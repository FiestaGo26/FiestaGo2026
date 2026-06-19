// ───────────────────────────────────────────────────────────────────────
// Quote Generator · IA redacta presupuesto profesional desde brief.
//
// Input: brief libre del proveedor describiendo el evento (texto del
// cliente, foto del WhatsApp, transcripción de audio, lo que sea) +
// contexto del proveedor (nombre, categoría, ciudad, precio base).
//
// Output: HTML del presupuesto con cabecera, secciones, totales,
// condiciones generales. Listo para mostrar al cliente o imprimir PDF.
// ───────────────────────────────────────────────────────────────────────

import Anthropic from '@anthropic-ai/sdk'
import { precioCliente, importeFee, formatEuro } from '@/lib/pricing'

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-4-8'

let _client: Anthropic | null = null
function client(): Anthropic {
  if (_client) return _client
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('Falta ANTHROPIC_API_KEY')
  _client = new Anthropic()
  return _client
}

export type QuoteProvider = {
  name:        string
  category:    string | null
  city:        string | null
  price_base:  number | null      // precio típico por evento (proveedor)
  price_unit:  string | null      // 'por evento' | 'por hora' | etc.
  email:       string | null
  phone:       string | null
}

export type GeneratedQuote = {
  // Items del desglose (lo que el proveedor cobra).
  items: Array<{
    concept:   string
    detail:    string
    quantity:  number
    unitPrice: number     // EUR, en precio PROVEEDOR (sin 8% Garantía)
    subtotal:  number     // EUR
  }>
  // Totales del proveedor (lo que cobra él).
  providerSubtotal: number
  // Cifras visibles al cliente (con +8% de Garantía de Éxito).
  clientFee:       number         // 8% sobre subtotal
  clientTotal:     number         // subtotal + fee
  // Condiciones generales aplicables al evento.
  conditions: string[]
  // Notas internas sugeridas (no se muestran al cliente).
  internalNotes: string
}

const SYSTEM = `Eres un asistente experto en redactar presupuestos profesionales para proveedores de bodas y eventos en España (fotografía, catering, espacios, música/DJ, flores, repostería, belleza, animación, transporte, papelería, planners, joyería).

Recibes:
- Un BRIEF libre del cliente (puede venir de texto, transcripción de audio, o foto/imagen interpretada).
- Datos del PROVEEDOR (nombre, categoría, ciudad, precio base orientativo).
- Datos del EVENTO (fecha, ciudad, nº invitados, si los hay).

Devuelves un PRESUPUESTO ESTRUCTURADO en JSON con:
- "items": array con cada concepto. Cada item tiene concept (corto), detail (1 línea), quantity, unitPrice (EUR, precio del proveedor sin comisiones), subtotal.
- "conditions": array de strings con condiciones generales razonables para esta categoría (anticipo, plazo, política de cancelación, qué incluye, qué NO incluye, tiempos de entrega...). 4-8 condiciones.
- "internalNotes": texto en 1-2 frases con sugerencias internas para el proveedor (qué preguntar al cliente antes de cerrar, qué riesgo ves, dónde puedes subir el precio si el cliente acepta sin negociar...).

Reglas:
- Si el brief NO especifica algo crítico (nº de horas, nº de invitados, fecha), HAZ una estimación razonable basada en el contexto del sector y MENCIÓNALO en internalNotes ("Asumí 6h de cobertura — confirma con el cliente").
- Los precios deben ser realistas para España 2026 y la categoría dada. Si no tienes price_base, usa estos rangos orientativos:
   · Foto/Vídeo: 1.200-2.500€ paquete completo boda · 80-150€/h
   · Catering: 60-95€/comensal · 35-55€ cóctel
   · Música/DJ: 800-1.500€ ceremonia + banquete
   · Flores: 350-1.200€ decoración floral
   · Pastel: 4-7€/persona tarta de boda · mín 200€
   · Animación: 400-900€ por evento
   · Belleza (novia): 250-500€ peinado + maquillaje
   · Transporte: 250-500€ servicio bodas
   · Planner: 1.500-5.000€ planning completo · 800€ day-of
- Items detallados, NO una sola línea "servicio completo X €". Mínimo 3 items.
- Condiciones realistas y JUSTAS (no abusivas). Anticipo típico 30-50%. Cancelación: gratis hasta X días, perdida tras Y.
- Español de España. Profesional pero cercano.

FORMATO DE RESPUESTA — devuelve ÚNICAMENTE el JSON, sin texto adicional, sin markdown:
{
  "items": [{"concept":"...", "detail":"...", "quantity":1, "unitPrice":0, "subtotal":0}],
  "conditions": ["...", "..."],
  "internalNotes": "..."
}`

