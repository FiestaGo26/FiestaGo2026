import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { generateReply, type ConvMessage } from '@/lib/conversation'
import { sendWhatsAppText, normalizePhone } from '@/lib/whatsapp'

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

// ── GET: verificación del webhook (Meta hace un handshake al configurarlo) ──
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams
  const mode      = params.get('hub.mode')
  const token     = params.get('hub.verify_token')
  const challenge = params.get('hub.challenge')

  if (mode === 'subscribe' && token && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    // Meta espera el challenge en texto plano
    return new NextResponse(challenge || '', { status: 200 })
  }
  return new NextResponse('Forbidden', { status: 403 })
}

// ── POST: mensajes entrantes ────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  let payload: any = {}
  try { payload = await req.json() } catch { /* noop */ }

  // Respondemos 200 rápido pase lo que pase: Meta reintenta si no.
  try {
    await handlePayload(payload)
  } catch (err: any) {
    console.error('[whatsapp/webhook] error:', err?.message)
  }
  return NextResponse.json({ received: true })
}

async function handlePayload(payload: any) {
  if (payload?.object !== 'whatsapp_business_account') return
  const supabase = createAdminClient()

  for (const entry of payload.entry || []) {
    for (const change of entry.changes || []) {
      const value = change.value || {}
      const contacts: any[] = value.contacts || []
      const messages: any[] = value.messages || []
      // Solo nos interesan mensajes de texto entrantes (ignoramos statuses)
      for (const msg of messages) {
        if (msg.type !== 'text' || !msg.text?.body) continue
        const fromPhone = normalizePhone(msg.from) || msg.from
        const waMsgId   = msg.id
        const body      = msg.text.body
        const profileName = contacts.find((c: any) => c.wa_id === msg.from)?.profile?.name || null

        await handleInbound(supabase, { fromPhone, waMsgId, body, profileName })
      }
    }
  }
}

async function handleInbound(
  supabase: any,
  { fromPhone, waMsgId, body, profileName }:
  { fromPhone: string; waMsgId: string; body: string; profileName: string | null },
) {
  // Dedupe: si ya procesamos este wa_message_id, salimos.
  if (waMsgId) {
    const { data: dup } = await supabase
      .from('provider_conversations')
      .select('id')
      .eq('wa_message_id', waMsgId)
      .maybeSingle()
    if (dup) return
  }

  // Localizar el proveedor por teléfono (whatsapp o phone). Comparamos por
  // los últimos 9 dígitos para tolerar diferencias de prefijo/formato.
  const tail = fromPhone.slice(-9)
  const { data: candidates } = await supabase
    .from('providers')
    .select('id, name, city, category, description, whatsapp, phone, conversation_status')
    .or(`whatsapp.ilike.%${tail}%,phone.ilike.%${tail}%`)
    .limit(1)
  const provider = candidates?.[0] || null

  // Guardar el mensaje entrante
  await supabase.from('provider_conversations').insert({
    provider_id:  provider?.id || null,
    channel:      'whatsapp',
    direction:    'in',
    body,
    wa_message_id: waMsgId || null,
    from_phone:   fromPhone,
  })

  if (provider) {
    await supabase.from('providers').update({
      last_inbound_at:     new Date().toISOString(),
      conversation_status: provider.conversation_status === 'escalated' ? 'escalated' : 'active',
      conversation_unread: 1,
      // si no teníamos el whatsapp guardado, lo fijamos
      ...(provider.whatsapp ? {} : { whatsapp: fromPhone }),
    }).eq('id', provider.id)
  }

  // Si el proveedor no se reconoce, escalamos a un humano (no auto-respondemos
  // a desconocidos para no exponer la marca).
  if (!provider) {
    await notifyAdmin(supabase, {
      title: '💬 WhatsApp de número desconocido',
      message: `${profileName || fromPhone}: "${body.slice(0, 120)}"`,
      data: { fromPhone, profileName },
    })
    return
  }

  // Cargar historial reciente del hilo (orden cronológico)
  const { data: hist } = await supabase
    .from('provider_conversations')
    .select('direction, body, created_at')
    .eq('provider_id', provider.id)
    .order('created_at', { ascending: true })
    .limit(30)
  const history: ConvMessage[] = (hist || []).map((m: any) => ({ direction: m.direction, body: m.body }))

  // Generar respuesta + decisión de la "red de seguridad"
  let decision
  try {
    decision = await generateReply(provider, history)
  } catch (err: any) {
    await escalate(supabase, provider, body, `Error generando respuesta: ${err.message}`)
    return
  }

  // Registrar intent detectado
  await supabase.from('providers')
    .update({ conversation_intent: decision.intent })
    .eq('id', provider.id)

  // Si el proveedor dice que ya se registró, marcamos y avisamos.
  if (decision.intent === 'register_intent') {
    await supabase.from('providers')
      .update({ conversation_status: 'registered' })
      .eq('id', provider.id)
  }

  if (decision.autosend && decision.reply) {
    const send = await sendWhatsAppText(provider.whatsapp || fromPhone, decision.reply)
    await supabase.from('provider_conversations').insert({
      provider_id:  provider.id,
      channel:      'whatsapp',
      direction:    'out',
      body:         decision.reply,
      ai_generated: true,
      autosent:     send.ok,
      intent:       decision.intent,
      needs_human:  false,
      reason:       decision.reason,
      wa_message_id: send.id || null,
    })
    if (send.ok) {
      await supabase.from('providers').update({
        last_outbound_at:    new Date().toISOString(),
        conversation_unread: 0,
      }).eq('id', provider.id)
    } else {
      // El envío falló → escalamos para que un humano lo retome
      await escalate(supabase, provider, body, `Fallo al enviar por WhatsApp: ${send.error}`)
    }
  } else {
    // Escalar: guardamos la respuesta sugerida como borrador para revisión.
    await supabase.from('provider_conversations').insert({
      provider_id:  provider.id,
      channel:      'whatsapp',
      direction:    'out',
      body:         decision.reply || '(sin borrador)',
      ai_generated: true,
      autosent:     false,
      intent:       decision.intent,
      needs_human:  true,
      reason:       decision.reason,
    })
    await escalate(supabase, provider, body, decision.reason || 'La IA marcó este caso para revisión humana.')
  }
}

async function escalate(supabase: any, provider: any, lastInbound: string, reason: string) {
  await supabase.from('providers').update({
    conversation_status: 'escalated',
    conversation_unread: 1,
  }).eq('id', provider.id)
  await notifyAdmin(supabase, {
    title: `🚨 Conversación a revisar · ${provider.name}`,
    message: `Motivo: ${reason}\nÚltimo mensaje: "${lastInbound.slice(0, 140)}"`,
    data: { provider_id: provider.id, reason },
    action_url: '/admin?section=conversaciones',
  })
}

async function notifyAdmin(
  supabase: any,
  { title, message, data, action_url }:
  { title: string; message: string; data?: any; action_url?: string },
) {
  await supabase.from('notifications').insert({
    type:       'conversation',
    title,
    message,
    data:       data || {},
    action_url: action_url || '/admin?section=conversaciones',
  })
}
