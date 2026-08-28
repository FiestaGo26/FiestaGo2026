#!/usr/bin/env node
/**
 * Genera los MP3 de voz IA para cada guión usando ElevenLabs.
 * Guarda cada uno en public/voices/{slug}.mp3 · esos archivos son
 * consumidos por el <Audio> de MarketingVideo.tsx al renderizar.
 *
 * REQUIERE:
 *   ELEVENLABS_API_KEY  · API key
 *   ELEVENLABS_VOICE_ID · id de una voz español España (recomendado: 'Marta' o 'David')
 *
 * USO:
 *   node scripts/gen-voices.mjs                 # todos
 *   node scripts/gen-voices.mjs 01-consultas-activas   # uno concreto
 */

import { writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT      = join(__dirname, '..')
const OUT_DIR   = join(ROOT, 'public', 'voices')

const API_KEY  = process.env.ELEVENLABS_API_KEY
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID
const MODEL_ID = process.env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2'

if (!API_KEY || !VOICE_ID) {
  console.error('❌ Faltan ELEVENLABS_API_KEY o ELEVENLABS_VOICE_ID')
  console.error('   ElevenLabs → API Keys / Voices para obtenerlos')
  process.exit(1)
}

// Cargamos los scripts desde el TS (dinámicamente via tsx si es local; con
// bundler estático si es CI). Aquí simplemente re-declaramos el shape mínimo
// leyendo el fichero como texto — trivial y sin toolchain extra.
const scriptsText = await import('node:fs').then(f => f.readFileSync(join(ROOT, 'src/scripts.ts'), 'utf8'))
// Extraemos slug + voiceover con regex simple. Cada script tiene:
//   slug: 'xx-yyy', ..., voiceover: 'texto largo'
const parsed = []
const rx = /slug:\s*'([^']+)'[\s\S]*?voiceover:\s*\n?\s*([\s\S]*?),\s*\n\s*scenes:/g
let m
while ((m = rx.exec(scriptsText)) !== null) {
  const slug = m[1]
  // voiceover puede ser una concatenación multi-línea con '+', unimos:
  const voRaw = m[2]
  const vo = voRaw
    .split('\n')
    .map(l => l.trim().replace(/^[+']+|['+]+$/g, '').replace(/\\'/g, "'").trim())
    .filter(Boolean)
    .join(' ')
    .replace(/'\s*\+\s*'/g, '')
    .replace(/^'|'$/g, '')
    .trim()
  parsed.push({ slug, voiceover: vo })
}

const only = process.argv[2]
const scripts = only ? parsed.filter(s => s.slug === only) : parsed

if (!scripts.length) {
  console.error(`❌ No hay scripts con slug ${only ? `"${only}"` : ''}`)
  process.exit(1)
}

mkdirSync(OUT_DIR, { recursive: true })

console.log(`🎙  Generando ${scripts.length} voz${scripts.length !== 1 ? 'es' : ''}...`)

for (const s of scripts) {
  const outPath = join(OUT_DIR, `${s.slug}.mp3`)
  console.log(`▶ ${s.slug} · ${s.voiceover.length} chars`)

  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`, {
    method: 'POST',
    headers: {
      'xi-api-key':   API_KEY,
      'Content-Type': 'application/json',
      'Accept':       'audio/mpeg',
    },
    body: JSON.stringify({
      text:     s.voiceover,
      model_id: MODEL_ID,
      voice_settings: {
        stability:         0.55,
        similarity_boost:  0.80,
        style:             0.35,
        use_speaker_boost: true,
      },
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    console.error(`  ✗ ElevenLabs error ${res.status}: ${body.slice(0, 300)}`)
    continue
  }

  const buf = Buffer.from(await res.arrayBuffer())
  writeFileSync(outPath, buf)
  console.log(`  ✓ ${outPath.replace(ROOT + '/', '')} · ${(buf.length / 1024).toFixed(1)} KB`)
}

console.log(`\n✅ Terminado. Los MP3 están en ${OUT_DIR.replace(ROOT + '/', '')}`)