export async function generateQuote(opts: {
  brief:       string
  provider:    QuoteProvider
  eventDate?:  string | null
  eventCity?:  string | null
  guestCount?: number | null
}): Promise<GeneratedQuote> {
  const { brief, provider } = opts

  const userMsg =
    `[BRIEF del cliente]\n${brief}\n\n` +
    `[Proveedor]\n` +
    `Nombre: ${provider.name}\n` +
    `Categoría: ${provider.category || '(sin especificar)'}\n` +
    `Ciudad base: ${provider.city || '(sin especificar)'}\n` +
    `Precio base orientativo: ${provider.price_base ? formatEuro(provider.price_base) + ' ' + (provider.price_unit || '') : 'no facilitado'}\n\n` +
    `[Evento]\n` +
    `Fecha: ${opts.eventDate || 'sin confirmar'}\n` +
    `Ciudad: ${opts.eventCity || provider.city || 'sin confirmar'}\n` +
    `Invitados: ${opts.guestCount || 'sin confirmar'}\n\n` +
    `Redacta el presupuesto.`

  const resp = await client().messages.create({
    model:      MODEL,
    max_tokens: 2048,
    thinking:   { type: 'disabled' },
    system: [{
      type: 'text',
      text: SYSTEM,
      cache_control: { type: 'ephemeral' },
    }],
    messages: [{ role: 'user', content: userMsg }],
  })

  const raw = resp.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map(b => b.text)
    .join('')
    .trim()
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()

  let parsed: any
  try {
    parsed = JSON.parse(cleaned)
  } catch (err) {
    throw new Error(`Quote LLM no es JSON parseable: ${cleaned.slice(0, 300)}`)
  }

  const items = (Array.isArray(parsed.items) ? parsed.items : []).map((it: any) => ({
    concept:   String(it.concept   ?? '').trim(),
    detail:    String(it.detail    ?? '').trim(),
    quantity:  Number(it.quantity  ?? 1) || 1,
    unitPrice: Number(it.unitPrice ?? 0) || 0,
    subtotal:  Number(it.subtotal  ?? 0) || 0,
  }))
  if (items.length === 0) throw new Error('Quote sin items')

  const providerSubtotal = items.reduce((acc: number, it: any) => acc + it.subtotal, 0)
  const clientTotal = precioCliente(providerSubtotal)
  const clientFee   = importeFee(providerSubtotal)

  return {
    items,
    providerSubtotal,
    clientFee,
    clientTotal,
    conditions:    Array.isArray(parsed.conditions) ? parsed.conditions.map(String) : [],
    internalNotes: String(parsed.internalNotes ?? '').trim(),
  }
}

