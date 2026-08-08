/**
 * Generador de facturas · orquestador de emisión legal.
 *
 * Dos funciones principales:
 *
 *   · generateCommissionInvoice(booking):
 *     Factura FiestaGo → Cliente por la comisión de intermediación
 *     (el 8% que paga el cliente sobre el precio base).
 *
 *   · generateDelegatedInvoice(booking, provider):
 *     Factura Proveedor → Cliente por el servicio contratado, emitida
 *     por FiestaGo en nombre del proveedor (facturación delegada,
 *     art. 5 RD 1619/2012). Requiere consent_delegated_invoicing=true.
 *
 * Flujo interno:
 *   1. Cargar datos del emisor (FiestaGo o proveedor)
 *   2. Reservar número de la serie correspondiente (atómico)
 *   3. Recuperar hash de la factura anterior de la cadena
 *   4. Calcular items, base, IVA, total
 *   5. Calcular hash SHA-256 según Verifactu
 *   6. Generar QR
 *   7. INSERT en invoices (inmutable a partir de aquí)
 *
 * El PDF se genera bajo demanda desde el endpoint de descarga —
 * separación de concerns: la factura legal existe con la fila en BD +
 * hash + QR. El PDF es solo una representación visual.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  reserveNextNumber,
  computeInvoiceHash,
  generateQrContent,
  getPrevInvoiceHash,
  providerSeriesFor,
  CURRENT_YEAR,
} from './verifactu'

type Booking = {
  id: string
  provider_id: string | null
  client_name: string
  client_email: string
  event_date: string
  event_type: string | null
  total_amount: number
  provider_earns: number | null
  commission_amt: number | null
  first_payment_amount?: number | null
  second_payment_amount?: number | null
}

type Provider = {
  id: string
  name: string
  tax_id: string | null
  tax_name: string | null
  tax_address: string | null
  consent_delegated_invoicing: boolean
  invoice_series: string | null
}

// Datos fiscales del emisor FiestaGo. Se leen de env vars — así el
// alta fiscal real la introduce Mariano cuando la tenga tramitada,
// sin necesidad de tocar código.
function fiestaGoIssuer(): { tax_id: string; tax_name: string; tax_address: string; series: string } {
  return {
    tax_id:       process.env.FIESTAGO_TAX_ID       || 'PENDIENTE',
    tax_name:     process.env.FIESTAGO_TAX_NAME     || 'FiestaGo (alta fiscal pendiente)',
    tax_address:  process.env.FIESTAGO_TAX_ADDRESS  || 'Valencia, España',
    series:       process.env.FIESTAGO_INVOICE_SERIES || 'FG',
  }
}

/**
 * Factura FiestaGo → Cliente por la comisión de intermediación.
 * Se emite en cada reserva confirmada. El importe facturado es
 * commission_amt (el 8% que paga el cliente sobre el precio base).
 */
export async function generateCommissionInvoice(
  supabase: SupabaseClient,
  booking: Booking
): Promise<{ invoiceId: string; full_number: string; error?: string }> {
  if (!booking.commission_amt || booking.commission_amt <= 0) {
    return { invoiceId: '', full_number: '', error: 'La reserva no tiene comisión imputable (importe 0)' }
  }

  const issuer = fiestaGoIssuer()

  // La comisión ya incluye IVA implícito. Para desglose legal:
  // Si commission_amt = 26€ (8% de 325€ ya con IVA), base = 26/1.21, IVA 21%.
  // AJUSTE: en el modelo actual el 8% es el % que el CLIENTE paga extra,
  // por tanto commission_amt YA es el bruto de la comisión (base + IVA).
  const commissionGross = Number(booking.commission_amt.toFixed(2))
  const taxRate = 21
  const commissionBase = Math.round((commissionGross / 1.21) * 100) / 100
  const commissionTax  = Math.round((commissionGross - commissionBase) * 100) / 100

  // Reservar número atómico
  const year = CURRENT_YEAR()
  const { number, full_number } = await reserveNextNumber(supabase, {
    series: issuer.series,
    year,
    providerId: null,
  })

  // Hash de la anterior (encadenamiento)
  const prevHash = await getPrevInvoiceHash(supabase, {
    series: issuer.series, year, issuerTaxId: issuer.tax_id,
  })

  const issueDate = new Date().toISOString()

  const items = [{
    description: `Servicio de intermediación FiestaGo · reserva ${booking.id.slice(0, 8)} para evento el ${booking.event_date}`,
    quantity: 1,
    unit_price: commissionBase,
    tax_rate: taxRate,
    subtotal: commissionBase,
  }]

  const invoiceCore = {
    issuer_tax_id: issuer.tax_id,
    full_number,
    issue_date: issueDate,
    invoice_type: 'commission_fiestago',
    base_amount: commissionBase,
    tax_amount: commissionTax,
    total_amount: commissionGross,
    prev_invoice_hash: prevHash,
  }

  const invoice_hash = computeInvoiceHash(invoiceCore)
  const qr_content   = generateQrContent({
    issuer_tax_id: issuer.tax_id, full_number,
    issue_date: issueDate, total_amount: commissionGross,
  })

  const { data, error } = await supabase.from('invoices').insert({
    invoice_type:       'commission_fiestago',
    issuer_provider_id: null,
    issuer_tax_id:      issuer.tax_id,
    issuer_tax_name:    issuer.tax_name,
    issuer_tax_address: issuer.tax_address,
    recipient_name:     booking.client_name,
    recipient_email:    booking.client_email,
    series:             issuer.series,
    year, number, full_number,
    issue_date:         issueDate,
    concept:            `Comisión FiestaGo por reserva del ${booking.event_date}`,
    booking_id:         booking.id,
    items_json:         items,
    base_amount:        commissionBase,
    tax_rate:           taxRate,
    tax_amount:         commissionTax,
    total_amount:       commissionGross,
    prev_invoice_hash:  prevHash,
    invoice_hash,
    qr_content,
    verifactu_mode:     'not_sent',
  }).select('id, full_number').single()

  if (error) return { invoiceId: '', full_number: '', error: error.message }
  return { invoiceId: data.id, full_number: data.full_number }
}

