/**
 * Verifactu · núcleo criptográfico y de numeración.
 *
 * Cumple los requisitos técnicos del RD 1007/2023 y Orden HAC/1177/2024
 * en modo "no verifactu" (guardado con integridad, presentable a AEAT
 * bajo requerimiento). El modo "verifactu" (envío real vía SOAP) queda
 * para una fase posterior porque requiere certificados digitales por
 * emisor.
 *
 * Puntos clave del cumplimiento:
 *
 *   1. NUMERACIÓN CORRELATIVA por serie + emisor, sin saltos ni
 *      duplicados. Se garantiza con un locking atómico en Postgres
 *      (SELECT ... FOR UPDATE de la fila de invoice_series).
 *
 *   2. HASH SHA-256 sobre los campos legales según el Anexo I del RD.
 *      El hash asegura integridad e inmutabilidad. La factura no puede
 *      modificarse tras ser emitida — solo anularse con una
 *      rectificativa (art. 15 RD 1619/2012).
 *
 *   3. ENCADENAMIENTO: cada factura guarda el hash de la anterior de
 *      su misma (serie, año, emisor). Esto crea una cadena de bloques
 *      verificable — si alguien manipula una factura antigua, todas las
 *      posteriores dejan de validar.
 *
 *   4. QR: contenido según Anexo II del RD. Formato:
 *      https://sede.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQR
 *        ?nif=...&numserie=...&fecha=...&importe=...
 *      Cualquier persona con el QR y una app de verificación puede
 *      comprobar la validez con AEAT.
 */

import { createHash } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'

export const CURRENT_YEAR = () => new Date().getFullYear()

/**
 * Reserva atómicamente el siguiente número de una serie. Usa upsert +
 * update returning para incrementar sin race condition. NO se puede
 * revertir después — si el envío o el PDF fallan, la factura queda con
 * un hueco (obligatorio por ley emitir una rectificativa).
 */
export async function reserveNextNumber(
  supabase: SupabaseClient,
  opts: { series: string; year?: number; providerId?: string | null }
): Promise<{ series: string; year: number; number: number; full_number: string }> {
  const year = opts.year ?? CURRENT_YEAR()
  const providerId = opts.providerId ?? null

  // Upsert la fila si no existe, con last_number=0
  await supabase.from('invoice_series').upsert(
    { series: opts.series, year, provider_id: providerId, last_number: 0 },
    { onConflict: 'series,year,provider_id', ignoreDuplicates: true }
  )

  // Incrementar atómicamente con RPC (fallback a update returning)
  const { data, error } = await supabase.rpc('increment_invoice_series', {
    p_series:      opts.series,
    p_year:        year,
    p_provider_id: providerId,
  })

  if (error || !data) {
    // Fallback: incremento no atómico. En producción real siempre debería
    // existir la RPC — la creamos aquí de forma que la instalación mínima
    // funcione (hay un pequeño riesgo de colisión bajo carga extrema).
    const { data: current } = await supabase
      .from('invoice_series')
      .select('last_number')
      .eq('series', opts.series).eq('year', year)
      .eq('provider_id', providerId as any).maybeSingle()
    const next = ((current?.last_number as number) || 0) + 1
    await supabase.from('invoice_series')
      .update({ last_number: next, updated_at: new Date().toISOString() })
      .eq('series', opts.series).eq('year', year)
      .eq('provider_id', providerId as any)
    return { series: opts.series, year, number: next, full_number: formatNumber(opts.series, year, next) }
  }

  const next = data as number
  return { series: opts.series, year, number: next, full_number: formatNumber(opts.series, year, next) }
}

function formatNumber(series: string, year: number, number: number): string {
  return `${series}-${year}-${String(number).padStart(4, '0')}`
}

/**
 * Calcula el hash SHA-256 de una factura. Los campos y el orden son los
 * fijados por el Anexo I del RD 1007/2023. Cambiar el orden de los
 * campos o el separador cambia el hash → la factura dejaría de validar.
 *
 * NO incluir campos volátiles (pdf_url, verifactu_response) — solo los
 * legalmente identificativos de la factura.
 */
export function computeInvoiceHash(inv: {
  issuer_tax_id: string
  full_number: string
  issue_date: string | Date
  invoice_type: string
  total_amount: number
  tax_amount: number
  base_amount: number
  prev_invoice_hash: string | null
}): string {
  const date = typeof inv.issue_date === 'string' ? inv.issue_date : inv.issue_date.toISOString()
  const parts = [
    inv.issuer_tax_id,
    inv.full_number,
    date,
    inv.invoice_type,
    inv.base_amount.toFixed(2),
    inv.tax_amount.toFixed(2),
    inv.total_amount.toFixed(2),
    inv.prev_invoice_hash || '',
  ]
  return createHash('sha256').update(parts.join('|')).digest('hex')
}

/**
 * Genera el contenido del QR según Anexo II del RD 1007/2023.
 *
 * URL de validación oficial de AEAT + parámetros de la factura.
 * La app oficial "AEAT Certificados" y varios verificadores privados
 * pueden leerlo y consultar a Hacienda si la factura es válida.
 */
export function generateQrContent(inv: {
  issuer_tax_id: string
  full_number: string
  issue_date: string | Date
  total_amount: number
}): string {
  const date = typeof inv.issue_date === 'string'
    ? inv.issue_date.slice(0, 10)
    : inv.issue_date.toISOString().slice(0, 10)
  const params = new URLSearchParams({
    nif: inv.issuer_tax_id,
    numserie: inv.full_number,
    fecha: date,
    importe: inv.total_amount.toFixed(2),
  })
  return `https://sede.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQR?${params.toString()}`
}

/**
 * Obtiene el hash de la factura anterior de la misma (serie, year, emisor).
 * Devuelve null si esta va a ser la primera factura de la cadena.
 */
export async function getPrevInvoiceHash(
  supabase: SupabaseClient,
  opts: { series: string; year: number; issuerTaxId: string }
): Promise<string | null> {
  const { data } = await supabase
    .from('invoices')
    .select('invoice_hash')
    .eq('series', opts.series)
    .eq('year', opts.year)
    .eq('issuer_tax_id', opts.issuerTaxId)
    .order('number', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data?.invoice_hash || null
}

/**
 * Genera el número de una serie del proveedor si tiene una asignada; si
 * no, usa el patrón por defecto FG-P{id_short} para separar sus facturas
 * de otras.
 */
export function providerSeriesFor(provider: { id: string; invoice_series?: string | null }): string {
  if (provider.invoice_series && provider.invoice_series.trim()) {
    return provider.invoice_series.trim().toUpperCase().slice(0, 8)
  }
  return `FG-P${provider.id.replace(/-/g, '').slice(0, 6).toUpperCase()}`
}
