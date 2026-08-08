/**
 * Generador de PDF legal para facturas Verifactu.
 *
 * Enfoque: HTML + Chromium headless (misma pipeline que el pitch
 * generado en /admin). Alternativa a librerías nativas de PDF que
 * dependencian instalaciones pesadas. Cumple los requisitos de:
 *
 *   · Contenido obligatorio (art. 6 RD 1619/2012): identificación
 *     emisor/receptor, número + serie, fecha, concepto, base + IVA
 *     + total.
 *   · Marca visible "Verifactu" o equivalente si se opta por ese modo.
 *   · QR con los datos según Anexo II del RD 1007/2023.
 *   · Hash de la factura visible (recomendado, no obligatorio).
 *
 * Este módulo genera el HTML del PDF. La conversión a PDF real se hace
 * desde el endpoint que llama a Chromium — así aislamos la lógica de
 * layout de la infraestructura de rendering.
 */

export type InvoiceForPdf = {
  full_number: string
  issue_date: string | Date
  invoice_type: 'commission_fiestago' | 'delegated_provider'
  issuer_tax_id: string
  issuer_tax_name: string
  issuer_tax_address: string
  recipient_name: string
  recipient_tax_id?: string | null
  recipient_email: string
  recipient_address?: string | null
  concept: string
  items: Array<{ description: string; quantity: number; unit_price: number; tax_rate: number; subtotal: number }>
  base_amount: number
  tax_rate: number
  tax_amount: number
  total_amount: number
  invoice_hash: string
  prev_invoice_hash: string | null
  qr_content: string
  verifactu_mode: 'not_sent' | 'sent' | 'accepted' | 'rejected'
}

const EUR = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 })
const DATE = new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })

function fmtEur(n: number): string { return EUR.format(n) }
function fmtDate(d: string | Date): string {
  return DATE.format(typeof d === 'string' ? new Date(d) : d)
}

/**
 * Genera el HTML autocontenido de una factura, listo para renderizar
 * como PDF con Chromium headless. Usa system-fonts (Georgia + Helvetica)
 * para no depender de CDN.
 */
