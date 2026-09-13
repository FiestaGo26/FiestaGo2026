/**
 * Generador de PDF mínimo, sin dependencias.
 *
 * ¿Por qué no reutilizamos la pipeline de facturas (HTML + Chromium)? En
 * el runtime de Netlify no hay Chromium disponible: las facturas se
 * resuelven pasando el HTML al navegador del usuario, que aquí no existe
 * — el webhook de disputa corre sin nadie delante y necesita bytes de PDF
 * para subirlos a Stripe.
 *
 * Así que escribimos el PDF a mano. Es texto plano paginado con Helvetica
 * (una de las 14 fuentes base, no hay que incrustar nada) y eso es
 * exactamente lo que necesita una evidencia: que se lea, no que sea
 * bonita.
 *
 * Codificación: WinAnsi (cp1252). Los acentos españoles, el euro y los
 * guiones largos entran; lo que no entre se sustituye para no romper el
 * fichero.
 */

const PAGE_W = 595.28   // A4 en puntos
const PAGE_H = 841.89
const MARGIN_X = 56
const MARGIN_TOP = 56
const MARGIN_BOTTOM = 56

type Style = 'title' | 'heading' | 'body' | 'small' | 'mono'

type Line = { text: string; style: Style; leading?: number }

const FONT_SIZE: Record<Style, number> = {
  title: 16, heading: 11.5, body: 9.5, small: 8, mono: 8.5,
}
const LEADING: Record<Style, number> = {
  title: 24, heading: 18, body: 13.5, small: 11.5, mono: 12,
}
const FONT_OF: Record<Style, 'F1' | 'F2' | 'F3'> = {
  title: 'F2', heading: 'F2', body: 'F1', small: 'F1', mono: 'F3',
}
/** Ancho medio por carácter como fracción del cuerpo — basta para partir líneas. */
const WIDTH_FACTOR: Record<Style, number> = {
  title: 0.55, heading: 0.55, body: 0.5, small: 0.5, mono: 0.6,
}

export class PdfDoc {
  private pages: Line[][] = [[]]
  private y = PAGE_H - MARGIN_TOP

  /** Título del documento (primera línea, grande). */
  title(text: string): this { return this.push(text, 'title') }
  heading(text: string): this { this.gap(6); return this.push(text, 'heading') }
  text(text: string): this { return this.push(text, 'body') }
  small(text: string): this { return this.push(text, 'small') }
  mono(text: string): this { return this.push(text, 'mono') }

  /** Par clave-valor en una línea ("Fecha del evento: 12 de junio de 2027"). */
  field(label: string, value: string | number | null | undefined): this {
    return this.push(`${label}: ${value === null || value === undefined || value === '' ? '—' : value}`, 'body')
  }

  /**
   * Espacio en blanco vertical. Se guarda como línea vacía con su propio
   * interlineado para que el renderizador avance exactamente lo mismo que
   * la paginación — si divergen, el texto se sale de la página.
   */
  gap(points = 8): this {
    if (this.y - points < MARGIN_BOTTOM) return this.pageBreak()
    this.pages[this.pages.length - 1].push({ text: '', style: 'body', leading: points })
    this.y -= points
    return this
  }

  divider(): this {
    this.gap(4)
    this.push('─'.repeat(78), 'small')
    return this.gap(4)
  }

  pageBreak(): this {
    this.pages.push([])
    this.y = PAGE_H - MARGIN_TOP
    return this
  }

  /** Bloque de texto largo respetando los saltos de línea originales. */
  paragraph(text: string, style: Style = 'body'): this {
    for (const raw of String(text ?? '').split('\n')) {
      if (!raw.trim()) { this.gap(LEADING[style] * 0.6); continue }
      this.push(raw, style)
    }
    return this
  }

  private push(text: string, style: Style): this {
    const maxChars = Math.floor((PAGE_W - MARGIN_X * 2) / (FONT_SIZE[style] * WIDTH_FACTOR[style]))
    for (const line of wrap(String(text ?? ''), Math.max(20, maxChars))) {
      if (this.y - LEADING[style] < MARGIN_BOTTOM) this.pageBreak()
      this.pages[this.pages.length - 1].push({ text: line, style })
      this.y -= LEADING[style]
    }
    return this
  }

