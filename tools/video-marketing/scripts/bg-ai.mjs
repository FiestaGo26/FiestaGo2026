/**
 * Quita el fondo de un vídeo SIN croma físico, usando fal.
 *
 * El modelo devuelve la toma sobre verde puro; el fondo definitivo lo pone
 * después el chromakey local, que ya está probado. Así la parte de pago se
 * limita a separar al sujeto.
 *
 * fal necesita leer el vídeo desde una URL pública, así que primero se sube
 * al Storage de Supabase y se borra el rastro al terminar no es automático:
 * el fichero queda en el bucket bajo `tmp/`.
 */
import { readFileSync } from 'node:fs'
import { basename } from 'node:path'
import { falRun, download } from './fal.mjs'
import { upload } from './supabase.mjs'
import { BG_REMOVAL_MODEL } from './models.mjs'
import { probe } from './video-ops.mjs'

export async function removeBackgroundAI(input, output) {
  const seconds = probe(input).duration
  const cost = seconds * BG_REMOVAL_MODEL.usdPerSecond
  console.log(`  · ${seconds.toFixed(1)}s → coste estimado $${cost.toFixed(2)}`)

  const name = `tmp/${Date.now()}-${basename(input)}`
  process.stdout.write('  · subiendo el vídeo para que fal pueda leerlo… ')
  const videoUrl = await upload(
    process.env.DAILY_BUCKET || 'social-posts', name, readFileSync(input), 'video/mp4')
  console.log('✓')

  process.stdout.write('  · separando al sujeto… ')
  const res = await falRun(BG_REMOVAL_MODEL.id, { video_url: videoUrl },
    st => process.stdout.write(st[0]))

  const url = res.video?.url
  if (!url) throw new Error(`El modelo no devolvió vídeo: ${JSON.stringify(res).slice(0, 200)}`)
  await download(url, output)
  console.log(` ✓ $${cost.toFixed(2)}`)
  console.log(`  · queda una copia temporal en el bucket: ${name}`)
  return output
}
