import crypto from 'crypto'

// ─── WhatsApp Cloud API helper ───────────────────────────────────────────────
//
// Docs: https://developers.facebook.com/docs/whatsapp/cloud-api
//
// Variables de entorno necesarias (ver .env.example):
//   WHATSAPP_PHONE_NUMBER_ID  — ID del número emisor (Meta → WhatsApp → API Setup)
//   WHATSAPP_TOKEN            — token permanente del System User
//   WHATSAPP_APP_SECRET       — App Secret (para verificar la firma del webhook)
//   WHATSAPP_VERIFY_TOKEN     — cadena que tú eliges para validar el webhook
//   WHATSAPP_GRAPH_VERSION    — opcional, por defecto 'v21.0'
//   WHATSAPP_OUTREACH_TEMPLATE — nombre de la plantilla de captación aprobada
//   WHATSAPP_TEMPLATE_LANG    — idioma de la plantilla, por defecto 'es'

const GRAPH_VERSION = process.env.WHATSAPP_GRAPH_VERSION || 'v21.0'

function cfg() {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  const token = process.env.WHATSAPP_TOKEN
  if (!phoneNumberId || !token) {
    throw new Error('Faltan WHATSAPP_PHONE_NUMBER_ID o WHATSAPP_TOKEN en el entorno')
  }
  return { phoneNumberId, token }
}

// ─── Normalización de números ────────────────────────────────────────────────
// WhatsApp espera el número en formato E.164 sin '+', solo dígitos.
// Si el número parece español (9 dígitos) le anteponemos 34.
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null
  let digits = raw.replace(/[^\d]/g, '')
  if (!digits) return null
  if (digits.length === 9) digits = '34' + digits // móvil español sin prefijo
  return digits
}

// ─── Validación de número (E.164 España) ─────────────────────────────────────
// La BD del agente captura a veces IDs de redes sociales en el campo phone
// (ej. "653685262962060080", 18 dígitos). Esos envíos a Meta fallan o caen
// en buzones aleatorios. Filtra ANTES de enviar.
//
// Acepta:
//   · 9 dígitos empezando por 6/7/8/9 (móvil/fijo ES sin prefijo)
//   · 11 dígitos empezando por 34 + un primer dígito 6/7/8/9
//   · E.164 internacional razonable (8-15 dígitos, no empieza por 0/1)
//
// Rechaza explícitamente cadenas de 16+ dígitos (claros IDs de redes).
export function isValidPhoneE164ES(raw: string | null | undefined): boolean {
  if (!raw) return false
  const digits = String(raw).replace(/[^\d]/g, '')
  if (!digits) return false

  if (digits.length === 9 && /^[6789]/.test(digits)) return true
  if (digits.length === 11 && digits.startsWith('34') && /^[6789]/.test(digits.slice(2))) return true

  if (digits.length >= 10 && digits.length <= 15 && !/^[01]/.test(digits)) {
    if (digits.startsWith('34') && digits.length === 11) return false
    return true
  }

  return false
}

/**
 * Excepción que lanza sendText/sendTemplate cuando el `to` no es un número
 * de teléfono válido. El llamante debe capturarla y marcar al proveedor
 * para no reintentar.
 */
export class InvalidPhoneError extends Error {
  to: string
  constructor(to: string) {
    super(`Número no válido para WhatsApp: "${to}"`)
    this.name = 'InvalidPhoneError'
    this.to = to
  }
}

/**
 * Heurística estricta para "este número CASI seguro tiene WhatsApp".
 * WhatsApp solo funciona de forma fiable en móviles. En España los móviles
 * empiezan por 6 o 7. Los fijos (8/9) NO tienen WhatsApp salvo verificación
 * Business especial (muy raro en proveedores pequeños).
 *
 * Devuelve true para:
 *   · 9 dígitos empezando por 6 o 7
 *   · 11 dígitos 34 + 6/7
 *   · números internacionales razonables E.164 (asumimos móvil si encaja)
 * Devuelve false para fijos ES (8/9 nacionales) y todo lo basura.
 */
export function isMobilePhoneES(raw: string | null | undefined): boolean {
  if (!raw) return false
  const digits = String(raw).replace(/[^\d]/g, '')
  if (!digits) return false
  if (digits.length === 9 && /^[67]/.test(digits)) return true
  if (digits.length === 11 && digits.startsWith('34') && /^[67]/.test(digits.slice(2))) return true
  // Internacional no-ES: asumimos móvil si es E.164 razonable (8-15 dígitos,
  // no empieza por 0/1 ni por 34 con dígito raro).
  if (digits.length >= 10 && digits.length <= 15 && !/^[01]/.test(digits)) {
    if (digits.startsWith('34')) return false  // ES ya cubierto arriba
    return true
  }
  return false
}

