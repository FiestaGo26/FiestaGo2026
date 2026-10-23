// ───────────────────────────────────────────────────────────────────────
// Upload-Post: publica en Instagram y TikTok y lee las métricas de cada
// publicación. Sustituye a Metricool (mismo resultado por bastante menos).
//
// API (sacada del SDK oficial `upload-post`):
//   Base     https://api.upload-post.com/api
//   Auth     Authorization: Apikey <UPLOADPOST_API_KEY>
//   POST     /upload          (vídeo: campo `video`, admite URL)
//   POST     /upload_photos   (fotos: `photos[]`, admiten URL)
//   GET      /uploadposts/status?request_id=…
//   GET      /uploadposts/post-analytics/<request_id>
//
// Variables de entorno (Netlify):
//   UPLOADPOST_API_KEY    clave de la API
//   UPLOADPOST_USER       nombre del perfil en Upload-Post (p. ej. "fiestago")
//   UPLOADPOST_PLATFORMS  opcional, por defecto "instagram,tiktok"
// ───────────────────────────────────────────────────────────────────────

const API = 'https://api.upload-post.com/api'

export function isUploadPostConfigured() {
  return !!(process.env.UPLOADPOST_API_KEY && process.env.UPLOADPOST_USER)
}

function platforms(): string[] {
  return (process.env.UPLOADPOST_PLATFORMS || 'instagram,tiktok')
    .split(',').map(s => s.trim()).filter(Boolean)
}

async function call(path: string, init: { method?: string; body?: FormData; query?: Record<string, string>; idempotencyKey?: string } = {}) {
  const url = new URL(API + path)
  for (const [k, v] of Object.entries(init.query || {})) url.searchParams.set(k, v)
  const res = await fetch(url, {
    method: init.method || 'GET',
    headers: {
      Authorization: `Apikey ${process.env.UPLOADPOST_API_KEY}`,
      ...(init.idempotencyKey ? { 'Idempotency-Key': init.idempotencyKey } : {}),
    },
    body: init.body,
  })
  const text = await res.text()
  let data: any
  try { data = JSON.parse(text) } catch { data = { raw: text.slice(0, 500) } }
  if (!res.ok || data?.success === false) {
    throw new Error(`Upload-Post ${res.status}: ${data?.message || data?.detail || data?.error || text.slice(0, 200)}`)
  }
  return data
}

export type PublishInput = {
  /** Texto para Instagram (pie de foto completo, con hashtags). */
  captionInstagram: string
  /** Texto para TikTok (más corto). */
  captionTiktok: string
  /** Clave para no publicar dos veces lo mismo si se reintenta. */
  idempotencyKey: string
}

// TikTok limita el título a 90 caracteres contando cada emoji como 2.
// Usamos la primera frase sin emojis (≤ 80) como título y el texto
// completo va en la descripción.
const EMOJI = new RegExp('\\p{Extended_Pictographic}|\\uFE0F|\\u200D', 'gu')
export function tiktokTitle(text: string, max = 80) {
  // Primera frase: corta en signo de cierre, salto de línea o emoji
  const first = text.replace(EMOJI, '\n').split(/[.!?\n]/).map(t => t.replace(/\s+/g, ' ').trim()).find(Boolean) || ''
  if (first.length <= max) return first
  const cut = first.slice(0, max - 1)
  const sp = cut.lastIndexOf(' ')
  return `${(sp > 40 ? cut.slice(0, sp) : cut).trim()}…`
}

function commonForm(input: PublishInput) {
  const form = new FormData()
  form.append('user', process.env.UPLOADPOST_USER!)
  const ps = platforms()
  ps.forEach(p => form.append('platform[]', p))
  form.append('title', input.captionInstagram.slice(0, 2200))
  if (ps.includes('instagram')) form.append('instagram_title', input.captionInstagram.slice(0, 2200))
  if (ps.includes('tiktok')) {
    form.append('tiktok_title', tiktokTitle(input.captionTiktok))
    form.append('tiktok_description', input.captionTiktok.slice(0, 2200))
    form.append('privacy_level', 'PUBLIC_TO_EVERYONE')
    // Contenido generado con IA: TikTok exige declararlo
    form.append('tiktok_is_ai_generated', 'true')
  }
  form.append('async_upload', 'true')
  return form
}

/** Publica una o varias imágenes (carrusel si son varias). */
export async function publishPhotos(urls: string[], input: PublishInput) {
  const form = commonForm(input)
  urls.forEach(u => form.append('photos[]', u))
  if (platforms().includes('tiktok')) form.append('auto_add_music', 'true')
  return call('/upload_photos', { method: 'POST', body: form, idempotencyKey: input.idempotencyKey })
}

/** Publica un vídeo vertical (Reel en Instagram). */
export async function publishVideo(url: string, input: PublishInput) {
  const form = commonForm(input)
  form.append('video', url)
  if (platforms().includes('instagram')) form.append('media_type', 'REELS')
  return call('/upload', { method: 'POST', body: form, idempotencyKey: input.idempotencyKey })
}

export async function getUploadStatus(requestId: string) {
  return call('/uploadposts/status', { query: { request_id: requestId } })
}

export type PostMetrics = { views: number; likes: number; comments: number; shares: number; saves: number; reach: number; new_followers: number }

/**
 * Métricas de una publicación (suma de todas las redes). La forma exacta
 * depende de la red, así que buscamos los campos por nombre en todo el JSON.
 */
export async function getPostMetrics(requestId: string): Promise<{ total: PostMetrics; raw: any }> {
  const raw = await call(`/uploadposts/post-analytics/${encodeURIComponent(requestId)}`)
  const total: PostMetrics = { views: 0, likes: 0, comments: 0, shares: 0, saves: 0, reach: 0, new_followers: 0 }
  const KEYS: Record<string, keyof PostMetrics> = {
    views: 'views', view_count: 'views', video_views: 'views', plays: 'views', play_count: 'views', impressions: 'views',
    likes: 'likes', like_count: 'likes',
    comments: 'comments', comment_count: 'comments', comments_count: 'comments',
    shares: 'shares', share_count: 'shares',
    saved: 'saves', saves: 'saves',
    reach: 'reach',
    new_followers: 'new_followers', follows: 'new_followers',
  }
  // Una entrada por red: cogemos el primer valor de cada métrica en cada una
  const perPlatform: any[] = []
  const collect = (node: any) => {
    if (!node || typeof node !== 'object') return
    if (node.post_metrics && typeof node.post_metrics === 'object') { perPlatform.push(node.post_metrics); return }
    for (const v of Object.values(node)) collect(v)
  }
  collect(raw)
  const sources = perPlatform.length ? perPlatform : [raw]
  for (const src of sources) {
    const seen = new Set<keyof PostMetrics>()
    for (const [k, v] of Object.entries(src || {})) {
      const m = KEYS[k.toLowerCase()]
      if (!m || seen.has(m)) continue
      const n = Number(v)
      if (Number.isFinite(n)) { total[m] += n; seen.add(m) }
    }
  }
  return { total, raw }
}

/** URLs públicas de cada red a partir de la respuesta de estado. */
export function extractUrls(status: any): Record<string, string> {
  const out: Record<string, string> = {}
  const walk = (node: any, platform?: string) => {
    if (!node || typeof node !== 'object') return
    const p = node.platform || node.name || platform
    const url = node.post_url || node.url || node.permalink
    if (p && typeof url === 'string' && url.startsWith('http')) out[String(p)] = url
    for (const [k, v] of Object.entries(node)) walk(v, ['instagram', 'tiktok'].includes(k) ? k : p)
  }
  walk(status)
  return out
}
