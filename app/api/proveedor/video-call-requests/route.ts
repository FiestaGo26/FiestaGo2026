import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requireProviderAuth } from '@/lib/auth'
import { maskContacts } from '@/lib/date-holds'
import { sendEmail } from '@/lib/resend'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/proveedor/video-call-requests?providerId=X
// Lista las solicitudes de videollamada del proveedor.
export async function GET(req: NextRequest) {
  const providerId = new URL(req.url).searchParams.get('providerId')
  const auth = await requireProviderAuth(req, providerId)
  if (!auth.ok) return auth.response

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('video_call_requests')
    .select('*')
    .eq('provider_id', auth.data.id)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  // Sin datos de contacto del cliente: la llamada se hace por el enlace que
  // le enviamos desde FiestaGo (la venta se queda dentro de la plataforma)
  const requests = (data || []).map((r: any) => ({
    ...r,
    client_name: String(r.client_name || '').trim().split(/\s+/)[0] || 'Cliente',
    client_email: null, client_phone: null,
    reason: r.reason ? maskContacts(r.reason) : null,
  }))
  return NextResponse.json({ requests })
}

// PATCH /api/proveedor/video-call-requests
// Body: { providerId, request_id, action: 'propose'|'complete'|'cancel',
//         jitsi_url?, proposed_at? }
//
// action='propose' → status='proposed', se genera jitsi_url si no viene
// action='complete' → status='completed' (para que sepamos que la llamada
//                     de verdad ocurrió)
// action='cancel'   → status='cancelled'
export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { providerId, request_id, action, jitsi_url, proposed_at } = body || {}

  const auth = await requireProviderAuth(req, providerId)
  if (!auth.ok) return auth.response

  if (!request_id || !action) {
    return NextResponse.json({ error: 'request_id y action requeridos' }, { status: 400 })
  }
  if (!['propose', 'complete', 'cancel'].includes(action)) {
    return NextResponse.json({ error: 'action no válida' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Verificar que la solicitud es de este proveedor.
  const { data: existing } = await supabase
    .from('video_call_requests')
    .select('id, provider_id, jitsi_url, client_name, client_email, providers(name)')
    .eq('id', request_id).maybeSingle()
  if (!existing || existing.provider_id !== auth.data.id) {
    return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 })
  }

  const update: Record<string, any> = {
    updated_at:   new Date().toISOString(),
    responded_at: new Date().toISOString(),
  }
  if (action === 'propose') {
    update.status = 'proposed'
    update.jitsi_url = jitsi_url || existing.jitsi_url || autoJitsiUrl(request_id)
    if (proposed_at) update.proposed_at = proposed_at
  } else if (action === 'complete') {
    update.status = 'completed'
  } else if (action === 'cancel') {
    update.status = 'cancelled'
  }

  const { data, error } = await supabase
    .from('video_call_requests')
    .update(update)
    .eq('id', request_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Al proponer, FiestaGo envía al cliente el enlace y la hora
  if (action === 'propose' && existing.client_email) {
    const prov: any = Array.isArray((existing as any).providers) ? (existing as any).providers[0] : (existing as any).providers
    const when = data.proposed_at
      ? new Date(data.proposed_at).toLocaleString('es-ES', { timeZone: 'Europe/Madrid', weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
      : null
    await sendEmail({
      to: existing.client_email,
      subject: `📹 Videollamada con ${prov?.name || 'tu proveedor'} · FiestaGo`,
      text: `Hola ${existing.client_name},\n\n${prov?.name || 'El proveedor'} te propone una videollamada${when ? ` el ${when}` : ''}. Entra desde este enlace (no hace falta instalar nada):\n\n${data.jitsi_url}\n\nSi esa hora no te va bien, contesta a este email y lo movemos.\n\nFiestaGo`,
    }).catch(() => {})
  }
  return NextResponse.json({ request: data, ok: true })
}

// Genera una URL Jitsi única a partir del id de la solicitud (determinista
// para que si el proveedor pulsa varias veces sin cambiar url, salga la
// misma sala).
function autoJitsiUrl(request_id: string): string {
  const suffix = String(request_id).replace(/-/g, '').slice(0, 20)
  return `https://meet.jit.si/fiestago-preventa-${suffix}`
}