/**
 * Devuelve true si el lead tiene al menos UNA vía WhatsApp clara:
 *   · Un wa.me/api.whatsapp link extraído de su web propia, o
 *   · Un teléfono que parece móvil (= alta probabilidad de WA).
 */
// Extrae el número detrás de una URL wa.me / api.whatsapp.com.
// Devuelve digits puros o null si no parece tener un número.
export function extractPhoneFromWaUrl(url: string | null | undefined): string | null {
  if (!url) return null
  const m = url.match(/wa\.me\/\+?(\d{8,15})|phone=\+?(\d{8,15})/i)
  const digits = m?.[1] || m?.[2] || ''
  return digits || null
}

export function hasValidWhatsapp(opts: {
  phone?: string | null
  outreach_whatsapp?: string | null
  whatsapp_url?: string | null
}): boolean {
  // wa.me URL: NO basta con que la cadena contenga "wa.me". Hay que
  // validar que el número detrás sea un móvil utilizable; si no, ese link
  // genera fallo 131026 en Meta o cae en un buzón cualquiera.
  const waPhone = extractPhoneFromWaUrl(opts.whatsapp_url)
  if (waPhone && isMobilePhoneES(waPhone)) return true
  if (isMobilePhoneES(opts.outreach_whatsapp)) return true
  if (isMobilePhoneES(opts.phone)) return true
  return false
}

// ─── Envío de texto libre (solo válido dentro de la ventana de 24h) ──────────
export async function sendText(to: string, body: string): Promise<string> {
  if (!isValidPhoneE164ES(to)) throw new InvalidPhoneError(to)
  const { phoneNumberId, token } = cfg()
  const res = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'text',
        text: { preview_url: false, body },
      }),
    }
  )
  const data = await res.json()
  if (!res.ok) {
    throw new Error(
      `WhatsApp sendText falló (${res.status}): ${JSON.stringify(data?.error ?? data)}`
    )
  }
  return data?.messages?.[0]?.id ?? ''
}

// ─── Envío de plantilla (única forma de iniciar conversación en frío) ────────
// La plantilla debe estar creada y APROBADA en Meta. Por defecto asumimos una
// plantilla con un parámetro de cuerpo {{1}} = nombre del proveedor.
//
// Para plantillas SIN parámetros (como 'hello_world' que viene pre-aprobada
// por defecto), se detecta automáticamente o se puede forzar con la env
// var WHATSAPP_TEMPLATE_HAS_PARAMS=false → no se incluyen components.
// Idiomas: 'hello_world' solo existe en en_US, no en español.
export async function sendTemplate(
  to: string,
  opts: {
    template?: string
    languageCode?: string
    bodyParams?: string[]
  } = {}
): Promise<string> {
  if (!isValidPhoneE164ES(to)) throw new InvalidPhoneError(to)
  const { phoneNumberId, token } = cfg()
  const template = opts.template || process.env.WHATSAPP_OUTREACH_TEMPLATE
  if (!template) {
    throw new Error(
      'Falta WHATSAPP_OUTREACH_TEMPLATE (nombre de la plantilla de captación aprobada en Meta)'
    )
  }
  // hello_world solo existe en en_US — forzamos el idioma correcto.
  const defaultLang =
    template === 'hello_world'
      ? 'en_US'
      : process.env.WHATSAPP_TEMPLATE_LANG || 'es'
  const languageCode = opts.languageCode || defaultLang

  // Plantillas que NO aceptan parámetros — no incluimos components.body.
  // Case-insensitive para tolerar valores "False", "FALSE", " false ".
  const envHasParamsFlag = (process.env.WHATSAPP_TEMPLATE_HAS_PARAMS || '').trim().toLowerCase()
  const templateHasNoParams =
    template === 'hello_world' ||
    envHasParamsFlag === 'false' ||
    envHasParamsFlag === '0' ||
    envHasParamsFlag === 'no'

  const buildPayload = (includeComponents: boolean) => ({
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'template',
    template: {
      name: template,
      language: { code: languageCode },
      ...(includeComponents && opts.bodyParams && opts.bodyParams.length
        ? {
            components: [
              {
                type: 'body',
                parameters: opts.bodyParams.map((text) => ({ type: 'text', text })),
              },
            ],
          }
        : {}),
    },
  })

  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }

  // Intento 1: con params si la plantilla los admite (o sin si la marca como sin).
  let payload = buildPayload(!templateHasNoParams)
  let res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(payload) })
  let data = await res.json()

  // Auto-retry defensivo bidireccional ante el error 132000 (param count
  // mismatch). Cubre los dos casos:
  //   (a) Plantilla espera 0 y mandamos N → reintenta sin components.
  //   (b) Plantilla espera N y mandamos 0 → reintenta CON components,
  //       siempre que tengamos bodyParams disponibles. Esto pilla el
  //       caso típico de tener WHATSAPP_TEMPLATE_HAS_PARAMS=false en
  //       Netlify de una plantilla antigua y haber cambiado a una nueva
  //       que sí requiere params.
  const errMsg = JSON.stringify(data?.error ?? data ?? {})
  const isParamMismatch =
    !res.ok &&
    /132000|number of localizable_params|expected number of params/i.test(errMsg)

  if (isParamMismatch) {
    // ¿La primera tentativa incluyó components?
    const firstHadComponents = !templateHasNoParams && !!opts.bodyParams?.length
    if (firstHadComponents) {
      // (a) Mandamos params, plantilla no los quería → retry sin.
      payload = buildPayload(false)
    } else if (opts.bodyParams && opts.bodyParams.length) {
      // (b) No mandamos params, plantilla los quería → retry con.
      payload = buildPayload(true)
    }
    res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(payload) })
    data = await res.json()
  }

  if (!res.ok) {
    throw new Error(
      `WhatsApp sendTemplate falló (${res.status}): ${JSON.stringify(data?.error ?? data)}`
    )
  }
  return data?.messages?.[0]?.id ?? ''
}

