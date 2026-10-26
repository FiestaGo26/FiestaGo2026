// ───────────────────────────────────────────────────────────────────────
// HeyGen API client · genera vídeos de avatar hablando a partir de texto.
// Plan Creator (€35/mo) — 15-30 min/mes, suficiente para 1 vídeo de 30s
// al día.
//
// Endpoints usados:
//   POST /v3/videos                → arranca generación con el motor más nuevo
//                                    (Avatar V; HEYGEN_ENGINE para cambiarlo)
//   GET  /v3/videos/{id}           → poll de estado de los vídeos v3
//   POST /v2/video/generate        → respaldo si la v3 falla
//   GET  /v1/video_status.get      → poll de estado de los vídeos v2
//
// El avatar de FiestaGo (photo_avatar) admite avatar_v, avatar_iv y
// avatar_iii (supported_api_engines, comprobado el 26-10-2026).
//
// Variables de entorno:
//   HEYGEN_API_KEY      — API key del panel HeyGen (Settings → API)
//   HEYGEN_AVATAR_ID    — id del avatar custom del usuario
//   HEYGEN_VOICE_ID     — id de la voz clonada del usuario
//   HEYGEN_BACKGROUND   — opcional, color hex (#f6f6f6 por defecto)
// ───────────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.heygen.com'

function cfg() {
  const apiKey   = process.env.HEYGEN_API_KEY
  const avatarId = process.env.HEYGEN_AVATAR_ID
  const voiceId  = process.env.HEYGEN_VOICE_ID
  if (!apiKey || !avatarId || !voiceId) {
    throw new Error('Faltan envs de HeyGen (HEYGEN_API_KEY / HEYGEN_AVATAR_ID / HEYGEN_VOICE_ID)')
  }
  return { apiKey, avatarId, voiceId }
}

export type HeyGenStatus = 'pending' | 'processing' | 'completed' | 'failed'

export type HeyGenVideoStatus = {
  status:       HeyGenStatus
  videoUrl:     string | null
  thumbnailUrl: string | null
  duration:     number | null    // segundos
  error:        string | null
}

// Arranca la generación de un vídeo. Devuelve video_id de HeyGen para
// hacer polling después. Dimensiones por defecto 720x1280 (9:16, ideal
// para Reel/TikTok/Short).
//
// Voz tuneable por env var para iterar sin redeploy:
//   HEYGEN_VOICE_SPEED   — 0.5-2.0, default 1.0. Más bajo suena más natural.
//   HEYGEN_VOICE_PITCH   — -50 a 50, default 0.
//   HEYGEN_VOICE_EMOTION — neutral | serious | happy | soothing | broadcaster
//                          default 'broadcaster' (más claro y profesional)
export async function generateVideo(opts: {
  script:       string
  speed?:       number     // 0.5-2.0, override de env
  width?:       number     // por defecto 720
  height?:      number     // por defecto 1280 (9:16)
  background?:  string     // hex color, por defecto #f6f6f6
  title?:       string
}): Promise<string> {
  // 1) Motor más nuevo (v3). Si falla por lo que sea, seguimos con la v2.
  let v3Error = ''
  try {
    return await generateVideoV3(opts)
  } catch (err: any) {
    v3Error = String(err?.message || err)
    console.error('[heygen] v3 falló, uso v2:', v3Error)
  }
  try {
    return await generateVideoV2(opts)
  } catch (err: any) {
    // Los dos errores, para saber qué falla de verdad (saldo, avatar, voz…)
    throw new Error(`${err?.message || err} · antes, ${v3Error}`)
  }
}

