/**
 * Operaciones de ffmpeg sobre la grabación: encuadre, fondo y corte de
 * silencios. Todo local y gratis — solo el fondo por IA sale de aquí.
 */
import { execFileSync, spawnSync } from 'node:child_process'

const VERTICAL = { w: 1080, h: 1920 }

export function ffmpeg(args) {
  return execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args],
    { encoding: 'utf8' })
}

export function probe(path) {
  const raw = execFileSync('ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration',
    '-show_entries', 'stream=codec_type,width,height,r_frame_rate,color_transfer,color_primaries',
    '-show_entries', 'stream_side_data=rotation',
    '-of', 'json', path,
  ], { encoding: 'utf8' })
  const j = JSON.parse(raw)
  const v = (j.streams || []).find(s => s.codec_type === 'video') || {}
  const [num, den] = String(v.r_frame_rate || '30/1').split('/').map(Number)

  // Los móviles guardan el vídeo apaisado y añaden un metadato de rotación:
  // ffprobe da 1920x1080 pero al reproducirse se ve vertical. Sin esto,
  // cualquier grabación de móvil se toma por horizontal — que es el caso
  // principal de esta herramienta.
  const rotation = Number(
    (v.side_data_list || []).find(d => d.rotation !== undefined)?.rotation ?? 0)
  const turned = Math.abs(rotation % 180) === 90
  const w = Number(v.width  ?? 0)
  const h = Number(v.height ?? 0)

  // HDR del iPhone (HLG/PQ). Si se pasa a SDR sin convertir, la imagen sale
  // apagada y con los colores lavados.
  const transfer = String(v.color_transfer ?? '')
  const isHdr = /arib-std-b67|smpte2084/i.test(transfer)

  return {
    duration: Number(j.format?.duration ?? 0),
    width:    turned ? h : w,
    height:   turned ? w : h,
    storedWidth: w,
    storedHeight: h,
    rotation,
    isHdr,
    fps:      den ? num / den : 30,
    hasAudio: (j.streams || []).some(s => s.codec_type === 'audio'),
  }
}

/**
 * Recorta y escala a 9:16 sin deformar: recorta lo que sobra.
 * Si la grabación viene en HDR (iPhone), la convierte a SDR con tonemap;
 * sin eso la imagen sale apagada y con los colores lavados en Instagram.
 */
export function toVertical(input, output, { isHdr = false } = {}) {
  const tonemap = isHdr
    ? 'zscale=t=linear:npl=100,tonemap=hable:desat=0,' +
      'zscale=p=bt709:t=bt709:m=bt709:r=tv,format=yuv420p,'
    : ''
  const vf =
    tonemap +
    `scale=${VERTICAL.w}:${VERTICAL.h}:force_original_aspect_ratio=increase,` +
    `crop=${VERTICAL.w}:${VERTICAL.h},setsar=1`
  ffmpeg(['-i', input, '-vf', vf, '-c:a', 'copy', '-c:v', 'libx264', '-crf', '18',
    '-pix_fmt', 'yuv420p', output])
  return output
}

/**
 * Sustituye un fondo croma por un color o una imagen.
 *
 * `similarity` es cuánto se parece un píxel al verde para considerarlo fondo:
 * súbelo si queda verde alrededor, bájalo si se come partes del sujeto.
 * `despill` quita el reflejo verde que el croma deja en pelo y hombros.
 */
export function chromaKey(input, output, {
  key = '0x00FF00', similarity = 0.18, blend = 0.05, background = '0x0F1013', image = null,
} = {}) {
  const bgInput = image
    ? ['-i', image]
    : ['-f', 'lavfi', '-i', `color=c=${background}:s=${VERTICAL.w}x${VERTICAL.h}`]

  const bgPrep = image
    ? `[1:v]scale=${VERTICAL.w}:${VERTICAL.h}:force_original_aspect_ratio=increase,` +
      `crop=${VERTICAL.w}:${VERTICAL.h},setsar=1[bg];`
    : `[1:v]scale=${VERTICAL.w}:${VERTICAL.h},setsar=1[bg];`

  const filter =
    bgPrep +
    `[0:v]chromakey=${key}:${similarity}:${blend},despill=type=green[fg];` +
    `[bg][fg]overlay=shortest=1,format=yuv420p[out]`

  ffmpeg(['-i', input, ...bgInput, '-filter_complex', filter,
    '-map', '[out]', '-map', '0:a?', '-c:a', 'copy', '-c:v', 'libx264', '-crf', '18',
    output])
  return output
}

