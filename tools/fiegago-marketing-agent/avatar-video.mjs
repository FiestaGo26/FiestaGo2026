// ═══════════════════════════════════════════════════════════════════
// FiestaGo · Avatar Video
// Genera un vídeo "talking head" TUYO a partir de un guion de texto:
//
//   guion → voz clonada (ElevenLabs) → lipsync sobre CLIP REAL tuyo (Sync Labs)
//         → subtítulos quemados por palabra + marca de agua + CTA final
//
// A diferencia de un avatar 100% sintético (HeyGen, Synthesia...), aquí la
// cara, el cuerpo y el movimiento SIEMPRE son metraje real que tú grabaste —
// la IA solo regenera la boca (lipsync) y el audio (voz clonada) para que
// diga un guion nuevo. Es el enfoque más difícil de distinguir de un vídeo
// grabado por ti mismo, porque casi nada se sintetiza desde cero.
//
// ⚠️ IMPORTANTE — verifica antes de usar en producción:
// Los endpoints/payloads de Sync Labs y ElevenLabs de abajo están escritos
// según su documentación pública. Esta sesión no tuvo acceso a internet para
// confirmar el esquema exacto en el momento de escribir el código. Si la API
// devuelve un error de "campo desconocido" o similar, es señal de que algo
// cambió — el mensaje de error de la propia API te dirá qué ajustar
// (docs: elevenlabs.io/docs/api-reference, docs.sync.so).
//
// SETUP (uno por avatar, no por vídeo):
//   1. Graba 3-6 clips de ti mismo hablando a cámara, 15-30s cada uno,
//      distintos tonos (neutral, enérgico, serio). Ver avatar-clips/README.md
//   2. Clona tu voz en ElevenLabs (Voice → Add Voice → Instant/Professional
//      Voice Clone, sube 1-3 min de audio tuyo limpio) → copia el voice_id
//   3. Rellena en .env: ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID, SYNC_API_KEY
// ═══════════════════════════════════════════════════════════════════

import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'fs'
import { resolve, join, extname, dirname } from 'path'
import { fileURLToPath } from 'url'
import { execFileSync } from 'child_process'
import { drawText, FONT_SANS, FONT_SERIF } from './ffmpeg-text.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FFMPEG = resolve(__dirname, 'bin', 'ffmpeg.exe')

// Las env vars se leen en el momento de llamar (no al importar el módulo),
// porque fiegago-marketing-agent.mjs carga .env DESPUÉS de que ESM resuelva
// los imports — si las leyéramos como const de módulo, llegarían undefined.
const env = (k) => process.env[k]

export function avatarEnabled() {
  return !!(env('ELEVENLABS_API_KEY') && env('ELEVENLABS_VOICE_ID') && env('SYNC_API_KEY'))
}

function clipsDir() {
  return resolve(env('AVATAR_CLIPS_DIR') || 'avatar-clips')
}

// ── 1. Voz clonada: texto → audio + timestamps por carácter ────────
export async function elevenLabsSpeak(text) {
  const voiceId = env('ELEVENLABS_VOICE_ID')
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps`, {
    method: 'POST',
    headers: { 'xi-api-key': env('ELEVENLABS_API_KEY'), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: { stability: 0.45, similarity_boost: 0.85, style: 0.35, use_speaker_boost: true },
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${JSON.stringify(data).slice(0, 300)}`)
  if (!data.audio_base64 || !data.alignment) throw new Error(`ElevenLabs: respuesta sin audio_base64/alignment — revisa el endpoint (${JSON.stringify(Object.keys(data))})`)
  return {
    audioBuffer: Buffer.from(data.audio_base64, 'base64'),
    alignment: data.alignment, // { characters, character_start_times_seconds, character_end_times_seconds }
  }
}

// ── 2. Elegir clip base según el tono del guion ─────────────────────
export function pickBaseClip(mood = 'neutral') {
  const dir = clipsDir()
  if (!existsSync(dir)) {
    throw new Error(`No existe ${dir}. Graba tus clips base — ver avatar-clips/README.md`)
  }
  const files = readdirSync(dir).filter(f => /\.(mp4|mov)$/i.test(f))
  const tagged = files.filter(f => f.toLowerCase().startsWith(`${mood.toLowerCase()}-`) || f.toLowerCase().startsWith(`${mood.toLowerCase()}_`))
  const pool = tagged.length ? tagged : files
  if (pool.length === 0) throw new Error(`No hay clips .mp4/.mov en ${dir} — ver avatar-clips/README.md`)
  return join(dir, pool[Math.floor(Math.random() * pool.length)])
}

