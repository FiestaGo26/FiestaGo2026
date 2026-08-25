import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requireProviderAuth } from '@/lib/auth'
import { generateCommissionInvoice, generateDelegatedInvoice } from '@/lib/invoicing/generator'

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

/**
 * POST /api/proveedor/invoices/regenerate
 *
 * Reintenta la emisión de facturas Verifactu (comisión + delegada) para
 * TODAS las reservas confirmadas/completadas de un proveedor a las que
 * les falte alguna. Idempotente: si una factura ya existe (por
 * booking_id + invoice_type) NO se duplica.
 *
 * Casos típicos donde esto se usa:
 *   · El proveedor confirmó una reserva antes de rellenar sus datos
 *     fiscales → solo se emitió la factura de comisión, falta la delegada
 *   · Algún fallo transitorio del proveedor de PDFs → una factura no
 *     terminó de generarse
 *
 * body: { providerId }
 * response: { ok, generated: { commission: N, delegated: N }, skipped, errors: [...] }
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const providerId: string = body.providerId
  const auth = await requireProviderAuth(req, providerId)
  if (!auth.ok) return auth.response

  const supabase = createAdminClient()

  // Traemos el proveedor completo (incluye tax_* y consent_delegated_invoicing).
  const { data: provider } = await supabase
    .from('providers').select('*').eq('id', providerId).single()
  if (!provider) return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 })

  // Reservas candidatas: confirmadas o completadas, con importe > 0.
  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('*')
    .eq('provider_id', providerId)
    .in('status', ['confirmed', 'completed'])
    .gt('total_amount', 0)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Facturas ya emitidas para estas reservas → set por (booking_id, type)
  const bookingIds = (bookings || []).map((b: any) => b.id)
  let existing: Set<string> = new Set()
  if (bookingIds.length > 0) {
    const { data: inv } = await supabase
      .from('invoices')
      .select('booking_id, invoice_type')
      .in('booking_id', bookingIds)
    existing = new Set((inv || []).map((i: any) => `${i.booking_id}:${i.invoice_type}`))
  }

  const generated = { commission: 0, delegated: 0 }
  const skipped: Array<{ booking_id: string; reason: string }> = []
  const errors:  Array<{ booking_id: string; type: string; error: string }> = []

  for (const booking of bookings || []) {
    // Attach providers para que el generator pueda leer datos fiscales
    const bWithProv = { ...booking, providers: provider }

    // FACTURA A · comisión FiestaGo → cliente
    if (!existing.has(`${booking.id}:commission_fiestago`)) {
      const r = await generateCommissionInvoice(supabase, bWithProv)
      if (r.error) errors.push({ booking_id: booking.id, type: 'commission', error: r.error })
      else generated.commission++
    }

    // FACTURA B · delegada Proveedor → cliente
    if (!existing.has(`${booking.id}:delegated`)) {
      // Prerrequisitos: consent activo + datos fiscales mínimos completos
      if (!provider.consent_delegated_invoicing) {
        skipped.push({ booking_id: booking.id, reason: 'consent-delegated-off' })
      } else if (!provider.tax_id || !provider.tax_name || !provider.tax_address) {
        skipped.push({ booking_id: booking.id, reason: 'fiscal-data-incomplete' })
      } else {
        const providerEarns = Number(booking.provider_earns || 0)
        const firstAmount = Number(booking.first_payment_amount || providerEarns)
        const hasSplit = booking.second_payment_status === 'pending' &&
                         Number(booking.second_payment_amount || 0) > 0
        const amountForProvider = hasSplit && booking.total_amount
          ? Math.round((providerEarns * (firstAmount / Number(booking.total_amount))) * 100) / 100
          : providerEarns
        const concept = hasSplit
          ? `Anticipo por servicios para evento del ${booking.event_date} (${booking.event_type || 'evento'})`
          : `Servicios para evento del ${booking.event_date} (${booking.event_type || 'evento'})`

        const r = await generateDelegatedInvoice(supabase, bWithProv, provider, {
          amount: amountForProvider,
          concept,
        })
        if (r.error) errors.push({ booking_id: booking.id, type: 'delegated', error: r.error })
        else generated.delegated++
      }
    }
  }

  return NextResponse.json({
    ok: true,
    scanned: bookings?.length || 0,
    generated,
    skipped,
    errors,
  })
}
