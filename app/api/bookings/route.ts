import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { calcCommission } from '@/lib/constants'
import { emailAdminNewBooking, emailAdminPackInquiry, emailProviderNewBooking, emailClientBookingReceived } from '@/lib/resend'
import { requireClientAuth } from '@/lib/auth'
import { computePaymentSchedule } from '@/lib/booking-payments'
import { sanitizeAcquisition } from '@/lib/attribution'
import { releaseHolds } from '@/lib/date-holds'
import { priceFor, cleanDeposit } from '@/lib/pricing'
import { loadProposal } from '@/lib/proposals'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/bookings — create new booking
export async function POST(req: NextRequest) {
  try {
    const supabase = createAdminClient()
    const body = await req.json().catch(() => ({}))

    let {
      booking_type, provider_id, pack_id, service_id,
      client_name, client_email, client_phone,
      event_date, event_type, city, guests, hours, message,
      total_amount, selected_addons, coupon_code,
      planner_name, planner_email,   // opcional: wedding/event planner que gestiona en nombre del cliente
    } = body || {}

    // Reserva desde una propuesta escrita (/propuesta/<token>): manda lo que
    // dice la propuesta (precio cerrado, señal, fecha, cliente), no el navegador.
    const proposal = body?.proposal_token ? await loadProposal(supabase, String(body.proposal_token)) : null
    if (body?.proposal_token) {
      if (!proposal) return NextResponse.json({ error: 'Propuesta no encontrada' }, { status: 404 })
      if (proposal.status === 'converted') return NextResponse.json({ error: 'Esta propuesta ya está reservada' }, { status: 409 })
      if (!proposal.event_date) return NextResponse.json({ error: 'La propuesta no tiene fecha. Escríbenos y la cerramos contigo.' }, { status: 400 })
      booking_type = 'provider'
      provider_id  = proposal.provider.id
      service_id   = proposal.service?.id || null
      client_name  = proposal.client_name
      client_email = proposal.client_email
      event_date   = proposal.event_date
      event_type   = proposal.event_type || event_type
      guests       = proposal.guests
      city         = proposal.provider.city
      // Extras que el cliente marca en la propuesta (con el precio del proveedor;
      // el servidor suma, no se fía del navegador)
      const wanted = new Set((Array.isArray(body?.proposal_extras) ? body.proposal_extras : []).map(String))
      selected_addons = proposal.extras.filter(e => wanted.has(e.id)).map(e => ({ id: e.id, label: e.label, price: e.provider_price }))
      coupon_code  = null
      message      = [`Reserva desde la propuesta escrita: ${proposal.includes}`, message].filter(Boolean).join('\n\n')
    }

    if (!client_name || !client_email || !event_date) {
      return NextResponse.json({ error: 'Faltan campos obligatorios (nombre, email, fecha)' }, { status: 400 })
    }

    // Si nos pasan service_id, comprobamos que la fecha no esté bloqueada
    if (service_id) {
      const { data: blocked } = await supabase
        .from('service_availability')
        .select('id, source')
        .eq('service_id', service_id)
        .eq('blocked_date', event_date)
        .maybeSingle()
      // Si la fecha la tiene bloqueada este mismo cliente (bloqueo de 48 h
      // gratis), la reserva la convierte: el bloqueo pasa a ser de la reserva.
      const ownHold = blocked?.source === 'hold'
        ? await releaseHolds(supabase, { service_id, event_date, client_email: String(client_email).trim(), status: 'converted' })
        : 0
      if (blocked && !ownHold) {
        return NextResponse.json({ error: 'La fecha seleccionada ya no está disponible para este servicio. Elige otra.' }, { status: 409 })
      }
      if (ownHold) {
        await supabase.from('service_availability').update({ source: 'manual', reason: `Reservado por ${client_name}` }).eq('id', blocked!.id)
      }
    }

    // total_amount puede ser 0 cuando es "precio a consultar" — lo permitimos
    let amount = Number(total_amount) || 0

    // Con servicio, el importe lo calcula el servidor (no nos fiamos del
    // navegador): precio según invitados + extras elegidos, desde la BD.
    let svcRow: any = null
    if (service_id) {
      const { data: s } = await supabase
        .from('provider_services')
        .select('provider_id, price, pricing_unit, included_guests, extra_guest_price, included_hours, extra_hour_price, addons, deposit_pct')
        .eq('id', service_id).maybeSingle()
      if (!s || (provider_id && s.provider_id !== provider_id)) {
        return NextResponse.json({ error: 'Servicio no válido' }, { status: 400 })
      }
      svcRow = s
      if (s.price != null) {
        const chosen = new Set((Array.isArray(selected_addons) ? selected_addons : []).map((a: any) => a?.id))
        const addonsTotal = (Array.isArray(s.addons) ? s.addons : [])
          .filter((a: any) => chosen.has(a.id))
          .reduce((sum: number, a: any) => sum + (Number(a.price) || 0), 0)
        amount = Math.round((priceFor(s, { guests: parseInt(guests), hours: Number(hours) }) + addonsTotal) * 100) / 100
      }
    }
    if (proposal) amount = Math.round((proposal.base + (selected_addons as any[]).reduce((n, a) => n + (Number(a.price) || 0), 0)) * 100) / 100

    // Aplicar cupón si viene y es válido (re-valida en el servidor, no fiamos
    // del cliente). Si es válido, descuenta el importe y reserva una "plaza"
    // del cupón incrementando used_count atómicamente.
    let appliedCoupon: { code: string; percent: number; amount: number } | null = null
    if (coupon_code && provider_id && amount > 0) {
      const normalized = String(coupon_code).toUpperCase().trim()
      const { data: c } = await supabase
        .from('coupons')
        .select('id, code, percent_off, max_uses, used_count, expires_at, active, service_id')
        .eq('provider_id', provider_id).eq('code', normalized).maybeSingle()

      const stillValid =
        c && c.active &&
        (!c.expires_at || new Date(c.expires_at) > new Date()) &&
        (c.max_uses == null || c.used_count < c.max_uses) &&
        // Scope por servicio: si el cupón está atado a uno concreto,
        // solo aplica cuando la reserva es de ese servicio.
        (!c.service_id || c.service_id === service_id)

      if (stillValid) {
        const off = Math.round((amount * c.percent_off / 100) * 100) / 100
        appliedCoupon = { code: c.code, percent: c.percent_off, amount: off }
        amount = Math.max(0, Math.round((amount - off) * 100) / 100)
        await supabase.from('coupons')
          .update({ used_count: c.used_count + 1 })
          .eq('id', c.id)
      }
    }

    // Calcular Garantía de Éxito (8%) sobre lo que cobra el proveedor.
    // Modelo: cliente paga base + 8%, proveedor recibe el 100% de base.
    // `amount` aquí ya tiene aplicado el cupón si lo había. Aplica
    // también a packs (mismo 8% encima del precio del pack).
    const commission = calcCommission(amount)

    // Anticipo del servicio, si aplica. Se lee del servicio elegido para
    // calcular el desglose de pagos (anticipo al reservar + resto 2 meses
    // antes del evento). Si no hay service_id, no hay anticipo y el
    // cliente paga 100% al reservar.
    // Señal siempre entre el 10 % y el 20 % (ver cleanDeposit).
    const depositPct = proposal ? proposal.deposit_pct : svcRow ? cleanDeposit(svcRow.deposit_pct) : 0
    // Opción A: pasamos base y Garantía por separado — la Garantía se cobra
    // ÍNTEGRA con el anticipo, no proporcional. Ver comentarios de
    // computePaymentSchedule para la lógica completa.
    const schedule = computePaymentSchedule(amount, commission.amount, depositPct, event_date)

    const { data, error } = await supabase
      .from('bookings')
      .insert({
        acquisition:  sanitizeAcquisition(body?.acquisition),
        booking_type: booking_type || 'provider',
        provider_id:  provider_id || null,
        pack_id:      pack_id || null,
        client_name, client_email,
        client_phone: client_phone || null,
        planner_name:  planner_name  ? String(planner_name).trim()  : null,
        planner_email: planner_email ? String(planner_email).trim().toLowerCase() : null,
        event_date, event_type: event_type || 'otro',
        city: city || null,
        guests: guests || null,
        hours:  Number(hours) > 0 ? Number(hours) : null,
        message: message || null,
        // total_amount = lo que pagó el cliente (base + comisión)
        total_amount: commission.clientPays,
        selected_addons: Array.isArray(selected_addons) ? selected_addons : [],
        coupon_code:    appliedCoupon?.code || null,
        coupon_percent: appliedCoupon?.percent || null,
        coupon_amount:  appliedCoupon?.amount || null,
        commission_rate:  commission.rate,
        commission_amt:   commission.amount,
        provider_earns:   commission.providerEarns,
        is_free_txn:      commission.isFree,
        // Desglose del pago (single-source-of-truth en lib/booking-payments.ts)
        first_payment_amount:   schedule.firstPaymentAmount,
        first_payment_status:   'pending',
        second_payment_amount:  schedule.secondPaymentAmount,
        second_payment_due_date: schedule.secondPaymentDueDate,
        second_payment_status:  schedule.secondPaymentStatus,
        status: 'pending',
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    if (proposal) {
      await supabase.from('date_holds').update({ status: 'converted' }).eq('id', proposal.hold_id)
    }

    // Update provider booking count (non-bloqueante)
    if (provider_id) {
      try { await supabase.rpc('increment_provider_bookings', { p_id: provider_id }) }
      catch { /* no-op */ }
    }

    // BLOQUEAR esa fecha automáticamente para el servicio (si lo hay)
    // Así otros clientes no podrán reservar el mismo servicio ese día.
    if (service_id && event_date) {
      try {
        await supabase
          .from('service_availability')
          .insert({
            service_id,
            blocked_date: event_date,
            reason:       `Reservado por ${client_name}`,
          })
      } catch { /* si ya estaba bloqueado, no pasa nada */ }
    }

    // Notificar via email (admin + proveedor + auto-respuesta al cliente).
    // No bloquea la respuesta si falla.
    if (provider_id) {
      try {
        const { data: prov } = await supabase
          .from('providers')
          .select('id, name, slug, email, city, category, auto_reply_message')
          .eq('id', provider_id)
          .single()
        if (prov) {
          emailAdminNewBooking(data, prov).catch(err =>
            console.error('emailAdminNewBooking:', err?.message))
          emailProviderNewBooking(data, prov).catch(err =>
            console.error('emailProviderNewBooking:', err?.message))
          emailClientBookingReceived(data, prov).catch(err =>
            console.error('emailClientBookingReceived:', err?.message))
        }
      } catch { /* no-op */ }
    } else if (pack_id) {
      // Solicitud de pack sin proveedor asignado: el admin recibe la
      // notificación para asignar manualmente proveedores.
      try {
        const { data: pack } = await supabase
          .from('packs')
          .select('id, name, slug, emoji, price_base, price_note')
          .eq('id', pack_id)
          .single()
        if (pack) {
          emailAdminPackInquiry(data, pack).catch(err =>
            console.error('emailAdminPackInquiry:', err?.message))
        }
      } catch { /* no-op */ }
    }

    return NextResponse.json({ booking: data, commission, schedule }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Error inesperado en la reserva' }, { status: 500 })
  }
}

// GET /api/bookings — get bookings for client (must be the client themselves)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const email = searchParams.get('email')

  const auth = await requireClientAuth(req, email)
  if (!auth.ok) return auth.response

  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('bookings')
    .select(`*, providers(name, category, city, photo_idx), packs(name, emoji, color)`)
    .eq('client_email', email)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ bookings: data })
}
