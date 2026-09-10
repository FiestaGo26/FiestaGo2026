#!/usr/bin/env node
/**
 * Monta una grabación tuya y la deja lista para publicar.
 *
 * Hace, por este orden:
 *   1. encuadre vertical 9:16 (recorta, no deforma)
 *   2. fondo: lo deja, lo cambia por croma, o lo quita con IA
 *   3. corta los silencios largos
 *   4. transcribe en español (local y gratis)
 *   5. quema los subtítulos con el estilo de la marca + CTA opcional
 *
 * El orden importa: la transcripción va DESPUÉS del corte, porque si no los
 * tiempos de los subtítulos no cuadrarían con el vídeo ya cortado.
 *
 * USO:
 *   node scripts/edit.mjs grabacion.mov
 *   node scripts/edit.mjs grabacion.mov --cut-silence --cta 3
 *   node scripts/edit.mjs grabacion.mov --background chroma --bg-image fondo.jpg
 *   node scripts/edit.mjs grabacion.mov --transcript ya-hecho.json   # sin whisper
 *
 * OPCIONES:
 *   --out <ruta>          salida (por defecto out/editado.mp4)
 *   --cut-silence [seg]   quita TODOS los silencios más largos que N (0.6 por defecto)
 *   --trim-ends           solo quita el aire del principio y del final
 *   --no-subtitles        no transcribe ni quema subtítulos
 *   --transcript <json>   usa una transcripción ya hecha
 *   --model <nombre>      modelo de whisper: tiny|base|small|medium (small)
 *   --fal                 transcribe en fal.ai en vez de en local
 *   --background <modo>   none (por defecto) | chroma | ai
 *   --bg-color <hex>      color de fondo al quitar el croma (0x0F1013)
 *   --bg-image <ruta>     imagen de fondo al quitar el croma
 *   --chroma-key <hex>    color del croma (0x00FF00)
 *   --cta <segundos>      tarjeta de CTA al final (0 = ninguna)
 *   --words <n>           palabras por línea de subtítulo (5)
 */
import './env.mjs'
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { basename, extname, join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { probe, toVertical, chromaKey, detectSilences, keepSegments, trimEnds, cutSegments } from './video-ops.mjs'
import { removeBackgroundAI } from './bg-ai.mjs'
import { transcribe } from './transcribe.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const TMP  = join(ROOT, '.edit-tmp')

// ─── Argumentos ──────────────────────────────────────────────────
const WITH_VALUE = new Set(['--out', '--transcript', '--model', '--background',
  '--bg-color', '--bg-image', '--chroma-key', '--cta', '--words', '--cut-silence'])
const flags = {}
const positional = []
{
  const argv = process.argv.slice(2)
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (WITH_VALUE.has(a)) {
      // --cut-silence puede ir sin valor
      const next = argv[i + 1]
      if (a === '--cut-silence' && (next === undefined || next.startsWith('--'))) flags[a] = true
      else flags[a] = argv[++i]
    } else if (a.startsWith('--')) flags[a] = true
    else positional.push(a)
  }
}

const input = positional[0]
if (!input) {
  console.error(readFileSync(new URL(import.meta.url)).toString()
    .split('\n').slice(1, 40).join('\n').replace(/^\s*\*ricbut?/gm, ''))
  console.error('\n❌ Falta el vídeo de entrada.\n')
  process.exit(2)
}
if (!existsSync(input)) {
  console.error(`❌ No existe: ${input}`)
  process.exit(1)
}

const outPath      = resolve(flags['--out'] ?? join(ROOT, 'out', 'editado.mp4'))
const wantSubs     = !flags['--no-subtitles']
const cutSilence   = !!flags['--cut-silence']
const silenceMin   = typeof flags['--cut-silence'] === 'string' ? Number(flags['--cut-silence']) : 0.6
const ctaSeconds   = Number(flags['--cta'] ?? 0)
const wordsPerCue  = Number(flags['--words'] ?? 5)

mkdirSync(TMP, { recursive: true })
mkdirSync(dirname(outPath), { recursive: true })

const slug = basename(input, extname(input)).replace(/[^a-z0-9_-]/gi, '-').toLowerCase()
let current = input

const info0 = probe(input)
console.log(`\n🎬 ${basename(input)}`)
console.log(`   ${info0.width}×${info0.height}` +
            `${info0.rotation ? ` (rotado ${info0.rotation}°)` : ''}` +
            ` · ${info0.duration.toFixed(1)}s · ${info0.fps.toFixed(0)}fps` +
            `${info0.isHdr ? ' · HDR' : ''}${info0.hasAudio ? '' : ' · SIN AUDIO'}\n`)

// ─── 1. Vertical ─────────────────────────────────────────────────
// Siempre pasamos por aquí si no es exactamente 1080×1920, o si viene en
// HDR: aunque el encuadre ya sea vertical, hay que convertir el color.
if (info0.width !== 1080 || info0.height !== 1920 || info0.isHdr) {
  process.stdout.write(`· Encuadrando a 9:16${info0.isHdr ? ' y convirtiendo HDR→SDR' : ''}… `)
  current = toVertical(current, join(TMP, `${slug}-vert.mp4`), { isHdr: info0.isHdr })
  console.log('✓')
}

