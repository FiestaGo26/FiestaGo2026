// ───────────────────────────────────────────────────────────────────────
// Helper de precios — fuente única para toda la app.
//
// MODELO ECONÓMICO:
//   El proveedor introduce su precio BASE (ej. 100€) y SIEMPRE cobra ese
//   íntegro. El cliente paga base + 8% como "Garantía de Éxito" — ese 8%
//   es lo que se queda FiestaGo y financia la garantía.
//
//   El +8% NUNCA se persiste sumado en BD. Solo se calcula al MOSTRAR
//   precios al cliente y al COBRAR en checkout. En BD el `price_base`
//   es siempre el precio del proveedor sin fee.
//
//   Sin excepciones (no hay "primera reserva gratis"). Aplica también
//   a packs.
// ───────────────────────────────────────────────────────────────────────

export const FEE_RATE = 0.08

/** Lo que el cliente ve y paga = base + 8%. Redondea a céntimos. */
export function precioCliente(base: number): number {
  if (!base || base <= 0) return 0
  return Math.round(base * (1 + FEE_RATE) * 100) / 100
}

/** Importe absoluto de la Garantía de Éxito sobre `base`. 100 -> 8. */
export function importeFee(base: number): number {
  if (!base || base <= 0) return 0
  return Math.round(base * FEE_RATE * 100) / 100
}

// ─── Precio según invitados ───────────────────────────────────────────
// El proveedor pone su precio, los invitados que incluye (el mínimo) y el
// precio por cada invitado de más. Con eso el sistema calcula el precio
// del proveedor para el número de invitados del cliente:
//   base + max(0, invitados − incluidos) × extra
// Si no hay invitados incluidos o precio extra, el precio es fijo.
// Un catering "45 €/persona, mínimo 30" = base 1.350, incluidos 30, extra 45.

export type GuestPricing = {
  price: number | null
  included_guests?: number | null
  extra_guest_price?: number | null
}

/** ¿El servicio cambia de precio según el número de invitados? */
export function hasGuestPricing(s: GuestPricing): boolean {
  return Number(s.included_guests) > 0 && Number(s.extra_guest_price) > 0
}

/** Precio del proveedor (sin Garantía) para `guests` invitados. */
export function priceForGuests(s: GuestPricing, guests?: number | null): number {
  const base = Number(s.price) || 0
  if (!hasGuestPricing(s)) return base
  const extraGuests = Math.max(0, Math.floor(Number(guests) || 0) - Number(s.included_guests))
  return Math.round((base + extraGuests * Number(s.extra_guest_price)) * 100) / 100
}

// ─── Señal al reservar ────────────────────────────────────────────────
// Entre el 10 % y el 20 % (lo que aceptan los clientes, 5.ª simulación).
export const DEPOSIT_MIN = 10
export const DEPOSIT_MAX = 20
export function cleanDeposit(raw: unknown): number {
  const n = Math.round(Number(raw) || DEPOSIT_MIN)
  return Math.max(DEPOSIT_MIN, Math.min(DEPOSIT_MAX, n))
}

/** Lo que cobra el proveedor — el `base` tal cual, expuesto como helper
 *  por simetría con `precioCliente`. */
export function precioProveedorCobra(base: number): number {
  return base || 0
}

/** Formatea un importe en euros para UI. Si es entero, sin decimales
 *  ("108 €" en vez de "108,00 €"). Si tiene céntimos, "108,50 €".
 *  Acepta también números negativos (descuentos, refunds). */
export function formatEuro(n: number, opts: { showCents?: 'auto' | 'always' | 'never' } = {}): string {
  const mode = opts.showCents || 'auto'
  if (n === null || n === undefined || Number.isNaN(n)) return '—'

  const rounded = Math.round(n * 100) / 100
  const isInt   = Math.abs(rounded - Math.round(rounded)) < 0.005

  let decimals = 2
  if (mode === 'never') decimals = 0
  else if (mode === 'auto' && isInt) decimals = 0

  return rounded.toLocaleString('es-ES', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }) + ' €'
}

/** Devuelve los 3 componentes listos para renderizar.
 *  Útil cuando una vista quiere mostrar el desglose completo. */
export function desglosePrecio(base: number): {
  cliente: number
  fee: number
  proveedor: number
  clienteStr: string
  feeStr: string
  proveedorStr: string
} {
  const cliente   = precioCliente(base)
  const fee       = importeFee(base)
  const proveedor = precioProveedorCobra(base)
  return {
    cliente, fee, proveedor,
    clienteStr:   formatEuro(cliente),
    feeStr:       formatEuro(fee),
    proveedorStr: formatEuro(proveedor),
  }
}

/** Texto reutilizable para tooltips/subtítulos.
 *  Sin importe: el porcentaje/importe de la Garantía solo aparece en la
 *  factura Verifactu (obligación fiscal). En web se muestra únicamente
 *  como "Garantía de Éxito incluida" sin distraer al cliente con cifras.
 *  `base` se conserva en la firma para no romper llamadas existentes. */
export function textoGarantiaIncluida(_base?: number): string {
  return 'Garantía de Éxito incluida'
}
