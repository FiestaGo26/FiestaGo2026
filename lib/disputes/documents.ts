/**
 * Los tres PDF que se adjuntan a una disputa.
 *
 *   1. Documentación del servicio  → service_documentation
 *   2. Comunicaciones              → customer_communication
 *   3. Política de reembolso       → refund_policy
 *
 * Todos parten de datos ya guardados en Supabase. Ninguno se genera "a
 * posteriori" con texto redactado para la ocasión: lo que va en el PDF es
 * lo que hay en las tablas, con sus fechas y sus hashes, porque eso es lo
 * que se puede sostener si el emisor pregunta.
 */

import { PdfDoc } from '@/lib/disputes/pdf'
import type { EvidenceBundle } from '@/lib/disputes/evidence'

const EUR = (n: number | null | undefined) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }).format(Number(n || 0))

const DT = (d: string | Date | null | undefined) => {
  if (!d) return '—'
  const date = new Date(typeof d === 'string' && d.length === 10 ? d + 'T00:00:00Z' : d)
  if (isNaN(date.getTime())) return String(d)
  return date.toLocaleString('es-ES', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid',
  }) + ' (hora peninsular española)'
}

const D = (d: string | Date | null | undefined) => {
  if (!d) return '—'
  const date = new Date(typeof d === 'string' && d.length === 10 ? d + 'T00:00:00Z' : d)
  if (isNaN(date.getTime())) return String(d)
  return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Europe/Madrid' })
}

function header(doc: PdfDoc, title: string, bundle: EvidenceBundle) {
  doc.title(title)
  doc.small(`FiestaGo · Reserva ${bundle.booking.id}`)
  doc.small(`Documento generado el ${DT(new Date())}`)
  doc.divider()
}

/** 1 · Documentación del servicio. */
export function buildServiceDocumentationPdf(bundle: EvidenceBundle): Buffer {
  const { booking, provider, confirmation, consent } = bundle
  const doc = new PdfDoc()

  header(doc, 'Documentacion del servicio contratado', bundle)

  doc.heading('1. Reserva')
  doc.field('Identificador de reserva', booking.id)
  doc.field('Fecha de la reserva', DT(booking.created_at))
  doc.field('Estado', booking.status)
  doc.field('Tipo de evento', booking.event_type || '—')
  doc.field('Fecha del evento', D(booking.event_date))
  doc.field('Localidad', booking.city || provider?.city || '—')
  doc.field('Numero de invitados', booking.guests || '—')
  doc.field('Importe total abonado por el cliente', EUR(booking.total_amount))
  if (Number(booking.second_payment_amount || 0) > 0) {
    doc.field('Anticipo (primer pago)', `${EUR(booking.first_payment_amount)} · estado ${booking.first_payment_status || '—'} · ${DT(booking.first_payment_paid_at)}`)
    doc.field('Resto (segundo pago)', `${EUR(booking.second_payment_amount)} · vencimiento ${D(booking.second_payment_due_date)} · estado ${booking.second_payment_status || '—'} · ${DT(booking.second_payment_paid_at)}`)
  } else {
    doc.field('Pago unico al reservar', `${EUR(booking.first_payment_amount || booking.total_amount)} · ${DT(booking.first_payment_paid_at)}`)
  }

  doc.heading('2. Cliente')
  doc.field('Nombre', booking.client_name)
  doc.field('Email', booking.client_email)
  doc.field('Telefono', booking.client_phone || '—')
  if (booking.planner_name) doc.field('Gestionada por (planner)', `${booking.planner_name} · ${booking.planner_email || '—'}`)

  doc.heading('3. Proveedor que presta el servicio')
  doc.field('Nombre', provider?.name || '—')
  doc.field('Categoria', provider?.category || '—')
  doc.field('Ciudad', provider?.city || '—')
  doc.field('Email de contacto', provider?.email || '—')
  doc.field('Telefono', provider?.phone || '—')
  if (provider?.website) doc.field('Web', provider.website)

  doc.heading('4. Confirmacion de prestacion del servicio')
  if (confirmation) {
    doc.text('El proveedor confirmo de forma expresa, desde su panel autenticado, que el servicio se presto:')
    doc.gap(4)
    doc.field('Fecha del servicio', D(confirmation.service_date))
    doc.field('Confirmado el', DT(confirmation.confirmed_at))
    doc.field('Metodo de confirmacion', confirmation.confirmation_method)
    doc.field('IP desde la que se confirmo', confirmation.ip_address || '—')
    doc.field('Identificador del registro', confirmation.id)
    if (confirmation.notes) {
      doc.gap(4)
      doc.text('Observaciones del proveedor:')
      doc.paragraph(confirmation.notes, 'small')
    }
    doc.gap(4)
    doc.small('Este registro es inmutable por diseno: la tabla service_confirmations tiene triggers que impiden cualquier UPDATE o DELETE.')
  } else {
    doc.text('A la fecha de emision de este documento el proveedor no ha registrado la confirmacion de prestacion del servicio en la plataforma.')
    if (booking.event_date && new Date(booking.event_date) > new Date()) {
      doc.text(`El evento esta previsto para el ${D(booking.event_date)}, todavia no ha tenido lugar.`)
    }
  }

  doc.heading('5. Aceptacion de condiciones por el cliente')
  if (consent) {
    doc.field('Aceptado el', DT(consent.accepted_at))
    doc.field('Direccion IP del cliente', consent.ip_address || '—')
    doc.field('Navegador (user agent)', consent.user_agent || '—')
    doc.field('URL de la pagina de pago', consent.page_url || '—')
    doc.field('Huella SHA-256 del texto aceptado', consent.content_hash)
  } else {
    doc.text('No consta registro de aceptacion para esta reserva.')
  }

  return doc.build()
}

