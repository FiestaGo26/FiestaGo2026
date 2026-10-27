// ───────────────────────────────────────────────────────────────────────
// Publicador automático de Instagram/TikTok (vía Upload-Post) y lector de
// métricas. Lo llama GitHub Actions (workflow social.yml) cada pocas horas.
//
//   publishNext() → elige UNA pieza (vídeo diario o post de la cola), la
//                   pasa por la revisión de marca y la publica.
//   syncMetrics() → trae visualizaciones, likes, etc. de lo publicado en
//                   los últimos 30 días; el CEO las usa para aprender.
//
// Reglas: tope diario (ceo_settings.social_max_per_day), interruptor
// social_autopublish, pausa global del CEO, y solo contenido reciente
// (nada de vaciar la cola antigua con fechas o mensajes caducados).
// ───────────────────────────────────────────────────────────────────────

import Anthropic from '@anthropic-ai/sdk'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getCeoSettings } from '@/lib/ceo-actions'
import { AUDIENCES, isUploadPostConfigured, profileFor, publishPhotos, publishVideo, getPostMetrics, getUploadStatus, extractUrls, type Audience } from '@/lib/uploadpost'

const REVIEW_MODEL = process.env.SOCIAL_REVIEW_MODEL || 'claude-haiku-5-5'
const MAX_ATTEMPTS = 3
const MIN_GAP_HOURS = 3

function madridDayStartIso() {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Madrid' })
  return new Date(`${today}T00:00:00+02:00`).toISOString()
}
const daysAgo = (d: number) => new Date(Date.now() - d * 86400_000).toISOString()

// ─── Revisión de marca ────────────────────────────────────────────

type Review = { ok: boolean; reasons: string[]; caption_instagram: string; caption_tiktok: string }

const REVIEW_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['ok', 'reasons', 'caption_instagram', 'caption_tiktok'],
  properties: {
    ok: { type: 'boolean' },
    reasons: { type: 'array', items: { type: 'string' } },
    caption_instagram: { type: 'string' },
    caption_tiktok: { type: 'string' },
  },
} as const

const AUDIENCE_RULE: Record<Audience, string> = {
  clientes: 'Esta pieza va a la cuenta de CLIENTES (parejas, familias y personas que organizan una celebración en cualquier parte de España). Rechaza si habla a profesionales o proveedores (alta, cuotas, conseguir clientes, registrarse como proveedor). A los clientes no se les habla del 8 % ni de comisiones: la Garantía de Éxito FiestaGo va incluida en el precio de todos los servicios; si el texto menciona el 8 %, quítalo y devuelve la versión corregida.',
  proveedores: 'Esta pieza va a la cuenta de PROVEEDORES (fotógrafos, catering, música, animación…). Rechaza si habla a clientes finales en lugar de a profesionales.',
}