// ── 3. Subida temporal a Supabase Storage (Sync Labs necesita URLs) ─
async function uploadTmp(buffer, filename, contentType) {
  const base = env('NEXT_PUBLIC_SUPABASE_URL')
  const key = env('SUPABASE_SERVICE_ROLE_KEY')
  if (!base || !key) throw new Error('Falta NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en .env (necesarios para subir el audio/vídeo temporal a Sync Labs)')
  const path = `avatar-tmp/${filename}`
  const res = await fetch(`${base}/storage/v1/object/social-posts/${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': contentType, 'x-upsert': 'true' },
    body: buffer,
  })
  if (!res.ok) throw new Error(`Supabase tmp upload ${res.status}: ${(await res.text()).slice(0, 200)}`)
  return `${base}/storage/v1/object/public/social-posts/${path}`
}

async function deleteTmp(filename) {
  try {
    const base = env('NEXT_PUBLIC_SUPABASE_URL')
    const key = env('SUPABASE_SERVICE_ROLE_KEY')
    await fetch(`${base}/storage/v1/object/social-posts/avatar-tmp/${filename}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${key}` },
    })
  } catch { /* limpieza best-effort */ }
}

// ── 4. Lipsync sobre el clip real (Sync Labs) ───────────────────────
async function syncLipsync(videoUrl, audioUrl) {
  const submit = await fetch('https://api.sync.so/v2/generate', {
    method: 'POST',
    headers: { 'x-api-key': env('SYNC_API_KEY'), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'lipsync-2',
      input: [
        { type: 'video', url: videoUrl },
        { type: 'audio', url: audioUrl },
      ],
      // sync_mode 'loop': si el guion (audio) dura más que el clip base,
      // el clip se repite en vez de fallar — por eso conviene grabar clips
      // de 20-30s, para minimizar los loops visibles.
      options: { output_format: 'mp4', sync_mode: 'loop' },
    }),
  })
  const sub = await submit.json()
  if (!submit.ok) throw new Error(`Sync Labs submit ${submit.status}: ${JSON.stringify(sub).slice(0, 300)}`)
  const id = sub.id
  if (!id) throw new Error(`Sync Labs: respuesta sin id de job — ${JSON.stringify(sub).slice(0, 300)}`)
  for (let i = 0; i < 90; i++) {
    await new Promise(r => setTimeout(r, 4000))
    const st = await fetch(`https://api.sync.so/v2/generate/${id}`, { headers: { 'x-api-key': env('SYNC_API_KEY') } })
    const sd = await st.json()
    process.stdout.write(`\r   → Sync Labs: ${sd.status} (${(i + 1) * 4}s)         `)
    if (sd.status === 'COMPLETED') { console.log(); return sd.outputUrl }
    if (sd.status === 'FAILED') { console.log(); throw new Error(`Sync Labs FAILED: ${JSON.stringify(sd).slice(0, 300)}`) }
  }
  throw new Error('Sync Labs timeout (6min)')
}

async function downloadTo(url, path) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`download ${res.status}`)
  writeFileSync(path, Buffer.from(await res.arrayBuffer()))
}

// ── 5. Alignment por carácter → palabras con timestamps ─────────────
function alignmentToWords(alignment) {
  const chars = alignment.characters
  const starts = alignment.character_start_times_seconds
  const ends = alignment.character_end_times_seconds
  const words = []
  let cur = '', curStart = null
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i]
    if (c === ' ' || c === '\n') {
      if (cur) { words.push({ text: cur, start: curStart, end: ends[i - 1] }); cur = ''; curStart = null }
      continue
    }
    if (curStart === null) curStart = starts[i]
    cur += c
  }
  if (cur) words.push({ text: cur, start: curStart, end: ends[chars.length - 1] })
  return words
}

function wordsToChunks(words, wordsPerChunk = 3) {
  const chunks = []
  for (let i = 0; i < words.length; i += wordsPerChunk) {
    const slice = words.slice(i, i + wordsPerChunk)
    chunks.push({ text: slice.map(w => w.text).join(' '), start: slice[0].start, end: slice[slice.length - 1].end })
  }
  return chunks
}

// ── 6. Composición final: captions + watermark + CTA outro ──────────
const CTA_OUTRO_DURATION = 3.0

function buildMainFilter(chunks) {
  const filters = []
  filters.push(`scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1`, `fps=25`)

  // Marca de agua
  filters.push(drawText({
    text: 'fiestago.es', fontsize: 36, fontfile: FONT_SERIF, color: 'white@0.85',
    boxcolor: 'black@0.35', borderw: 2, x: 'w-tw-30', y: 'h-th-30',
  }))

  // Subtítulos quemados por bloques de palabras, abajo (no tapan la cara)
  for (const c of chunks) {
    filters.push(drawText({
      text: c.text.toUpperCase(), fontsize: 58, fontfile: FONT_SANS, color: 'white',
      boxcolor: 'black@0.55', borderw: 4, x: '(w-tw)/2', y: 'h*0.80',
      start: c.start, end: c.end,
    }))
  }
  return filters.join(',')
}

