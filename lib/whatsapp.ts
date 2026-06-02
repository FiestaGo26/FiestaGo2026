// ───────────────────────────────────────────────────────────────────────
// WhatsApp Cloud API (Meta) — envío de mensajes del agente conversacional.
//
// Variables de entorno necesarias (ver .env.example):
//   WHATSAPP_TOKEN          → token permanente de la app de Meta
//   WHATSAPP_PHONE_ID       → Phone Number ID del número de WhatsApp Business
//   WHATSAPP_VERIFY_TOKEN   → cadena secreta para verificar el webhook
//   WHATSAPP_GRAPH_VERSION  → opcional, por defecto v21.0
//
// Notas Meta:
//  · Mensajes de TEXTO libre solo se permiten dentro de la ventana de 24h
//    desde el último mensaje del usuario. Para iniciar fuera de ventana hay
//    que usar plantillas aprobadas (sendWhatsAppTemplate).
// ───────────────────────────────────────────────────────────────────────

const GRAPH_VERSION = process.env.WHATSAPP_GRAPH_VERSION || 'v21.0'

export function whatsappConfigured(): boolean {
  return !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID)
}

// Normaliza un teléfono a dígitos en formato internacional sin '+'.
// España por defecto: añade prefijo 34 si parece un móvil/fijo nacional.
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null
  let d = String(raw).replace(/[^\d]/g, '')
  if (!d) return null
  // quitar 00 inicial (prefijo internacional alternativo)
  if (d.startsWith('00')) d = d.slice(2)
  // número nacional español (9 dígitos, empieza por 6/7/8/9) → anteponer 34
  if (d.length === 9 && /^[6789]/.test(d)) d = '34' + d
  return d
}

type SendResult = { ok: boolean; id?: string; error?: string }

// Envía un mensaje de texto libre (requiere ventana de 24h abierta).
export async function sendWhatsAppText(to: string, body: string): Promise<SendResult> {
  const token   = process.env.WHATSAPP_TOKEN
  const phoneId = process.env.WHATSAPP_PHONE_ID
  if (!token || !phoneId) return { ok: false, error: 'WhatsApp no configurado (faltan WHATSAPP_TOKEN / WHATSAPP_PHONE_ID)' }

  const dest = normalizePhone(to)
  if (!dest) return { ok: false, error: 'Teléfono destino inválido' }

  try {
    const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${phoneId}/messages`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: dest,
        type: 'text',
        text: { preview_url: true, body },
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false, error: (data as any)?.error?.message || `HTTP ${res.status}` }
    return { ok: true, id: (data as any)?.messages?.[0]?.id }
  } catch (err: any) {
    return { ok: false, error: err.message || 'fetch error' }
  }
}

// Envía una plantilla aprobada (para iniciar conversación fuera de la
// ventana de 24h). `components` sigue el formato de la Graph API.
export async function sendWhatsAppTemplate(
  to: string,
  templateName: string,
  languageCode = 'es',
  components?: any[],
): Promise<SendResult> {
  const token   = process.env.WHATSAPP_TOKEN
  const phoneId = process.env.WHATSAPP_PHONE_ID
  if (!token || !phoneId) return { ok: false, error: 'WhatsApp no configurado' }

  const dest = normalizePhone(to)
  if (!dest) return { ok: false, error: 'Teléfono destino inválido' }

  try {
    const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${phoneId}/messages`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: dest,
        type: 'template',
        template: {
          name: templateName,
          language: { code: languageCode },
          ...(components ? { components } : {}),
        },
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false, error: (data as any)?.error?.message || `HTTP ${res.status}` }
    return { ok: true, id: (data as any)?.messages?.[0]?.id }
  } catch (err: any) {
    return { ok: false, error: err.message || 'fetch error' }
  }
}
