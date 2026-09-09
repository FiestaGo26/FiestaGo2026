#!/usr/bin/env node
/**
 * Voz en off (ElevenLabs) para los reels híbridos.
 *
 * Va en OFF a propósito: sin diálogo a cámara no hace falta lipsync ni el
 * audio nativo del modelo de vídeo, que cuesta un 50% más y en español de
 * España rinde peor.
 *
 * Sin ELEVENLABS_API_KEY genera una pista de silencio de la duración exacta
 * del reel, para poder renderizar y revisar el montaje igualmente.
 *
 * USO:
 *   node scripts/gen-cine-voice.mjs                      # todos
 *   node scripts/gen-cine-voice.mjs cine-01-el-fichaje   # uno
 */
import './env.mjs'
import { writeFileSync, mkdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadTs } from './load-ts.mjs'

const ROOT    = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = join(ROOT, 'public', 'voices')

const API_KEY  = process.env.ELEVENLABS_API_KEY
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID
const MODEL_ID = process.env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2'

const { REELS, totalDuration } = await loadTs(join(ROOT, 'src/cinematic/shots.ts'))
const only = process.argv[2]
const reels = only ? REELS.filter(r => r.slug === only) : REELS

if (!reels.length) {
  console.error(`❌ No hay reel con slug "${only}"`)
  process.exit(1)
}

mkdirSync(OUT_DIR, { recursive: true })

const silent = !API_KEY || !VOICE_ID
if (silent) {
  console.log('⚠  Sin ELEVENLABS_API_KEY / ELEVENLABS_VOICE_ID → genero pistas de SILENCIO.')
  console.log('   Sirven para revisar el montaje; pon las claves cuando quieras la voz real.\n')
}

for (const r of reels) {
  const outPath = join(OUT_DIR, `${r.slug}.mp3`)
  console.log(`▶ ${r.slug} · ${r.voiceover.length} chars · ${totalDuration(r)}s`)

  if (silent) {
    execFileSync('ffmpeg', [
      '-y', '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo',
      '-t', String(totalDuration(r)), '-c:a', 'libmp3lame', '-q:a', '9', outPath,
    ], { stdio: 'pipe' })
    console.log('  ✓ pista de silencio\n')
    continue
  }

  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`, {
    method: 'POST',
    headers: { 'xi-api-key': API_KEY, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({
      text: r.voiceover,
      model_id: MODEL_ID,
      voice_settings: { stability: 0.55, similarity_boost: 0.80, style: 0.35, use_speaker_boost: true },
    }),
  })

  if (!res.ok) {
    console.error(`  ✗ ElevenLabs ${res.status}: ${(await res.text()).slice(0, 300)}\n`)
    continue
  }

  const buf = Buffer.from(await res.arrayBuffer())
  writeFileSync(outPath, buf)
  console.log(`  ✓ ${(buf.length / 1024).toFixed(1)} KB\n`)
}

console.log('✅ Listo. Siguiente: npm run cine:render')