function buildOutroFilter(ctaLine1, ctaLine2) {
  const filters = []
  filters.push(drawText({
    text: ctaLine1, fontsize: 72, fontfile: FONT_SANS, color: 'white', boxcolor: 'black@0.0',
    borderw: 6, x: '(w-tw)/2', y: 'h*0.42',
  }))
  filters.push(drawText({
    text: ctaLine2, fontsize: 50, fontfile: FONT_SERIF, color: '#F5C518', boxcolor: 'black@0.0',
    borderw: 5, x: '(w-tw)/2', y: 'h*0.42+100',
  }))
  return filters.join(',')
}

// Compone: [clip lipsync + subtítulos + watermark] + [outro CTA 3s] concatenados
function composeFinal({ rawPath, chunks, duration, cta, outPath }) {
  const filterPath = outPath.replace(/\.mp4$/, '_filter.txt')
  const mainVf = buildMainFilter(chunks)
  const outroVf = buildOutroFilter(cta.line1, cta.line2)

  const filterComplex = [
    `[0:v]${mainVf}[main]`,
    `color=c=0x1A1A1A:s=1080x1920:d=${CTA_OUTRO_DURATION}:r=25,${outroVf}[outro]`,
    `[0:a]anull[maina]`,
    `anullsrc=channel_layout=stereo:sample_rate=44100:d=${CTA_OUTRO_DURATION}[outroa]`,
    `[main][maina][outro][outroa]concat=n=2:v=1:a=1[outv][outa]`,
  ].join(';')
  writeFileSync(filterPath, filterComplex, 'utf-8')

  const args = [
    '-y', '-i', rawPath,
    '-filter_complex_script', filterPath,
    '-map', '[outv]', '-map', '[outa]',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'medium', '-crf', '20',
    '-c:a', 'aac', '-b:a', '128k',
    outPath,
  ]
  execFileSync(FFMPEG, args, { stdio: 'pipe' })
}

// ── 7. Orquestación completa ─────────────────────────────────────────
// script: texto que dirá el avatar (guion hablado, distinto del caption)
// mood: 'neutral' | 'energetic' | 'serious' → elige el clip base tageado
// cta: { line1, line2 } — tarjeta final de 3s
// outDir: carpeta del post (donde ya viven imagen/caption/meta.json)
export async function generateAvatarVideo({ script, mood = 'neutral', cta, outDir }) {
  if (!avatarEnabled()) {
    throw new Error('Avatar deshabilitado: faltan ELEVENLABS_API_KEY / ELEVENLABS_VOICE_ID / SYNC_API_KEY en .env')
  }
  if (!existsSync(FFMPEG)) {
    throw new Error(`No encuentro FFmpeg en ${FFMPEG} (mismo requisito que compose-video.mjs)`)
  }

  console.log(`   🎙️  Generando voz clonada (ElevenLabs)...`)
  const { audioBuffer, alignment } = await elevenLabsSpeak(script)
  writeFileSync(join(outDir, 'avatar_voz.mp3'), audioBuffer)

  const baseClipPath = pickBaseClip(mood)
  console.log(`   🎬 Clip base: ${baseClipPath.split(/[\\/]/).pop()}`)

  console.log(`   ☁️  Subiendo clip + audio (temporal, para Sync Labs)...`)
  const stamp = Date.now()
  const baseExt = extname(baseClipPath)
  const videoUrl = await uploadTmp(readFileSync(baseClipPath), `${stamp}-base${baseExt}`, 'video/mp4')
  const audioUrl = await uploadTmp(audioBuffer, `${stamp}-voz.mp3`, 'audio/mpeg')

  console.log(`   🫦 Sincronizando labios con tu voz (Sync Labs)...`)
  const outputUrl = await syncLipsync(videoUrl, audioUrl)

  const rawPath = join(outDir, 'avatar_raw.mp4')
  await downloadTo(outputUrl, rawPath)
  await Promise.all([deleteTmp(`${stamp}-base${baseExt}`), deleteTmp(`${stamp}-voz.mp3`)])

  const words = alignmentToWords(alignment)
  const chunks = wordsToChunks(words)
  const duration = alignment.character_end_times_seconds.at(-1) || 0

  console.log(`   🎨 Componiendo subtítulos + marca de agua + CTA final...`)
  const finalPath = join(outDir, 'video_final.mp4')
  composeFinal({
    rawPath, chunks, duration,
    cta: cta || { line1: 'Date de alta gratis', line2: 'fiestago.es/registro-proveedor' },
    outPath: finalPath,
  })

  return { finalPath, rawPath, duration }
}
