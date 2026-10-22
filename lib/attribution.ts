// ───────────────────────────────────────────────────────────────────────
// Atribución: de dónde viene cada proveedor, email y reserva.
//
// Al entrar en la web guardamos las utm_* (y el referrer) en
// localStorage: el primer contacto ("first") no se pisa nunca y el último
// ("last") se actualiza en cada visita con utm. Los formularios mandan
// ese objeto como `acquisition` y la API lo guarda tal cual, saneado.
//
// El Agente CEO etiqueta sus enlaces con utm_campaign = slug del
// experimento, así puede medir qué experimento trajo cada alta.
// ───────────────────────────────────────────────────────────────────────

export type Touch = {
  utm_source?:   string
  utm_medium?:   string
  utm_campaign?: string
  utm_content?:  string
  utm_term?:     string
  landing?:      string
  referrer?:     string
  at?:           string
}
export type Acquisition = { first?: Touch; last?: Touch }

const KEY = 'fg_acquisition'
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const

/** Navegador: registra la visita actual. Llamar una vez por carga de página. */
export function captureTouch() {
  if (typeof window === 'undefined') return
  try {
    const url = new URL(window.location.href)
    const touch: Touch = {}
    for (const k of UTM_KEYS) {
      const v = url.searchParams.get(k)
      if (v) touch[k] = v.slice(0, 100)
    }
    const ref = document.referrer && !document.referrer.startsWith(window.location.origin) ? document.referrer : ''
    // Sin utm ni referrer externo es navegación interna: no es un "toque".
    if (!touch.utm_source && !touch.utm_campaign && !ref) return
    if (!touch.utm_source && ref) {
      touch.utm_source = new URL(ref).hostname.replace(/^www\./, '')
      touch.utm_medium = 'referral'
    }
    touch.landing  = url.pathname.slice(0, 200)
    touch.referrer = ref.slice(0, 200)
    touch.at       = new Date().toISOString()

    const prev: Acquisition = JSON.parse(localStorage.getItem(KEY) || '{}')
    localStorage.setItem(KEY, JSON.stringify({ first: prev.first || touch, last: touch }))
  } catch { /* modo privado o storage bloqueado: sin atribución */ }
}

/** Navegador: lo que se manda junto al formulario. */
export function getAcquisition(): Acquisition | undefined {
  if (typeof window === 'undefined') return undefined
  try {
    const a = JSON.parse(localStorage.getItem(KEY) || 'null')
    return a && (a.first || a.last) ? a : undefined
  } catch {
    return undefined
  }
}

/** Servidor: valida lo que llega del cliente antes de guardarlo. */
export function sanitizeAcquisition(raw: unknown): Acquisition | null {
  if (!raw || typeof raw !== 'object') return null
  const clean = (t: any): Touch | undefined => {
    if (!t || typeof t !== 'object') return undefined
    const out: Touch = {}
    for (const k of [...UTM_KEYS, 'landing', 'referrer', 'at'] as const) {
      if (typeof t[k] === 'string' && t[k]) out[k] = t[k].slice(0, 200)
    }
    return Object.keys(out).length ? out : undefined
  }
  const a = raw as any
  const res: Acquisition = { first: clean(a.first), last: clean(a.last) }
  return res.first || res.last ? res : null
}

/** Añade utm a un enlace de fiestago.es (para posts, emails y anuncios). */
export function tagUrl(url: string, t: { source: string; medium: string; campaign: string; content?: string }) {
  try {
    const u = new URL(url)
    u.searchParams.set('utm_source', t.source)
    u.searchParams.set('utm_medium', t.medium)
    u.searchParams.set('utm_campaign', t.campaign)
    if (t.content) u.searchParams.set('utm_content', t.content)
    return u.toString()
  } catch {
    return url
  }
}
