#!/usr/bin/env node
/**
 * Vídeo diario para redes · máximo 15 segundos.
 *
 * Reutiliza toda la maquinaria que ya existe — lib/content-planner.ts elige
 * pilar y tema del día con anti-repetición y Claude redacta el guion — y solo
 * cambia el productor: en vez del avatar de HeyGen, tomas cinematográficas
 * con Kling + lipsync.
 *
 * ESTRUCTURA (15s):
 *   toma 1  5s  presentador hablando  (hook)
 *   toma 2  5s  presentador hablando  (cuerpo)
 *   toma 3  5s  tarjeta de CTA        (motion graphics, gratis)
 *
 * LA CARA DEL PRESENTADOR se fija una vez y se reutiliza siempre:
 * define DAILY_PRESENTER_IMAGE_URL con una imagen pública aprobada por ti.
 * Así el coste de imagen es 0 y —más importante— la marca tiene una cara
 * estable en vez de una distinta cada mañana.
 *
 * USO:
 *   node scripts/daily.mjs --dry-run     # sin gastar y sin escribir en la BD
 *   node scripts/daily.mjs               # producción
 *   node scripts/daily.mjs --force       # rehacer el de hoy
 */
import './env.mjs'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadTs } from './load-ts.mjs'
import { select, insert, upload } from './supabase.mjs'

const ROOT     = join(dirname(fileURLToPath(import.meta.url)), '..')
const REPO     = join(ROOT, '..', '..')
const BUCKET   = process.env.DAILY_BUCKET || 'social-posts'
const MAX_SECS = Number(process.env.DAILY_MAX_SECONDS || 15)

const args   = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const force  = args.includes('--force')

const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Madrid' })
const slug  = `daily-${today}`

console.log(`\n📅 Vídeo diario · ${today}${dryRun ? ' · DRY RUN' : ''}\n`)

// ─── 1. ¿Ya hay vídeo de hoy? ────────────────────────────────────
if (!dryRun && !force) {
  const rows = await select('content_videos',
    `scheduled_for=eq.${today}&select=id,heygen_status&limit=1`)
  if (rows.length) {
    console.log(`✓ Ya existe vídeo para ${today} (${rows[0].heygen_status}). Nada que hacer.`)
    console.log('  Usa --force para rehacerlo.\n')
    process.exit(0)
  }
}

// ─── 2. Pilar, tema y guion ──────────────────────────────────────
// Dos tomas habladas de 5s = 10s de voz. El CTA va en la tarjeta final,
// así que el guion se pide para los segundos que realmente se hablan.
const SPOKEN_SHOTS   = 2
const SHOT_SECONDS   = 5
const spokenSeconds  = SPOKEN_SHOTS * SHOT_SECONDS

// El planner vive en la app y arrastra el SDK de Anthropic. Solo lo cargamos
// cuando de verdad hace falta, para que el ensayo en seco funcione sin tener
// instaladas las dependencias de la raíz.
const useSample = dryRun && !process.env.ANTHROPIC_API_KEY

let pillar, topic, content
if (useSample) {
  console.log('· Sin ANTHROPIC_API_KEY: pilar, tema y guion de ejemplo para el ensayo\n')
  pillar  = { id: 'demo', label: 'Demo (ensayo en seco)', ctaUrl: 'fiestago.es/registro-proveedor' }
  topic   = 'Ensayo del pipeline diario'
  content = {
    script:   'Esta semana hay parejas buscando fotógrafo en tu ciudad. Solo ven a quien está dado de alta.',
    caption:  '(caption de ejemplo)',
    hashtags: ['#FiestaGo'],
  }
} else {
  const planner = await loadTs(join(REPO, 'lib/content-planner.ts'),
    { external: ['@anthropic-ai/sdk'] })
  pillar = planner.pickPillarForToday()

  let recentTopics = []
  if (!dryRun) {
    const recents = await select('content_videos',
      `pillar=eq.${encodeURIComponent(pillar.id)}&select=topic&order=created_at.desc&limit=14`)
    recentTopics = recents.map(r => r.topic).filter(Boolean)
  }
  topic = planner.pickTopic(pillar, recentTopics)
  content = await planner.generateContent({ pillar, topic, maxSeconds: spokenSeconds })
}
console.log(`▶ Pilar: ${pillar.label}\n▶ Tema:  ${topic}\n`)
console.log(`▶ Guion (${content.script.split(/\s+/).length} palabras):\n  "${content.script}"\n`)

// ─── 3. Construir el reel ────────────────────────────────────────
const chars       = await loadTs(join(ROOT, 'src/cinematic/characters.ts'))
const presenterId = process.env.DAILY_CHARACTER || 'elena'
const presenter   = chars.character(presenterId)
const { LOOK }    = chars

const lines = splitIntoLines(content.script, SPOKEN_SHOTS)
console.log('▶ Reparto de frases:')
lines.forEach((l, i) => console.log(`  ${i + 1}. "${l}"`))

