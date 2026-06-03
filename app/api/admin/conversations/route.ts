import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function checkAuth(req: NextRequest) {
  return req.headers.get('x-admin-password') === process.env.ADMIN_PASSWORD
}

// GET /api/admin/conversations
//   ?status=active  (default)
// Lista conversaciones con datos del proveedor.
export async function GET(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const url = new URL(req.url)
  const status = url.searchParams.get('status') || 'active'

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('provider_conversations')
    .select(`
      id, provider_id, channel, status, messages,
      created_at, updated_at, last_message_at,
      providers ( id, name, city, category, phone, email, website, instagram )
    `)
    .eq('status', status)
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .limit(200)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Calcular para cada conversación cuántos mensajes hay y de quién es el último
  const enriched = (data || []).map((c: any) => {
    const msgs = (c.messages || []) as any[]
    const last = msgs[msgs.length - 1] || null
    return {
      ...c,
      messageCount: msgs.length,
      lastMessage:  last ? {
        role:    last.role,
        content: last.content?.slice(0, 200) || '',
        at:      last.at,
      } : null,
    }
  })

  return NextResponse.json({ conversations: enriched })
}

// POST /api/admin/conversations
//   body: { provider_id, channel, initialMessage?, role? }
// Crea (o reactiva) una conversación con el proveedor por canal.
// Si initialMessage está, lo añade al historial. role default: 'us'.
export async function POST(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { provider_id, channel, initialMessage, role = 'us' } = body
  if (!provider_id) return NextResponse.json({ error: 'provider_id requerido' }, { status: 400 })
  if (!['whatsapp', 'instagram', 'email', 'other'].includes(channel)) {
    return NextResponse.json({ error: 'channel inválido' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // ¿Existe ya una conversación activa para este (provider, channel)?
  const { data: existing } = await supabase
    .from('provider_conversations')
    .select('id, messages')
    .eq('provider_id', provider_id)
    .eq('channel', channel)
    .in('status', ['active', 'paused'])
    .maybeSingle()

  const newMsg = initialMessage ? {
    role:    role === 'them' ? 'them' : 'us',
    content: String(initialMessage).slice(0, 4000),
    at:      new Date().toISOString(),
  } : null

  if (existing) {
    if (newMsg) {
      const updated = [...(existing.messages as any[]), newMsg]
      await supabase
        .from('provider_conversations')
        .update({
          messages:        updated,
          status:          'active',
          last_message_at: newMsg.at,
          updated_at:      newMsg.at,
        })
        .eq('id', existing.id)
    }
    return NextResponse.json({ id: existing.id, reused: true })
  }

  const messages = newMsg ? [newMsg] : []
  const { data: created, error } = await supabase
    .from('provider_conversations')
    .insert({
      provider_id,
      channel,
      messages,
      status:          'active',
      last_message_at: newMsg?.at || null,
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: created.id, reused: false })
}

// PATCH /api/admin/conversations
//   body: { id, status?, addMessage? }
// Actualiza estado o añade un mensaje al historial.
export async function PATCH(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { id, status, addMessage } = body
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  const supabase = createAdminClient()
  const updates: any = { updated_at: new Date().toISOString() }
  if (status && ['active', 'won', 'lost', 'paused'].includes(status)) updates.status = status

  if (addMessage && addMessage.content) {
    const { data: current } = await supabase
      .from('provider_conversations')
      .select('messages')
      .eq('id', id)
      .single()
    const msgs = (current?.messages || []) as any[]
    const newMsg = {
      role:            addMessage.role === 'them' ? 'them' : 'us',
      content:         String(addMessage.content).slice(0, 4000),
      at:              new Date().toISOString(),
      generated_by_ai: !!addMessage.generated_by_ai,
    }
    updates.messages = [...msgs, newMsg]
    updates.last_message_at = newMsg.at
  }

  const { error } = await supabase
    .from('provider_conversations')
    .update(updates)
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
