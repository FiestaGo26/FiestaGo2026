#!/usr/bin/env node
/**
 * Transcripción en español con tiempos por palabra.
 *
 * Por defecto usa faster-whisper EN LOCAL: gratis, sin límite y sin mandar
 * tu grabación a ningún sitio. Con --fal usa Whisper en fal.ai, que sale a
 * céntimos, por si no quieres instalar Python.
 *
 * USO:
 *   node scripts/transcribe.mjs grabacion.mp4 transcript.json
 *   node scripts/transcribe.mjs grabacion.mp4 transcript.json --model medium
 */
import './env.mjs'
import { execFileSync } from 'node:child_process'
import { existsSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { falRun } from './fal.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))

export async function transcribe(input, output, { model = 'small', useFal = false } = {}) {
  if (!existsSync(input)) throw new Error(`No existe el archivo: ${input}`)

  if (useFal) {
    const res = await falRun('fal-ai/whisper', {
      audio_url: input,        // fal acepta URL pública o data URI
      task: 'transcribe',
      language: 'es',
      chunk_level: 'word',
    })
    writeFileSync(output, JSON.stringify(res, null, 2))
    return output
  }

  try {
    execFileSync('python3', [join(HERE, 'py', 'transcribe.py'), input, output, model],
      { stdio: 'inherit' })
  } catch (err) {
    throw new Error(
      'La transcripción local falló. Comprueba que tienes Python y faster-whisper:\n' +
      '  pip install faster-whisper\n' +
      'O usa --fal para transcribir en la nube.'
    )
  }
  return output
}

// Ejecutable directo
if (import.meta.url === `file://${process.argv[1]}`) {
  const [input, output] = process.argv.slice(2).filter(a => !a.startsWith('--'))
  const argv  = process.argv.slice(2)
  const model = argv.includes('--model') ? argv[argv.indexOf('--model') + 1] : 'small'
  if (!input || !output) {
    console.error('uso: node scripts/transcribe.mjs <vídeo> <salida.json> [--model small|medium] [--fal]')
    process.exit(2)
  }
  await transcribe(input, output, { model, useFal: argv.includes('--fal') })
}
