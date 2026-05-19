// ───────────────────────────────────────────────────────────────────────
// Garantía de Éxito — funciones de cálculo
// Fuente única para que el importe que el cliente recibe y el que se le
// cobra al proveedor sean coherentes en todos los sitios (panel admin,
// emails, página /garantia, documentos internos).
// ───────────────────────────────────────────────────────────────────────

/**
 * Compensación fija que recibe el cliente cuando un proveedor incumple
 * (no-show o cancelación con <7 días). La paga íntegramente el proveedor,
 * descontada de su payout (o cobrada directamente si no tiene payout
 * suficiente).
 *
 * La escala es "potente" a propósito: tiene que doler al proveedor para
 * que no cancele por capricho.
 */
export function calcCompensation(ticket: number): number {
  const t = Number(ticket) || 0
  if (t <= 500)    return 300
  if (t <= 2_000)  return 500
  if (t <= 5_000)  return 1_000
  if (t <= 15_000) return 2_000
  return 3_000
}

/**
 * Resumen del coste total para el proveedor cuando incumple. Útil para
 * mostrar transparente en emails y en el modal de admin.
 *
 * - clientPaid: lo que pagó el cliente (incluye comisión FiestaGo).
 * - ticket: el precio neto del proveedor antes de comisión (= provider_earns
 *           teórico). Se usa para escalar la compensación.
 */
export function calcProviderChargeForNoShow(opts: { clientPaid: number; ticket: number }) {
  const refund        = Math.round((opts.clientPaid || 0) * 100) / 100
  const compensation  = calcCompensation(opts.ticket || 0)
  return {
    refundToClient:       refund,                       // se le devuelve al cliente
    compensationToClient: compensation,                 // extra que recibe el cliente
    totalToClient:        refund + compensation,
    providerCharge:       refund + compensation,        // proveedor paga ambas cosas
  }
}
