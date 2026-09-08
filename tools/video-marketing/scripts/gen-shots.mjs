#!/usr/bin/env node
/**
 * Genera las tomas de vídeo IA de un reel híbrido.
 *
 * Para cada toma kind:'ai' hace dos pasos:
 *   1. Flux 1.1 Pro  → el FOTOGRAMA de arranque (la cara del personaje)
 *   2. Kling img2vid → los 5s de movimiento a partir de ese fotograma
 *
 * Encadenar así es lo que abarata: la consistencia de personaje sale del
 * fotograma inicial + el bloque `look` bloqueado, en vez del sistema de
 * "elements" de Kling, que cuesta el doble por segundo.
 *
 * USO:
 *   node scripts/gen-shots.mjs --dry-run              # placeholders · 0 €
 *   node scripts/gen-shots.mjs cine-01-el-fichaje     # de verdad · gasta
 *   node scripts/gen-shots.mjs --only 02-ventana      # repetir UNA toma
 *   node scripts/gen-shots.mjs --frames-only          # solo imágenes ($0.04 c/u)
 *   node scripts/gen-shots.mjs --model kling-v3-pro   # subir a 1080p
 *
 * REQUIERE (salvo en --dry-run): FAL_KEY
 */
import { mkdirSync, existsSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadTs } from './load-ts.mjs'
import { falRun, download } from './fal.mjs'
import { IMAGE_MODEL, videoModel, DEFAULT_VIDEO_MODEL } from './models.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'

// Parser: los flags con valor (--only, --model) consumen el argumento
// siguiente; lo que quede suelto es el slug del reel.
const WITH_VALUE = new Set(['--only', '--model'])
const flags = {}
const positional = []
{
  const argv = process.argv.slice(2)
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (WITH_VALUE.has(a)) {
      const v = argv[++i]
      if (v === undefined) { console.error(`❌ ${a} necesita un valor`); process.exit(1) }
      flags[a] = v
    } else if (a.startsWith('--')) {
      flags[a] = true
    } else {
      positional.push(a)
    }
  }
}
const dryRun     = flags['--dry-run'] === true
const framesOnly = flags['--frames-only'] === true
const force      = flags['--force'] === true
const onlyShot   = flags['--only'] ?? null
const modelName  = flags['--model'] ?? DEFAULT_VIDEO_MODEL
const reelSlug   = positional[0]

const { REELS, aiShots, NEGATIVE } = await loadTs(join(ROOT, 'src/cinematic/shots.ts'))
const vm = videoModel(modelName)

const reels = reelSlug ? REELS.filter(r => r.slug === reelSlug) : REELS
if (!reels.length) {
  console.error(`❌ No hay reel con slug "${reelSlug}". Disponibles: ${REELS.map(r => r.slug).join(', ')}`)
  process.exit(1)
}

let spent = 0

