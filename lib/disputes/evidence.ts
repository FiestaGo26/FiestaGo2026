/**
 * Compilación del paquete de evidencia de una disputa.
 *
 * Recoge todo lo que hay en Supabase sobre la reserva, genera los tres
 * PDF, los sube a Stripe y devuelve el objeto `evidence` listo para
 * stripe.disputes.update().
 *
 * Lo que NO hace: enviar. La evidencia se deja como borrador para que
 * Mariano la revise. Stripe la envía sola al llegar evidence_due_by, y
 * un envío con submit: true es irreversible — no se puede corregir
 * después.
 */

import type Stripe from 'stripe'
import { createAdminClient } from '@/lib/supabase'
import { getStripe } from '@/lib/stripe'
import { getLatestConsent, type BookingConsentRow } from '@/lib/payments/consent'
import { getTermsVersion, type TermsVersion } from '@/lib/legal/terms-versions'
import {
  buildCommunicationsPdf,
  buildRefundPolicyPdf,
  buildServiceDocumentationPdf,
} from '@/lib/disputes/documents'

export type ServiceConfirmationRow = {
  id: string
  booking_id: string
  provider_id: string | null
  confirmed_at: string
  service_date: string
  notes: string | null
  ip_address: string | null
  confirmation_method: string
}

export type TimelineItem = { at: string; label: string; detail?: string }

export type EvidenceBundle = {
  booking: any
  provider: any
  consent: BookingConsentRow | null
  termsVersion: TermsVersion | null
  confirmation: ServiceConfirmationRow | null
  chatMessages: any[]
  whatsappMessages: any[]
  invoices: any[]
  timeline: TimelineItem[]
}

// ─── 1 · Recogida de datos ──────────────────────────────────────────────