  build(): Buffer {
    const objects: string[] = []
    const pageIds: number[] = []

    // 1 catálogo · 2 pages · 3,4,5 fuentes · a partir de 6 páginas y contenidos
    const firstPageObj = 6
    this.pages.forEach((_, i) => pageIds.push(firstPageObj + i * 2))

    objects[1] = '<< /Type /Catalog /Pages 2 0 R >>'
    objects[2] = `<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] /Count ${this.pages.length} >>`
    objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'
    objects[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'
    objects[5] = '<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>'

    this.pages.forEach((lines, i) => {
      const pageId = pageIds[i]
      const contentId = pageId + 1
      objects[pageId] =
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W.toFixed(2)} ${PAGE_H.toFixed(2)}] ` +
        `/Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >> /Contents ${contentId} 0 R >>`

      const stream = renderPage(lines, i + 1, this.pages.length)
      const bytes = Buffer.from(stream, 'latin1')
      objects[contentId] = `<< /Length ${bytes.length} >>\nstream\n${stream}\nendstream`
    })

    // Ensamblado con tabla xref
    let pdf = '%PDF-1.4\n'
    const offsets: number[] = []
    for (let i = 1; i < objects.length; i++) {
      if (!objects[i]) continue
      offsets[i] = Buffer.byteLength(pdf, 'latin1')
      pdf += `${i} 0 obj\n${objects[i]}\nendobj\n`
    }
    const xrefOffset = Buffer.byteLength(pdf, 'latin1')
    const count = objects.length

    pdf += `xref\n0 ${count}\n0000000000 65535 f \n`
    for (let i = 1; i < count; i++) {
      pdf += offsets[i] !== undefined
        ? `${String(offsets[i]).padStart(10, '0')} 00000 n \n`
        : '0000000000 65535 f \n'
    }
    pdf += `trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`

    return Buffer.from(pdf, 'latin1')
  }
}

function renderPage(lines: Line[], pageNumber: number, totalPages: number): string {
  let out = ''
  let y = PAGE_H - MARGIN_TOP

  for (const line of lines) {
    const leading = line.leading ?? LEADING[line.style]
    if (line.text) {
      const size = FONT_SIZE[line.style]
      out += `BT /${FONT_OF[line.style]} ${size} Tf 1 0 0 1 ${MARGIN_X} ${y.toFixed(2)} Tm (${escapePdf(line.text)}) Tj ET\n`
    }
    y -= leading
  }

  // Pie con paginación: una evidencia sin "página 2 de 5" invita a
  // preguntarse si falta algo.
  const footer = `FiestaGo · pagina ${pageNumber} de ${totalPages}`
  out += `BT /F1 7.5 Tf 1 0 0 1 ${MARGIN_X} ${(MARGIN_BOTTOM - 24).toFixed(2)} Tm (${escapePdf(footer)}) Tj ET\n`

  return out
}

function wrap(text: string, maxChars: number): string[] {
  const clean = text.replace(/\t/g, '    ')
  if (clean.length <= maxChars) return [clean]

  const words = clean.split(' ')
  const lines: string[] = []
  let current = ''

  for (const word of words) {
    if (word.length > maxChars) {
      if (current) { lines.push(current); current = '' }
      for (let i = 0; i < word.length; i += maxChars) lines.push(word.slice(i, i + maxChars))
      continue
    }
    if (!current) current = word
    else if (current.length + 1 + word.length <= maxChars) current += ' ' + word
    else { lines.push(current); current = word }
  }
  if (current) lines.push(current)
  return lines
}

/**
 * Texto → cadena PDF en WinAnsi. Escapa los caracteres de sintaxis y
 * convierte lo que no cabe en cp1252 a un equivalente legible: mejor
 * "EUR" que un cuadrado vacío en un documento que va a leer el analista
 * de disputas del banco.
 */
export function escapePdf(text: string): string {
  const replaced = String(text ?? '')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2026/g, '...')
    .replace(/[\u2500-\u257F]/g, '-')      // filetes de caja
    .replace(/\u20AC/g, '\u0080')           // € · cp1252 0x80
    .replace(/\u2013/g, '\u0096')           // – 
    .replace(/\u2014/g, '\u0097')           // —
    .replace(/\u2022/g, '\u0095')           // •
    .replace(/[^\x00-\xFF]/g, '?')         // lo demás fuera de cp1252

  let out = ''
  for (const ch of replaced) {
    const code = ch.charCodeAt(0)
    if (ch === '(' || ch === ')' || ch === '\\') out += '\\' + ch
    else if (code < 32) out += ' '
    else if (code > 126) out += '\\' + code.toString(8).padStart(3, '0')
    else out += ch
  }
  return out
}
