import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { sendWhatsAppText } from '@/lib/whatsapp'

export const runtime = 'nodejs'
export const maxDuration = 30
export const dynamic = 'force-dynamic'

function checkAuth(req: NextRequest) {
  return req.headers.get('x-admin-password') === process.env.ADMIN_PASSWORD
}

// GET /api/admin/conversations
//   ?provider_id=...  → devuelve el hilo completo de un proveedor
//   (sin params)      → lista los proveedores con conversación activa/escalada
export async function GET(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const supabase = createAdminClient()
  const providerId = req.nextUrl.searchParams.get('provider_id')

  if (providerId) {
    const { data: provider } = await supabase
      .from('providers')
      .select('id, name, city, category, whatsapp, phone, conversation_status, conversation_intent, last_inbound_at, last_outbound_at')
      .eq('id', providerId)
      .single()
    const { data: messages } = await supabase
      .from('provider_conversations')
      .select('*')
      .eq('provider_id', providerId)
      .order('created_at', { ascending: true })
    // Marcar como leído al abrir el hilo
    await supabase.from('providers').update({ conversation_unread: 0 }).eq('id', providerId)
    return NextResponse.json({ provider, messages: messages || [] })
  }

  // Listado: proveedores con alguna conversación, escalados primero.
  const { data: threads } = await supabase
    .from('providers')
    .select('id, name, city, category, whatsapp, conversation_status, conversation_intent, conversation_unread, last_inbound_at, last_outbound_at')
    .in('conversation_status', ['active', 'escalated', 'registered'])
    .order('last_inbound_at', { ascending: false, nullsFirst: false })
    .limit(100)

  const stats = {
    escalated:  (threads || []).filter((t: any) => t.conversation_status === 'escalated').length,
    active:     (threads || []).filter((t: any) => t.conversation_status === 'active').length,
    registered: (threads || []).filter((t: any) => t.conversation_status === 'registered').length,
  }
  return NextResponse.json({ threads: threads || [], stats })
}

// POST /api/admin/conversations
//   body: { provider_id, body, resolve?: boolean }
//   Envía un mensaje (respuesta aprobada por el admin o inicio de conversación)
//   por WhatsApp y lo guarda en el hilo. Si resolve=true, baja el estado a 'active'.
export async function POST(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const supabase = createAdminClient()

  const { provider_id, body, resolve } = await req.json().catch(() => ({}))
  if (!provider_id || !body?.trim()) {
    return NextResponse.json({ error: 'Faltan provider_id o body' }, { status: 400 })
  }

  const { data: provider } = await supabase
    .from('providers')
    .select('id, name, whatsapp, phone')
    .eq('id', provider_id)
    .single()
  if (!provider) return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 })

  const dest = provider.whatsapp || provider.phone
  if (!dest) return NextResponse.json({ error: 'El proveedor no tiene número de WhatsApp/teléfono' }, { status: 400 })

  const send = await sendWhatsAppText(dest, body.trim())

  await supabase.from('provider_conversations').insert({
    provider_id,
    channel:      'whatsapp',
    direction:    'out',
    body:         body.trim(),
    ai_generated: false,
    autosent:     false,
    needs_human:  false,
    wa_message_id: send.id || null,
    reason:       'Enviado manualmente por el admin',
  })

  if (send.ok) {
    await supabase.from('providers').update({
      last_outbound_at:    new Date().toISOString(),
      conversation_unread: 0,
      conversation_status: resolve ? 'active' : undefined,
    }).eq('id', provider_id)
  }

  return NextResponse.json({ ok: send.ok, error: send.error })
}