export async function gatherEvidence(bookingId: string): Promise<EvidenceBundle> {
  const supabase = createAdminClient()

  const { data: booking } = await supabase
    .from('bookings')
    .select('*, providers(*)')
    .eq('id', bookingId)
    .maybeSingle()

  if (!booking) throw new Error(`Reserva ${bookingId} no encontrada`)

  const provider = booking.providers || null
  const consent = await getLatestConsent(bookingId)
  const termsVersion = consent ? await getTermsVersion(consent.terms_version_id) : null

  const { data: confirmation } = await supabase
    .from('service_confirmations')
    .select('*')
    .eq('booking_id', bookingId)
    .order('confirmed_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data: chatMessages } = await supabase
    .from('messages')
    .select('*')
    .eq('booking_id', bookingId)
    .order('created_at', { ascending: true })
    .limit(500)

  let whatsappMessages: any[] = []
  if (booking.provider_id) {
    const { data } = await supabase
      .from('whatsapp_messages')
      .select('id, direction, body, type, status, created_at')
      .eq('provider_id', booking.provider_id)
      .order('created_at', { ascending: true })
      .limit(300)
    whatsappMessages = data || []
  }

  const { data: invoices } = await supabase
    .from('invoices')
    .select('id, full_number, issue_date, invoice_type, total_amount, recipient_address, recipient_name, recipient_tax_id')
    .eq('booking_id', bookingId)
    .order('issue_date', { ascending: true })

  return {
    booking,
    provider,
    consent,
    termsVersion,
    confirmation: (confirmation as ServiceConfirmationRow) || null,
    chatMessages: chatMessages || [],
    whatsappMessages,
    invoices: invoices || [],
    timeline: buildTimeline(booking, consent, confirmation as ServiceConfirmationRow | null, invoices || []),
  }
}

/**
 * Cronología de lo que la plataforma comunicó al cliente. Se reconstruye
 * desde los timestamps que la propia reserva va guardando: cada uno de
 * ellos se escribió al enviar el email correspondiente, así que es una
 * traza de envíos, no una redacción posterior.
 */
function buildTimeline(
  booking: any,
  consent: BookingConsentRow | null,
  confirmation: ServiceConfirmationRow | null,
  invoices: any[],
): TimelineItem[] {
  const items: TimelineItem[] = []
  const add = (at: string | null | undefined, label: string, detail?: string) => {
    if (at) items.push({ at, label, detail })
  }

  add(booking.created_at, 'Solicitud de reserva recibida',
    'Email automatico al cliente confirmando la recepcion de la solicitud (emailClientBookingReceived).')
  add(booking.confirmed_at, 'Reserva confirmada por el proveedor',
    'Email automatico al cliente con los datos del proveedor y el enlace de pago (emailClientBookingConfirmed).')
  if (consent) {
    add(consent.accepted_at, 'El cliente acepta las condiciones y la politica de reembolso',
      `Dos casillas separadas, sin premarcar. IP ${consent.ip_address || 'no capturada'}.`)
  }
  add(booking.first_payment_paid_at, 'Primer pago cobrado',
    `Importe ${booking.first_payment_amount} EUR. Descriptor en el extracto: FIESTAGO.`)
  for (const inv of invoices) {
    add(inv.issue_date, `Factura ${inv.full_number} emitida y enviada por email`,
      `${inv.invoice_type === 'commission_fiestago' ? 'Comision FiestaGo' : 'Servicios del proveedor'} · ${inv.total_amount} EUR.`)
  }
  add(booking.second_payment_reminder_d7_sent_at, 'Recordatorio del segundo pago (7 dias antes del vencimiento)')
  add(booking.second_payment_reminder_d3_sent_at, 'Recordatorio del segundo pago (3 dias antes del vencimiento)')
  add(booking.second_payment_reminder_d0_sent_at, 'Recordatorio del segundo pago (dia del vencimiento)')
  add(booking.second_payment_overdue_since, 'Aviso de segundo pago vencido e inicio del periodo de gracia')
  add(booking.second_payment_paid_at, 'Segundo pago cobrado',
    `Importe ${booking.second_payment_amount} EUR, mediante enlace de pago con autenticacion del titular (SCA).`)
  add(booking.second_payment_cancelled_at, 'Reserva cancelada automaticamente por impago del segundo pago')
  add(booking.cancelled_at, 'Reserva cancelada', booking.cancel_reason || undefined)
  if (confirmation) {
    add(confirmation.confirmed_at, 'El proveedor confirma que el servicio se presto',
      `Fecha del servicio: ${confirmation.service_date}. Metodo: ${confirmation.confirmation_method}.`)
  }
  add(booking.reviewed_at, 'El cliente publica una resena sobre el servicio',
    booking.review_rating ? `Valoracion: ${booking.review_rating}/5. ${booking.review_text || ''}`.trim() : undefined)

  return items.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
}

// ─── 2 · PDF y subida a Stripe ──────────────────────────────────────────

export type EvidenceFiles = {
  service_documentation?: string
  customer_communication?: string
  refund_policy?: string
  errors?: string[]
}

export function buildEvidencePdfs(bundle: EvidenceBundle) {
  return {
    serviceDocumentation: buildServiceDocumentationPdf(bundle),
    customerCommunication: buildCommunicationsPdf(bundle),
    refundPolicy: buildRefundPolicyPdf(bundle),
  }
}

/**
 * Sube los tres PDF a Stripe con purpose 'dispute_evidence'. Si alguno
 * falla seguimos con los demás: media evidencia adjuntada es mejor que
 * ninguna, y el error queda anotado para que se vea en el panel.
 */
export async function uploadEvidenceFiles(bundle: EvidenceBundle): Promise<EvidenceFiles> {
  const stripe = getStripe()
  const pdfs = buildEvidencePdfs(bundle)
  const shortId = String(bundle.booking.id).slice(0, 8)
  const out: EvidenceFiles = {}
  const errors: string[] = []

  const uploads: Array<[keyof EvidenceFiles, Buffer, string]> = [
    ['service_documentation',  pdfs.serviceDocumentation,  `servicio-${shortId}.pdf`],
    ['customer_communication', pdfs.customerCommunication, `comunicaciones-${shortId}.pdf`],
    ['refund_policy',          pdfs.refundPolicy,          `politica-reembolso-${shortId}.pdf`],
  ]

  for (const [field, data, name] of uploads) {
    try {
      const file = await stripe.files.create({
        purpose: 'dispute_evidence',
        file: { data, name, type: 'application/pdf' },
      })
      out[field] = file.id as any
    } catch (err: any) {
      console.error(`[disputes] subida de ${name} fallida:`, err?.message)
      errors.push(`${name}: ${err?.message || 'error desconocido'}`)
    }
  }

  if (errors.length) out.errors = errors
  return out
}

// ─── 3 · Objeto evidence para Stripe ────────────────────────────────────

export function buildRefundPolicyDisclosure(bundle: EvidenceBundle): string {
  const { consent, termsVersion } = bundle
  if (!consent) {
    return 'No consta registro de aceptacion para esta reserva en el sistema de la plataforma.'
  }
  const accepted = new Date(consent.accepted_at).toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })
  return [
    'La politica de reembolso y la clausula de perdida del anticipo se mostraron al cliente de forma visible en la propia pagina de pago',
    `(${consent.page_url || 'pagina de pago de la reserva'}), renderizadas en el documento HTML junto al importe, no detras de un enlace ni de una ventana emergente.`,
    'Para completar el pago el cliente tuvo que marcar dos casillas independientes, ninguna de ellas premarcada: una para las condiciones generales y la politica de privacidad,',
    'y otra especifica para la politica de reembolso y la no devolucion del anticipo.',
    `La aceptacion quedo registrada el ${accepted} (hora peninsular espanola) desde la direccion IP ${consent.ip_address || 'no capturada'}`,
    `con el navegador "${consent.user_agent || 'no capturado'}".`,
    `El texto aceptado corresponde a la version ${termsVersion?.version_label || 'vigente'} del documento, con huella SHA-256 ${consent.content_hash},`,
    'almacenada en el mismo registro de aceptacion, lo que permite verificar que el texto no ha sido alterado con posterioridad.',
    'El registro de aceptacion se guarda en una tabla con triggers que impiden cualquier modificacion o borrado posterior.',
    'Se adjunta el texto integro en el documento de politica de reembolso.',
  ].join(' ')
}

