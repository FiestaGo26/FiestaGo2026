#!/usr/bin/env node
/**
 * Comprueba que esta máquina puede montar vídeos, y dice exactamente qué
 * falta si algo no está.
 *
 *   node scripts/doctor.mjs
 */
import './env.mjs'
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const rows = []

const ok   = (what, detail = '')  => rows.push({ icon: '✓', what, detail, level: 'ok' })
const warn = (what, detail = '')  => rows.push({ icon: '!', what, detail, level: 'warn' })
const bad  = (what, detail = '')  => rows.push({ icon: '✗', what, detail, level: 'bad' })

function version(cmd, args = ['--version']) {
  const r = spawnSync(cmd, args, { encoding: 'utf8' })
  if (r.error) return null
  return String(r.stdout || r.stderr).split('\n')[0].trim()
}

// ── Imprescindible para montar tus grabaciones ───────────────────
const node = process.versions.node
Number(node.split('.')[0]) >= 20
  ? ok('Node', `v${node}`)
  : bad('Node', `v${node} · hace falta 20 o superior`)

const ff = version('ffmpeg', ['-version'])
ff ? ok('ffmpeg', ff.slice(0, 40))
   : bad('ffmpeg', 'macOS: brew install ffmpeg · Windows: winget install ffmpeg')

version('ffprobe', ['-version']) ? ok('ffprobe') : bad('ffprobe', 'viene con ffmpeg')

existsSync(join(ROOT, 'node_modules', 'remotion'))
  ? ok('Dependencias', 'node_modules instalado')
  : bad('Dependencias', 'ejecuta:  npm install')

// ── Subtítulos ───────────────────────────────────────────────────
const py = version('python3') || version('python')
if (!py) {
  warn('Python', 'sin él no hay subtítulos automáticos (o usa --fal)')
} else {
  ok('Python', py)
  const has = spawnSync(py.toLowerCase().includes('python 3') ? 'python3' : 'python3',
    ['-c', 'import faster_whisper; print(faster_whisper.__version__)'], { encoding: 'utf8' })
  has.status === 0
    ? ok('faster-whisper', `v${String(has.stdout).trim()}`)
    : bad('faster-whisper', 'ejecuta:  pip install faster-whisper')
}

// ── Claves (solo para lo que las necesita) ───────────────────────
process.env.FAL_KEY
  ? ok('FAL_KEY', 'fondo por IA y vídeo generado')
  : warn('FAL_KEY', 'solo hace falta para fondo por IA o vídeo generado')

process.env.ELEVENLABS_API_KEY
  ? ok('ELEVENLABS_API_KEY')
  : warn('ELEVENLABS_API_KEY', 'solo para voz generada · no la necesitas si grabas tú')

// ── Red ──────────────────────────────────────────────────────────
/**
 * Comprueba acceso real, no solo que haya respuesta.
 *
 * fetch() no lanza excepción con un 403, así que un cortafuegos o un proxy
 * corporativo que bloquea el host se contaba como "red correcta". Aquí se
 * mira el estado y, si hay bloqueo, se dice quién lo está bloqueando.
 */
async function reach(name, url, needed) {
  const label = `Red · ${name}`
  let res
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(8000) })
  } catch (e) {
    return (needed ? bad : warn)(label, `sin conexión (${String(e.message).slice(0, 40)})`)
  }

  if (res.status === 403 || res.status === 407) {
    const body = await res.text().catch(() => '')
    const blocked = /allowlist|egress|proxy|blocked|forbidden by/i.test(body)
    return (needed ? bad : warn)(label,
      blocked ? 'bloqueado por un proxy o cortafuegos de tu red' : `HTTP ${res.status}`)
  }
  if (res.status >= 500) return (needed ? bad : warn)(label, `el servicio responde ${res.status}`)

  ok(label, `HTTP ${res.status}`)
}
await reach('huggingface (modelos de subtítulos)', 'https://huggingface.co', true)
await reach('fal.ai', 'https://fal.run', false)
await reach('elevenlabs', 'https://api.elevenlabs.io', false)

// ── Informe ──────────────────────────────────────────────────────
const colors = { ok: '\x1b[32m', warn: '\x1b[33m', bad: '\x1b[31m' }
console.log('\n🩺 Estado de esta máquina para montar vídeo\n')
for (const r of rows) {
  console.log(`  ${colors[r.level]}${r.icon}\x1b[0m ${r.what.padEnd(38)} ${r.detail}`)
}

const bads  = rows.filter(r => r.level === 'bad')
const warns = rows.filter(r => r.level === 'warn')
console.log('')
if (!bads.length) {
  console.log('✅ Puedes montar tus grabaciones con subtítulos.')
  if (warns.length) console.log('   Los avisos solo afectan a funciones que quizá no uses.')
} else {
  console.log(`❌ Faltan ${bads.length} cosa(s). Arregla las marcadas con ✗ y vuelve a ejecutar.`)
}
console.log('\n   Prueba:  node scripts/edit.mjs tu-video.mov --cut-silence --cta 3\n')
