import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import {
  verifyWebhookSignature,
  extractInboundMessages,
  extractStatusEvents,
  messageText,
  categorizeInbound,
  normalizePhone,
  sendText,
  InvalidPhoneError,
  downloadWhatsappMedia,
  transcribeAudio,
  type WhatsappStatusEvent,
} from '@/lib/whatsapp'
import { generateReply, countPlazasConSelloRestantes, type AgentTurn } from '@/lib/fiestago-agent'

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

// ─── POST: mensajes entrantes + eventos de estado ────────────────────────────
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

  const supabase = createAdminClient()

  // 2. Procesar eventos de ESTADO (sent/delivered/read/failed).
  const statuses = extractStatusEvents(payload)
  for (const st of statuses) {
    try {
      await handleStatus(supabase, st)
    } catch (err) {
      console.error('[whatsapp webhook] error procesando status', st.id, err)
    }
  }

  // 3. Procesar mensajes ENTRANTES.
  const messages = extractInboundMessages(payload)
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

// ─── Status outbound: actualiza la fila del mensaje saliente ────────────────
//
// Códigos típicos de error de Meta cuando el destinatario no es válido:
//   131000 — Generic user error
//   131026 — Receiver is incapable of receiving this message
//   131056 — Couldn't deliver message
// Marcar como whatsapp_invalid solo con códigos claros de número malo.
async function handleStatus(supabase: any, st: WhatsappStatusEvent) {
  const status = String(st.status || '').toLowerCase()
  const tsIso  = st.timestamp ? new Date(Number(st.timestamp) * 1000).toISOString() : new Date().toISOString()
  const update: Record<string, any> = {}

  if (status === 'sent')      update.status = 'sent'
  if (status === 'delivered') { update.delivered_at = tsIso; update.status = 'delivered' }
  if (status === 'read')      { update.read_at      = tsIso; update.status = 'read' }
  if (status === 'failed')    {
    update.failed_at    = tsIso
    update.status       = 'failed'
    const firstErr = st.errors?.[0]
    if (firstErr) {
      update.error_code   = firstErr.code ?? null
      update.error_detail = (firstErr.title || firstErr.message || JSON.stringify(firstErr)).slice(0, 500)
    }
  }

  if (Object.keys(update).length === 0) return

  const { data: outRow } = await supabase
    .from('whatsapp_messages')
    .select('id, provider_id, to_number')
    .eq('wa_message_id', st.id)
    .maybeSingle()

  if (!outRow) {
    console.warn('[whatsapp webhook] status para wa_id desconocido:', st.id, status)
    return
  }

  await supabase.from('whatsapp_messages').update(update).eq('id', outRow.id)

  // Si el fallo apunta a número inexistente, marcar al proveedor para no
  // reintentar y que la UI deje de mostrar el botón "Enviar".
  if (status === 'failed' && outRow.provider_id) {
    const code = update.error_code
    const isBadNumber = code === 131026 || code === 131056 || code === 131000
    if (isBadNumber) {
      await supabase.from('providers').update({
        whatsapp_invalid:        true,
        whatsapp_invalid_reason: `Meta error ${code}: ${update.error_detail || 'sin detalle'}`.slice(0, 500),
      }).eq('id', outRow.provider_id)
    }
  }
}