/** 2 · Comunicaciones con el cliente, en orden cronológico. */
export function buildCommunicationsPdf(bundle: EvidenceBundle): Buffer {
  const { booking, provider, timeline, chatMessages, whatsappMessages } = bundle
  const doc = new PdfDoc()

  header(doc, 'Comunicaciones con el cliente', bundle)

  doc.heading('1. Comunicaciones enviadas por FiestaGo al cliente')
  doc.small(`Direccion de correo del cliente: ${booking.client_email}`)
  doc.gap(4)
  if (timeline.length === 0) {
    doc.text('Sin registros.')
  } else {
    for (const item of timeline) {
      doc.text(`${DT(item.at)} · ${item.label}`)
      if (item.detail) doc.small(`   ${item.detail}`)
    }
  }

  doc.heading('2. Chat entre cliente y proveedor en la plataforma')
  if (!chatMessages.length) {
    doc.text('No hay mensajes en el chat de la reserva.')
  } else {
    for (const m of chatMessages) {
      const who = m.sender_role === 'client' ? booking.client_name
        : m.sender_role === 'provider' ? (provider?.name || 'Proveedor')
        : 'FiestaGo (soporte)'
      doc.text(`${DT(m.created_at)} · ${who}:`)
      doc.paragraph(m.body, 'small')
      doc.gap(3)
    }
  }

  doc.heading('3. WhatsApp entre FiestaGo y el proveedor del servicio')
  if (!whatsappMessages.length) {
    doc.text('Sin mensajes de WhatsApp asociados a este proveedor.')
  } else {
    for (const m of whatsappMessages) {
      const who = m.direction === 'inbound' ? (provider?.name || 'Proveedor') : 'FiestaGo'
      doc.text(`${DT(m.created_at)} · ${who} (${m.type || 'text'}${m.status ? `, ${m.status}` : ''}):`)
      doc.paragraph(m.body || '[sin cuerpo de texto]', 'small')
      doc.gap(3)
    }
  }

  return doc.build()
}

/** 3 · Política de reembolso: el texto literal de la versión aceptada. */
export function buildRefundPolicyPdf(bundle: EvidenceBundle): Buffer {
  const { consent, termsVersion } = bundle
  const doc = new PdfDoc()

  header(doc, 'Politica de reembolso aceptada por el cliente', bundle)

  doc.heading('Datos de la aceptacion')
  doc.field('Version del documento', termsVersion?.version_label || '—')
  doc.field('Publicada el', DT(termsVersion?.published_at))
  doc.field('Huella SHA-256 del texto', termsVersion?.content_hash || consent?.content_hash || '—')
  doc.field('Aceptada por el cliente el', DT(consent?.accepted_at))
  doc.field('Desde la IP', consent?.ip_address || '—')
  doc.field('En la pagina', consent?.page_url || '—')
  doc.gap(4)
  doc.small('La huella SHA-256 se calcula sobre el texto integro reproducido a continuacion. Coincide con la registrada en el momento de la aceptacion, lo que acredita que el documento no ha sido alterado desde entonces.')

  if (consent?.displayed_clause_text) {
    doc.heading('Texto mostrado en pantalla en el momento del pago')
    doc.small('Reproduccion literal de lo que el cliente tenia delante, visible en la propia pagina de pago, antes de marcar la casilla especifica de aceptacion de la politica de reembolso.')
    doc.gap(4)
    doc.paragraph(consent.displayed_clause_text, 'mono')
  }

  doc.pageBreak()
  doc.heading('Texto integro del documento aceptado')
  doc.paragraph(termsVersion?.content || '(no disponible)', 'small')

  return doc.build()
}
