/**
 * Textos legales que se muestran y se guardan como prueba.
 *
 * Regla de oro de este módulo: el texto que se renderiza en pantalla y el
 * que se guarda en booking_consents.displayed_clause_text salen de la
 * MISMA función. Si algún día divergen, la evidencia deja de valer: el
 * emisor de la tarjeta no acepta "el cliente aceptó unas condiciones
 * parecidas a estas".
 *
 * Cuando cambies TERMS_PAYMENTS_CONTENT sube también su etiqueta de
 * versión. Nunca se edita una versión ya publicada — se publica otra
 * (ver publish_terms_version() en la migración anti-chargeback).
 */

// ─── Versiones publicadas ────────────────────────────────────────────────
// Historial:
//   2026-09-a · septiembre 2026 — versión inicial del documento de pagos,
//               anticipo y reembolso usado en el checkout.
export const TERMS_PAYMENTS_VERSION = '2026-09-a'

export type LegalDocumentType = 'terms' | 'guarantee' | 'privacy'

/**
 * Texto literal del documento de condiciones de pago que el cliente
 * acepta al pagar. Es el que se guarda íntegro en terms_versions.content
 * y el que se adjunta como "refund_policy" en la evidencia de una
 * disputa, así que tiene que ser autocontenido: quien lo lea dentro de
 * un año no va a tener a mano la web.
 */
export const TERMS_PAYMENTS_CONTENT = `FIESTAGO · CONDICIONES DE PAGO, ANTICIPO Y REEMBOLSO
Versión ${TERMS_PAYMENTS_VERSION}

1. OBJETO
FiestaGo es una plataforma de intermediación que pone en contacto a clientes con proveedores de servicios para eventos (fotografía, catering, espacios, música, flores y otras categorías). El servicio lo presta el proveedor contratado; FiestaGo gestiona la reserva, el cobro y la Garantía de Éxito.

2. PRECIO Y TARIFA DE SERVICIO
El cliente abona el precio del servicio fijado por el proveedor más una tarifa de servicio del 8% en concepto de Garantía de Éxito. El importe total queda retenido por FiestaGo en depósito (escrow) hasta la finalización del evento.

3. CALENDARIO DE PAGOS
Cada servicio puede requerir un anticipo de entre el 0% y el 40% del precio en el momento de la reserva, según la configuración del proveedor, visible en la ficha del servicio antes de reservar. En todo caso el cliente debe tener abonado el 100% del importe con al menos 2 meses (60 días) de antelación al evento.
  a) Si el servicio no exige anticipo, el cliente paga el 100% al reservar.
  b) Si el servicio exige anticipo y el evento es en más de 60 días, el cliente paga el anticipo al reservar y el resto en la fecha calculada automáticamente como fecha del evento menos 60 días.
  c) Si el servicio exige anticipo pero el evento es en 60 días o menos, el cliente paga el 100% al reservar y no hay segundo pago.
El segundo pago NO se carga en silencio a la tarjeta guardada: FiestaGo envía al cliente un enlace de pago por email y WhatsApp, y el cliente completa el pago autenticándose con su banco.

4. PÉRDIDA DEL ANTICIPO POR IMPAGO DEL RESTO
Llegada la fecha de vencimiento del segundo pago, el cliente dispone de 7 días naturales de gracia, durante los cuales recibe recordatorios por email y, si procede, por WhatsApp. Transcurrido ese plazo sin haber completado el pago, la reserva se cancela automáticamente y EL ANTICIPO ABONADO NO SE REEMBOLSA: se destina íntegramente al proveedor como compensación por haber bloqueado la fecha del evento y haber rechazado otras solicitudes para ese día.

5. CANCELACIÓN POR EL CLIENTE
Cada servicio indica en su ficha la política de cancelación aplicable. El reembolso se calcula sobre el importe pagado en función de la política y de los días que resten hasta el evento:
  · Flexible: 100% si se cancela con 7 o más días de antelación; 50% entre 7 y 2 días; 0% en las últimas 48 horas.
  · Moderada: 100% con 14 o más días; 50% entre 14 y 7 días; 0% con menos de 7 días.
  · Estricta: 50% con 30 o más días; 0% con menos de 30 días.
El reembolso aprobado se procesa al mismo método de pago original en un máximo de 5 días hábiles.

6. GARANTÍA DE ÉXITO
Si el proveedor cancela una reserva confirmada, FiestaGo proporciona un sustituto equivalente en un máximo de 48 horas o reembolsa al cliente el 110% del importe pagado. Si el proveedor no se presenta el día del evento, el cliente recibe el reembolso del 100% más una compensación de entre 300€ y 3.000€ según el importe de la reserva. En caso de fuerza mayor del cliente debidamente acreditada (fallecimiento de familiar directo u hospitalización) el evento puede aplazarse hasta 12 meses sin coste.
Quedan excluidos: meteorología en eventos al aire libre, insatisfacción subjetiva sin incumplimiento objetivo, cambios solicitados por el cliente fuera del alcance contratado, daños causados por invitados, reclamaciones presentadas más de 14 días después del evento y operaciones realizadas total o parcialmente fuera de la plataforma. Importe máximo cubierto: 25.000€ por reserva.

7. RECLAMACIONES
Antes de iniciar una reclamación ante la entidad emisora de su tarjeta, el cliente se compromete a contactar con FiestaGo en contacto@fiestago.es. FiestaGo responde a toda incidencia en un plazo máximo de 48 horas y dispone del procedimiento de Garantía de Éxito descrito en el apartado 6 para resolverla.

8. CARGO EN EL EXTRACTO BANCARIO
El cargo aparecerá en el extracto de la tarjeta identificado como FIESTAGO. Al tratarse de reservas con hasta 8 meses de antelación al evento, se recomienda conservar el email de confirmación de la reserva.

9. CONSERVACIÓN DE LA PRUEBA DE ACEPTACIÓN
La aceptación de estas condiciones se registra con fecha y hora, dirección IP, navegador y copia literal del texto mostrado. Este registro se conserva durante 14 meses desde la fecha del evento por interés legítimo (defensa frente a reclamaciones), conforme a la política de privacidad.`

