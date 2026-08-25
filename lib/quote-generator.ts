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

// Sonnet 5 basta para redactar presupuestos desde brief estructurado
// (~0,07€/quote vs ~0,33€ con Opus). Se puede sobreescribir por env var
// puntual si algún cliente exige la máxima calidad literaria de Opus.
const MODEL = process.env.ANTHROPIC_QUOTE_MODEL || 'claude-sonnet-5'

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

const SYSTEM = `Redactas presupuestos profesionales para proveedores de bodas y eventos en España (foto, catering, espacios, música, flores, repostería, belleza, animación, transporte, papelería, planners, joyería). Español de España.

Recibes: brief libre del cliente, datos del proveedor, sus servicios reales con precios, sus preferencias (señal %, validez, includes/excludes, conditions, estilo), sus 3 últimos presupuestos, y datos del evento si los hay.

Devuelves JSON con:
- "items": array de conceptos {concept, detail (1 línea), quantity, unitPrice (EUR sin comisiones), subtotal}. Mínimo 3 items detallados — nunca una línea "servicio completo".
- "conditions": 4-8 strings con condiciones (anticipo, validez, incluye, no incluye, cancelación).
- "internalNotes": 1-2 frases privadas para el proveedor (qué preguntar, qué riesgo, dónde puede subir precio).

JERARQUÍA DE PRECIO (de más a menos prioritario):
1. Servicios reales del panel con precio → USA ese precio LITERAL, sin modificar.
2. Últimos presupuestos → mantén consistencia con items parecidos.
3. Sus preferencias (default_includes/excludes, pricing_notes).
4. Su precio base orientativo si lo facilitó.
5. Rangos genéricos SOLO si nada de lo anterior:
   Foto/Vídeo 1.200-2.500€ paquete · 80-150€/h · Catering 60-95€/comensal · 35-55€ cóctel · DJ 800-1.500€ · Flores 350-1.200€ · Pastel 4-7€/pax mín 200€ · Animación 400-900€ · Belleza novia 250-500€ · Transporte 250-500€ · Planner 1.500-5.000€ full · 800€ day-of.

CONSTRUCCIÓN DE CONDICIONES: primero sus default_conditions verbatim; luego una con deposit_pct exacto; una con validity_days; si aplican, "INCLUYE:" desde default_includes y "NO INCLUYE:" desde default_excludes.

ESTILO según language_style: 'cercano' (tú, natural, sin "rogamos"), 'profesional' (usted, pulido), 'muy_formal' (usted, técnico, empresa grande).

REGLAS: si el brief no dice algo crítico (horas, invitados, fecha), estima y ANOTA en internalNotes. Si usas un servicio del catálogo, MENCIÓNALO en internalNotes. Si te apartas del precio de un presupuesto anterior similar, EXPLÍCALO.

Devuelve ÚNICAMENTE el JSON, sin markdown:
{"items":[{"concept":"","detail":"","quantity":1,"unitPrice":0,"subtotal":0}],"conditions":["",""],"internalNotes":""}`

export type ProviderQuoteContext = {
  services?: Array<{
    name:        string
    description: string | null
    price:       number | null
    price_unit:  string | null
    duration:    string | null
  }>
  prefs?: {
    deposit_pct:        number
    validity_days:      number
    default_includes:   string[]
    default_excludes:   string[]
    default_conditions: string[]
    language_style:     string
    pricing_notes:      string | null
  }
  recentQuotes?: Array<{
    created_at:    string
    brief_snippet: string
    items: Array<{ concept: string; quantity: number; unitPrice: number }>
    total: number
  }>
}

