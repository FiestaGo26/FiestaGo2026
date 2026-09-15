#!/usr/bin/env node
/**
 * Prepara una muestra de voz lista para clonar en ElevenLabs.
 *
 * Saca el audio de una grabación, le quita los silencios (lo que cuenta es
 * el habla, no la duración del fichero), reduce ruido de fondo, normaliza el
 * volumen y avisa si no llega al mínimo.
 *
 * Por qué importa quitar los silencios: el clonado mide segundos de VOZ.
 * Un fichero de un minuto con medio minuto de pausas cuenta como medio.
 *
 * USO:
 *   node scripts/voice-sample.mjs grabacion.mov muestra.mp3
 */
import { execFileSync } from 'node:child_process'
import { existsSync, statSync } from 'node:fs'
import { probe, detectSilences, keepSegments } from './video-ops.mjs'

// ElevenLabs: 30s es el mínimo del clonado instantáneo; por encima de 3
// minutos no mejora y a veces empeora.
const MIN_SPEECH = 30
const IDEAL_MIN  = 60
const MAX_USEFUL = 180

const [input, output = 'muestra-voz.mp3'] = process.argv.slice(2)
if (!input) {
  console.error('uso: node scripts/voice-sample.mjs <grabación> [salida.mp3]')
  process.exit(2)
}
if (!existsSync(input)) {
  console.error(`❌ No existe: ${input}`)
  process.exit(1)
}

const info = probe(input)
if (!info.hasAudio) {
  console.error('❌ Esa grabación no tiene pista de audio.')
  process.exit(1)
}

console.log(`\n🎙  ${input}\n   ${info.duration.toFixed(1)}s de fichero`)

// Cuánto de eso es voz de verdad
const silences = detectSilences(input, { noiseDb: -35, minDuration: 0.4 })
const keeps    = keepSegments(info.duration, silences, { pad: 0.1 })
const speech   = keeps.reduce((a, s) => a + (s.end - s.start), 0)
console.log(`   ${speech.toFixed(1)}s de voz real (${(info.duration - speech).toFixed(1)}s de silencio)\n`)

// Concatenar solo los tramos hablados, limpiar y normalizar.
//  highpass  → quita el retumbe de la habitación y el aire
//  afftdn    → reduce el ruido de fondo constante (nevera, ordenador)
//  loudnorm  → deja el volumen parejo, que es lo que más ayuda al clonado
const parts = keeps.map((s, i) =>
  `[0:a]atrim=start=${s.start}:end=${s.end},asetpts=PTS-STARTPTS[a${i}];`).join('')
const refs = keeps.map((_, i) => `[a${i}]`).join('')
const filter =
  `${parts}${refs}concat=n=${keeps.length}:v=0:a=1[cat];` +
  `[cat]highpass=f=80,afftdn=nf=-25,loudnorm=I=-18:TP=-2:LRA=9[out]`

execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', input,
  '-filter_complex', filter, '-map', '[out]',
  '-ar', '44100', '-ac', '1', '-c:a', 'libmp3lame', '-q:a', '2', output])

const kb = (statSync(output).size / 1024).toFixed(0)
console.log(`✓ ${output} · ${kb} KB · ${speech.toFixed(1)}s de voz limpia\n`)

if (speech < MIN_SPEECH) {
  console.log(`❌ Insuficiente. ElevenLabs pide ${MIN_SPEECH}s mínimo de voz.`)
  console.log(`   Te faltan ${(MIN_SPEECH - speech).toFixed(0)}s. Graba otra toma más larga.\n`)
  process.exit(1)
}
if (speech < IDEAL_MIN) {
  console.log(`⚠  Llega al mínimo pero va justo. Con ${IDEAL_MIN}s el clon sale bastante mejor.\n`)
} else if (speech > MAX_USEFUL) {
  console.log(`⚠  Más de ${MAX_USEFUL / 60} minutos no aporta y a veces empeora el resultado.`)
  console.log(`   Puedes recortarlo y quedarte con los mejores 1-2 minutos.\n`)
} else {
  console.log('✅ Duración ideal para el clonado instantáneo.\n')
}

console.log('   Súbelo en ElevenLabs → Voices → Add voice → Instant Voice Clone')
console.log('   y pon el voice_id resultante en ELEVENLABS_VOICE_ID.\n')
