#!/usr/bin/env node
/**
 * Renderiza los 10 MP4 de marketing en secuencia usando Remotion.
 *
 * Requiere haber corrido antes `npm run generate-voices` (o al menos que
 * existan los MP3 en public/voices/).
 *
 * USO:
 *   node scripts/render-all.mjs                       # todos
 *   node scripts/render-all.mjs 01-consultas-activas  # uno concreto
 */

import { bundle } from '@remotion/bundler'
import { renderMedia, selectComposition } from '@remotion/renderer'
import { mkdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT      = join(__dirname, '..')
const OUT_DIR   = join(ROOT, 'out')

mkdirSync(OUT_DIR, { recursive: true })

// Bundle una vez (dura 30-60s en frío)
console.log('📦 Bundling Remotion...')
const serveUrl = await bundle({
  entryPoint: join(ROOT, 'src/index.ts'),
  webpackOverride: (c) => c,
})

// Cargamos los slugs desde scripts.ts
// scripts.ts (los 10 guiones) + ceo-agent.ts (vídeo del Agente CEO)
const scriptsText = await import('node:fs').then(f =>
  ['src/scripts.ts', 'src/ceo-agent.ts'].map(p => f.readFileSync(join(ROOT, p), 'utf8')).join('\n'))
const slugs = []
const rx = /slug:\s*'([^']+)'/g
let m
while ((m = rx.exec(scriptsText)) !== null) slugs.push(m[1])

const only = process.argv[2]
const targets = only ? slugs.filter(s => s === only) : slugs

console.log(`🎬 Renderizando ${targets.length} vídeo${targets.length !== 1 ? 's' : ''}\n`)

for (const slug of targets) {
  const outPath = join(OUT_DIR, `${slug}.mp4`)
  // Sin MP3 de voz (p. ej. sin ElevenLabs) se renderiza mudo en vez de fallar
  const noVoice = !existsSync(join(ROOT, 'public', 'voices', `${slug}.mp3`))
  console.log(`▶ ${slug}${noVoice ? ' (sin voz)' : ''}`)

  const composition = await selectComposition({
    serveUrl,
    id: slug,
    ...(process.env.REMOTION_BROWSER ? { browserExecutable: process.env.REMOTION_BROWSER } : {}),
    inputProps: { slug, noVoice },
  })

  await renderMedia({
    composition,
    serveUrl,
    codec: 'h264',
    outputLocation: outPath,
    inputProps: { slug, noVoice },
    concurrency: 1,
    ...(process.env.REMOTION_BROWSER ? { browserExecutable: process.env.REMOTION_BROWSER } : {}),
    onProgress: ({ progress }) => {
      process.stdout.write(`\r  render ${(progress * 100).toFixed(0)}%   `)
    },
  })
  console.log(`\n  ✓ ${outPath.replace(ROOT + '/', '')}\n`)
}

console.log(`✅ Terminado. Los MP4 están en ${OUT_DIR.replace(ROOT + '/', '')}`)