// Renderiza el presupuesto a HTML standalone — listo para mostrar al
// cliente o imprimir como PDF (window.print() con CSS @media print).
export function renderQuoteHtml(opts: {
  quote:     GeneratedQuote
  provider:  QuoteProvider
  client?:   { name?: string | null; email?: string | null; phone?: string | null }
  eventDate?: string | null
  eventCity?: string | null
  guestCount?: number | null
  quoteRef:  string                  // public_id corto visible
  issueDate: string                  // YYYY-MM-DD
}): string {
  const { quote, provider, client, eventDate, eventCity, guestCount, quoteRef, issueDate } = opts
  const itemsRows = quote.items.map(it => `
    <tr>
      <td>
        <div class="concept">${escape(it.concept)}</div>
        ${it.detail ? `<div class="detail">${escape(it.detail)}</div>` : ''}
      </td>
      <td class="num">${it.quantity}</td>
      <td class="num">${formatEuro(it.unitPrice)}</td>
      <td class="num">${formatEuro(it.subtotal)}</td>
    </tr>
  `).join('')

  const conditions = quote.conditions.map(c => `<li>${escape(c)}</li>`).join('')

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Presupuesto ${quoteRef} · ${escape(provider.name)}</title>
<style>
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, sans-serif;
    color: #1F2937; background: #F9FAFB; margin: 0; padding: 24px;
    line-height: 1.5;
  }
  .sheet {
    max-width: 800px; margin: 0 auto; background: #fff; padding: 40px;
    border-radius: 14px; box-shadow: 0 2px 12px rgba(0,0,0,.05);
  }
  header {
    display: flex; justify-content: space-between; align-items: flex-start;
    border-bottom: 2px solid #1F2937; padding-bottom: 20px; margin-bottom: 24px;
  }
  .from h1 { font-size: 22px; margin: 0 0 4px; color: #1F2937; }
  .from .meta { font-size: 12px; color: #6B7280; }
  .ref { text-align: right; font-size: 12px; color: #6B7280; }
  .ref strong { font-size: 16px; color: #1F2937; display: block; margin-bottom: 4px; }
  .section { margin-bottom: 22px; }
  .section h2 {
    font-size: 11px; text-transform: uppercase; letter-spacing: .08em;
    color: #6B7280; margin: 0 0 10px; font-weight: 700;
  }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; font-size: 13px; }
  .grid .label { font-size: 11px; color: #6B7280; }
  .grid .value { color: #1F2937; font-weight: 600; }
  table {
    width: 100%; border-collapse: collapse; font-size: 13px;
  }
  th {
    text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .05em;
    color: #6B7280; border-bottom: 2px solid #E5E7EB; padding: 10px 8px; font-weight: 700;
  }
  th.num, td.num { text-align: right; white-space: nowrap; }
  td {
    padding: 12px 8px; border-bottom: 1px solid #E5E7EB; vertical-align: top;
  }
  td .concept { font-weight: 600; color: #1F2937; }
  td .detail { font-size: 12px; color: #6B7280; margin-top: 2px; }
  tfoot td {
    border: none; padding-top: 14px; font-weight: 600;
  }
  tfoot tr.subtotal td { color: #6B7280; font-size: 13px; }
  tfoot tr.fee td { color: #6B7280; font-size: 12px; }
  tfoot tr.total td {
    font-size: 18px; color: #1F2937; border-top: 2px solid #1F2937; padding-top: 12px;
  }
  ul.conditions {
    padding-left: 18px; margin: 0; font-size: 12px; color: #4B5563; line-height: 1.7;
  }
  ul.conditions li { margin-bottom: 4px; }
  footer {
    margin-top: 32px; padding-top: 20px; border-top: 1px solid #E5E7EB;
    font-size: 11px; color: #9CA3AF; text-align: center;
  }
  footer a { color: #C0392B; text-decoration: none; }
  @media print {
    body { background: #fff; padding: 0; }
    .sheet { box-shadow: none; border-radius: 0; padding: 28px; max-width: none; }
    .no-print { display: none; }
  }
  .actions {
    max-width: 800px; margin: 0 auto 16px; display: flex; gap: 10px; justify-content: flex-end;
  }
  .actions button {
    padding: 10px 16px; border-radius: 8px; border: 1px solid #D1D5DB;
    background: #fff; color: #1F2937; cursor: pointer; font-size: 13px;
    font-weight: 600;
  }
  .actions button.primary { background: #C0392B; color: #fff; border-color: #C0392B; }
</style>
</head>
<body>
  <div class="actions no-print">
    <button onclick="window.print()" class="primary">🖨️ Imprimir / Guardar PDF</button>
  </div>
  <div class="sheet">
    <header>
      <div class="from">
        <h1>${escape(provider.name)}</h1>
        <div class="meta">
          ${provider.category ? `<div>${escape(provider.category)}${provider.city ? ' · ' + escape(provider.city) : ''}</div>` : ''}
          ${provider.email ? `<div>${escape(provider.email)}</div>` : ''}
          ${provider.phone ? `<div>${escape(provider.phone)}</div>` : ''}
        </div>
      </div>
      <div class="ref">
        <strong>Presupuesto #${escape(quoteRef.toUpperCase())}</strong>
        <div>Emisión: ${escape(issueDate)}</div>
        <div>Validez: 30 días</div>
      </div>
    </header>

    ${(client?.name || eventDate || eventCity || guestCount) ? `
    <div class="section">
      <h2>Datos del evento</h2>
      <div class="grid">
        ${client?.name      ? `<div><div class="label">Cliente</div><div class="value">${escape(client.name)}</div></div>` : ''}
        ${eventDate         ? `<div><div class="label">Fecha</div><div class="value">${escape(eventDate)}</div></div>` : ''}
        ${eventCity         ? `<div><div class="label">Ciudad</div><div class="value">${escape(eventCity)}</div></div>` : ''}
        ${guestCount        ? `<div><div class="label">Invitados</div><div class="value">${guestCount}</div></div>` : ''}
      </div>
    </div>
    ` : ''}

    <div class="section">
      <h2>Desglose</h2>
      <table>
        <thead>
          <tr>
            <th>Concepto</th>
            <th class="num">Cantidad</th>
            <th class="num">Precio</th>
            <th class="num">Subtotal</th>
          </tr>
        </thead>
        <tbody>${itemsRows}</tbody>
        <tfoot>
          <tr class="subtotal"><td colspan="3">Subtotal servicios</td><td class="num">${formatEuro(quote.providerSubtotal)}</td></tr>
          <tr class="fee"><td colspan="3">Garantía de Éxito FiestaGo (8%)</td><td class="num">${formatEuro(quote.clientFee)}</td></tr>
          <tr class="total"><td colspan="3">TOTAL</td><td class="num">${formatEuro(quote.clientTotal)}</td></tr>
        </tfoot>
      </table>
    </div>

    ${quote.conditions.length > 0 ? `
    <div class="section">
      <h2>Condiciones</h2>
      <ul class="conditions">${conditions}</ul>
    </div>
    ` : ''}

    <footer>
      Presupuesto emitido a través de <a href="https://fiestago.es" target="_blank">FiestaGo</a> ·
      Marketplace de celebraciones en España · Garantía de Éxito incluida
    </footer>
  </div>
</body>
</html>`
}

function escape(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
