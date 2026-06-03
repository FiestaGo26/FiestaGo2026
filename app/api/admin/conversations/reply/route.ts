import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { generateConversationReply, type ConversationMessage } from '@/lib/conversation-ai'

export const runtime = 'nodejs'
export const maxDuration = 30
export const dynamic = 'force-dynamic'

function checkAuth(req: NextRequest) {
  return req.headers.get('x-admin-password') === process.env.ADMIN_PASSWORD
}

// POST /api/admin/conversations/reply
//   body: { conversation_id, incoming }
//
// Genera un borrador de respuesta usando Claude Haiku basándose en el
// historial completo de la conversación + el último mensaje del proveedor
// (`incoming`). NO marca el mensaje como enviado — solo devuelve el texto.
// El admin lo copia, lo pega en WhatsApp/IG, lo envía manualmente, y
// luego pulsa "Guardar respuesta enviada" para registrarlo en BD.
export async function POST(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const conversationId = body.conversation_id as string
  const incoming       = (body.incoming || '').toString().trim()
  if (!conversationId) return NextResponse.json({ error: 'conversation_id requerido' }, { status: 400 })
  if (!incoming)       return NextResponse.json({ error: 'incoming (texto del proveedor) requerido' }, { status: 400 })

  const supabase = createAdminClient()

  // Cargar conversación + proveedor
  const { data: conv, error } = await supabase
    .from('provider_conversations')
    .select(`
      id, channel, messages,
      providers ( id, name, city, category, email, website )
    `)
    .eq('id', conversationId)
    .single()

  if (error || !conv) {
    return NextResponse.json({ error: error?.message || 'Conversación no encontrada' }, { status: 404 })
  }

  const provider = (conv as any).providers
  if (!provider) {
    return NextResponse.json({ error: 'Proveedor asociado no encontrado' }, { status: 404 })
  }

  const history = (conv.messages as ConversationMessage[]) || []
  const channel = conv.channel as 'whatsapp' | 'instagram' | 'email' | 'other'

  // Llama a Claude
  const result = await generateConversationReply(
    {
      name:     provider.name,
      city:     provider.city,
      category: provider.category,
      email:    provider.email,
      website:  provider.website,
    },
    channel,
    history,
    incoming,
  )
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 })

  // Guardamos el mensaje del proveedor (incoming) en el historial AHORA
  // para que la conversación quede registrada aunque el admin nunca pulse
  // "guardar respuesta". El borrador NO se guarda — eso lo hace el admin
  // cuando confirme que lo envió.
  const newIncomingMsg = {
    role:    'them',
    content: incoming.slice(0, 4000),
    at:      new Date().toISOString(),
  }
  const updatedHistory = [...history, newIncomingMsg]
  await supabase
    .from('provider_conversations')
    .update({
      messages:        updatedHistory,
      last_message_at: newIncomingMsg.at,
      updated_at:      newIncomingMsg.at,
      status:          'active',
    })
    .eq('id', conversationId)

  return NextResponse.json({
    draft:   result.text,
    history: updatedHistory,
  })
}