export async function generateQuote(opts: {
  brief:       string
  provider:    QuoteProvider
  eventDate?:  string | null
  eventCity?:  string | null
  guestCount?: number | null
  context?:    ProviderQuoteContext   // servicios reales + prefs + últimos presupuestos
}): Promise<GeneratedQuote> {
  const { brief, provider, context } = opts

  // Bloque de servicios reales del proveedor (si los tiene).
  const servicesBlock = context?.services && context.services.length > 0
    ? `\n[SUS SERVICIOS REALES con precio actual — USA ESTOS PRECIOS LITERALES si encajan con el brief]\n` +
      context.services
        .filter(s => s.price != null)
        .slice(0, 20)
        .map(s =>
          `· ${s.name}${s.duration ? ' (' + s.duration + ')' : ''}: ` +
          `${formatEuro(s.price!)}${s.price_unit ? ' ' + s.price_unit : ''}` +
          `${s.description ? ' — ' + s.description.slice(0, 120) : ''}`
        )
        .join('\n') + '\n'
    : ''

  // Bloque de preferencias (siempre que existan).
  const prefsBlock = context?.prefs
    ? `\n[SUS PREFERENCIAS de presupuesto]\n` +
      `Señal/anticipo: ${context.prefs.deposit_pct}%\n` +
      `Validez del presupuesto: ${context.prefs.validity_days} días\n` +
      `Estilo: ${context.prefs.language_style}\n` +
      (context.prefs.default_includes.length > 0
        ? `Siempre incluye: ${context.prefs.default_includes.join(' · ')}\n` : '') +
      (context.prefs.default_excludes.length > 0
        ? `Nunca incluye (cobra aparte): ${context.prefs.default_excludes.join(' · ')}\n` : '') +
      (context.prefs.default_conditions.length > 0
        ? `Condiciones que SIEMPRE añade verbatim:\n` +
          context.prefs.default_conditions.map(c => `  - ${c}`).join('\n') + '\n'
        : '') +
      (context.prefs.pricing_notes
        ? `Notas de pricing (aplícalas):\n${context.prefs.pricing_notes}\n` : '')
    : ''

  // Bloque de últimos presupuestos para mantener consistencia.
  const recentBlock = context?.recentQuotes && context.recentQuotes.length > 0
    ? `\n[SUS ÚLTIMOS PRESUPUESTOS — mantén consistencia de precios y tono]\n` +
      context.recentQuotes.slice(0, 3).map((q, i) =>
        `Presupuesto #${i + 1} (${q.created_at.slice(0, 10)}, total ${formatEuro(q.total)}):\n` +
        `  Brief: "${q.brief_snippet.slice(0, 140)}…"\n` +
        `  Items: ${q.items.slice(0, 5).map(it => `${it.concept} (${it.quantity}×${formatEuro(it.unitPrice)})`).join(', ')}`
      ).join('\n')
    : ''

  const userMsg =
    `[BRIEF del cliente]\n${brief}\n\n` +
    `[Proveedor]\n` +
    `Nombre: ${provider.name}\n` +
    `Categoría: ${provider.category || '(sin especificar)'}\n` +
    `Ciudad base: ${provider.city || '(sin especificar)'}\n` +
    `Precio base orientativo: ${provider.price_base ? formatEuro(provider.price_base) + ' ' + (provider.price_unit || '') : 'no facilitado'}\n` +
    servicesBlock +
    prefsBlock +
    recentBlock +
    `\n[Evento]\n` +
    `Fecha: ${opts.eventDate || 'sin confirmar'}\n` +
    `Ciudad: ${opts.eventCity || provider.city || 'sin confirmar'}\n` +
    `Invitados: ${opts.guestCount || 'sin confirmar'}\n\n` +
    `Redacta el presupuesto.`

  const resp = await client().messages.create({
    model:      MODEL,
    // 1500 basta: presupuestos típicos ocupan ~800-1200 tokens output.
    // Sonnet no infla la salida como Opus, así que este tope evita
    // pagar por texto extra que no aporta.
    max_tokens: 1500,
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
  // Los importes por línea que ve el cliente incluyen ya la Garantía de
  // Éxito (8%) baked-in. Así el presupuesto se lee como uno tradicional,
  // sin línea "extra" que invite a comparar por partes. El proveedor sí
  // sigue viendo su cifra neta en su panel y en las facturas legales.
  const itemsRows = quote.items.map(it => {
    const unitPriceClient = precioCliente(it.unitPrice)
    const subtotalClient  = precioCliente(it.subtotal)
    return `
    <tr>
      <td>
        <div class="concept">${escape(it.concept)}</div>
        ${it.detail ? `<div class="detail">${escape(it.detail)}</div>` : ''}
      </td>
      <td class="num">${it.quantity}</td>
      <td class="num">${formatEuro(unitPriceClient)}</td>
      <td class="num">${formatEuro(subtotalClient)}</td>
    </tr>
  `}).join('')

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
  tfoot tr.total td {
    font-size: 18px; color: #1F2937; border-top: 2px solid #1F2937; padding-top: 12px;
  }
  tfoot tr.total-note td {
    font-size: 11px; color: #9CA3AF; font-weight: 400; text-align: right;
    padding-top: 4px; padding-bottom: 0;
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
          <tr class="total"><td colspan="3">TOTAL</td><td class="num">${formatEuro(quote.clientTotal)}</td></tr>
          <tr class="total-note"><td colspan="4">Precios finales · gestión, contrato y garantía de reembolso FiestaGo incluidos</td></tr>
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