/**
 * Tramos de silencio detectados por ffmpeg, en segundos.
 *
 * silencedetect escribe su informe en stderr y ffmpeg termina con código 0,
 * así que hay que usar spawnSync y leer stderr pase lo que pase: con
 * execFileSync el stderr solo llega cuando el comando falla, y la función
 * devolvía "no hay silencios" siempre, en silencio.
 */
export function detectSilences(input, { noiseDb = -35, minDuration = 0.6 } = {}) {
  const res = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', input,
    '-af', `silencedetect=noise=${noiseDb}dB:d=${minDuration}`, '-f', 'null', '-'],
    { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })

  if (res.error) throw new Error(`No pude ejecutar ffmpeg: ${res.error.message}`)
  const log = String(res.stderr ?? '')

  // Los eventos llegan intercalados: recogemos cada marca por separado y las
  // emparejamos en orden. Un silence_start sin su end significa que la
  // grabación termina en silencio.
  const starts = [...log.matchAll(/silence_start:\s*(-?[\d.]+)/g)].map(m => Math.max(0, Number(m[1])))
  const ends   = [...log.matchAll(/silence_end:\s*([\d.]+)/g)].map(m => Number(m[1]))
  const dur    = starts.length > ends.length ? probe(input).duration : 0

  return starts
    .map((start, i) => ({ start, end: ends[i] ?? dur }))
    .filter(x => Number.isFinite(x.start) && Number.isFinite(x.end) && x.end > x.start)
}

/**
 * Tramos que se QUEDAN, a partir de los silencios.
 * Deja un margen (`pad`) a cada lado para no cortar el ataque de la palabra,
 * que es el error clásico de los cortes automáticos.
 */
export function keepSegments(duration, silences, { pad = 0.15, minKeep = 0.25 } = {}) {
  const keeps = []
  let cursor = 0
  for (const s of silences) {
    const end = Math.max(cursor, s.start + pad)
    if (end - cursor >= minKeep) keeps.push({ start: cursor, end })
    cursor = Math.max(end, s.end - pad)
  }
  if (duration - cursor >= minKeep) keeps.push({ start: cursor, end: duration })
  return keeps
}

/** Concatena los tramos en un solo vídeo, re-encodeando una sola vez. */
export function cutSegments(input, output, segments) {
  if (!segments.length) throw new Error('No queda ningún tramo tras quitar los silencios')

  const parts = segments.map((s, i) =>
    `[0:v]trim=start=${s.start}:end=${s.end},setpts=PTS-STARTPTS[v${i}];` +
    `[0:a]atrim=start=${s.start}:end=${s.end},asetpts=PTS-STARTPTS[a${i}];`
  ).join('')
  const refs = segments.map((_, i) => `[v${i}][a${i}]`).join('')
  const filter = `${parts}${refs}concat=n=${segments.length}:v=1:a=1[v][a]`

  ffmpeg(['-i', input, '-filter_complex', filter, '-map', '[v]', '-map', '[a]',
    '-c:v', 'libx264', '-crf', '18', '-pix_fmt', 'yuv420p', output])
  return output
}

/**
 * Solo quita el aire muerto del principio y del final, dejando intacto el
 * ritmo del habla.
 *
 * En un plano hablado las pausas de un segundo suelen ser intencionadas —o al
 * menos naturales— y cortarlas deja saltos raros. El aire de antes de empezar
 * y el de después de terminar, en cambio, no aporta nada nunca.
 */
export function trimEnds(duration, silences, { pad = 0.25 } = {}) {
  const head = silences.find(s => s.start <= 0.05)
  const tail = [...silences].reverse().find(s => s.end >= duration - 0.05)

  const start = head ? Math.max(0, head.end - pad) : 0
  const end   = tail ? Math.min(duration, tail.start + pad) : duration

  return end - start > 0.5 ? [{ start, end }] : [{ start: 0, end: duration }]
}