async function reviewCaption(captionIg: string, captionTt: string, context: string, audience: Audience): Promise<Review> {
  const today = new Date().toLocaleDateString('es-ES', { timeZone: 'Europe/Madrid', day: 'numeric', month: 'long', year: 'numeric' })
  const resp = await new Anthropic().messages.create({
    model: REVIEW_MODEL,
    // Devuelve los dos textos completos corregidos: con 2000 se cortaba
    // ("Unterminated string in JSON") y no se publicaba nada.
    max_tokens: 6000,
    output_config: { format: { type: 'json_schema', schema: REVIEW_SCHEMA as unknown as Record<string, unknown> } },
    system: `Revisas publicaciones de Instagram y TikTok de FiestaGo (fiestago.es), un marketplace español de proveedores para bodas, cumpleaños, comuniones y eventos, antes de que se publiquen solas. Hoy es ${today}.
${AUDIENCE_RULE[audience]}
Rechaza (ok=false) si el texto:
- inventa cifras, testimonios, reseñas, clientes, premios o nombres de proveedores;
- menciona fechas, lanzamientos o promociones ya pasadas (por ejemplo el lanzamiento del 10 de junio de 2026) o sorteos;
- promete algo que FiestaGo no ofrece, habla mal de un competidor por su nombre o puede resultar ofensivo;
- no está en español de España.
Datos verdaderos que sí puede usar: alta gratis para profesionales sin cuotas ni permanencia; el proveedor cobra el 100 % de su precio y el 8 % lo paga el cliente como Garantía de Éxito FiestaGo (ya incluido en el precio que ve el cliente); si el proveedor cancela se busca un sustituto equivalente (mismas funciones, precio similar) en 48 h y, si no lo hay, se devuelve el 110 %; si no se presenta, el 100 % más una compensación según el importe de la reserva (300 € hasta 500 €; 500 € de 500 a 2.000 €; 1.000 € de 2.000 a 5.000 €; 2.000 € de 5.000 a 15.000 €; 3.000 € por encima). Si el texto da un ejemplo con cifras, la compensación tiene que ser la de su tramo; si no cuadra, corrígela; pago retenido en Stripe (entidad de pagos regulada) hasta el evento; abierto a celebraciones en toda España; proveedores verificados (se comprueba DNI/CIF y seguro de responsabilidad civil); precio cerrado sin pedir presupuestos; detrás está Mariano González, el fundador, y se puede preguntar por WhatsApp antes de reservar (contesta una persona de lunes a viernes de 10:00 a 20:00 y los sábados de 10:00 a 14:00). No anuncies que fuera de horario contesta un asistente o un bot.
Consejos generales del sector sin cifras concretas son aceptables; las cifras de mercado sin fuente no.
Si el texto es aceptable pero mejorable (erratas, emojis excesivos, hashtags de más de 12), devuelve ok=true con la versión corregida. Si lo rechazas, explica por qué en "reasons" y devuelve los textos tal cual. En TikTok el texto debe ser corto (máximo unos 300 caracteres). En ambos, si hay llamada a la acción con enlace, usa "enlace en la bio" en lugar de una URL.`,
    messages: [{ role: 'user', content: `Contexto: ${context}\n\n[Instagram]\n${captionIg}\n\n[TikTok]\n${captionTt}` }],
  })
  if (resp.stop_reason === 'max_tokens') throw new Error('Revisión de marca cortada (max_tokens)')
  const text = resp.content.filter((b): b is Anthropic.TextBlock => b.type === 'text').map(b => b.text).join('')
  return JSON.parse(text) as Review
}

// ─── Publicar ─────────────────────────────────────────────────────

/**
 * Publica una pieza por cada público con cuenta conectada (clientes en las
 * cuentas de siempre, proveedores en las nuevas). Si la revisión rechaza
 * una, prueba con la siguiente (máx. 3 por público).
 */
export async function publishNext(supabase: SupabaseClient) {
  const out: Record<string, any> = {}
  for (const audience of AUDIENCES) {
    const user = profileFor(audience)
    if (!user) { out[audience] = { skipped: `Sin perfil de Upload-Post para ${audience}${audience === 'proveedores' ? ' (UPLOADPOST_USER_PRO)' : ' (UPLOADPOST_USER)'}` }; continue }
    const tried: any[] = []
    for (let i = 0; i < 3; i++) {
      const r = await publishOne(supabase, audience, user)
      tried.push(r)
      if (!('rejected' in r)) break
    }
    out[audience] = tried.length === 1 ? tried[0] : { steps: tried, ...tried[tried.length - 1] }
  }
  return out
}