/**
 * Factura Proveedor → Cliente por el servicio, emitida por FiestaGo en
 * nombre del proveedor. Requiere consent_delegated_invoicing=true y
 * datos fiscales completos del proveedor (tax_id/tax_name/tax_address).
 *
 * amount: qué importe factura esta factura concreta. Casos:
 *   · Reserva sin split: total = provider_earns (100% del servicio)
 *   · Reserva con anticipo: emite dos facturas, primero por
 *     first_payment_amount, luego por second_payment_amount.
 *
 * Devuelve error controlado (sin throw) para que el endpoint pueda
 * decidir si aborta la confirmación o solo avisa.
 */
export async function generateDelegatedInvoice(
  supabase: SupabaseClient,
  booking: Booking,
  provider: Provider,
  opts: { amount: number; concept: string; taxRate?: number }
): Promise<{ invoiceId: string; full_number: string; error?: string }> {
  if (!provider.consent_delegated_invoicing) {
    return { invoiceId: '', full_number: '', error: 'El proveedor no ha dado consentimiento para facturación delegada' }
  }
  if (!provider.tax_id || !provider.tax_name || !provider.tax_address) {
    return { invoiceId: '', full_number: '', error: 'El proveedor no tiene datos fiscales completos' }
  }
  if (opts.amount <= 0) {
    return { invoiceId: '', full_number: '', error: 'Importe cero o negativo' }
  }

  const taxRate = opts.taxRate ?? 21
  const gross   = Number(opts.amount.toFixed(2))
  const base    = Math.round((gross / (1 + taxRate / 100)) * 100) / 100
  const tax     = Math.round((gross - base) * 100) / 100

  const series = providerSeriesFor(provider)
  const year   = CURRENT_YEAR()

  const { number, full_number } = await reserveNextNumber(supabase, {
    series, year, providerId: provider.id,
  })

  const prevHash = await getPrevInvoiceHash(supabase, {
    series, year, issuerTaxId: provider.tax_id,
  })

  const issueDate = new Date().toISOString()

  const items = [{
    description: opts.concept,
    quantity: 1,
    unit_price: base,
    tax_rate: taxRate,
    subtotal: base,
  }]

  const invoice_hash = computeInvoiceHash({
    issuer_tax_id: provider.tax_id,
    full_number,
    issue_date: issueDate,
    invoice_type: 'delegated_provider',
    base_amount: base,
    tax_amount: tax,
    total_amount: gross,
    prev_invoice_hash: prevHash,
  })

  const qr_content = generateQrContent({
    issuer_tax_id: provider.tax_id, full_number,
    issue_date: issueDate, total_amount: gross,
  })

  const { data, error } = await supabase.from('invoices').insert({
    invoice_type:       'delegated_provider',
    issuer_provider_id: provider.id,
    issuer_tax_id:      provider.tax_id,
    issuer_tax_name:    provider.tax_name,
    issuer_tax_address: provider.tax_address,
    recipient_name:     booking.client_name,
    recipient_email:    booking.client_email,
    series, year, number, full_number,
    issue_date:         issueDate,
    concept:            opts.concept,
    booking_id:         booking.id,
    items_json:         items,
    base_amount:        base,
    tax_rate:           taxRate,
    tax_amount:         tax,
    total_amount:       gross,
    prev_invoice_hash:  prevHash,
    invoice_hash,
    qr_content,
    verifactu_mode:     'not_sent',
  }).select('id, full_number').single()

  if (error) return { invoiceId: '', full_number: '', error: error.message }
  return { invoiceId: data.id, full_number: data.full_number }
}
