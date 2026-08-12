// ═══════════════════════════════════════════════════════════════════
// FiestaGo · Helpers de texto para FFmpeg (drawtext)
// Compartido entre compose-video.mjs (posts con vídeo/imagen de IA) y
// avatar-video.mjs (posts con avatar de vídeo real + voz clonada).
// ═══════════════════════════════════════════════════════════════════

// Escapa el TEXTO que va dentro de drawtext text='...'. Como los filtros se
// pasan como UN solo argumento vía -filter_complex_script (fichero), no hace
// falta escapar para la shell. Solo para el parser de drawtext.
export function escDrawTextValue(s) {
  return String(s)
    .replace(/\\/g, '\\\\')   // \ → \\
    .replace(/'/g, '’')  // ' → ' (apóstrofe tipográfico; no rompe '...')
    .replace(/:/g, '\\:')     // : → \: incluso dentro de '...' (separador de option)
    .replace(/\n/g, '\\n')    // newline real → \n literal (drawtext lo interpreta)
}

// Color #RRGGBB → 0xRRGGBB (formato más explícito para FFmpeg)
export function color(c) {
  return c.startsWith('#') ? '0x' + c.slice(1) : c
}

// drawtext multilínea — texto entre comillas simples
export function drawText({ text, fontsize, x, y, color: col = 'white', boxcolor = 'black@0.55', borderw = 6, start, end, fontfile }) {
  const enable = (start != null && end != null) ? `:enable='between(t,${start},${end})'` : ''
  const t = escDrawTextValue(text)
  const ff = fontfile ? `:fontfile='${fontfile}'` : ''  // fontfile pre-escapado
  return `drawtext=text='${t}'${ff}:fontsize=${fontsize}:fontcolor=${color(col)}:x=${x}:y=${y}:box=1:boxborderw=22:boxcolor=${boxcolor}:line_spacing=8:borderw=${borderw}:bordercolor=black@0.85${enable}`
}

// Fuentes Windows: dentro de fontfile='...' el : se escapa con \\ y se usa /
export const FONT_SANS = 'C\\:/Windows/Fonts/arialbd.ttf'
export const FONT_SERIF = 'C\\:/Windows/Fonts/georgia.ttf'