/**
 * Etiqueta del checkbox de condiciones generales y privacidad. Va
 * SEPARADO del de pérdida del anticipo: agregarlos en uno solo es
 * exactamente lo que un emisor de tarjeta usa para tumbar la evidencia.
 */
export const GENERAL_TERMS_CHECKBOX_LABEL =
  'He leído y acepto las Condiciones de uso y la Política de privacidad de FiestaGo.'

export const ADVANCE_FORFEIT_CHECKBOX_LABEL =
  'Entiendo y acepto la política de reembolso y que el anticipo no es reembolsable en los supuestos descritos arriba.'

export type ForfeitClauseInput = {
  providerName: string
  eventDate: string | Date
  /** Importe que se paga ahora, en euros. */
  amountNow: number
  /** Importe del segundo pago, 0 si no hay split. */
  secondAmount?: number | null
  /** Fecha de vencimiento del segundo pago (YYYY-MM-DD), si hay split. */
  secondDueDate?: string | null
  /** 'deposit' = anticipo o 100% al reservar · 'balance' = resto. */
  stage: 'deposit' | 'balance'
  /** Política de cancelación del servicio. */
  cancellationPolicy?: 'flexible' | 'moderate' | 'strict' | null
}

const EUR = (n: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 }).format(n || 0)

const DATE_ES = (d: string | Date) =>
  new Date(typeof d === 'string' && d.length === 10 ? d + 'T00:00:00' : d)
    .toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })

const POLICY_TEXT: Record<string, string> = {
  flexible: 'Flexible: reembolso del 100% si cancelas con 7 o más días de antelación, del 50% entre 7 y 2 días, y del 0% en las últimas 48 horas.',
  moderate: 'Moderada: reembolso del 100% si cancelas con 14 o más días de antelación, del 50% entre 14 y 7 días, y del 0% con menos de 7 días.',
  strict:   'Estricta: reembolso del 50% si cancelas con 30 o más días de antelación, y del 0% con menos de 30 días.',
}

/**
 * Genera el texto literal de la cláusula de pérdida del anticipo que se
 * renderiza VISIBLE en la página de pago (no detrás de un enlace ni de un
 * modal) y que se guarda tal cual en booking_consents.
 *
 * Lleva los importes y fechas concretos de esta reserva a propósito: una
 * cláusula genérica prueba mucho menos que una que dice "usted aceptó
 * perder estos 380 € si no pagaba los 700 € restantes antes del 14 de
 * marzo de 2027".
 */
export function buildAdvanceForfeitClause(input: ForfeitClauseInput): string {
  const {
    providerName, eventDate, amountNow, secondAmount, secondDueDate, stage,
    cancellationPolicy,
  } = input

  const hasSplit = stage === 'deposit' && Number(secondAmount || 0) > 0 && !!secondDueDate
  const policy = POLICY_TEXT[cancellationPolicy || 'moderate'] || POLICY_TEXT.moderate

  const lines: string[] = []

  lines.push(
    `POLÍTICA DE REEMBOLSO Y PÉRDIDA DEL ANTICIPO · reserva con ${providerName} para el evento del ${DATE_ES(eventDate)}.`
  )

  if (hasSplit) {
    lines.push(
      `1. Hoy pagas ${EUR(amountNow)} en concepto de anticipo. Con este pago el proveedor bloquea la fecha ${DATE_ES(eventDate)} y deja de ofrecerla a otros clientes.`,
      `2. El resto, ${EUR(Number(secondAmount))}, vence el ${DATE_ES(secondDueDate!)} (dos meses antes del evento). Te enviaremos un enlace de pago por email y WhatsApp: no cargaremos nada a tu tarjeta sin que lo autorices tú en ese momento.`,
      `3. Si llegado el vencimiento no completas el segundo pago, dispones de 7 días naturales de gracia con recordatorios. Pasado ese plazo la reserva se cancela automáticamente y EL ANTICIPO DE ${EUR(amountNow).toUpperCase()} NO SE TE DEVUELVE: se entrega íntegro al proveedor como compensación por la fecha bloqueada.`,
      `4. Si cancelas tú la reserva, se aplica la política de cancelación del servicio. ${policy}`,
    )
  } else {
    lines.push(
      `1. Hoy pagas ${EUR(amountNow)}${stage === 'balance' ? ', el importe restante de tu reserva' : ', el importe íntegro de tu reserva'}. Con este pago el proveedor bloquea la fecha ${DATE_ES(eventDate)} y deja de ofrecerla a otros clientes.`,
      `2. Si cancelas la reserva, se aplica la política de cancelación del servicio. ${policy}`,
      `3. La parte no reembolsable según esa política se entrega al proveedor como compensación por la fecha bloqueada.`,
    )
  }

  lines.push(
    `5. El importe queda retenido por FiestaGo (escrow) hasta que el evento se celebre, y cubierto por la Garantía de Éxito: si el proveedor cancela o no se presenta, recuperas tu dinero con la compensación descrita en las condiciones.`,
    `6. El cargo aparecerá en tu extracto bancario como FIESTAGO. Si tienes cualquier problema con la reserva, escríbenos a contacto@fiestago.es antes de reclamar a tu banco: respondemos en menos de 48 horas.`,
  )

  // Renumeración: los dos últimos puntos siguen la numeración real según
  // el número de líneas ya emitidas (excluida la cabecera).
  return renumber(lines).join('\n')
}

function renumber(lines: string[]): string[] {
  let n = 0
  return lines.map((line, i) => {
    if (i === 0) return line
    n++
    return line.replace(/^\d+\.\s*/, `${n}. `)
  })
}