for (const r of reels) {
  const framesDir = join(ROOT, 'public', 'frames', r.slug)
  const shotsDir  = join(ROOT, 'public', 'shots',  r.slug)
  mkdirSync(framesDir, { recursive: true })
  mkdirSync(shotsDir,  { recursive: true })

  const shots = aiShots(r).filter(s => !onlyShot || s.id === onlyShot)
  if (!shots.length) {
    console.error(`❌ La toma "${onlyShot}" no existe en ${r.slug}`)
    process.exit(1)
  }

  console.log(`\n🎬 ${r.slug} · ${shots.length} toma(s) IA · modelo ${modelName}${dryRun ? ' · DRY RUN' : ''}`)

  for (const shot of shots) {
    const framePath = join(framesDir, `${shot.id}.jpg`)
    const clipPath  = join(shotsDir,  `${shot.id}.mp4`)
    console.log(`\n▶ ${shot.id}`)

    if (dryRun) {
      makePlaceholder(clipPath, framePath, shot, r.slug)
      console.log(`  ✓ placeholder ${shot.durationInSeconds}s · 0,00 $`)
      continue
    }

    // ─── 1. Fotograma de arranque ───────────────────────────────
    let imageUrl
    if (existsSync(framePath) && !force) {
      console.log('  · fotograma ya existe (usa --force para regenerar)')
      imageUrl = null
    } else {
      process.stdout.write('  · generando fotograma… ')
      const img = await falRun(IMAGE_MODEL.id, {
        prompt:          shot.framePrompt,
        image_size:      'portrait_16_9',
        num_images:      1,
        output_format:   'jpeg',
        safety_tolerance: '2',
      })
      imageUrl = img.images?.[0]?.url
      if (!imageUrl) throw new Error(`Flux no devolvió imagen para ${shot.id}`)
      const bytes = await download(imageUrl, framePath)
      spent += IMAGE_MODEL.usdPerImage
      console.log(`✓ ${(bytes / 1024).toFixed(0)} KB · $${IMAGE_MODEL.usdPerImage}`)
    }

    if (framesOnly) {
      console.log('  · --frames-only: no genero vídeo')
      continue
    }
    if (!imageUrl) {
      console.log('  ⚠ sin URL del fotograma (ya estaba en disco). Usa --force para regenerar y encadenar.')
      continue
    }

    // ─── 2. Movimiento ──────────────────────────────────────────
    // Reusamos la URL del CDN de fal: nos ahorra subir la imagen.
    if (![5, 10].includes(shot.durationInSeconds)) {
      throw new Error(`${shot.id}: Kling solo acepta clips de 5 o 10s (tiene ${shot.durationInSeconds}s)`)
    }
    process.stdout.write('  · generando vídeo… ')
    const vid = await falRun(vm.id, {
      prompt:          shot.motionPrompt,
      image_url:       imageUrl,
      duration:        String(shot.durationInSeconds),
      negative_prompt: NEGATIVE,
    }, st => process.stdout.write(`${st[0]}`))

    const videoUrl = vid.video?.url
    if (!videoUrl) throw new Error(`Kling no devolvió vídeo para ${shot.id}: ${JSON.stringify(vid).slice(0, 200)}`)
    const bytes = await download(videoUrl, clipPath)
    const cost = shot.durationInSeconds * vm.usdPerSecond
    spent += cost
    console.log(` ✓ ${(bytes / 1024 / 1024).toFixed(1)} MB · $${cost.toFixed(2)}`)
  }
}

console.log(`\n${dryRun ? '✅ Dry run terminado · gastado 0,00 $' : `✅ Terminado · gastado $${spent.toFixed(2)}`}`)
if (dryRun) console.log('   Los MP4 son placeholders: sirven para revisar ritmo, subtítulos y CTA antes de pagar.')
console.log(`   Siguiente: npm run cine:voice && npm run cine:render\n`)

// ─── Placeholder para dry-run ───────────────────────────────────
// Un clip sintético con el id de la toma y su prompt, para que la pieza se
// pueda montar y revisar entera sin llamar a ninguna API.
function makePlaceholder(clipPath, framePath, shot, slug) {
  const label = `${shot.id}`.replace(/[:'\\]/g, ' ')
  const wrapped = wrap(shot.motionPrompt, 34).slice(0, 5)
  const drawLines = wrapped.map((line, i) =>
    `drawtext=fontfile=${FONT}:text='${esc(line)}':fontcolor=0xA29D91:fontsize=34` +
    `:x=(w-text_w)/2:y=h/2+${i * 46}`
  ).join(',')

  const vf = [
    `drawtext=fontfile=${FONT}:text='${esc(label)}':fontcolor=0xF5F1E8:fontsize=64` +
      `:x=(w-text_w)/2:y=h/2-160`,
    `drawtext=fontfile=${FONT}:text='TOMA IA - PLACEHOLDER':fontcolor=0xE8553E:fontsize=30` +
      `:x=(w-text_w)/2:y=h/2-240`,
    drawLines,
  ].join(',')

  execFileSync('ffmpeg', [
    '-y', '-f', 'lavfi',
    '-i', `color=c=0x1A1D22:s=1080x1920:d=${shot.durationInSeconds}:r=30`,
    '-vf', vf,
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '28',
    clipPath,
  ], { stdio: 'pipe' })

  // Un fotograma suelto para poder ojear el encuadre en public/frames/
  execFileSync('ffmpeg', [
    '-y', '-i', clipPath, '-frames:v', '1', '-q:v', '4', framePath,
  ], { stdio: 'pipe' })
}

function esc(s) {
  return String(s).replace(/\\/g, '').replace(/'/g, '').replace(/:/g, '\\:').replace(/%/g, '')
}

function wrap(text, width) {
  const out = []
  let line = ''
  for (const word of String(text).split(/\s+/)) {
    if ((line + ' ' + word).trim().length > width) { out.push(line.trim()); line = word }
    else line += ' ' + word
  }
  if (line.trim()) out.push(line.trim())
  return out
}
