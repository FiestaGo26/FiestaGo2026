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

// ─── Envío de texto libre (solo válido dentro de la ventana de 24h) ──────────
export async function sendText(to: string, body: string): Promise<string> {
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

  // Auto-retry defensivo: si Meta devuelve "param count mismatch" (132000)
  // porque la plantilla esperaba 0 params y le mandamos N, reintenta sin
  // params. Hace el sistema resistente a configuración incorrecta de
  // WHATSAPP_TEMPLATE_HAS_PARAMS y a actualizaciones de plantillas en Meta.
  const errMsg = JSON.stringify(data?.error ?? data ?? {})
  if (!res.ok && /132000|number of localizable_params|expected number of params/i.test(errMsg)) {
    payload = buildPayload(false)
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
export type WhatsappInboundMessage = {
  from: string // número del remitente (proveedor)
  id: string // wa message id
  timestamp: string
  type: string // 'text' | 'image' | 'button' | ...
  text?: { body: string }
  button?: { text?: string; payload?: string }
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

// Devuelve el texto legible de un mensaje entrante (texto o botón).
export function messageText(msg: WhatsappInboundMessage): string {
  if (msg.type === 'text') return msg.text?.body ?? ''
  if (msg.type === 'button') return msg.button?.text ?? msg.button?.payload ?? ''
  return `[${msg.type}]`
}