async function publishOne(supabase: SupabaseClient, audience: Audience, user: string): Promise<Record<string, any>> {
  const settings: any = await getCeoSettings(supabase)
  if (settings.paused) return { skipped: 'Agente CEO en pausa' }
  if (settings.social_autopublish === false) return { skipped: 'Publicación automática desactivada' }

  // Tope diario por público (cada par de cuentas tiene el suyo)
  const since = madridDayStartIso()
  const [{ count: postsToday }, { count: videosToday }] = await Promise.all([
    supabase.from('social_posts').select('id', { count: 'exact', head: true }).eq('audience', audience).gte('published_at', since).not('uploadpost_request_id', 'is', null),
    supabase.from('content_videos').select('id', { count: 'exact', head: true }).eq('audience', audience).gte('published_at', since).not('uploadpost_request_id', 'is', null),
  ])
  const cap = Number(settings.social_max_per_day ?? 2)
  if ((postsToday || 0) + (videosToday || 0) >= cap) return { skipped: `Tope diario alcanzado (${cap})` }

  // Separación mínima entre publicaciones de la misma cuenta (el latido
  // llama cada 10 min; GitHub sigue de respaldo)
  const gapSince = new Date(Date.now() - MIN_GAP_HOURS * 3600_000).toISOString()
  const [{ count: recentPosts }, { count: recentVideos }] = await Promise.all([
    supabase.from('social_posts').select('id', { count: 'exact', head: true }).eq('audience', audience).gte('published_at', gapSince).not('uploadpost_request_id', 'is', null),
    supabase.from('content_videos').select('id', { count: 'exact', head: true }).eq('audience', audience).gte('published_at', gapSince).not('uploadpost_request_id', 'is', null),
  ])
  if ((recentPosts || 0) + (recentVideos || 0) > 0) return { skipped: `Ya se publicó en las últimas ${MIN_GAP_HOURS} h` }

  // 1 · Vídeo diario terminado (más alcance que una imagen)
  const { data: video } = await supabase.from('content_videos')
    .select('id, caption, hashtags, topic, video_url, publish_attempts, experiment')
    .eq('audience', audience)
    .eq('heygen_status', 'completed').not('video_url', 'is', null)
    .is('published_at', null).lt('publish_attempts', MAX_ATTEMPTS)
    .gte('created_at', daysAgo(3))
    .order('created_at', { ascending: true }).limit(1).maybeSingle()

  if (video) {
    const caption = [video.caption, (video.hashtags || []).map((h: string) => `#${h.replace(/^#/, '')}`).join(' ')].filter(Boolean).join('\n\n')
    await supabase.from('content_videos').update({ publish_attempts: (video.publish_attempts || 0) + 1 }).eq('id', video.id)
    let review: Review
    try {
      review = await reviewCaption(caption, caption.slice(0, 300), `Vídeo diario: ${video.topic || ''}`, audience)
    } catch (err: any) {
      await supabase.from('content_videos').update({ publish_error: `Revisión: ${err.message}`.slice(0, 500) }).eq('id', video.id)
      return { error: `Revisión: ${err.message}`, id: video.id }
    }
    if (!review.ok) {
      await supabase.from('content_videos').update({ publish_error: `Revisión: ${review.reasons.join('; ')}`, publish_attempts: MAX_ATTEMPTS }).eq('id', video.id)
      return { rejected: 'video', id: video.id, reasons: review.reasons }
    }
    try {
      const res = await publishVideo(video.video_url, { user, captionInstagram: review.caption_instagram, captionTiktok: review.caption_tiktok, idempotencyKey: `video-${video.id}` })
      await supabase.from('content_videos').update({
        uploadpost_request_id: res.request_id || null, published_at: new Date().toISOString(),
        published_channels: ['instagram', 'tiktok'], publish_error: null,
      }).eq('id', video.id)
      return { published: 'video', id: video.id, request_id: res.request_id }
    } catch (err: any) {
      await supabase.from('content_videos').update({ publish_error: String(err.message).slice(0, 500) }).eq('id', video.id)
      return { error: err.message, id: video.id }
    }
  }

  // 2 · Post de la cola: primero los de experimentos del CEO, luego el resto reciente
  const { data: posts } = await supabase.from('social_posts')
    .select('id, media_url, media_type, caption_instagram, caption_tiktok, hashtags, topic, context, publish_attempts')
    .eq('audience', audience)
    .in('status', ['pending', 'approved']).not('media_url', 'is', null)
    .is('uploadpost_request_id', null).lt('publish_attempts', MAX_ATTEMPTS)
    .gte('created_at', daysAgo(7))
    .order('created_at', { ascending: true }).limit(20)
  const post = (posts || []).sort((a: any, b: any) => (b.context?.experiment ? 1 : 0) - (a.context?.experiment ? 1 : 0))[0]
  if (!post) return { skipped: 'Nada nuevo que publicar' }

  const tags = (post.hashtags || []).map((h: string) => `#${h.replace(/^#/, '')}`).join(' ')
  const ig = [post.caption_instagram, tags].filter(Boolean).join('\n\n')
  const tt = post.caption_tiktok || post.caption_instagram || ''
  await supabase.from('social_posts').update({ publish_attempts: (post.publish_attempts || 0) + 1 }).eq('id', post.id)

  let review: Review
  try {
    review = await reviewCaption(ig, tt, `Post: ${post.topic || ''}`, audience)
  } catch (err: any) {
    await supabase.from('social_posts').update({ publish_error: `Revisión: ${err.message}`.slice(0, 500) }).eq('id', post.id)
    return { error: `Revisión: ${err.message}`, id: post.id }
  }
  if (!review.ok) {
    await supabase.from('social_posts').update({
      status: 'rejected', rejected_reason: `Revisión automática: ${review.reasons.join('; ')}`.slice(0, 500), review,
    }).eq('id', post.id)
    return { rejected: 'post', id: post.id, reasons: review.reasons }
  }

  try {
    const input = { user, captionInstagram: review.caption_instagram, captionTiktok: review.caption_tiktok, idempotencyKey: `post-${post.id}` }
    const res = post.media_type === 'video'
      ? await publishVideo(post.media_url, input)
      : await publishPhotos([post.media_url], input)
    await supabase.from('social_posts').update({
      status: 'published', published_at: new Date().toISOString(),
      published_to_ig: true, published_to_tt: true,
      uploadpost_request_id: res.request_id || null, publish_error: null, review,
      caption_instagram: review.caption_instagram, caption_tiktok: review.caption_tiktok,
      approved_by: 'auto', approved_at: new Date().toISOString(),
    }).eq('id', post.id)
    return { published: 'post', id: post.id, request_id: res.request_id }
  } catch (err: any) {
    await supabase.from('social_posts').update({ publish_error: String(err.message).slice(0, 500) }).eq('id', post.id)
    return { error: err.message, id: post.id }
  }
}

