/**
 * Desglose de pagos de un booking · fuente única.
 *
 * Regla de negocio (definida por el fundador tras la reunión con WOW):
 *
 *   1. El cliente debe tener el 100% del importe en escrow como muy tarde
 *      2 meses (60 días) antes del evento. Sin esto la Garantía de Éxito
 *      no puede activarse: necesitamos el dinero disponible para responder
 *      si el proveedor falla.
 *
 *   2. Si el servicio tiene deposit_pct > 0 Y el evento es dentro de más
 *      de 60 días, el cobro se divide en dos:
 *        · anticipo al reservar     = precio × deposit_pct/100
 *        · resto (evento - 60 días) = precio - anticipo
 *
 *   3. En cualquier otro caso (deposit_pct=0, o evento en <=60 días),
 *      el cliente paga el 100% al reservar. Sin dobles pagos.
 *
 *   4. Si el cliente no paga el resto en la fecha límite, tiene GRACE_DAYS
 *      días de gracia con recordatorios. Pasados esos días → cancelación
 *      automática, el anticipo va al proveedor como compensación.
 */

export const GRACE_DAYS_DEFAULT = 7
export const SECOND_PAYMENT_LEAD_DAYS = 60

export type PaymentSchedule = {
  /** Importe que paga el cliente HOY al reservar. */
  firstPaymentAmount: number
  /** Importe que paga después. 0 si el 100% ya se cobra al reservar. */
  secondPaymentAmount: number
  /** Fecha límite del segundo pago. null si secondPaymentAmount = 0. */
  secondPaymentDueDate: string | null
  /** Estado inicial del segundo pago. */
  secondPaymentStatus: 'not_needed' | 'pending'
  /** true si el evento cae en menos de 60 días y por eso se cobra todo al reservar. */
  isRush: boolean
  /** Copy en lenguaje humano listo para mostrar al cliente en el checkout. */
  humanCopy: string
}

/**
 * Calcula el desglose del pago. NO tiene efectos secundarios — solo
 * matemáticas y fechas puras. El endpoint /api/bookings usa esto tanto
 * para guardar en BD como para devolver el desglose al cliente en el
 * checkout.
 *
 * baseAmount:       importe base del servicio (lo que cobra el proveedor)
 * commissionAmount: Garantía de Éxito (8% base, la paga el cliente)
 * depositPct:       0-40 del servicio elegido (0 si no se definió)
 * eventDate:        YYYY-MM-DD del evento
 * now:              opcional, para tests deterministas
 *
 * REGLA DE DIVISIÓN (Opción A · decidida tras revisión con socios):
 * Cuando hay split, la Garantía se cobra ÍNTEGRA con el anticipo — no
 * proporcional. Razones:
 *   · FiestaGo tiene la Garantía cobrada desde el día 1 → cobertura
 *     total incluso si el cliente no paga el resto.
 *   · Cada pago cuadra exacto con sus facturas (anticipo = comisión
 *     FiestaGo + parte del servicio; resto = solo servicio).
 *   · Simplifica contabilidad: una sola factura de comisión, no dos.
 *
 * Ejemplo: base 1000€ + Garantía 80€, anticipo 30%
 *   Anticipo:  380€  (80€ Garantía  +  300€ = 30% del servicio)
 *   Resto:     700€  (100% del servicio restante, cero Garantía)
 */
export function computePaymentSchedule(
  baseAmount:       number,
  commissionAmount: number,
  depositPct:       number,
  eventDate:        string | Date,
  now:              Date = new Date()
): PaymentSchedule {
  const base       = Math.round(Math.max(0, baseAmount)       * 100) / 100
  const commission = Math.round(Math.max(0, commissionAmount) * 100) / 100
  const total      = Math.round((base + commission)           * 100) / 100
  const pct        = Math.max(0, Math.min(40, Math.round(depositPct || 0)))

  const eventD = typeof eventDate === 'string' ? new Date(eventDate + 'T00:00:00') : new Date(eventDate)
  const dueMs  = eventD.getTime() - SECOND_PAYMENT_LEAD_DAYS * 24 * 60 * 60 * 1000
  const nowMs  = now.getTime()

  // Rush: reserva de última hora (evento <=60 días) o servicio sin anticipo.
  // En ambos casos, el cliente paga el 100% al reservar y no hay segundo pago.
  const isRush = dueMs <= nowMs || pct === 0

  if (isRush) {
    return {
      firstPaymentAmount:   total,
      secondPaymentAmount:  0,
      secondPaymentDueDate: null,
      secondPaymentStatus:  'not_needed',
      isRush:               true,
      humanCopy:            `Pagas ${fmt(total)} al reservar. El importe queda retenido por FiestaGo hasta el evento.`,
    }
  }

  // Opción A: anticipo = Garantía completa + parte proporcional del servicio.
  const providerDeposit = Math.round(base * pct / 100 * 100) / 100
  const first  = Math.round((commission + providerDeposit) * 100) / 100
  const second = Math.round((base - providerDeposit) * 100) / 100
  const dueDate = new Date(dueMs)
  const dueIso  = dueDate.toISOString().slice(0, 10) // YYYY-MM-DD

  return {
    firstPaymentAmount:   first,
    secondPaymentAmount:  second,
    secondPaymentDueDate: dueIso,
    secondPaymentStatus:  'pending',
    isRush:               false,
    humanCopy:
      `Hoy pagas ${fmt(first)} (Garantía de Éxito incluida). ` +
      `El ${fmtDate(dueDate)} pagas los ${fmt(second)} restantes (2 meses antes del evento).`,
  }
}

function fmt(n: number): string {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 }).format(n)
}
function fmtDate(d: Date): string {
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
}