export function buildUncategorizedText(bundle: EvidenceBundle): string {
  const { booking, provider, consent, confirmation, timeline } = bundle
  const lines: string[] = []

  lines.push(
    `FiestaGo es una plataforma espanola de reserva de servicios para eventos. El cliente ${booking.client_name} (${booking.client_email}) ` +
    `contrato a traves de la plataforma el servicio de ${provider?.name || 'un proveedor verificado'} ` +
    `(${provider?.category || 'servicios para eventos'}, ${provider?.city || 'Espana'}) para su evento del ${fmtDate(booking.event_date)}.`
  )
  lines.push('')
  lines.push(
    'Modelo de pago: el cliente abona un anticipo al cerrar la reserva y el resto dos meses antes del evento, ' +
    'de modo que entre el primer cargo y la prestacion del servicio pueden transcurrir varios meses. ' +
    'Ambos cobros se realizan con el titular presente y autenticacion reforzada (SCA); no se realizan cargos recurrentes ni fuera de sesion.'
  )
  lines.push('')
  lines.push('CRONOLOGIA DE LA OPERACION:')
  for (const item of timeline) {
    lines.push(`- ${fmtDateTime(item.at)}: ${item.label}${item.detail ? ` (${item.detail})` : ''}`)
  }
  lines.push('')

  if (confirmation) {
    lines.push(
      `PRESTACION DEL SERVICIO: el proveedor confirmo expresamente desde su panel autenticado, el ${fmtDateTime(confirmation.confirmed_at)}, ` +
      `que el servicio se presto en la fecha ${fmtDate(confirmation.service_date)}. El registro es inmutable.`
    )
  } else if (booking.event_date && new Date(booking.event_date) > new Date()) {
    lines.push(
      `SITUACION ACTUAL: el evento esta previsto para el ${fmtDate(booking.event_date)} y todavia no ha tenido lugar. ` +
      'El importe permanece retenido por la plataforma y el proveedor mantiene la fecha bloqueada en exclusiva para este cliente.'
    )
  } else {
    lines.push(
      'PRESTACION DEL SERVICIO: a la fecha de este escrito no consta registro de confirmacion del proveedor en la plataforma.'
    )
  }

  lines.push('')
  if (consent) {
    lines.push(
      `ACEPTACION DE CONDICIONES: registrada el ${fmtDateTime(consent.accepted_at)} desde la IP ${consent.ip_address || 'no capturada'}, ` +
      'con casilla especifica e independiente para la politica de reembolso.'
    )
  }
  lines.push(
    'El cargo aparece identificado en el extracto del titular como FIESTAGO. ' +
    'La plataforma atiende cualquier incidencia en contacto@fiestago.es en un plazo maximo de 48 horas y dispone de un procedimiento propio de reembolso ' +
    '(Garantia de Exito) que el cliente no ha llegado a utilizar antes de reclamar a su entidad emisora.'
  )

  return lines.join('\n')
}

