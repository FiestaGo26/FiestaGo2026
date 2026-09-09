#!/usr/bin/env node
/**
 * Renderiza los reels híbridos a MP4 (1080×1920 · 30 fps).
 *
 * Antes necesita:
 *   - public/shots/{slug}/*.mp4   → npm run cine:shots (o :shots-dry)
 *   - public/voices/{slug}.mp3    → npm run cine:voice
 *
 * USO:
 *   node scripts/render-cine.mjs                      # todos
 *   node scripts/render-cine.mjs cine-01-el-fichaje   # uno
 */
import { bundle } from '@remotion/bundler'
import { renderMedia, selectComposition } from '@remotion/renderer'
import { mkdirSync, existsSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadTs } from './load-ts.mjs'

const ROOT    = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = join(ROOT, 'out')
mkdirSync(OUT_DIR, { recursive: true })

const { REELS, aiShots } = await loadTs(join(ROOT, 'src/cinematic/shots.ts'))

// --reel <json> [salida.mp4] renderiza un reel construido en caliente.
const argv     = process.argv.slice(2)
const reelIdx  = argv.indexOf('--reel')
const adhoc    = reelIdx !== -1 ? JSON.parse(readFileSync(argv[reelIdx + 1], 'utf8')) : null
const adhocOut = reelIdx !== -1 ? argv[reelIdx + 2] : null
const only     = reelIdx === -1 ? argv[0] : null

const reels = adhoc ? [adhoc] : only ? REELS.filter(r => r.slug === only) : REELS

if (!reels.length) {
  console.error(`❌ No hay reel con slug "${only}"`)
  process.exit(1)
}

// Comprobamos los assets ANTES de bundlear: fallar aquí cuesta 1s,
// fallar a mitad del render cuesta minutos.
let missing = false
for (const r of reels) {
  for (const s of aiShots(r)) {
    const p = join(ROOT, 'public', 'shots', r.slug, `${s.id}.mp4`)
    if (!existsSync(p)) {
      console.error(`❌ Falta la toma ${r.slug}/${s.id}.mp4`)
      missing = true
    }
  }
  // Los reels de diálogo no tienen pista global: el audio va en cada clip.
  if (r.voiceMode !== 'dialogue' &&
      !existsSync(join(ROOT, 'public', 'voices', `${r.slug}.mp3`))) {
    console.error(`❌ Falta la voz ${r.slug}.mp3`)
    missing = true
  }
}
if (missing) {
  console.error('\n   Ejecuta primero:  npm run cine:shots-dry && npm run cine:voice')
  process.exit(1)
}

// Remotion se descarga su propio Chrome la primera vez. En entornos con la
// red restringida esa descarga falla, así que dejamos apuntar a un Chromium
// ya instalado. En local no hace falta tocar nada: se queda en null y
// Remotion resuelve solo.
function findChrome() {
  if (process.env.REMOTION_BROWSER_EXECUTABLE) return process.env.REMOTION_BROWSER_EXECUTABLE
  const candidates = [
    '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell',
    '/opt/pw-browsers/chromium',
    '/usr/bin/chromium',
    '/usr/bin/google-chrome',
  ]
  return candidates.find(existsSync) ?? null
}
const browserExecutable = findChrome()
if (browserExecutable) console.log(`🌐 Chromium: ${browserExecutable}`)

console.log('📦 Bundling Remotion...')
const serveUrl = await bundle({ entryPoint: join(ROOT, 'src/index.ts'), webpackOverride: c => c })

for (const r of reels) {
  const outPath = adhocOut || join(OUT_DIR, `${r.slug}.mp4`)
  console.log(`\n▶ ${r.slug}`)

  // El reel ad-hoc va por la composición genérica 'daily': se le pasa el reel
  // entero y se ajusta la duración a la suma real de sus tomas.
  const inputProps = adhoc ? { slug: r.slug, reelData: r } : { slug: r.slug }
  const base = await selectComposition({ serveUrl, id: adhoc ? 'daily' : r.slug, inputProps, browserExecutable })
  const composition = adhoc
    ? { ...base, durationInFrames: Math.round(r.shots.reduce((a, x) => a + x.durationInSeconds, 0) * 30) }
    : base

  await renderMedia({
    composition,
    serveUrl,
    codec: 'h264',
    outputLocation: outPath,
    inputProps,
    browserExecutable,
    concurrency: 1,
    onProgress: ({ progress }) => process.stdout.write(`\r  render ${(progress * 100).toFixed(0)}%   `),
  })
  console.log(`\n  ✓ ${outPath.replace(ROOT + '/', '')}`)
}

console.log(`\n✅ Terminado. MP4 en ${OUT_DIR.replace(ROOT + '/', '')}`)
