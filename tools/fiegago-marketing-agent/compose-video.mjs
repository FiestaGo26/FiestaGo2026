// ═══════════════════════════════════════════════════════════════════
// FiestaGo · Compose Video
// Toma los video.mp4 generados por fiegago-marketing-agent y produce
// video_final.mp4 listo para subir con:
//   · Vídeo extendido de 5s a ~12s (freeze del último frame)
//   · Hook overlay grande (0-3s)
//   · Kickers / subtítulos quemados (3s-final)
//   · CTA + marca de agua FiestaGo
//
// USO:
//   node compose-video.mjs                        # procesa todos los posts sin video_final.mp4
//   node compose-video.mjs --id <post-id>         # solo uno
//   node compose-video.mjs --force                # regenera aunque ya exista video_final.mp4
//   node compose-video.mjs --dry-run              # imprime comandos FFmpeg, no ejecuta
// ═══════════════════════════════════════════════════════════════════

import { readFileSync, writeFileSync, readdirSync, existsSync, statSync, unlinkSync } from 'fs'
import { resolve, join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { execSync, execFileSync } from 'child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FFMPEG = resolve(__dirname, 'bin', 'ffmpeg.exe')
const ROOT = resolve(__dirname, 'FiestaGo-Contenido', 'redes-sociales')
const MUSIC_DIR = resolve(__dirname, 'music')

// Pista de audio asociada a cada mood. El archivo debe existir en MUSIC_DIR;
// si no existe, el vídeo se compone sin audio (silencio).
function musicPath(mood) {
  if (!mood) return null
  const p = resolve(MUSIC_DIR, `${mood}.mp3`)
  return existsSync(p) ? p : null
}

// ── ARGS ──────────────────────────────────────────────────────────
const argv = process.argv.slice(2)
const arg = (name, fallback = null) => {
  const i = argv.indexOf(`--${name}`)
  return i >= 0 ? (argv[i + 1] || true) : fallback
}
const ONLY_ID = arg('id', null)
const FORCE   = argv.includes('--force')
const DRY_RUN = argv.includes('--dry-run')

// ── Scripts por template (timing en segundos) ─────────────────────
// duration = total del video_final (extendido con freeze del último frame)
// Cada kicker es una línea de texto que aparece en pantalla en su rango temporal
const SCRIPTS = {
  provider_zero_commission_video: {
    duration: 12,
    hook: '0% COMISIÓN',
    hook_sub: 'PRIMERA VENTA',
    music: 'motivational',
    kickers: [
      { start: 3.2, end: 5.5, text: 'Tu primera venta\n100% para ti' },
      { start: 5.6, end: 8.0, text: 'Desde la 2ª\nsolo 8%' },
      { start: 8.1, end: 12.0, text: 'Sin cuota · Sin permanencia' },
    ],
    cta: { start: 9.5, end: 12.0, line1: 'Date de alta gratis', line2: 'fiestago.es/registro-proveedor' },
  },
  provider_anti_subscription_video: {
    duration: 12,
    hook: 'PAGA SOLO',
    hook_sub: 'CUANDO VENDES',
    music: 'tense',
    kickers: [
      { start: 3.2, end: 5.5, text: '¿Cuota mensual\nsin clientes?' },
      { start: 5.6, end: 8.5, text: 'FiestaGo es comisión,\nno suscripción' },
      { start: 8.6, end: 12.0, text: '0€ alta · 0% 1ª venta\n8% desde la 2ª' },
    ],
    cta: { start: 9.5, end: 12.0, line1: 'Empieza por aquí', line2: 'fiestago.es/registro-proveedor' },
  },
  provider_low_season_video: {
    duration: 12,
    hook: 'AGENDA VACÍA',
    hook_sub: 'EN INVIERNO',
    music: 'reflective',
    kickers: [
      { start: 3.2, end: 5.8, text: 'Octubre, enero, febrero\nno tienen por qué ser muertos' },
      { start: 5.9, end: 8.5, text: 'Cumples · Comuniones\nCorporate · Despedidas' },
      { start: 8.6, end: 12.0, text: 'Llena la temporada baja' },
    ],
    cta: { start: 9.5, end: 12.0, line1: 'Date de alta gratis', line2: 'fiestago.es/registro-proveedor' },
  },
  provider_demo_signup_video: {
    duration: 12,
    hook: 'ALTA EN',
    hook_sub: '60 SEGUNDOS',
    music: 'motivational',
    kickers: [
      { start: 3.2, end: 5.5, text: 'Nombre · Categoría · Ciudad' },
      { start: 5.6, end: 8.0, text: '3 fotos + precio orientativo' },
      { start: 8.1, end: 12.0, text: 'Sin tarjeta · Sin cuota' },
    ],
    cta: { start: 9.5, end: 12.0, line1: 'Cronómetro listo', line2: 'fiestago.es/registro-proveedor' },
  },
  provider_hot_take_video: {
    duration: 12,
    hook: 'OPINIÓN',
    hook_sub: 'IMPOPULAR',
    music: 'tense',
    kickers: [
      { start: 3.2, end: 6.0, text: 'Pagar cuota anual\nsin vender es robar' },
      { start: 6.1, end: 9.0, text: 'Comisión sobre ventas.\n1ª gratis. Punto.' },
      { start: 9.1, end: 12.0, text: 'Por eso montamos\nFiestaGo' },
    ],
    cta: { start: 9.5, end: 12.0, line1: 'Cámbiate', line2: 'fiestago.es/registro-proveedor' },
  },
  // Carruseles imagen → vídeo Reel de 12s con ken-burns + texto progresivo
  provider_not_only_weddings_carousel: {
    duration: 14,
    hook: '7 NEGOCIOS',
    hook_sub: 'QUE PIERDEN DINERO',
    music: 'corporate',
    kickers: [
      { start: 3.0, end: 4.5, text: 'Food trucks de cumple' },
      { start: 4.6, end: 6.0, text: 'Magos para comuniones' },
      { start: 6.1, end: 7.5, text: 'Decoradores y photocall' },
      { start: 7.6, end: 9.0, text: 'Animadores infantiles' },
      { start: 9.1, end: 10.5, text: 'Catering pequeño <50 pax' },
      { start: 10.6, end: 12.0, text: 'Fotógrafos no-boda' },
      { start: 12.1, end: 14.0, text: '¿Te has visto?' },
    ],
    cta: { start: 11.5, end: 14.0, line1: 'Date de alta gratis', line2: 'fiestago.es/registro-proveedor' },
    image_mode: true,
  },
  provider_comparison_carousel: {
    duration: 14,
    hook: 'LO QUE TE CUESTA',
    hook_sub: 'SALIR EN CADA SITIO',
    music: 'corporate',
    kickers: [
      { start: 3.0, end: 5.0, text: 'Bodas.net:\ncuotas anuales (desde 60€/mes)' },
      { start: 5.1, end: 7.0, text: 'Google Ads:\n1-3€ por clic, sin garantía' },
      { start: 7.1, end: 9.0, text: 'Instagram orgánico:\n10h/semana' },
      { start: 9.1, end: 12.0, text: 'FiestaGo:\n0€ alta · 0% 1ª · 8% desde la 2ª' },
      { start: 12.1, end: 14.0, text: 'Hazlo bien' },
    ],
    cta: { start: 11.5, end: 14.0, line1: 'Date de alta', line2: 'fiestago.es/registro-proveedor' },
    image_mode: true,
  },
}

// ── Utils ─────────────────────────────────────────────────────────
// Escapa el TEXTO que va dentro de drawtext text='...'. Como pasamos el filter
// como UN solo argumento via execFileSync (sin shell), no necesitamos escapar
// para la shell. Solo escapamos para el parser de drawtext.
function escDrawTextValue(s) {
  return String(s)
    .replace(/\\/g, '\\\\')   // \ → \\
    .replace(/'/g, '’')       // ' → ’ (apóstrofe tipográfico; no rompe '...')
    .replace(/:/g, '\\:')     // : → \: incluso dentro de '...' (separador de option)
    .replace(/\n/g, '\\n')    // newline real → \n literal (drawtext lo interpreta)
}

// Color #RRGGBB → 0xRRGGBB (formato más explícito para FFmpeg)
function color(c) {
  return c.startsWith('#') ? '0x' + c.slice(1) : c
}

// drawtext multilínea — texto entre comillas simples
function drawText({ text, fontsize, x, y, color: col = 'white', boxcolor = 'black@0.55', borderw = 6, start, end, fontfile }) {
  const enable = (start != null && end != null) ? `:enable='between(t,${start},${end})'` : ''
  const t = escDrawTextValue(text)
  const ff = fontfile ? `:fontfile='${fontfile}'` : ''  // fontfile pre-escapado
  return `drawtext=text='${t}'${ff}:fontsize=${fontsize}:fontcolor=${color(col)}:x=${x}:y=${y}:box=1:boxborderw=22:boxcolor=${boxcolor}:line_spacing=8:borderw=${borderw}:bordercolor=black@0.85${enable}`
}

// Fuentes Windows: dentro de fontfile='...' el : se escapa con \\ y se usa /
// El valor literal que queremos dentro de '...' es: C\:/Windows/Fonts/arialbd.ttf
// En source JS: 'C\\:/Windows/Fonts/arialbd.ttf'
const FONT_SANS = 'C\\:/Windows/Fonts/arialbd.ttf'
const FONT_SERIF = 'C\\:/Windows/Fonts/georgia.ttf'

// ── Discover posts ────────────────────────────────────────────────
function listPostDirs() {
  if (!existsSync(ROOT)) return []
  const dates = readdirSync(ROOT).filter(n => /^\d{4}-\d{2}-\d{2}$/.test(n))
  const dirs = []
  for (const d of dates) {
    const full = join(ROOT, d)
    if (!statSync(full).isDirectory()) continue
    for (const post of readdirSync(full)) {
      const pdir = join(full, post)
      if (statSync(pdir).isDirectory() && existsSync(join(pdir, 'meta.json'))) dirs.push(pdir)
    }
  }
  return dirs
}

// ── Composición ───────────────────────────────────────────────────
function buildFilter(script, isImage, videoDuration) {
  const W = 1080, H = 1920  // 9:16
  const D = script.duration
  const filters = []

  if (isImage) {
    // Imagen cuadrada (~1080x1080 de Flux square_hd) → 9:16 1080x1920
    // Estrategia: imagen escalada al ancho 1080 (queda cuadrada), centrada vertical
    // con pad de fondo en color FiestaGo crema oscuro #1A1A1A
    filters.push(`scale=1080:1080:force_original_aspect_ratio=decrease`)
    filters.push(`pad=1080:1920:0:(1920-ih)/2:color=0x1A1A1A`)
    filters.push(`setsar=1`)
    filters.push(`fps=25`)
  } else {
    // Vídeo entrante 5s → extender a D segundos con tpad freeze del último frame
    filters.push(`scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1`)
    const extra = Math.max(0, D - videoDuration)
    if (extra > 0) {
      filters.push(`tpad=stop_mode=clone:stop_duration=${extra.toFixed(2)}`)
    }
  }

  // Marca de agua texto FiestaGo abajo derecha (always on)
  filters.push(drawText({
    text: 'fiestago.es',
    fontsize: 36,
    fontfile: FONT_SERIF,
    color: 'white@0.85',
    boxcolor: 'black@0.35',
    borderw: 2,
    x: 'w-tw-30',
    y: 'h-th-30',
  }))

  // HOOK (0 - 3.0s): dos líneas grandes en top
  filters.push(drawText({
    text: script.hook,
    fontsize: 110,
    fontfile: FONT_SANS,
    color: 'white',
    boxcolor: 'black@0.0',
    borderw: 8,
    x: '(w-tw)/2',
    y: 'h*0.18',
    start: 0,
    end: 3.0,
  }))
  if (script.hook_sub) {
    filters.push(drawText({
      text: script.hook_sub,
      fontsize: 78,
      fontfile: FONT_SANS,
      color: '#F5C518',  // amarillo marca
      boxcolor: 'black@0.0',
      borderw: 7,
      x: '(w-tw)/2',
      y: 'h*0.18+150',
      start: 0,
      end: 3.0,
    }))
  }

  // KICKERS — texto centrado-medio en cada rango
  for (const k of script.kickers) {
    filters.push(drawText({
      text: k.text,
      fontsize: 72,
      fontfile: FONT_SANS,
      color: 'white',
      boxcolor: 'black@0.55',
      borderw: 5,
      x: '(w-tw)/2',
      y: 'h*0.42',
      start: k.start,
      end: k.end,
    }))
  }

  // CTA — bottom (debajo del centro) en los últimos segundos
  if (script.cta) {
    filters.push(drawText({
      text: script.cta.line1,
      fontsize: 70,
      fontfile: FONT_SANS,
      color: 'white',
      boxcolor: 'black@0.6',
      borderw: 5,
      x: '(w-tw)/2',
      y: 'h*0.72',
      start: script.cta.start,
      end: script.cta.end,
    }))
    filters.push(drawText({
      text: script.cta.line2,
      fontsize: 56,
      fontfile: FONT_SERIF,
      color: '#F5C518',
      boxcolor: 'black@0.6',
      borderw: 4,
      x: '(w-tw)/2',
      y: 'h*0.72+110',
      start: script.cta.start,
      end: script.cta.end,
    }))
  }

  return filters.join(',')
}

function probeDuration(path) {
  try {
    const out = execSync(`"${resolve(__dirname, 'bin', 'ffprobe.exe')}" -v error -show_entries format=duration -of csv=p=0 "${path}"`, { encoding: 'utf-8' })
    return parseFloat(out.trim()) || 5.0
  } catch {
    return 5.0
  }
}

function composeOne(postDir) {
  const meta = JSON.parse(readFileSync(join(postDir, 'meta.json'), 'utf-8'))
  const tid = meta.template_id
  const script = SCRIPTS[tid]
  if (!script) {
    console.log(`   ⚠️  Sin script para template ${tid}, salto`)
    return { skipped: true }
  }

  const out = join(postDir, 'video_final.mp4')
  if (existsSync(out) && !FORCE) {
    console.log(`   ⏭️  Ya existe video_final.mp4 (--force para regenerar)`)
    return { skipped: true }
  }

  const isImage = !!script.image_mode || meta.media === 'image'
  const inputPath = isImage
    ? join(postDir, 'imagen.jpg')
    : join(postDir, 'video.mp4')

  if (!existsSync(inputPath)) {
    console.log(`   ❌ No existe el input: ${inputPath}`)
    return { error: 'missing_input' }
  }

  const videoDur = isImage ? script.duration : probeDuration(inputPath)
  const vf = buildFilter(script, isImage, videoDur)

  // Audio opcional según mood de la plantilla
  const audioPath = musicPath(script.music)
  const D = script.duration
  const fadeOut = Math.max(0, D - 1.2)  // fade out 1.2s al final

  // Filter graph completo (video + audio si lo hay) escrito a archivo
  // (evita problemas de Unicode/comas/quotes en argv)
  const filterPath = join(postDir, '_filter.txt')
  let filterComplex = `[0:v]${vf}[outv]`
  if (audioPath) {
    // Mezcla audio: pista de música → afade in/out, volumen 0.55 (-5 dB aprox),
    // truncada a D segundos para emparejar con el vídeo.
    filterComplex += `;[1:a]atrim=0:${D},asetpts=PTS-STARTPTS,volume=0.55,afade=t=in:st=0:d=0.5,afade=t=out:st=${fadeOut}:d=1.2[outa]`
  }
  writeFileSync(filterPath, filterComplex, 'utf-8')

  const args = ['-y']
  if (isImage) {
    args.push('-loop', '1', '-t', String(D), '-i', inputPath)
  } else {
    args.push('-i', inputPath)
  }
  if (audioPath) {
    args.push('-i', audioPath)
  }
  args.push(
    '-filter_complex_script', filterPath,
    '-map', '[outv]',
  )
  if (audioPath) {
    args.push('-map', '[outa]', '-c:a', 'aac', '-b:a', '128k', '-shortest')
  } else {
    args.push('-an')
  }
  args.push(
    '-t', String(D),
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-preset', 'medium',
    '-crf', '20',
    out
  )

  if (DRY_RUN) {
    console.log(`\n[DRY-RUN] ${tid}`)
    console.log(`${FFMPEG} \\\n  ${args.map(a => a.includes(' ') || a.includes(',') ? `"${a}"` : a).join(' \\\n  ')}`)
    return { dry: true }
  }

  console.log(`   🎬 Componiendo (${script.duration}s)...`)
  try {
    execFileSync(FFMPEG, args, { stdio: 'pipe' })
    try { unlinkSync(filterPath) } catch {}
    console.log(`   ✓ ${out.replace(ROOT, '...')}`)
    return { ok: true, path: out }
  } catch (err) {
    const stderr = (err.stderr || '').toString()
    const tail = stderr.split('\n').filter(Boolean).slice(-4).join(' | ').slice(0, 400)
    console.log(`   ✗ FFmpeg falló: ${tail || err.message}`)
    return { error: tail || err.message }
  }
}

// ── MAIN ──────────────────────────────────────────────────────────
function main() {
  console.log('\n' + '═'.repeat(56))
  console.log('🎬 FiestaGo · Compose Video')
  console.log('═'.repeat(56))

  if (!DRY_RUN && !existsSync(FFMPEG)) {
    console.error(`❌ No encuentro FFmpeg en ${FFMPEG}`)
    console.error(`   Descárgalo a tools/fiegago-marketing-agent/bin/ffmpeg.exe`)
    process.exit(1)
  }

  let posts = listPostDirs()
  if (ONLY_ID) posts = posts.filter(p => p.includes(ONLY_ID))
  if (posts.length === 0) { console.log('Sin posts.'); return }

  console.log(`Posts encontrados: ${posts.length}`)
  console.log(`Modo: ${DRY_RUN ? 'DRY-RUN' : 'COMPONER'}  ·  Force: ${FORCE}`)
  console.log()

  let ok = 0, skipped = 0, err = 0
  for (const p of posts) {
    const id = p.split(/[\\\/]/).pop()
    console.log(`▶ ${id}`)
    const r = composeOne(p)
    if (r.ok) ok++
    else if (r.skipped || r.dry) skipped++
    else err++
  }

  console.log(`\n${'═'.repeat(56)}`)
  console.log(`🎉 ${ok} compuestos · ${skipped} saltados · ${err} con error`)
  console.log('═'.repeat(56) + '\n')
}

main()
