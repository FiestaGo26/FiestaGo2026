import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/video-call-requests
// Endpoint PÚBLICO (sin auth). Lo llama el modal de la ficha pública del
// proveedor cuando un cliente potencial pide videollamada previa.
//
// body: { provider_id, client_name, client_email, client_phone?,
//         reason?, preferred_slot? }
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const {
    provider_id, client_name, client_email, client_phone,
    reason, preferred_slot,
  } = body || {}

  if (!provider_id || !client_name || !client_email) {
    return NextResponse.json({ error: 'provider_id, client_name y client_email requeridos' }, { status: 400 })
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(client_email))) {
    return NextResponse.json({ error: 'Email no válido' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Verificar que el proveedor existe, está aprobado y ofrece videollamada.
  // Sin este check se podrían crear solicitudes fantasma a proveedores que
  // desactivaron la opción o no están aprobados.
  const { data: prov } = await supabase
    .from('providers')
    .select('id, name, email, offers_video_call, status')
    .eq('id', provider_id)
    .maybeSingle()
  if (!prov || prov.status !== 'approved') {
    return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 })
  }
  if (!prov.offers_video_call) {
    return NextResponse.json({ error: 'Este proveedor no ofrece videollamadas' }, { status: 400 })
  }

  // Anti-spam ligero: evitar que el mismo cliente cree >5 solicitudes al
  // mismo proveedor en las últimas 24h.
  const { count: recentCount } = await supabase
    .from('video_call_requests')
    .select('id', { count: 'exact', head: true })
    .eq('provider_id', provider_id)
    .eq('client_email', client_email)
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60_000).toISOString())
  if ((recentCount || 0) >= 5) {
    return NextResponse.json({ error: 'Ya has enviado varias solicitudes hoy — el proveedor te contactará pronto.' }, { status: 429 })
  }

  const { data: request, error } = await supabase
    .from('video_call_requests')
    .insert({
      provider_id,
      client_name:  String(client_name).trim().slice(0, 120),
      client_email: String(client_email).trim().toLowerCase().slice(0, 200),
      client_phone: client_phone ? String(client_phone).trim().slice(0, 40) : null,
      reason:       reason ? String(reason).trim().slice(0, 500) : null,
      preferred_slot: preferred_slot ? String(preferred_slot).trim().slice(0, 200) : null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Notificación en la campana del proveedor (aparece en /admin y también
  // en el panel del proveedor porque leemos notifications por provider_id
  // cuando exista esa vinculación en el futuro).
  await supabase.from('notifications').insert({
    type:       'video_call_request',
    title:      `📹 Nuevo cliente pide videollamada · ${client_name}`,
    message:    `${prov.name}: ${client_name} (${client_email}) quiere hablar antes de reservar.${preferred_slot ? ` Prefiere: ${preferred_slot}` : ''}`,
    data:       { request_id: request.id, provider_id, client_email },
    action_url: `/proveedor/panel?tab=video-calls`,
  })

  return NextResponse.json({ request, ok: true }, { status: 201 })
}
