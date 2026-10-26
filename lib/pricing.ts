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

// ─── Cómo cobra cada servicio ─────────────────────────────────────────
// Cada proveedor elige (siempre con IVA incluido):
//   · 'guests' → precio para N personas + € por persona de más
//                (fotógrafo, local, catering… "45 €/persona, mínimo 30"
//                = base 1.350, incluidas 30, extra 45)
//   · 'hours'  → precio para N horas + € por hora de más (DJ, animación…)
//   · 'fixed'  → precio cerrado (una tarta, un photocall)
// Con eso el sistema calcula el precio del proveedor para el caso del
// cliente: base + max(0, invitados − incluidos) × extra (o lo mismo con
// horas). Los servicios antiguos sin pricing_unit se deducen de sus campos.

export type PricingUnit = 'fixed' | 'guests' | 'hours'

export type GuestPricing = {
  price: number | null
  pricing_unit?: PricingUnit | string | null
  included_guests?: number | null
  extra_guest_price?: number | null
  included_hours?: number | null
  extra_hour_price?: number | null
}

/** Cómo cobra el servicio (deducido si no está guardado). */
export function pricingUnit(s: GuestPricing): PricingUnit {
  if (s.pricing_unit === 'guests' || s.pricing_unit === 'hours' || s.pricing_unit === 'fixed') {
    if (s.pricing_unit === 'guests' && !(Number(s.included_guests) > 0 && Number(s.extra_guest_price) > 0)) return 'fixed'
    if (s.pricing_unit === 'hours' && !(Number(s.included_hours) > 0 && Number(s.extra_hour_price) > 0)) return 'fixed'
    return s.pricing_unit
  }
  if (Number(s.included_guests) > 0 && Number(s.extra_guest_price) > 0) return 'guests'
  if (Number(s.included_hours) > 0 && Number(s.extra_hour_price) > 0) return 'hours'
  return 'fixed'
}

/** ¿El servicio cambia de precio según el número de invitados? */
export function hasGuestPricing(s: GuestPricing): boolean {
  return pricingUnit(s) === 'guests'
}

/** ¿El servicio cambia de precio según las horas? */
export function hasHourPricing(s: GuestPricing): boolean {
  return pricingUnit(s) === 'hours'
}

/** Precio del proveedor (IVA incluido, sin Garantía) para el caso del cliente. */
export function priceFor(s: GuestPricing, opts: { guests?: number | null; hours?: number | null } = {}): number {
  const base = Number(s.price) || 0
  const unit = pricingUnit(s)
  if (unit === 'guests') {
    const extra = Math.max(0, Math.floor(Number(opts.guests) || 0) - Number(s.included_guests))
    return Math.round((base + extra * Number(s.extra_guest_price)) * 100) / 100
  }
  if (unit === 'hours') {
    const extra = Math.max(0, Math.ceil(Number(opts.hours) || 0) - Number(s.included_hours))
    return Math.round((base + extra * Number(s.extra_hour_price)) * 100) / 100
  }
  return base
}

/** Compatibilidad: precio según invitados (los servicios por horas usan sus horas incluidas). */
export function priceForGuests(s: GuestPricing, guests?: number | null): number {
  return priceFor(s, { guests })
}

/** Cuánto sale por persona (para mostrarlo junto al total). */
export function perPerson(total: number, guests?: number | null): number | null {
  const g = Math.floor(Number(guests) || 0)
  return g > 0 && total > 0 ? Math.round((total / g) * 100) / 100 : null
}

/** "Precio para 30 personas · 45 € por persona de más" (o por horas). */
export function pricingSummary(s: GuestPricing): string {
  const unit = pricingUnit(s)
  if (unit === 'guests') return `para ${s.included_guests} personas · ${formatEuro(Number(s.extra_guest_price))} por persona de más`
  if (unit === 'hours') return `para ${s.included_hours} h · ${formatEuro(Number(s.extra_hour_price))} por hora de más`
  return 'precio cerrado'
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