export function renderInvoiceHtml(inv: InvoiceForPdf): string {
  const typeLabel = inv.invoice_type === 'commission_fiestago'
    ? 'Factura por servicio de intermediación'
    : 'Factura por servicios prestados'
  const verifactuLabel = inv.verifactu_mode === 'sent' || inv.verifactu_mode === 'accepted'
    ? 'FACTURA VERIFACTU'
    : 'FACTURA VERIFICABLE'

  return `<!DOCTYPE html>
<html lang="es"><head>
<meta charset="utf-8"/>
<title>Factura ${escape_(inv.full_number)}</title>
<style>
  @page { size: A4; margin: 16mm 14mm 14mm 14mm; }
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, "Helvetica Neue", Helvetica, Arial, sans-serif;
    color: #1A1612;
    font-size: 11px;
    line-height: 1.45;
    margin: 0;
    background: #fff;
  }
  h1, h2, h3 { font-family: Georgia, "Times New Roman", serif; font-weight: 700; margin: 0; }
  .stamp {
    display: inline-block;
    border: 2px solid #1A1612;
    padding: 6px 12px;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }
  .head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding-bottom: 20px;
    border-bottom: 2px solid #1A1612;
    margin-bottom: 24px;
  }
  .head .num { text-align: right; }
  .head .num h1 { font-size: 24px; letter-spacing: -0.02em; margin-bottom: 4px; }
  .head .num .date { font-size: 11px; color: #5C534A; }

  .parties {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
    margin-bottom: 24px;
  }
  .party {
    padding: 14px;
    background: #FBF7F0;
    border-radius: 4px;
    border-left: 3px solid #1A1612;
  }
  .party .label {
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    font-weight: 700;
    color: #5C534A;
    margin-bottom: 6px;
  }
  .party .name { font-size: 13px; font-weight: 700; margin-bottom: 3px; }
  .party .row { font-size: 11px; color: #3A3229; line-height: 1.6; }

  .concept {
    margin-bottom: 18px;
    padding: 12px 14px;
    background: #FBF7F0;
    border-radius: 4px;
    font-size: 12px;
  }

  table.items {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 18px;
    font-size: 11px;
  }
  table.items thead th {
    text-align: left;
    padding: 10px 12px;
    background: #1A1612;
    color: #fff;
    font-size: 9px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    font-weight: 700;
  }
  table.items thead th.num, table.items tbody td.num { text-align: right; font-variant-numeric: tabular-nums; }
  table.items tbody td {
    padding: 12px;
    border-bottom: 1px solid #E5E1D8;
    vertical-align: top;
  }

  .totals {
    margin-left: auto;
    width: 260px;
    font-size: 12px;
  }
  .totals .row {
    display: flex;
    justify-content: space-between;
    padding: 6px 0;
    color: #3A3229;
  }
  .totals .row.total {
    border-top: 2px solid #1A1612;
    margin-top: 6px;
    padding-top: 10px;
    font-size: 15px;
    font-weight: 800;
    color: #1A1612;
  }
  .totals .row.total .amount {
    font-family: Georgia, serif;
    font-style: italic;
  }

  .footer {
    margin-top: 30px;
    padding-top: 18px;
    border-top: 1px solid #E5E1D8;
    display: grid;
    grid-template-columns: 1fr 130px;
    gap: 20px;
    align-items: end;
  }
  .footer .hashes {
    font-size: 8.5px;
    color: #5C534A;
    font-family: ui-monospace, "SF Mono", Menlo, monospace;
    word-break: break-all;
    line-height: 1.6;
  }
  .footer .hashes .label {
    text-transform: uppercase;
    letter-spacing: 0.1em;
    font-family: -apple-system, sans-serif;
    font-weight: 700;
    color: #1A1612;
    margin-right: 4px;
  }
  .footer .qr img { width: 130px; height: 130px; display: block; }
  .footer .qr .caption {
    font-size: 8px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #5C534A;
    text-align: center;
    margin-top: 4px;
    font-weight: 700;
  }

  .legal {
    margin-top: 20px;
    padding: 10px 12px;
    background: #FBF7F0;
    border-radius: 4px;
    font-size: 9px;
    color: #5C534A;
    line-height: 1.5;
  }
</style>
</head>
<body>

<div class="head">
  <div>
    <h1 style="font-size: 20px;">FiestaGo</h1>
    <div style="font-size: 10px; color: #5C534A; margin-top: 4px;">${escape_(typeLabel)}</div>
    <div style="margin-top: 10px;"><span class="stamp">${verifactuLabel}</span></div>
  </div>
  <div class="num">
    <h1>Factura</h1>
    <div style="font-family: ui-monospace, monospace; font-size: 14px; font-weight: 700; margin-top: 2px;">${escape_(inv.full_number)}</div>
    <div class="date">Fecha: ${fmtDate(inv.issue_date)}</div>
  </div>
</div>

<div class="parties">
  <div class="party">
    <div class="label">Emisor</div>
    <div class="name">${escape_(inv.issuer_tax_name)}</div>
    <div class="row">NIF: ${escape_(inv.issuer_tax_id)}</div>
    <div class="row">${escape_(inv.issuer_tax_address)}</div>
  </div>
  <div class="party">
    <div class="label">Receptor</div>
    <div class="name">${escape_(inv.recipient_name)}</div>
    ${inv.recipient_tax_id ? `<div class="row">NIF: ${escape_(inv.recipient_tax_id)}</div>` : ''}
    <div class="row">${escape_(inv.recipient_email)}</div>
    ${inv.recipient_address ? `<div class="row">${escape_(inv.recipient_address)}</div>` : ''}
  </div>
</div>

<div class="concept">
  <strong>Concepto:</strong> ${escape_(inv.concept)}
</div>

<table class="items">
  <thead>
    <tr>
      <th>Descripción</th>
      <th class="num">Cant.</th>
      <th class="num">Precio unit.</th>
      <th class="num">Subtotal</th>
    </tr>
  </thead>
  <tbody>
    ${inv.items.map(it => `
      <tr>
        <td>${escape_(it.description)}</td>
        <td class="num">${it.quantity}</td>
        <td class="num">${fmtEur(it.unit_price)}</td>
        <td class="num">${fmtEur(it.subtotal)}</td>
      </tr>
    `).join('')}
  </tbody>
</table>

<div class="totals">
  <div class="row"><span>Base imponible</span><span class="amount">${fmtEur(inv.base_amount)}</span></div>
  <div class="row"><span>IVA (${inv.tax_rate}%)</span><span class="amount">${fmtEur(inv.tax_amount)}</span></div>
  <div class="row total"><span>Total</span><span class="amount">${fmtEur(inv.total_amount)}</span></div>
</div>

<div class="footer">
  <div class="hashes">
    <div><span class="label">Huella factura:</span>${escape_(inv.invoice_hash)}</div>
    ${inv.prev_invoice_hash ? `<div><span class="label">Huella anterior:</span>${escape_(inv.prev_invoice_hash)}</div>` : ''}
  </div>
  <div class="qr">
    <img src="https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(inv.qr_content)}" alt="QR Verifactu"/>
    <div class="caption">Verificable en AEAT</div>
  </div>
</div>

<div class="legal">
  Factura emitida conforme al Real Decreto 1007/2023 (Reglamento Verifactu). Los datos de esta factura están registrados con hash SHA-256 encadenado, garantizando su integridad e inmutabilidad. Puede verificar su validez escaneando el código QR con la aplicación oficial de la Agencia Tributaria.
  ${inv.invoice_type === 'delegated_provider' ? '<br><br><strong>Factura emitida por FiestaGo en nombre del proveedor</strong> según lo dispuesto en el artículo 5 del Real Decreto 1619/2012, con consentimiento previo del sujeto pasivo.' : ''}
</div>

</body></html>`
}

function escape_(s: string | number | null | undefined): string {
  if (s == null) return ''
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
