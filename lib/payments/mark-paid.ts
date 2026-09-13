/**
 * Marca un tramo de pago como cobrado.
 *
 * Fuente única para los dos caminos que llevan aquí:
 *   · webhook de Stripe (payment_intent.succeeded) — el real
 *   · endpoints /api/mock/pay-first|pay-second — solo en modo test
 *
 * Idempotente: si el tramo ya está pagado no vuelve a facturar ni a
 * notificar. Stripe reintenta los webhooks, así que esto importa.
 */

import { generateDelegatedInvoice } from '@/lib/invoicing/generator'
import { emailClientInvoicesReady } from '@/lib/resend'

type Supa = any

export type MarkPaidResult = {
  ok: boolean
  alreadyPaid?: boolean
  amount?: number
  error?: string
}

export async function markFirstPaymentPaid(
  supabase: Supa,
  booking: any,
  opts: { paymentIntentId?: string | null; source: 'stripe' | 'mock' } = { source: 'stripe' },
): Promise<MarkPaidResult> {
  if (booking.first_payment_status === 'paid') {
    return { ok: true, alreadyPaid: true, amount: Number(booking.first_payment_amount || 0) }
  }

  const now = new Date().toISOString()
  const { error } = await supabase.from('bookings').update({
    first_payment_status:  'paid',
    first_payment_paid_at: now,
    ...(opts.paymentIntentId ? {
      first_payment_intent_id: opts.paymentIntentId,
      stripe_payment_intent:   opts.paymentIntentId,
      paid_at:                 now,
    } : {}),
  }).eq('id', booking.id)

  if (error) return { ok: false, error: error.message }

  await notify(supabase, {
    type:    opts.source === 'mock' ? 'mock_first_payment' : 'first_payment_received',
    title:   `✓ Primer pago recibido · ${booking.client_name}`,
    message: `${booking.client_name} completó el primer pago (${booking.first_payment_amount}€) — evento ${booking.event_date}`,
    data:    { booking_id: booking.id, amount: booking.first_payment_amount, test_mode: opts.source === 'mock' },
    action_url: `/admin?booking=${booking.id}`,
  })

  return { ok: true, amount: Number(booking.first_payment_amount || 0) }
}

export async function markSecondPaymentPaid(
  supabase: Supa,
  booking: any,
  opts: { paymentIntentId?: string | null; source: 'stripe' | 'mock' } = { source: 'stripe' },
): Promise<MarkPaidResult> {
  const secondAmount = Number(booking.second_payment_amount || 0)

  if (['paid', 'cancelled', 'not_needed'].includes(booking.second_payment_status)) {
    return {
      ok: booking.second_payment_status === 'paid',
      alreadyPaid: booking.second_payment_status === 'paid',
      amount: secondAmount,
      error: booking.second_payment_status === 'paid' ? undefined : `El segundo pago está ${booking.second_payment_status}`,
    }
  }

  const now = new Date().toISOString()
  const { error } = await supabase.from('bookings').update({
    second_payment_status:  'paid',
    second_payment_paid_at: now,
    ...(opts.paymentIntentId ? { second_payment_intent_id: opts.paymentIntentId } : {}),
  }).eq('id', booking.id)

  if (error) return { ok: false, error: error.message }

  // Factura delegada del segundo tramo si el proveedor tiene el
  // consentimiento activo. Opción A: el segundo pago es íntegramente del
  // proveedor — la Garantía ya se cobró completa con el anticipo.
  const provider = booking.providers
  if (provider?.consent_delegated_invoicing && secondAmount > 0) {
    const result = await generateDelegatedInvoice(supabase, booking, provider, {
      amount:  secondAmount,
      concept: `Resto por servicios para evento del ${booking.event_date} (${booking.event_type || 'evento'})`,
    })
    if (result.error) {
      console.error('delegated invoice (second payment) failed:', result.error)
    } else if (result.invoiceId) {
      try {
        const { data: inv } = await supabase
          .from('invoices')
          .select('id, full_number, total_amount, invoice_type')
          .eq('id', result.invoiceId).maybeSingle()
        if (inv) await emailClientInvoicesReady(booking, provider, [inv as any])
      } catch (e) { console.error('[second payment invoice email] failed', e) }
    }
  }

  await notify(supabase, {
    type:    opts.source === 'mock' ? 'mock_second_payment' : 'second_payment_received',
    title:   `✓ Segundo pago recibido · ${booking.client_name}`,
    message: `${booking.client_name} completó el segundo pago (${secondAmount}€) — evento ${booking.event_date}`,
    data:    { booking_id: booking.id, amount: secondAmount, test_mode: opts.source === 'mock' },
    action_url: `/admin?booking=${booking.id}`,
  })

  return { ok: true, amount: secondAmount }
}

async function notify(supabase: Supa, row: Record<string, any>) {
  try { await supabase.from('notifications').insert(row) }
  catch { /* la notificación nunca bloquea un cobro */ }
}