const presenterImage = process.env.DAILY_PRESENTER_IMAGE_URL
if (!presenterImage && !dryRun) {
  console.log('\n⚠  Sin DAILY_PRESENTER_IMAGE_URL: se generará una cara nueva ($0,04)')
  console.log('   y puede no parecerse a la de ayer. Fija una imagen aprobada.\n')
}

const reel = {
  slug,
  title:     `Vídeo diario ${today}`,
  target:    pillar.id?.startsWith('client') ? 'client' : 'provider',
  voiceMode: 'dialogue',
  voiceover: '',
  ctaUrl:    pillar.ctaUrl,
  shots: [
    ...lines.map((line, i) => ({
      kind: 'ai',
      id:   `0${i + 1}-habla`,
      durationInSeconds: SHOT_SECONDS,
      characterId: presenterId,
      ...(presenterImage ? { imageUrl: presenterImage } : {
        framePrompt:
          `Medium close shot of ${presenter.look}, speaking directly to camera in a bright ` +
          `modern office with soft depth of field behind her, confident and warm, ${LOOK}`,
      }),
      motionPrompt: 'She speaks one short line directly to camera. Static shot, minimal movement.',
      dialogue: { characterId: presenterId, line },
      subtitle: line,
    })),
    {
      kind: 'motion',
      id:   '03-cta',
      durationInSeconds: MAX_SECS - spokenSeconds,
      kicker: 'Date de alta\ngratis',
      sub: pillar.ctaUrl,
      bgAccent: true,
    },
  ],
}

const total = reel.shots.reduce((a, s) => a + s.durationInSeconds, 0)
console.log(`\n▶ Duración: ${total}s (máximo ${MAX_SECS}s)`)
if (total > MAX_SECS) {
  console.error(`❌ El reel se pasa del máximo. Revisa DAILY_MAX_SECONDS.`)
  process.exit(1)
}

// ─── 4. Generar tomas y renderizar ───────────────────────────────
const reelPath = join(ROOT, '.daily-reel.json')
mkdirSync(dirname(reelPath), { recursive: true })
writeFileSync(reelPath, JSON.stringify(reel, null, 2))

run('node', ['scripts/gen-shots.mjs', '--reel', reelPath, ...(dryRun ? ['--dry-run'] : [])])
const outPath = join(ROOT, 'out', `${slug}.mp4`)
mkdirSync(join(ROOT, 'out'), { recursive: true })
run('node', ['scripts/render-cine.mjs', '--reel', reelPath, outPath])

const sizeMb = (readFileSync(outPath).length / 1024 / 1024).toFixed(1)
console.log(`\n✓ ${outPath.replace(ROOT + '/', '')} · ${sizeMb} MB`)

if (dryRun) {
  console.log('\n✅ Dry run terminado · 0 € gastados · no se ha escrito en la base de datos\n')
  process.exit(0)
}

// ─── 5. Subir y registrar ────────────────────────────────────────
console.log('\n· Subiendo a Supabase Storage…')
const videoUrl = await upload(BUCKET, `daily/${slug}.mp4`, readFileSync(outPath), 'video/mp4')
console.log(`  ✓ ${videoUrl}`)

const row = await insert('content_videos', {
  scheduled_for:    today,
  pillar:           pillar.id,
  topic,
  script:           content.script,
  caption:          content.caption,
  hashtags:         content.hashtags,
  cta_url:          pillar.ctaUrl,
  // No hay columna de origen en la tabla; marcamos la procedencia aquí para
  // poder distinguir estos de los de HeyGen sin necesidad de migración.
  heygen_video_id:  `cinematic:${slug}`,
  heygen_status:    'completed',
  video_url:        videoUrl,
  duration_seconds: total,
  generation_started_at: new Date().toISOString(),
  completed_at:     new Date().toISOString(),
})
console.log(`  ✓ content_videos ${row.id}\n`)
console.log('✅ Listo. Aparece en /admin → Contenido para que lo apruebes.\n')

// ─── Utilidades ──────────────────────────────────────────────────

/** Reparte el guion en n frases equilibradas, respetando los puntos. */
function splitIntoLines(script, n) {
  const sentences = script.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean)
  if (sentences.length <= n) {
    // Menos frases que tomas: rellenamos con lo que haya.
    return Array.from({ length: n }, (_, i) => sentences[i] ?? sentences[sentences.length - 1] ?? '')
  }
  // Reparto voraz equilibrando por número de palabras.
  const words = sentences.map(s => s.split(/\s+/).length)
  const totalW = words.reduce((a, b) => a + b, 0)
  const groups = Array.from({ length: n }, () => [])
  let gi = 0, acc = 0
  sentences.forEach((s, i) => {
    groups[gi].push(s)
    acc += words[i]
    if (gi < n - 1 && acc >= (totalW / n) * (gi + 1)) gi++
  })
  return groups.map(g => g.join(' '))
}

function run(cmd, argv) {
  console.log(`\n$ ${cmd} ${argv.join(' ')}`)
  execFileSync(cmd, argv, { cwd: ROOT, stdio: 'inherit' })
}