async function generateVideoV3(opts: { script: string; speed?: number; background?: string; title?: string }): Promise<string> {
  const { apiKey, avatarId, voiceId } = cfg()
  const engine = (process.env.HEYGEN_ENGINE || 'avatar_v').trim()
  const speed  = opts.speed ?? Number(process.env.HEYGEN_VOICE_SPEED || '1.0')
  const body: any = {
    avatar_id:    avatarId,
    script:       opts.script,
    voice_id:     voiceId,
    engine:       { type: engine },
    aspect_ratio: '9:16',
    resolution:   '1080p',
    background:   { type: 'color', value: opts.background ?? process.env.HEYGEN_BACKGROUND ?? '#f6f6f6' },
    title:        opts.title || `FiestaGo ${new Date().toISOString().slice(0, 10)}`,
  }
  if (speed && speed !== 1) body.voice_settings = { speed: Math.min(1.5, Math.max(0.5, speed)) }

  const res = await fetch(`${API_BASE}/v3/videos`, {
    method: 'POST',
    headers: { 'X-Api-Key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data: any = await res.json().catch(() => ({}))
  if (!res.ok || data?.error) {
    throw new Error(`HeyGen v3 (${res.status}): ${JSON.stringify(data?.error ?? data).slice(0, 400)}`)
  }
  const videoId = data?.data?.video_id || data?.video_id || data?.data?.id || data?.id
  if (!videoId) throw new Error(`HeyGen v3 sin video_id: ${JSON.stringify(data).slice(0, 300)}`)
  return `v3:${videoId}`
}

async function generateVideoV2(opts: {
  script:       string
  speed?:       number
  width?:       number
  height?:      number
  background?:  string
}): Promise<string> {
  const { apiKey, avatarId, voiceId } = cfg()
  const width  = opts.width  ?? 720
  const height = opts.height ?? 1280
  const bg     = opts.background ?? process.env.HEYGEN_BACKGROUND ?? '#f6f6f6'
  const speed  = opts.speed ?? Number(process.env.HEYGEN_VOICE_SPEED || '1.0')
  const pitch  = Number(process.env.HEYGEN_VOICE_PITCH || '0')
  // HeyGen exige la emoción capitalizada (TitleCase) y validada contra
  // su enum: Excited | Friendly | Serious | Soothing | Broadcaster | Angry.
  // Normalizamos defensivamente para que cualquier capitalización
  // (broadcaster / BROADCASTER / Broadcaster) funcione, y fallback a
  // Broadcaster si el valor no está en la lista permitida.
  const ALLOWED_EMOTIONS = ['Excited', 'Friendly', 'Serious', 'Soothing', 'Broadcaster', 'Angry']
  const rawEmotion = (process.env.HEYGEN_VOICE_EMOTION || 'Broadcaster').trim()
  const titleCased = rawEmotion.charAt(0).toUpperCase() + rawEmotion.slice(1).toLowerCase()
  const emotion = ALLOWED_EMOTIONS.includes(titleCased) ? titleCased : 'Broadcaster'

  const voicePayload: any = {
    type:       'text',
    input_text: opts.script,
    voice_id:   voiceId,
    speed,
  }
  if (pitch)   voicePayload.pitch   = pitch
  if (emotion) voicePayload.emotion = emotion

  const body = {
    video_inputs: [{
      character: {
        type:         'avatar',
        avatar_id:    avatarId,
        avatar_style: 'normal',
      },
      voice: voicePayload,
      background: {
        type:  'color',
        value: bg,
      },
    }],
    dimension: { width, height },
    test:      false,
  }

  const res = await fetch(`${API_BASE}/v2/video/generate`, {
    method: 'POST',
    headers: {
      'X-Api-Key':    apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  const data: any = await res.json().catch(() => ({}))
  if (!res.ok || data?.error) {
    throw new Error(`HeyGen generateVideo falló (${res.status}): ${JSON.stringify(data?.error ?? data)}`)
  }
  const videoId = data?.data?.video_id
  if (!videoId) throw new Error(`HeyGen generateVideo sin video_id: ${JSON.stringify(data)}`)
  return videoId as string
}

// Consulta el estado de un vídeo. Llamar cada ~30s hasta completed/failed.
// HeyGen tarda ~1-3 min para un vídeo de 30s.
export async function getVideoStatus(videoId: string): Promise<HeyGenVideoStatus> {
  const { apiKey } = cfg()
  // Los vídeos v3 se guardan con el prefijo "v3:"
  if (videoId.startsWith('v3:')) {
    const id = videoId.slice(3)
    const r = await fetch(`${API_BASE}/v3/videos/${encodeURIComponent(id)}`, { headers: { 'X-Api-Key': apiKey } })
    const j: any = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(`HeyGen v3 getVideoStatus falló (${r.status}): ${JSON.stringify(j).slice(0, 300)}`)
    const d = j?.data ?? j ?? {}
    const raw = String(d.status || '').toLowerCase()
    const status: HeyGenStatus = raw === 'completed' || raw === 'done' ? 'completed'
      : raw === 'failed' || raw === 'error' ? 'failed'
      : raw ? 'processing' : 'pending'
    return {
      status,
      videoUrl:     d.video_url || null,
      thumbnailUrl: d.thumbnail_url || null,
      duration:     typeof d.duration === 'number' ? d.duration : null,
      error:        d.failure_message || d.error?.message || (typeof d.error === 'string' ? d.error : null),
    }
  }
  const res = await fetch(`${API_BASE}/v1/video_status.get?video_id=${encodeURIComponent(videoId)}`, {
    headers: { 'X-Api-Key': apiKey },
  })
  const data: any = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(`HeyGen getVideoStatus falló (${res.status}): ${JSON.stringify(data)}`)
  }
  const d = data?.data ?? {}
  const rawStatus: string = (d.status || '').toLowerCase()
  let status: HeyGenStatus = 'pending'
  if (rawStatus === 'completed' || rawStatus === 'done')        status = 'completed'
  else if (rawStatus === 'failed' || rawStatus === 'error')     status = 'failed'
  else if (rawStatus === 'processing' || rawStatus === 'waiting') status = 'processing'

  return {
    status,
    videoUrl:     d.video_url     || null,
    thumbnailUrl: d.thumbnail_url || null,
    duration:     typeof d.duration === 'number' ? d.duration : null,
    error:        d.error || null,
  }
}

// True si las envs mínimas están configuradas. Útil para mostrar/ocultar
// la pestaña de Contenido en /admin antes de que el usuario meta sus keys.
export function isConfigured(): boolean {
  return !!(process.env.HEYGEN_API_KEY && process.env.HEYGEN_AVATAR_ID && process.env.HEYGEN_VOICE_ID)
}
