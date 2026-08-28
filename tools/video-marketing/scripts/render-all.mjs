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
import { mkdirSync } from 'node:fs'
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
const scriptsText = await import('node:fs').then(f => f.readFileSync(join(ROOT, 'src/scripts.ts'), 'utf8'))
const slugs = []
const rx = /slug:\s*'([^']+)'/g
let m
while ((m = rx.exec(scriptsText)) !== null) slugs.push(m[1])

const only = process.argv[2]
const targets = only ? slugs.filter(s => s === only) : slugs

console.log(`🎬 Renderizando ${targets.length} vídeo${targets.length !== 1 ? 's' : ''}\n`)

for (const slug of targets) {
  const outPath = join(OUT_DIR, `${slug}.mp4`)
  console.log(`▶ ${slug}`)

  const composition = await selectComposition({
    serveUrl,
    id: slug,
    inputProps: { slug },
  })

  await renderMedia({
    composition,
    serveUrl,
    codec: 'h264',
    outputLocation: outPath,
    inputProps: { slug },
    concurrency: 1,
    onProgress: ({ progress }) => {
      process.stdout.write(`\r  render ${(progress * 100).toFixed(0)}%   `)
    },
  })
  console.log(`\n  ✓ ${outPath.replace(ROOT + '/', '')}\n`)
}

console.log(`✅ Terminado. Los MP4 están en ${OUT_DIR.replace(ROOT + '/', '')}`)
