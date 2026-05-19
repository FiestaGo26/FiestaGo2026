import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requireClientAuth, isAdminRequest } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const VALID_TYPES = ['cancelled_by_provider','no_show','quality','wrong_service','payment','other']

// Calcula deadline SLA según la proximidad del evento:
//  · evento ya pasó      → 4h
//  · evento en <7 días   → 12h
//  · evento en <30 días  → 24h
//  · resto               → 72h
function computeSLA(eventDate: string | null): string {
  const now = new Date()
  const event = eventDate ? new Date(eventDate) : null
  let hours = 72
  if (event && !isNaN(event.getTime())) {
    const daysUntil = Math.floor((event.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
    if (daysUntil < 0)       hours = 4
    else if (daysUntil < 7)  hours = 12
    else if (daysUntil < 30) hours = 24
  }
  return new Date(now.getTime() + hours * 60 * 60 * 1000).toISOString()
}

// POST /api/incidents
// body: { booking_id, type, description, evidence_urls? }
// El llamante debe ser el cliente de la reserva (auth Supabase).
export async function POST(req: NextRequest) {
  const supabase = createAdminClient()
  const body = await req.json().catch(() => ({}))
  const { booking_id, type, description, evidence_urls } = body || {}

  if (!booking_id || !type || !description) {
    return NextResponse.json({ error: 'booking_id, type y description requeridos' }, { status: 400 })
  }
  if (!VALID_TYPES.includes(type)) {
    return NextResponse.json({ error: 'Tipo de incidencia no válido' }, { status: 400 })
  }
  if (description.length < 20) {
    return NextResponse.json({ error: 'La descripción debe tener al menos 20 caracteres' }, { status: 400 })
  }

  // Cargar la reserva para validar
  const { data: booking } = await supabase
    .from('bookings')
    .select('id, client_email, provider_id, event_date, status')
    .eq('id', booking_id).maybeSingle()
  if (!booking) return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 })

  // Solo el cliente o admin puede reportar
  const auth = await requireClientAuth(req, booking.client_email)
  if (!auth.ok) return auth.response

  // No duplicar: si ya hay una incidencia open/investigating para esta
  // reserva, redirigir a esa
  const { data: existing } = await supabase
    .from('incidents').select('id')
    .eq('booking_id', booking_id)
    .in('status', ['open', 'investigating'])
    .maybeSingle()
  if (existing) {
    return NextResponse.json({ error: 'Ya hay una incidencia abierta para esta reserva. Espera nuestra respuesta o escríbenos a contacto@fiestago.es.' }, { status: 409 })
  }

  const { data, error } = await supabase
    .from('incidents')
    .insert({
      booking_id,
      reporter_role:  'client',
      reporter_email: booking.client_email,
      type,
      description:    description.trim().slice(0, 5000),
      evidence_urls:  Array.isArray(evidence_urls) ? evidence_urls.slice(0, 10) : [],
      status:         'open',
      sla_target_at:  computeSLA(booking.event_date),
    })
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Notificación al admin (la tabla notifications ya existe y se ve en /admin)
  await supabase.from('notifications').insert({
    type:    'new_incident',
    title:   `🚨 Incidencia nueva · ${type}`,
    message: description.slice(0, 160),
    data:    { incident_id: data.id, booking_id, type },
    action_url: `/admin?incident=${data.id}`,
  }).then(() => {})

  return NextResponse.json({ incident: data }, { status: 201 })
}

// GET /api/incidents
// - Admin (x-admin-password): lista todas, opcionalmente ?status=open|investigating|resolved|rejected
// - Cliente autenticado: lista las de sus reservas (?email=)
export async function GET(req: NextRequest) {
  const supabase = createAdminClient()
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const email  = searchParams.get('email')

  if (isAdminRequest(req)) {
    let q = supabase.from('incidents')
      .select('*, bookings(id, client_name, client_email, event_date, total_amount, provider_id, providers(name))')
      .order('created_at', { ascending: false })
    if (status) q = q.eq('status', status)
    const { data, error } = await q
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Stats agregadas
    const { data: all } = await supabase.from('incidents').select('status')
    const stats: Record<string, number> = { open: 0, investigating: 0, resolved: 0, rejected: 0 }
    for (const s of (all || [])) stats[s.status] = (stats[s.status] || 0) + 1

    return NextResponse.json({ incidents: data || [], stats })
  }

  // Acceso del propio cliente
  const auth = await requireClientAuth(req, email)
  if (!auth.ok) return auth.response

  const { data: mine, error } = await supabase
    .from('incidents')
    .select('*, bookings!inner(client_email, event_date, providers(name))')
    .eq('bookings.client_email', email!)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ incidents: mine || [] })
}
