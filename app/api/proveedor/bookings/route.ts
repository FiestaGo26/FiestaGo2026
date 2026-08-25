import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requireProviderAuth } from '@/lib/auth'
import { emailClientBookingConfirmed, emailClientBookingCancelled } from '@/lib/resend'
import { calcRefund } from '@/lib/constants'
import { exportBookingToGoogle, removeBookingFromGoogle } from '@/lib/google-sync'
import { generateCommissionInvoice, generateDelegatedInvoice } from '@/lib/invoicing/generator'

// Antes de aceptar la reserva, el proveedor solo ve datos generales.
// Esto evita que el proveedor contacte al cliente fuera de la plataforma
// y se salte la comisión. Una vez confirmada, ve todos los datos.
function maskForProvider(b: any) {
  if (b.status === 'confirmed' || b.status === 'completed') return b
  // Limpiamos también el mensaje de posibles emails/teléfonos colados:
  const safeMsg = b.message
    ? b.message
        .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email oculto]')
        .replace(/\b(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?)?\d{3}[\s.-]?\d{3,4}\b/g, '[teléfono oculto]')
    : null
  return {
    ...b,
    client_name:  '🔒 Cliente (acepta para ver)',
    client_email: null,
    client_phone: null,
    message:      safeMsg,
    _masked:      true,
  }
}