// ─── Verificación de la firma del webhook (X-Hub-Signature-256) ──────────────
// Meta firma el cuerpo crudo con HMAC-SHA256 usando el App Secret.
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null
): boolean {
  const appSecret = process.env.WHATSAPP_APP_SECRET
  if (!appSecret) {
    // Sin App Secret no podemos verificar; en producción esto debería estar
    // siempre configurado. Devolvemos false para no procesar datos no verificados.
    return false
  }
  if (!signatureHeader) return false

  const expected =
    'sha256=' +
    crypto.createHmac('sha256', appSecret).update(rawBody, 'utf8').digest('hex')

  const a = Buffer.from(signatureHeader)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

// ─── Tipos del payload entrante del webhook ──────────────────────────────────
// Versión extendida que cubre text, button, audio, image, document, video,
// sticker, location y contacts. El webhook diferencia el tratamiento de
// cada uno.
export type WhatsappInboundMessage = {
  from: string
  id: string
  timestamp: string
  type:
    | 'text' | 'button'
    | 'audio' | 'image' | 'video' | 'document' | 'sticker'
    | 'location' | 'contacts' | 'reaction' | 'interactive'
    | string
  text?:    { body: string }
  button?:  { text?: string; payload?: string }
  // Cloud API moderna: cuando el usuario pulsa un botón quick-reply de
  // una plantilla, llega como type='interactive' con button_reply.title
  // (el texto visible del botón) y .id (payload).
  interactive?: {
    type?:          'button_reply' | 'list_reply' | string
    button_reply?:  { id?: string; title?: string }
    list_reply?:    { id?: string; title?: string; description?: string }
  }
  audio?:   { id: string; mime_type?: string; voice?: boolean }
  image?:   { id: string; mime_type?: string; caption?: string; sha256?: string }
  video?:   { id: string; mime_type?: string; caption?: string }
  document?:{ id: string; mime_type?: string; filename?: string; caption?: string }
  sticker?: { id: string; mime_type?: string }
  location?:{ latitude: number; longitude: number; name?: string; address?: string }
  contacts?: Array<{
    name?:   { formatted_name?: string; first_name?: string }
    phones?: Array<{ phone?: string; wa_id?: string; type?: string }>
  }>
  reaction?:{ message_id: string; emoji?: string }
}

// Eventos de estado de mensajes salientes (sent/delivered/read/failed).
// Llegan en el mismo webhook bajo value.statuses[].
export type WhatsappStatusEvent = {
  id: string                                  // wa_message_id del OUTBOUND
  status: 'sent' | 'delivered' | 'read' | 'failed' | string
  timestamp: string
  recipient_id?: string
  errors?: Array<{ code?: number; title?: string; message?: string; error_data?: any }>
}

// Extrae los mensajes entrantes de un payload de webhook de WhatsApp.
export function extractInboundMessages(payload: any): WhatsappInboundMessage[] {
  const out: WhatsappInboundMessage[] = []
  const entries = payload?.entry ?? []
  for (const entry of entries) {
    for (const change of entry?.changes ?? []) {
      const value = change?.value
      for (const msg of value?.messages ?? []) {
        out.push(msg as WhatsappInboundMessage)
      }
    }
  }
  return out
}

// Extrae los eventos de status de mensajes salientes (entrega, lectura, error).
export function extractStatusEvents(payload: any): WhatsappStatusEvent[] {
  const out: WhatsappStatusEvent[] = []
  const entries = payload?.entry ?? []
  for (const entry of entries) {
    for (const change of entry?.changes ?? []) {
      const value = change?.value
      for (const st of value?.statuses ?? []) {
        out.push(st as WhatsappStatusEvent)
      }
    }
  }
  return out
}

// Devuelve el texto legible de un mensaje entrante.
// Para multimedia devuelve un marcador "[audio]" / "[image]" / etc. que el
// llamante (webhook) usará para decidir si pedir texto o transcribir.
export function messageText(msg: WhatsappInboundMessage): string {
  if (msg.type === 'text')   return msg.text?.body ?? ''
  if (msg.type === 'button') return msg.button?.text ?? msg.button?.payload ?? ''
  // Botones quick-reply de plantillas modernas (interactive.button_reply)
  // y respuestas a listas (list_reply). Devolvemos el TÍTULO visible del
  // botón pulsado — el cerebro lo procesa como cualquier texto entrante.
  if (msg.type === 'interactive') {
    if (msg.interactive?.button_reply?.title) return msg.interactive.button_reply.title
    if (msg.interactive?.list_reply?.title)   return msg.interactive.list_reply.title
    return msg.interactive?.button_reply?.id || msg.interactive?.list_reply?.id || ''
  }
  if (msg.type === 'image' && msg.image?.caption)       return msg.image.caption
  if (msg.type === 'video' && msg.video?.caption)       return msg.video.caption
  if (msg.type === 'document' && msg.document?.caption) return msg.document.caption
  if (msg.type === 'location') {
    const l = msg.location
    return l ? `[ubicación: ${l.latitude},${l.longitude}${l.address ? ` · ${l.address}` : ''}]` : '[ubicación]'
  }
  if (msg.type === 'contacts') {
    const phones = (msg.contacts || []).flatMap(c => c.phones || []).map(p => p.wa_id || p.phone).filter(Boolean)
    return phones.length ? `[contacto: ${phones.join(', ')}]` : '[contacto]'
  }
  if (msg.type === 'reaction') return `[reacción ${msg.reaction?.emoji ?? ''}]`
  return `[${msg.type}]`
}

// Categoriza el mensaje entrante para que el webhook decida cómo responder.
export type InboundCategory = 'text' | 'button' | 'audio' | 'visual' | 'contact' | 'other'
export function categorizeInbound(msg: WhatsappInboundMessage): InboundCategory {
  if (msg.type === 'text')   return 'text'
  if (msg.type === 'button') return 'button'
  if (msg.type === 'audio')  return 'audio'
  if (msg.type === 'image' || msg.type === 'video' || msg.type === 'document' || msg.type === 'sticker') return 'visual'
  if (msg.type === 'contacts') return 'contact'
  return 'other'
}

// ─── Descarga de media de WhatsApp ───────────────────────────────────────────
// Meta NO entrega el binario en el webhook — solo el media_id. Hay que hacer
// 2 saltos: 1) GET /<media_id> → devuelve {url}; 2) GET <url> con Bearer.
// Devuelve { buffer, mimeType } o null si falla.
export async function downloadWhatsappMedia(
  mediaId: string,
): Promise<{ buffer: Buffer; mimeType: string } | null> {
  const token = process.env.WHATSAPP_TOKEN
  if (!token) return null
  try {
    const metaRes = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${mediaId}`,
      { headers: { Authorization: `Bearer ${token}` } },
    )
    if (!metaRes.ok) return null
    const meta = await metaRes.json() as any
    const url      = meta?.url
    const mimeType = meta?.mime_type || 'application/octet-stream'
    if (!url) return null

    const binRes = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    if (!binRes.ok) return null
    const arr = new Uint8Array(await binRes.arrayBuffer())
    return { buffer: Buffer.from(arr), mimeType }
  } catch (err) {
    console.error('[whatsapp] downloadWhatsappMedia falló:', (err as any)?.message)
    return null
  }
}

// ─── Transcripción de audio (Whisper de OpenAI) ─────────────────────────────
// Si OPENAI_API_KEY está configurada, transcribe el audio. Si no, devuelve
// null para que el webhook caiga al fallback ("¿me lo pones por escrito?").
export async function transcribeAudio(
  audio: { buffer: Buffer; mimeType: string },
): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return null
  try {
    const form = new FormData()
    const blob = new Blob([new Uint8Array(audio.buffer)], { type: audio.mimeType || 'audio/ogg' })
    form.append('file', blob, audio.mimeType.includes('mpeg') ? 'audio.mp3' : 'audio.ogg')
    form.append('model', 'whisper-1')
    form.append('language', 'es')
    form.append('response_format', 'text')

    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    })
    if (!res.ok) {
      console.error('[whatsapp] transcribeAudio Whisper falló:', res.status, await res.text())
      return null
    }
    const text = (await res.text()).trim()
    return text || null
  } catch (err) {
    console.error('[whatsapp] transcribeAudio excepción:', (err as any)?.message)
    return null
  }
}