// ─── 2. Fondo ────────────────────────────────────────────────────
if (flags['--background'] === 'ai') {
  // Sin croma físico: la IA separa al sujeto y nos devuelve la toma sobre
  // verde; el fondo definitivo lo pone el chromakey local de siempre.
  console.log('· Quitando el fondo con IA (esto se paga)…')
  const green = await removeBackgroundAI(current, join(TMP, `${slug}-green.mp4`))
  process.stdout.write('· Poniendo el fondo… ')
  current = chromaKey(green, join(TMP, `${slug}-bg.mp4`), {
    background: flags['--bg-color'] ?? '0x0F1013',
    image:      flags['--bg-image'] ?? null,
  })
  console.log('✓')
} else if (flags['--background'] === 'chroma') {
  process.stdout.write('· Quitando el croma y poniendo el fondo… ')
  current = chromaKey(current, join(TMP, `${slug}-bg.mp4`), {
    key:        flags['--chroma-key'] ?? '0x00FF00',
    background: flags['--bg-color']   ?? '0x0F1013',
    image:      flags['--bg-image']   ?? null,
  })
  console.log('✓')
}

// ─── 3. Silencios ────────────────────────────────────────────────
if (cutSilence) {
  if (!info0.hasAudio) {
    console.log('· El vídeo no tiene audio: no hay silencios que cortar')
  } else {
    process.stdout.write('· Buscando silencios… ')
    const info = probe(current)
    const silences = detectSilences(current, { minDuration: silenceMin })
    const keeps = flags['--trim-ends']
      ? trimEnds(info.duration, silences)
      : keepSegments(info.duration, silences)
    const kept = keeps.reduce((a, s) => a + (s.end - s.start), 0)
    console.log(`${silences.length} encontrados` +
                (flags['--trim-ends'] ? ' · solo recorto principio y final' : ''))

    if (silences.length && kept < info.duration - 0.2) {
      process.stdout.write('· Cortando… ')
      current = cutSegments(current, join(TMP, `${slug}-cut.mp4`), keeps)
      console.log(`✓ ${info.duration.toFixed(1)}s → ${kept.toFixed(1)}s ` +
                  `(-${(info.duration - kept).toFixed(1)}s)`)
    }
  }
}

// ─── 4. Transcripción ────────────────────────────────────────────
let cues = []
if (wantSubs && info0.hasAudio) {
  const transcriptPath = flags['--transcript'] ?? join(TMP, `${slug}.json`)
  if (flags['--transcript']) {
    console.log(`· Transcripción dada: ${flags['--transcript']}`)
  } else {
    console.log('· Transcribiendo (la primera vez descarga el modelo)…')
    await transcribe(current, transcriptPath, {
      model:  flags['--model'] ?? 'small',
      useFal: !!flags['--fal'],
    })
  }
  cues = buildCues(JSON.parse(readFileSync(transcriptPath, 'utf8')), wordsPerCue)
  console.log(`· ${cues.length} líneas de subtítulo`)
} else if (wantSubs) {
  console.log('· Sin audio: no hay nada que subtitular')
}

// ─── 5. Render ───────────────────────────────────────────────────
const publicDir = join(ROOT, 'public', 'edit')
mkdirSync(publicDir, { recursive: true })
copyFileSync(current, join(publicDir, `${slug}.mp4`))

const finalInfo = probe(current)
const totalSeconds = finalInfo.duration + ctaSeconds
const propsPath = join(TMP, `${slug}-props.json`)
writeFileSync(propsPath, JSON.stringify({
  videoSrc: `edit/${slug}.mp4`,
  cues,
  ctaSeconds,
  ctaKicker: 'Date de alta\ngratis',
  ctaSub:    'fiestago.es/registro-proveedor',
}, null, 2))

console.log('\n· Renderizando con subtítulos…')
execFileSync('node', [join(ROOT, 'scripts', 'render-edited.mjs'),
  propsPath, outPath, String(totalSeconds)], { stdio: 'inherit', cwd: ROOT })

console.log(`\n✅ ${outPath}`)
console.log(`   ${totalSeconds.toFixed(1)}s · listo para subir\n`)

// ─── Utilidades ──────────────────────────────────────────────────

/**
 * Agrupa las palabras en líneas cortas de subtítulo.
 *
 * Dos reglas, y la segunda importa tanto como la primera:
 *  - máximo `perCue` palabras: una línea larga en vertical obliga a leer
 *    en vez de mirar;
 *  - corta en el punto o la coma. Agrupar solo por número de palabras
 *    produce líneas como "dado de alta. Date de", que se leen fatal.
 */
function buildCues(transcript, perCue) {
  const cues = []

  for (const seg of transcript.segments ?? []) {
    const words = seg.words?.length ? seg.words : null
    if (!words) {
      // Sin tiempos por palabra nos quedamos con el segmento entero.
      cues.push({ start: seg.start, end: seg.end, text: seg.text })
      continue
    }

    let chunk = []
    const flush = () => {
      if (!chunk.length) return
      cues.push({
        start: chunk[0].start,
        end:   chunk[chunk.length - 1].end,
        text:  chunk.map(w => w.word).join(' ').replace(/\s+([,.!?;:])/g, '$1'),
      })
      chunk = []
    }

    for (const w of words) {
      chunk.push(w)
      const endsSentence = /[.!?…]$/.test(w.word)
      const endsClause   = /[,;:]$/.test(w.word)
      // Cortamos en punto siempre; en coma solo si la línea ya va servida,
      // para no dejar líneas de dos palabras sueltas.
      if (endsSentence || chunk.length >= perCue || (endsClause && chunk.length >= perCue - 1)) {
        flush()
      }
    }
    flush()
  }

  // Une los huecos de milisegundos entre líneas seguidas: si no, el
  // subtítulo parpadea entre una y otra.
  for (let i = 0; i < cues.length - 1; i++) {
    if (cues[i + 1].start - cues[i].end < 0.25) cues[i].end = cues[i + 1].start
  }
  return cues
}