export async function GET(req: NextRequest) {
  const id = new URL(req.url).searchParams.get('id')
  const auth = await requireProviderAuth(req, id)
  if (!auth.ok) return auth.response
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .eq('provider_id', id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const bookings = (data || []).map(maskForProvider)
  return NextResponse.json({ bookings })
}

export async function PATCH(req: NextRequest) {
  const { id, status, providerId } = await req.json()
  if (!id || !status) return NextResponse.json({ error: 'Datos requeridos' }, { status: 400 })
  const auth = await requireProviderAuth(req, providerId)
  if (!auth.ok) return auth.response
  const supabase = createAdminClient()

  const updates: any = { status }
  if (status === 'confirmed') updates.confirmed_at = new Date().toISOString()
  if (status === 'cancelled') updates.cancelled_at = new Date().toISOString()

  // Lookup previa para conocer la fecha y calcular refund si toca cancelar.
  // No hay FK bookings → provider_services, así que no podemos traer la
  // política de cancelación por join. Aplicamos la default 'moderate'.
  const { data: prev } = await supabase
    .from('bookings')
    .select('event_date, total_amount')
    .eq('id', id).single()

  let refund: { percent: number; amount: number; rule: string } | null = null
  if (status === 'cancelled' && prev) {
    refund = calcRefund({
      policy: 'moderate',
      eventDate: prev.event_date,
      totalAmount: prev.total_amount || 0,
    })
    updates.refund_percent = refund.percent
    updates.refund_amount  = refund.amount
  }

  const { data, error } = await supabase
    .from('bookings')
    .update(updates)
    .eq('id', id)
    .eq('provider_id', providerId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Si cancela, liberar el bloqueo automático en service_availability
  if (status === 'cancelled' && prev?.event_date) {
    try {
      await supabase.from('service_availability')
        .delete()
        .eq('blocked_date', prev.event_date)
        .like('reason', 'Reservado por%')
    } catch { /* no-op */ }
  }

  // Email al cliente avisando del cambio. No bloquea la respuesta.
  if (status === 'confirmed' || status === 'cancelled') {
    try {
      const { data: prov } = await supabase
        .from('providers').select('id, name, email, phone')
        .eq('id', providerId).single()
      if (prov) {
        if (status === 'confirmed') {
          emailClientBookingConfirmed(data, prov).catch(err =>
            console.error('emailClientBookingConfirmed:', err?.message))
        } else {
          emailClientBookingCancelled(data, prov, 'provider', undefined, refund).catch(err =>
            console.error('emailClientBookingCancelled:', err?.message))
          // Notificar al admin del importe a procesar
          if (refund && refund.amount > 0) {
            await supabase.from('notifications').insert({
              type: 'refund_pending',
              title: `💸 Reembolso pendiente · ${refund.amount.toLocaleString()}€`,
              message: `Reserva cancelada por proveedor · ${refund.percent}% · ${refund.rule}`,
              data: { booking_id: id, amount: refund.amount, percent: refund.percent },
              action_url: `/admin?booking=${id}`,
            }).then(() => {})
          }
        }
      }
    } catch { /* no-op */ }
  }

  // Google Calendar sync: si está conectado, exportar al confirmar y
  // borrar el evento al cancelar. Best-effort, no bloquea la respuesta.
  if (status === 'confirmed') {
    exportBookingToGoogle(id).catch(err => console.error('gcal export:', err?.message))
  } else if (status === 'cancelled') {
    removeBookingFromGoogle(id).catch(err => console.error('gcal remove:', err?.message))
  }

  // Facturación automática al confirmar. Best-effort — si falla la
  // emisión de alguna factura, la reserva SIGUE confirmada y se puede
  // reintentar desde el panel admin. Lo que NUNCA hacemos es crear una
  // reserva confirmada sin dejar rastro del intento.
  if (status === 'confirmed') {
    autoIssueInvoicesForBooking(supabase, id).catch(err =>
      console.error('invoicing:', err?.message))
  }

  return NextResponse.json({ booking: data })
}

/**
 * Emite las facturas correspondientes a una reserva confirmada:
 *   1. Factura FiestaGo → Cliente por la comisión (siempre)
 *   2. Factura Proveedor → Cliente por el servicio, delegada
 *      (solo si el proveedor tiene consent_delegated_invoicing=true
 *      y datos fiscales completos)
 *
 * Con pagos divididos:
 *   · Si second_payment_status = 'not_needed' → una sola factura
 *     delegada por el total.
 *   · Si second_payment_status = 'pending' → factura delegada por
 *     first_payment_amount ahora, la del resto se emite cuando llegue
 *     el segundo pago (endpoint aparte, no cubierto en este hook).
 */
async function autoIssueInvoicesForBooking(supabase: any, bookingId: string) {
  const { data: booking } = await supabase
    .from('bookings')
    .select('*, providers(*)')
    .eq('id', bookingId).maybeSingle()
  if (!booking) return

  // Factura A · comisión FiestaGo → Cliente (siempre, si hay comisión)
  const commissionResult = await generateCommissionInvoice(supabase, booking)
  if (commissionResult.error) {
    console.error('commission invoice failed:', commissionResult.error)
    await supabase.from('notifications').insert({
      type:    'invoice_error',
      title:   '⚠️ Error emitiendo factura comisión',
      message: `Reserva ${bookingId}: ${commissionResult.error}`,
      data:    { booking_id: bookingId, error: commissionResult.error },
      action_url: `/admin?booking=${bookingId}`,
    })
  }

  // Factura B · delegada Proveedor → Cliente (solo si consent + datos)
  const provider = booking.providers
  if (!provider?.consent_delegated_invoicing) return

  // Cuánto facturar en este momento: si hay split, el anticipo;
  // si no, el total del provider_earns.
  const providerEarns = Number(booking.provider_earns || 0)
  const firstAmount = Number(booking.first_payment_amount || providerEarns)
  const hasSplit    = booking.second_payment_status === 'pending' && Number(booking.second_payment_amount || 0) > 0
  // Nota: first_payment_amount incluye la comisión. La parte que va al
  // proveedor por este primer pago es proporcional a su cuota total.
  const amountForProvider = hasSplit
    ? Math.round((providerEarns * (firstAmount / Number(booking.total_amount))) * 100) / 100
    : providerEarns
  const concept = hasSplit
    ? `Anticipo por servicios para evento del ${booking.event_date} (${booking.event_type || 'evento'})`
    : `Servicios para evento del ${booking.event_date} (${booking.event_type || 'evento'})`

  const delegatedResult = await generateDelegatedInvoice(supabase, booking, provider, {
    amount: amountForProvider,
    concept,
  })
  if (delegatedResult.error) {
    console.error('delegated invoice failed:', delegatedResult.error)
    // No bloqueamos — el proveedor puede facturar por su cuenta si esto falla
    await supabase.from('notifications').insert({
      type:    'invoice_error',
      title:   '⚠️ Error emitiendo factura delegada',
      message: `Reserva ${bookingId} · proveedor ${provider.name}: ${delegatedResult.error}`,
      data:    { booking_id: bookingId, provider_id: provider.id, error: delegatedResult.error },
      action_url: `/admin?booking=${bookingId}`,
    })
  }
}
