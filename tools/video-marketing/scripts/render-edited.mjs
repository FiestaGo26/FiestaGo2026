#!/usr/bin/env node
/** Render de la composición 'edited'. Lo llama scripts/edit.mjs. */
import { bundle } from '@remotion/bundler'
import { renderMedia, selectComposition } from '@remotion/renderer'
import { existsSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const [propsPath, outPath, seconds] = process.argv.slice(2)

function findChrome() {
  if (process.env.REMOTION_BROWSER_EXECUTABLE) return process.env.REMOTION_BROWSER_EXECUTABLE
  return [
    '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell',
    '/opt/pw-browsers/chromium', '/usr/bin/chromium', '/usr/bin/google-chrome',
  ].find(existsSync) ?? null
}

const inputProps = JSON.parse(readFileSync(propsPath, 'utf8'))
const serveUrl = await bundle({ entryPoint: join(ROOT, 'src/index.ts'), webpackOverride: c => c })
const browserExecutable = findChrome()

const base = await selectComposition({ serveUrl, id: 'edited', inputProps, browserExecutable })
await renderMedia({
  composition: { ...base, durationInFrames: Math.max(1, Math.round(Number(seconds) * 30)) },
  serveUrl,
  codec: 'h264',
  outputLocation: outPath,
  inputProps,
  browserExecutable,
  concurrency: 1,
  onProgress: ({ progress }) => process.stdout.write(`\r  render ${(progress * 100).toFixed(0)}%   `),
})
console.log('')
