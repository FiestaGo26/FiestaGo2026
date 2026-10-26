import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requireProviderAuth } from '@/lib/auth'
import { maskContacts } from '@/lib/date-holds'
import { sendEmail } from '@/lib/resend'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Peticiones de clientes (presupuestos y fechas bloqueadas 48 h) para el
// panel del proveedor. Nunca devuelve email ni teléfono del cliente: el
// proveedor responde aquí y FiestaGo se lo envía al cliente. Así la venta
// no se cierra fuera de la plataforma (los datos se ven al pagar la señal).

// GET /api/proveedor/requests?provider_id=...
export async function GET(req: NextRequest) {
  const providerId = new URL(req.url).searchParams.get('provider_id')
  const auth = await requireProviderAuth(req, providerId)
  if (!auth.ok) return auth.response

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('date_holds')
    .select('id, created_at, kind, status, service_id, event_date, expires_at, client_name, event_type, guests, message, provider_reply, replied_at')
    .eq('provider_id', providerId!)
    .in('kind', ['hold', 'quote'])
    .gte('created_at', new Date(Date.now() - 90 * 86400_000).toISOString())
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const requests = (data || []).map((r: any) => ({
    ...r,
    client_name: String(r.client_name || '').trim().split(/\s+/)[0] || 'Cliente',
    message: r.message ? maskContacts(r.message) : null,
  }))
  return NextResponse.json({ requests })
}

// POST /api/proveedor/requests — body: { provider_id, id, reply }
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const auth = await requireProviderAuth(req, body.provider_id)
  if (!auth.ok) return auth.response

  const reply = String(body.reply || '').trim().slice(0, 3000)
  if (!body.id || reply.length < 5) return NextResponse.json({ error: 'Escribe tu respuesta' }, { status: 400 })

  const supabase = createAdminClient()
  const { data: hold } = await supabase
    .from('date_holds')
    .select('id, provider_id, client_name, client_email, kind, event_date, providers(name, slug)')
    .eq('id', body.id).maybeSingle()
  if (!hold || hold.provider_id !== body.provider_id) {
    return NextResponse.json({ error: 'Petición no encontrada' }, { status: 404 })
  }

  const safeReply = maskContacts(reply)
  await supabase.from('date_holds')
    .update({ provider_reply: safeReply, replied_at: new Date().toISOString() })
    .eq('id', hold.id)

  const prov: any = Array.isArray(hold.providers) ? hold.providers[0] : hold.providers
  const fichaUrl = `${(process.env.NEXT_PUBLIC_APP_URL || 'https://fiestago.es').replace(/\/$/, '')}/proveedores/${prov?.slug || hold.provider_id}`
  await sendEmail({
    to: hold.client_email,
    subject: `${prov?.name || 'Tu proveedor'} te ha respondido · FiestaGo`,
    text: `Hola ${hold.client_name},\n\n${prov?.name || 'El proveedor'} te responde:\n\n"${safeReply}"\n\nSi te encaja, bloquea tu fecha 48 h gratis o reserva con una señal desde su ficha: ${fichaUrl}\nTodos los servicios llevan la Garantía de Éxito incluida y tu pago queda retenido en Stripe hasta que termina tu evento (la garantía solo cubre lo que se reserva y paga dentro de FiestaGo).\n\n¿Dudas? Responde a este email o escríbenos por WhatsApp.\n\nFiestaGo`,
  }).catch(() => {})

  return NextResponse.json({ ok: true })
}
