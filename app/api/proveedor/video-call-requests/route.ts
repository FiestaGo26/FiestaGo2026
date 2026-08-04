import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requireProviderAuth } from '@/lib/auth'

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
  return NextResponse.json({ requests: data || [] })
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
    .select('id, provider_id, jitsi_url')
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
  return NextResponse.json({ request: data, ok: true })
}

// Genera una URL Jitsi única a partir del id de la solicitud (determinista
// para que si el proveedor pulsa varias veces sin cambiar url, salga la
// misma sala).
function autoJitsiUrl(request_id: string): string {
  const suffix = String(request_id).replace(/-/g, '').slice(0, 20)
  return `https://meet.jit.si/fiestago-preventa-${suffix}`
}
