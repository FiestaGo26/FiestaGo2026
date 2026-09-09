#!/usr/bin/env node
/**
 * Anima UNA imagen que ya existe → clip de vídeo.
 *
 * Pensado para las imágenes que genera el agente de marketing del panel
 * (/admin/marketing): esas ya están en el bucket `social-posts` de Supabase
 * con URL pública, así que se pueden animar directamente sin volver a
 * generar nada. Te ahorras el paso de Flux: solo pagas el vídeo.
 *
 * USO:
 *   node scripts/animate.mjs <url-imagen> "<movimiento>" [opciones]
 *
 * EJEMPLO:
 *   node scripts/animate.mjs \
 *     "https://xxx.supabase.co/storage/v1/object/public/social-posts/custom/foo.jpg" \
 *     "She turns slowly toward the camera and smiles. Very slow push in." \
 *     --out out/clip-novia.mp4
 *
 * OPCIONES:
 *   --out <ruta>        dónde guardar (por defecto out/animado-<timestamp>.mp4)
 *   --duration <5|10>   segundos (por defecto 5)
 *   --model <nombre>    ver scripts/models.mjs
 *
 * REQUIERE: FAL_KEY (en .env o en el entorno)
 */
import './env.mjs'
import { mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { falRun, download } from './fal.mjs'
import { videoModel, DEFAULT_VIDEO_MODEL } from './models.mjs'
import { NEGATIVE_FALLBACK } from './negative.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

const WITH_VALUE = new Set(['--out', '--duration', '--model'])
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
    } else if (a.startsWith('--')) flags[a] = true
    else positional.push(a)
  }
}

const [imageUrl, motionPrompt] = positional
if (!imageUrl || !motionPrompt) {
  console.error('❌ Faltan argumentos.\n')
  console.error('   node scripts/animate.mjs <url-imagen> "<qué pasa en el plano>"\n')
  console.error('   El movimiento se describe en inglés y en corto. Ejemplos que funcionan:')
  console.error('     "She turns toward the camera and smiles. Slow push in."')
  console.error('     "He lowers the phone, jaw tightening. Almost no camera movement."')
  console.error('     "The couple walk into frame holding hands. Gentle handheld drift."\n')
  process.exit(1)
}

if (!/^https?:\/\//.test(imageUrl)) {
  console.error(`❌ La imagen tiene que ser una URL pública (http/https), no una ruta local.`)
  console.error(`   Recibido: ${imageUrl}`)
  console.error(`   Las del agente de marketing valen: son públicas en el bucket social-posts.`)
  process.exit(1)
}

const duration = Number(flags['--duration'] ?? 5)
if (![5, 10].includes(duration)) {
  console.error(`❌ Kling solo acepta clips de 5 o 10 segundos (has pedido ${duration}).`)
  process.exit(1)
}

const vm = videoModel(flags['--model'] ?? DEFAULT_VIDEO_MODEL)
const outPath = flags['--out'] ?? join(ROOT, 'out', `animado-${Date.now()}.mp4`)
mkdirSync(dirname(outPath), { recursive: true })

const cost = duration * vm.usdPerSecond
console.log(`\n🎬 Animando imagen · ${duration}s · ${vm.resolution} · coste ~$${cost.toFixed(2)}`)
console.log(`   ${imageUrl.slice(0, 90)}${imageUrl.length > 90 ? '…' : ''}\n`)

try {
  process.stdout.write('   generando… ')
  const vid = await falRun(vm.id, {
    prompt:          motionPrompt,
    image_url:       imageUrl,
    duration:        String(duration),
    negative_prompt: NEGATIVE_FALLBACK,
  }, st => process.stdout.write(st[0]))

  const url = vid.video?.url
  if (!url) throw new Error(`El modelo no devolvió vídeo: ${JSON.stringify(vid).slice(0, 200)}`)

  const bytes = await download(url, outPath)
  console.log(` ✓\n\n✅ ${outPath.replace(ROOT + '/', '')} · ${(bytes / 1024 / 1024).toFixed(1)} MB · $${cost.toFixed(2)}\n`)
} catch (err) {
  const m = String(err?.message ?? err)
  if (/not in allowlist|ENOTFOUND|ECONNREFUSED|EAI_AGAIN|fetch failed/i.test(m)) {
    console.error(`\n\n❌ No hay salida de red hacia fal.ai desde esta máquina.\n`)
  } else if (/\b(401|403)\b/.test(m)) {
    console.error(`\n\n❌ FAL_KEY inválida o sin permisos · https://fal.ai/dashboard/keys\n`)
  } else if (/\b(404|403)\b/.test(m) && /image/i.test(m)) {
    console.error(`\n\n❌ fal.ai no pudo leer la imagen. ¿Es pública la URL?\n`)
  } else {
    console.error(`\n\n❌ ${m}\n`)
  }
  process.exit(1)
}