async function handleInbound(supabase: any, msg: any) {
  const fromNumber = normalizePhone(msg.from)
  const category   = categorizeInbound(msg)

  // 0) Si el mensaje es de AUDIO y tenemos Whisper, intentar transcribir
  //    ANTES de guardar — la transcripción va en `body` para que el agente
  //    razone con texto natural en lugar de "[audio]".
  let body = messageText(msg)
  let transcriptionUsed = false
  if (category === 'audio' && msg.audio?.id && process.env.OPENAI_API_KEY) {
    const media = await downloadWhatsappMedia(msg.audio.id)
    if (media) {
      const transcript = await transcribeAudio(media)
      if (transcript) {
        body = `🎙 ${transcript}`
        transcriptionUsed = true
      }
    }
  }

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
    status: transcriptionUsed ? 'received_transcribed' : 'received',
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

  // 3b) Si es 'contacts', guardamos los teléfonos en agent_notes para revisión.
  if (category === 'contact') {
    const phones = (msg.contacts || [])
      .flatMap((c: any) => (c.phones || []).map((p: any) => p.wa_id || p.phone))
      .filter(Boolean)
    if (phones.length > 0) {
      const note = `[Contacto recibido por WhatsApp ${new Date().toISOString().slice(0,16)}]: ${phones.join(', ')}`
      const { data: cur } = await supabase
        .from('providers').select('agent_notes').eq('id', provider.id).single()
      const merged = [(cur?.agent_notes || ''), note].filter(Boolean).join('\n').slice(0, 2000)
      await supabase.from('providers').update({ agent_notes: merged }).eq('id', provider.id)
    }
  }

  // 3c) Multimedia (visual / audio sin Whisper / other): responder con
  //     cortesía pidiendo texto y marcar para revisión del admin.
  const needsCourtesy =
    category === 'visual' ||
    (category === 'audio' && !transcriptionUsed) ||
    category === 'other'

  if (needsCourtesy && fromNumber) {
    const courtesy = category === 'audio'
      ? '¡Gracias por el mensaje! 🙏 ¿Me lo puedes poner por escrito y te cuento los detalles?'
      : category === 'visual'
        ? '¡Gracias por compartirlo! No puedo abrir adjuntos por aquí. ¿Me lo cuentas en un mensaje de texto y seguimos?'
        : '¡Gracias! ¿Me lo puedes poner por escrito y te cuento los detalles?'

    try {
      const waId = await sendText(fromNumber, courtesy)
      await supabase.from('whatsapp_messages').insert({
        wa_message_id: waId || null,
        direction:     'outbound',
        from_number:   process.env.WHATSAPP_PHONE_NUMBER_ID ?? null,
        to_number:     fromNumber,
        type:          'text',
        body:          courtesy,
        status:        'sent',
        provider_id:   provider.id,
      })
    } catch (err: any) {
      if (err instanceof InvalidPhoneError) {
        await markProviderInvalidWhatsapp(supabase, provider.id, `Número no E.164 válido: "${fromNumber}"`)
      } else {
        console.error('[whatsapp webhook] cortesía sendText falló:', err?.message)
      }
    }
    await supabase.from('providers').update({ tag: 'WhatsApp · revisar adjunto' }).eq('id', provider.id)
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

  // 5) El agente genera la respuesta. Calculamos las plazas con sello
  //    una sola vez y se las pasamos al cerebro (cupo de 100 - aprobados).
  const plazasConSello = await countPlazasConSelloRestantes()
  let reply: string
  try {
    reply = await generateReply({
      provider: {
        name: provider.name,
        category: provider.category,
        city: provider.city,
        social_handle: provider.social_handle,
      },
      plazasConSello,
      history,
    })
  } catch (err: any) {
    console.error('[whatsapp webhook] Claude generateReply falló:', err?.message)
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
    if (err instanceof InvalidPhoneError) {
      await markProviderInvalidWhatsapp(supabase, provider.id, `Número no E.164 válido: "${fromNumber}"`)
      await supabase.from('whatsapp_messages').insert({
        direction: 'outbound', from_number: process.env.WHATSAPP_PHONE_NUMBER_ID ?? null,
        to_number: fromNumber, type: 'text',
        body: `[ERROR número inválido] no se envía respuesta — proveedor marcado whatsapp_invalid`,
        status: 'failed_invalid_phone', provider_id: provider.id,
      })
      return
    }
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

// Marca un proveedor como WhatsApp inválido para no reintentar.
async function markProviderInvalidWhatsapp(supabase: any, providerId: string, reason: string) {
  try {
    await supabase
      .from('providers')
      .update({
        whatsapp_invalid:        true,
        whatsapp_invalid_reason: reason.slice(0, 500),
      })
      .eq('id', providerId)
  } catch (err) {
    console.error('[whatsapp webhook] markProviderInvalidWhatsapp falló:', (err as any)?.message)
  }
}
