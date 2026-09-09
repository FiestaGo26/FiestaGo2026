/**
 * Carga un módulo TypeScript desde un script .mjs.
 *
 * Así el guión vive UNA sola vez en src/cinematic/shots.ts (tipado, y es lo
 * que consume Remotion) en lugar de duplicarlo en JS o parsearlo a regex.
 * esbuild ya viene instalado con Remotion; está declarado en devDependencies.
 */
import { build } from 'esbuild'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

export async function loadTs(entryPath, { external = [] } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'fiestago-ts-'))
  const outfile = join(dir, 'mod.mjs')
  try {
    await build({
      entryPoints: [entryPath],
      outfile,
      bundle: true,
      format: 'esm',
      platform: 'node',
      target: 'node20',
      external,
      logLevel: 'silent',
    })
    return await import(pathToFileURL(outfile).href)
  } finally {
    // El import ya está en memoria; el temp se puede tirar.
    setTimeout(() => rmSync(dir, { recursive: true, force: true }), 0)
  }
}
