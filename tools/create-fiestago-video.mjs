// ═══════════════════════════════════════════════════════════════════
// FiestaGo · Create Video (captación de proveedores)
//
// Genera UN vídeo vertical 9:16 de ~12s para captar proveedores:
//   1. fal.ai Kling text-to-video → clip cinemático de 5s
//   2. FFmpeg extiende a 12s (freeze del último frame) y superpone:
//      · Hook 0-3s          : +CLIENTES · 0€ DE ALTA
//      · Kicker 3-5.5s      : Sin cuota mensual · Sin permanencia
//      · Kicker 5.6-8s      : Tu 1ª venta: 100% para ti
//      · Kicker 8.1-12s     : Desde la 2ª venta: solo 8%
//      · CTA 9.5-12s        : Date de alta gratis · fiestago.es/registro-proveedor
//      · Marca de agua      : fiestago.es (siempre)
//
// USO:
//   FAL_KEY=xxx node tools/create-fiestago-video.mjs
//   FAL_KEY=xxx node tools/create-fiestago-video.mjs --scene 2
//   FAL_KEY=xxx node tools/create-fiestago-video.mjs --prompt "..." --out mi-video.mp4
//   FAL_KEY=xxx node tools/create-fiestago-video.mjs --skip-ai --input clip.mp4   # reutiliza un clip ya generado
//
// REQUISITOS:
//   · FAL_KEY en el entorno (o en tools/fiegago-marketing-agent/.env)
//   · ffmpeg en PATH, o env FFMPEG, o tools/fiegago-marketing-agent/bin/ffmpeg(.exe)
// ═══════════════════════════════════════════════════════════════════

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { resolve, dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { execFileSync, execSync } from 'child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

// ── Args ──────────────────────────────────────────────────────────
const argv = process.argv.slice(2)
const arg = (name, fallback = null) => {
  const i = argv.indexOf(`--${name}`)
  return i >= 0 ? (argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true) : fallback
}
const SCENE_IDX  = Number(arg('scene', 0)) || 0
const PROMPT_OVR = arg('prompt', null)
const OUT_ARG    = arg('out', null)
const INPUT_ARG  = arg('input', null)
const SKIP_AI    = argv.includes('--skip-ai') || !!INPUT_ARG
const DRY_RUN    = argv.includes('--dry-run')

// ── Env loader (compatible con tools/fiegago-marketing-agent/.env) ─
function loadEnv() {
  const candidates = [
    resolve(process.cwd(), '.env'),
    resolve(__dirname, '.env'),
    resolve(__dirname, 'fiegago-marketing-agent', '.env'),
  ]
  for (const p of candidates) {
    if (!existsSync(p)) continue
    for (const l of readFileSync(p, 'utf-8').split('\n')) {
      const t = l.trim()
      if (!t || t.startsWith('#')) continue
      const [k, ...v] = t.split('=')
      if (k && v.length && !process.env[k.trim()]) {
        process.env[k.trim()] = v.join('=').trim().replace(/^["']|["']$/g, '')
      }
    }
  }
}
loadEnv()
const FAL_KEY = process.env.FAL_KEY

// ── Escenas (prompts para Kling) ──────────────────────────────────
const SCENES = [
  'a Spanish wedding photographer reviewing photos on a laptop in a sunlit studio, focused and confident, warm natural light through tall windows, shallow depth of field, slow camera push-in, cinematic editorial style',
  'a small catering team plating elegant Spanish tapas in a sunlit kitchen, hands working with focus, warm Mediterranean light, slow dolly shot, commercial cinematic style',
  'a DJ adjusting controllers at a Spanish outdoor venue at golden hour, festoon lights warming up in the background, slow camera push-in, cinematic depth of field',
  'a florist arranging an elegant white bouquet in a bright Mediterranean workshop, hands moving with precision, soft natural light, slow camera reveal, editorial commercial style',
  'a Spanish decorator hanging string lights and fabric across a sunlit patio for a celebration, slow horizontal pan, golden hour warmth, cinematic shallow depth of field',
]
const SCENE = PROMPT_OVR || SCENES[Math.min(Math.max(0, SCENE_IDX), SCENES.length - 1)]
const FULL_PROMPT = PROMPT_OVR
  || `Cinematic 5-second vertical 9:16 video of ${SCENE}, professional editorial style, warm natural light, Spanish small business owner aesthetic, modern and aspirational, no text overlays, no logos, no readable signs`

// ── Script de overlays (timing en segundos) ───────────────────────
const SCRIPT = {
  duration: 12,
  hook: '+CLIENTES',
  hook_sub: '0€ DE ALTA',
  kickers: [
    { start: 3.2, end: 5.5, text: 'Sin cuota mensual\nSin permanencia' },
    { start: 5.6, end: 8.0, text: 'Tu 1ª venta:\n100% para ti' },
    { start: 8.1, end: 12.0, text: 'Desde la 2ª venta:\nsolo 8%' },
  ],
  cta: { start: 9.5, end: 12.0, line1: 'Date de alta gratis', line2: 'fiestago.es/registro-proveedor' },
}

// ── Output paths ──────────────────────────────────────────────────
const OUT_DIR = resolve(__dirname, 'output')
mkdirSync(OUT_DIR, { recursive: true })
const OUT_PATH    = resolve(OUT_DIR, OUT_ARG || 'fiestago-captacion.mp4')
const RAW_PATH    = resolve(OUT_DIR, 'fiestago-captacion.raw.mp4')
const FILTER_PATH = resolve(OUT_DIR, '_filter.txt')

// ── FFmpeg resolution ─────────────────────────────────────────────
function resolveFFmpeg() {
  if (process.env.FFMPEG && existsSync(process.env.FFMPEG)) return process.env.FFMPEG
  const localBin = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'
  const bundled = resolve(__dirname, 'fiegago-marketing-agent', 'bin', localBin)
  if (existsSync(bundled)) return bundled
  try {
    const which = process.platform === 'win32' ? 'where ffmpeg' : 'command -v ffmpeg'
    const r = execSync(which, { encoding: 'utf-8' }).trim().split('\n')[0]
    if (r && existsSync(r)) return r
  } catch {}
  return null
}
function resolveFFprobe(ffmpegPath) {
  if (!ffmpegPath) return null
  const dir = dirname(ffmpegPath)
  const name = process.platform === 'win32' ? 'ffprobe.exe' : 'ffprobe'
  const sibling = join(dir, name)
  if (existsSync(sibling)) return sibling
  try {
    const which = process.platform === 'win32' ? 'where ffprobe' : 'command -v ffprobe'
    const r = execSync(which, { encoding: 'utf-8' }).trim().split('\n')[0]
    if (r && existsSync(r)) return r
  } catch {}
  return null
}

// ── Fuentes (cross-platform, opcionales) ──────────────────────────
function findFont(candidates) {
  for (const p of candidates) if (existsSync(p)) return p
  return null
}
const FONT_SANS_PATH = findFont([
  'C:/Windows/Fonts/arialbd.ttf',
  '/System/Library/Fonts/Supplemental/Arial Bold.ttf',
  '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
  '/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf',
])
const FONT_SERIF_PATH = findFont([
  'C:/Windows/Fonts/georgia.ttf',
  '/System/Library/Fonts/Supplemental/Georgia.ttf',
  '/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf',
  '/usr/share/fonts/dejavu/DejaVuSerif-Bold.ttf',
])

// FFmpeg drawtext requiere escapar ':' dentro de fontfile='...'
function ffEscapeFontPath(p) {
  if (!p) return null
  return p.replace(/\\/g, '/').replace(/:/g, '\\:')
}
const FONT_SANS  = ffEscapeFontPath(FONT_SANS_PATH)
const FONT_SERIF = ffEscapeFontPath(FONT_SERIF_PATH)

// ── fal.ai Kling text-to-video (v1.6 standard, 9:16) ──────────────
async function callKling(prompt, durationSec) {
  if (!FAL_KEY) throw new Error('Falta FAL_KEY en el entorno (.env o env var)')
  console.log(`   → Enviando prompt a Kling (${durationSec}s, 9:16)…`)
  const submit = await fetch('https://queue.fal.run/fal-ai/kling-video/v1.6/standard/text-to-video', {
    method: 'POST',
    headers: { 'Authorization': `Key ${FAL_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, duration: String(durationSec), aspect_ratio: '9:16' }),
  })
  const sub = await submit.json()
  if (!submit.ok) throw new Error(`Kling submit ${submit.status}: ${JSON.stringify(sub).slice(0, 300)}`)
  const id = sub.request_id
  console.log(`   → Request id: ${id}`)
  for (let i = 0; i < 90; i++) {
    await new Promise(r => setTimeout(r, 5000))
    const status = await fetch(
      `https://queue.fal.run/fal-ai/kling-video/requests/${id}/status`,
      { headers: { 'Authorization': `Key ${FAL_KEY}` } },
    )
    const sd = await status.json()
    process.stdout.write(`\r   → ${sd.status || '...'}  (${(i + 1) * 5}s)         `)
    if (sd.status === 'COMPLETED') {
      const r = await fetch(
        `https://queue.fal.run/fal-ai/kling-video/requests/${id}`,
        { headers: { 'Authorization': `Key ${FAL_KEY}` } },
      )
      const rd = await r.json()
      console.log()
      const url = rd.video?.url || rd.output?.video?.url
      if (!url) throw new Error(`Kling COMPLETED pero sin URL: ${JSON.stringify(rd).slice(0, 300)}`)
      return url
    }
    if (sd.status === 'FAILED' || sd.status === 'ERROR') {
      console.log()
      throw new Error(`Kling falló: ${JSON.stringify(sd).slice(0, 300)}`)
    }
  }
  throw new Error('Kling timeout (>7.5 min)')
}

async function downloadTo(url, destPath) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Descarga ${res.status} de ${url}`)
  writeFileSync(destPath, Buffer.from(await res.arrayBuffer()))
}

// ── Drawtext helpers ──────────────────────────────────────────────
function escDrawText(s) {
  return String(s)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, '’')
    .replace(/:/g, '\\:')
    .replace(/\n/g, '\\n')
}
const hex = c => c.startsWith('#') ? '0x' + c.slice(1) : c

function drawText({ text, fontsize, x, y, color = 'white', boxcolor = 'black@0.0',
                    borderw = 6, start, end, fontfile }) {
  const enable = (start != null && end != null) ? `:enable='between(t,${start},${end})'` : ''
  const ff = fontfile ? `:fontfile='${fontfile}'` : ''
  const box = boxcolor && boxcolor !== 'black@0.0'
    ? `:box=1:boxborderw=22:boxcolor=${boxcolor}` : ''
  return `drawtext=text='${escDrawText(text)}'${ff}:fontsize=${fontsize}:fontcolor=${hex(color)}${box}:line_spacing=8:borderw=${borderw}:bordercolor=black@0.85:x=${x}:y=${y}${enable}`
}

function probeDuration(ffprobe, path) {
  if (!ffprobe) return 5.0
  try {
    const out = execFileSync(ffprobe,
      ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path],
      { encoding: 'utf-8' })
    return parseFloat(out.trim()) || 5.0
  } catch { return 5.0 }
}

function buildFilter(inputDuration) {
  const D = SCRIPT.duration
  const filters = []
  // Encuadre 9:16 1080x1920 + extensión por freeze
  filters.push('scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1')
  const extra = Math.max(0, D - inputDuration)
  if (extra > 0) filters.push(`tpad=stop_mode=clone:stop_duration=${extra.toFixed(2)}`)
  filters.push('fps=25')

  // Marca de agua (siempre)
  filters.push(drawText({
    text: 'fiestago.es', fontsize: 36, fontfile: FONT_SERIF,
    color: 'white@0.85', boxcolor: 'black@0.35', borderw: 2,
    x: 'w-tw-30', y: 'h-th-30',
  }))

  // Hook (0-3s)
  filters.push(drawText({
    text: SCRIPT.hook, fontsize: 130, fontfile: FONT_SANS,
    color: 'white', borderw: 8,
    x: '(w-tw)/2', y: 'h*0.16', start: 0, end: 3.0,
  }))
  filters.push(drawText({
    text: SCRIPT.hook_sub, fontsize: 86, fontfile: FONT_SANS,
    color: '#F5C518', borderw: 7,
    x: '(w-tw)/2', y: 'h*0.16+170', start: 0, end: 3.0,
  }))

  // Kickers (medio)
  for (const k of SCRIPT.kickers) {
    filters.push(drawText({
      text: k.text, fontsize: 72, fontfile: FONT_SANS,
      color: 'white', boxcolor: 'black@0.55', borderw: 5,
      x: '(w-tw)/2', y: 'h*0.42', start: k.start, end: k.end,
    }))
  }

  // CTA (final)
  filters.push(drawText({
    text: SCRIPT.cta.line1, fontsize: 70, fontfile: FONT_SANS,
    color: 'white', boxcolor: 'black@0.6', borderw: 5,
    x: '(w-tw)/2', y: 'h*0.72', start: SCRIPT.cta.start, end: SCRIPT.cta.end,
  }))
  filters.push(drawText({
    text: SCRIPT.cta.line2, fontsize: 54, fontfile: FONT_SERIF,
    color: '#F5C518', boxcolor: 'black@0.6', borderw: 4,
    x: '(w-tw)/2', y: 'h*0.72+115', start: SCRIPT.cta.start, end: SCRIPT.cta.end,
  }))

  return filters.join(',')
}

// ── Compose ───────────────────────────────────────────────────────
function compose(ffmpeg, ffprobe, inputPath) {
  const inDur = probeDuration(ffprobe, inputPath)
  const vf = buildFilter(inDur)
  writeFileSync(FILTER_PATH, `[0:v]${vf}[outv]`, 'utf-8')

  const args = [
    '-y',
    '-i', inputPath,
    '-filter_complex_script', FILTER_PATH,
    '-map', '[outv]',
    '-an',
    '-t', String(SCRIPT.duration),
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-preset', 'medium',
    '-crf', '20',
    OUT_PATH,
  ]

  if (DRY_RUN) {
    console.log('\n[DRY-RUN] FFmpeg:')
    console.log(`${ffmpeg} ${args.map(a => /[\s,]/.test(a) ? `"${a}"` : a).join(' ')}`)
    return
  }
  console.log(`   → Componiendo overlay (${SCRIPT.duration}s)…`)
  try {
    execFileSync(ffmpeg, args, { stdio: 'pipe' })
    console.log(`   ✓ ${OUT_PATH}`)
  } catch (err) {
    const tail = (err.stderr || '').toString().split('\n').filter(Boolean).slice(-6).join('\n')
    throw new Error(`FFmpeg falló:\n${tail}`)
  }
}

// ── Main ──────────────────────────────────────────────────────────
async function main() {
  console.log('\n' + '═'.repeat(58))
  console.log('🎬  FiestaGo · Vídeo de captación de proveedores')
  console.log('═'.repeat(58))
  console.log(`Salida : ${OUT_PATH}`)
  console.log(`Duración: ${SCRIPT.duration}s · Formato: 1080x1920 (9:16)`)
  console.log(`Escena : ${SCENE.slice(0, 80)}${SCENE.length > 80 ? '…' : ''}`)
  if (!FONT_SANS)  console.log('⚠️  No se encontró fuente sans-serif local; FFmpeg usará la por defecto.')
  if (!FONT_SERIF) console.log('⚠️  No se encontró fuente serif local; la marca de agua usará la por defecto.')
  console.log()

  const ffmpeg = resolveFFmpeg()
  if (!ffmpeg) {
    console.error('❌ No encuentro FFmpeg. Instálalo, ponlo en PATH o exporta FFMPEG=/ruta/a/ffmpeg')
    process.exit(1)
  }
  const ffprobe = resolveFFprobe(ffmpeg)
  console.log(`FFmpeg : ${ffmpeg}`)
  if (ffprobe) console.log(`FFprobe: ${ffprobe}`)
  console.log()

  let clipPath = INPUT_ARG ? resolve(INPUT_ARG) : RAW_PATH
  if (SKIP_AI) {
    if (!existsSync(clipPath)) {
      console.error(`❌ --skip-ai pero no existe el clip ${clipPath}`)
      process.exit(1)
    }
    console.log(`▶ Reutilizando clip existente: ${clipPath}`)
  } else {
    console.log('▶ 1/2  Generando clip con fal.ai Kling…')
    const url = await callKling(FULL_PROMPT, 5)
    console.log(`   → Descargando: ${url.slice(0, 80)}…`)
    await downloadTo(url, RAW_PATH)
    console.log(`   ✓ Clip bruto: ${RAW_PATH}`)
    clipPath = RAW_PATH
  }

  console.log('\n▶ 2/2  Componiendo vídeo final…')
  compose(ffmpeg, ffprobe, clipPath)

  console.log('\n' + '═'.repeat(58))
  console.log(`🎉  Listo: ${OUT_PATH}`)
  console.log('═'.repeat(58) + '\n')
}

main().catch(err => {
  console.error('\n❌', err.message || err)
  process.exit(1)
})