// ─── Métricas ─────────────────────────────────────────────────────

export async function syncMetrics(supabase: SupabaseClient, max = 10) {
  if (!isUploadPostConfigured()) return { skipped: 'Upload-Post sin configurar' }
  const stale = daysAgo(0.25) // cada 6 h como mucho por publicación
  const log: string[] = []

  const { data: posts } = await supabase.from('social_posts')
    .select('id, uploadpost_request_id, published_urls, metrics_last_synced_at')
    .not('uploadpost_request_id', 'is', null).gte('published_at', daysAgo(30))
    .or(`metrics_last_synced_at.is.null,metrics_last_synced_at.lt.${stale}`)
    .order('metrics_last_synced_at', { ascending: true, nullsFirst: true }).limit(max)

  for (const p of posts || []) {
    try {
      const updates: Record<string, unknown> = { metrics_last_synced_at: new Date().toISOString() }
      if (!p.published_urls) {
        const st = await getUploadStatus(p.uploadpost_request_id).catch(() => null)
        const urls = st ? extractUrls(st) : {}
        if (Object.keys(urls).length) updates.published_urls = urls
      }
      const { total } = await getPostMetrics(p.uploadpost_request_id)
      Object.assign(updates, {
        metric_views: total.views, metric_likes: total.likes, metric_comments: total.comments,
        metric_shares: total.shares, metric_clicks: 0,
      })
      await supabase.from('social_posts').update(updates).eq('id', p.id)
      log.push(`post ${p.id}: ${total.views} vis.`)
    } catch (err: any) {
      await supabase.from('social_posts').update({ metrics_last_synced_at: new Date().toISOString() }).eq('id', p.id)
      log.push(`post ${p.id}: ${err.message}`)
    }
  }

  const { data: videos } = await supabase.from('content_videos')
    .select('id, uploadpost_request_id, published_urls')
    .not('uploadpost_request_id', 'is', null).gte('published_at', daysAgo(30))
    .or(`metrics_last_synced_at.is.null,metrics_last_synced_at.lt.${stale}`)
    .limit(max)

  for (const v of videos || []) {
    try {
      const updates: Record<string, unknown> = { metrics_last_synced_at: new Date().toISOString() }
      if (!v.published_urls) {
        const st = await getUploadStatus(v.uploadpost_request_id).catch(() => null)
        const urls = st ? extractUrls(st) : {}
        if (Object.keys(urls).length) updates.published_urls = urls
      }
      const { total } = await getPostMetrics(v.uploadpost_request_id)
      updates.metrics = total
      await supabase.from('content_videos').update(updates).eq('id', v.id)
      log.push(`vídeo ${v.id}: ${total.views} vis.`)
    } catch (err: any) {
      await supabase.from('content_videos').update({ metrics_last_synced_at: new Date().toISOString() }).eq('id', v.id)
      log.push(`vídeo ${v.id}: ${err.message}`)
    }
  }
  return { synced: log.length, log }
}
