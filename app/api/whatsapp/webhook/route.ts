import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import {
  verifyWebhookSignature,
  extractInboundMessages,
  messageText,
  normalizePhone,
  sendText,
} from '@/lib/whatsapp'
import { generateReply, type AgentTurn } from '@/lib/fiestago-agent'

// El webhook recibe datos externos (Meta) y llama a Claude → forzamos runtime
// Node.js y ejecución dinámica.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ─── GET: verificación del webhook (handshake de Meta) ───────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge ?? '', { status: 200 })
  }
  return new NextResponse('Forbidden', { status: 403 })
}

// ─── POST: mensajes entrantes ────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  // 1) Cuerpo CRUDO para verificar la firma (no usar req.json() antes de esto).
  const rawBody = await req.text()
  const signature = req.headers.get('x-hub-signature-256')

  if (!verifyWebhookSignature(rawBody, signature)) {
    return new NextResponse('Invalid signature', { status: 401 })
  }

  let payload: any
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return new NextResponse('Bad payload', { status: 400 })
  }

  const messages = extractInboundMessages(payload)
  if (messages.length === 0) {
    // Puede ser un evento de estado (entregado/leído) u otra cosa: 200 y fuera.
    return NextResponse.json({ ok: true })
  }

  const supabase = createAdminClient()

  for (const msg of messages) {
    try {
      await handleInbound(supabase, msg)
    } catch (err) {
      // No reventamos el webhook por un mensaje: log y seguimos. Devolver 200
      // evita que Meta reintente en bucle.
      console.error('[whatsapp webhook] error procesando mensaje', msg.id, err)
    }
  }

  return NextResponse.json({ ok: true })
}

async function handleInbound(supabase: any, msg: any) {
  const fromNumber = normalizePhone(msg.from)
  const body = messageText(msg)

  // 1) Localizar al proveedor por su número (heurística: últimos 9 dígitos).
  const provider = fromNumber ? await findProviderByPhone(supabase, fromNumber) : null

  // 2) Guardar el mensaje entrante. wa_message_id es UNIQUE → si ya existía
  //    (reintento de Meta), no lo reprocesamos para no responder dos veces.
  const { error: insertErr } = await supabase.from('whatsapp_messages').insert({
    wa_message_id: msg.id,
    direction: 'inbound',
    from_number: fromNumber,
    to_number: process.env.WHATSAPP_PHONE_NUMBER_ID ?? null,
    type: msg.type ?? 'text',
    body,
    payload: msg,
    status: 'received',
    provider_id: provider?.id ?? null,
  })

  if (insertErr) {
    if ((insertErr as any).code === '23505') return // duplicado: ya procesado
    throw insertErr
  }

  // 3) Si no hay proveedor conocido, lo dejamos en la bandeja sin auto-responder.
  if (!provider) {
    console.warn('[whatsapp webhook] mensaje de número no asociado a proveedor:', fromNumber)
    return
  }

  // 4) Reconstruir el historial de la conversación con este proveedor.
  const { data: rows } = await supabase
    .from('whatsapp_messages')
    .select('direction, body, created_at')
    .eq('provider_id', provider.id)
    .order('created_at', { ascending: true })

  const history: AgentTurn[] = (rows ?? [])
    .filter((r: any) => r.body)
    .map((r: any) => ({
      role: r.direction === 'inbound' ? 'user' : 'assistant',
      text: r.body as string,
    }))

  // 5) El agente genera la respuesta.
  let reply: string
  try {
    reply = await generateReply({
      provider: {
        name: provider.name,
        category: provider.category,
        city: provider.city,
        social_handle: provider.social_handle,
      },
      history,
    })
  } catch (err: any) {
    console.error('[whatsapp webhook] Claude generateReply falló:', err?.message)
    // Persistir el error en BD para poder diagnosticar desde Supabase.
    await supabase.from('whatsapp_messages').insert({
      wa_message_id: null,
      direction: 'outbound',
      from_number: process.env.WHATSAPP_PHONE_NUMBER_ID ?? null,
      to_number: fromNumber,
      type: 'text',
      body: `[ERROR Claude] ${String(err?.message || err).slice(0, 500)}`,
      status: 'failed_claude',
      provider_id: provider.id,
    })
    return
  }

  if (!reply) {
    await supabase.from('whatsapp_messages').insert({
      direction: 'outbound', from_number: process.env.WHATSAPP_PHONE_NUMBER_ID ?? null,
      to_number: fromNumber, type: 'text',
      body: '[ERROR Claude] devolvió respuesta vacía',
      status: 'failed_empty', provider_id: provider.id,
    })
    return
  }

  // 6) Enviar por WhatsApp (dentro de la ventana de 24h, texto libre permitido).
  let waId: string
  try {
    waId = await sendText(fromNumber!, reply)
  } catch (err: any) {
    console.error('[whatsapp webhook] sendText falló:', err?.message)
    await supabase.from('whatsapp_messages').insert({
      wa_message_id: null,
      direction: 'outbound',
      from_number: process.env.WHATSAPP_PHONE_NUMBER_ID ?? null,
      to_number: fromNumber,
      type: 'text',
      body: `[ERROR sendText] ${String(err?.message || err).slice(0, 500)}\n\n--- Claude generó ---\n${reply.slice(0, 800)}`,
      status: 'failed_send',
      provider_id: provider.id,
    })
    return
  }

  // 7) Guardar el saliente.
  await supabase.from('whatsapp_messages').insert({
    wa_message_id: waId || null,
    direction: 'outbound',
    from_number: process.env.WHATSAPP_PHONE_NUMBER_ID ?? null,
    to_number: fromNumber,
    type: 'text',
    body: reply,
    status: 'sent',
    provider_id: provider.id,
  })
}

// Busca un proveedor cuyo phone u outreach_whatsapp contenga los últimos 9
// dígitos del número entrante.
async function findProviderByPhone(supabase: any, normalized: string) {
  const last9 = normalized.slice(-9)
  const { data } = await supabase
    .from('providers')
    .select('id, name, category, city, social_handle, phone, outreach_whatsapp')
    .or(`phone.ilike.%${last9}%,outreach_whatsapp.ilike.%${last9}%`)
    .limit(1)
  return data?.[0] ?? null
}