/**
 * Monta el objeto `evidence` de Stripe. `files` se pasa aparte porque la
 * subida puede fallar sin que eso invalide el resto del escrito.
 */
export function buildEvidenceObject(
  bundle: EvidenceBundle,
  files: EvidenceFiles,
): Stripe.DisputeUpdateParams.Evidence {
  const { booking, provider, consent, confirmation, invoices } = bundle

  const serviceDate = confirmation?.service_date || booking.event_date
  const invoiceWithAddress = invoices.find(i => i.recipient_address)

  const evidence: Stripe.DisputeUpdateParams.Evidence = {
    service_date: fmtDate(serviceDate),
    customer_name: booking.client_name || '',
    customer_email_address: booking.client_email || '',
    customer_purchase_ip: consent?.ip_address || undefined,
    billing_address: invoiceWithAddress?.recipient_address
      || [booking.city, 'Espana'].filter(Boolean).join(', '),
    product_description:
      `Reserva de ${provider?.category || 'servicio para eventos'} con ${provider?.name || 'proveedor verificado'} ` +
      `para el evento del ${fmtDate(booking.event_date)} en ${booking.city || provider?.city || 'Espana'}. ` +
      `Importe total ${booking.total_amount} EUR, del que ${booking.commission_amt || 0} EUR corresponden a la tarifa de servicio de la plataforma.`,
    refund_policy_disclosure: buildRefundPolicyDisclosure(bundle),
    uncategorized_text: buildUncategorizedText(bundle),
  }

  if (files.service_documentation)  evidence.service_documentation  = files.service_documentation
  if (files.customer_communication) evidence.customer_communication = files.customer_communication
  if (files.refund_policy)          evidence.refund_policy          = files.refund_policy

  return evidence
}

/**
 * Todo junto: datos → PDF → subida → objeto evidence. Lo usan el webhook
 * (al abrirse la disputa) y el panel de admin (al recompilar).
 */
export async function compileEvidenceForBooking(bookingId: string): Promise<{
  bundle: EvidenceBundle
  files: EvidenceFiles
  evidence: Stripe.DisputeUpdateParams.Evidence
}> {
  const bundle = await gatherEvidence(bookingId)
  const files = await uploadEvidenceFiles(bundle)
  const evidence = buildEvidenceObject(bundle, files)
  return { bundle, files, evidence }
}

function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return ''
  const date = new Date(typeof d === 'string' && d.length === 10 ? d + 'T00:00:00Z' : d)
  if (isNaN(date.getTime())) return String(d)
  return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Madrid' })
}

function fmtDateTime(d: string | Date | null | undefined): string {
  if (!d) return ''
  const date = new Date(d)
  if (isNaN(date.getTime())) return String(d)
  return date.toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })
}
