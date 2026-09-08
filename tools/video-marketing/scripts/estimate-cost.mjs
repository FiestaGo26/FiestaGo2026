#!/usr/bin/env node
/**
 * Calculadora de coste ANTES de gastar. Lee el guión y te dice qué vale.
 *
 * USO:
 *   node scripts/estimate-cost.mjs                       # todos los reels
 *   node scripts/estimate-cost.mjs cine-01-el-fichaje    # uno
 *   node scripts/estimate-cost.mjs --model kling-v3-pro  # comparar modelos
 */
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadTs } from './load-ts.mjs'
import { IMAGE_MODEL, videoModel, DEFAULT_VIDEO_MODEL, VIDEO_MODELS } from './models.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

// Nº medio de intentos por toma. Nadie clava una toma a la primera: este
// factor es lo que separa un presupuesto realista de una sorpresa.
const RETRY_FACTOR = Number(process.env.RETRY_FACTOR || 2.5)

const args = process.argv.slice(2)
const modelIdx = args.indexOf('--model')
const modelName = modelIdx !== -1 ? args[modelIdx + 1] : DEFAULT_VIDEO_MODEL
const only = args.filter(a => !a.startsWith('--') && a !== modelName)[0]

const { REELS, totalDuration, aiShots } = await loadTs(join(ROOT, 'src/cinematic/shots.ts'))
const vm = videoModel(modelName)
const targets = only ? REELS.filter(r => r.slug === only) : REELS

if (!targets.length) {
  console.error(`❌ No hay reel con slug "${only}"`)
  process.exit(1)
}

console.log(`\n💰 Presupuesto · modelo ${modelName} (${vm.resolution}, $${vm.usdPerSecond}/s)`)
console.log(`   Factor de reintentos: ×${RETRY_FACTOR}\n`)

let grandTotal = 0

for (const r of targets) {
  const ai = aiShots(r)
  const aiSeconds = ai.reduce((a, s) => a + s.durationInSeconds, 0)
  const motionCount = r.shots.length - ai.length

  const videoClean = aiSeconds * vm.usdPerSecond
  const imageClean = ai.length * IMAGE_MODEL.usdPerImage
  const clean = videoClean + imageClean
  const real = clean * RETRY_FACTOR
  grandTotal += real

  console.log(`▶ ${r.slug} · ${totalDuration(r)}s totales`)
  console.log(`  ${ai.length} tomas IA (${aiSeconds}s de pago) · ${motionCount} tomas motion graphics (gratis)`)
  console.log(`  Fotogramas inicio : $${imageClean.toFixed(2)}  (${ai.length} × $${IMAGE_MODEL.usdPerImage})`)
  console.log(`  Vídeo             : $${videoClean.toFixed(2)}  (${aiSeconds}s × $${vm.usdPerSecond})`)
  console.log(`  Pasada limpia     : $${clean.toFixed(2)}`)
  console.log(`  Coste realista    : $${real.toFixed(2)}  ← cuenta con este\n`)
}

if (targets.length > 1) console.log(`TOTAL realista: $${grandTotal.toFixed(2)}\n`)

console.log('Comparativa de modelos para el mismo guión:')
for (const [name, m] of Object.entries(VIDEO_MODELS)) {
  const t = targets.reduce((acc, r) => {
    const ai = aiShots(r)
    const secs = ai.reduce((a, s) => a + s.durationInSeconds, 0)
    return acc + (secs * m.usdPerSecond + ai.length * IMAGE_MODEL.usdPerImage) * RETRY_FACTOR
  }, 0)
  console.log(`  ${name.padEnd(20)} $${t.toFixed(2).padStart(7)}  ${m.resolution}  ${m.nota}`)
}
console.log('')
