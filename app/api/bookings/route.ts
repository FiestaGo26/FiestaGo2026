import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { calcCommission } from '@/lib/constants'
import { emailAdminNewBooking, emailProviderNewBooking, emailClientBookingReceived } from '@/lib/resend'
import { requireClientAuth } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/bookings — create new booking
export async function POST(req: NextRequest) {
  try {
    const supabase = createAdminClient()
    const body = await req.json().catch(() => ({}))

    const {
      booking_type, provider_id, pack_id, service_id,
      client_name, client_email, client_phone,
      event_date, event_type, city, guests, message,
      total_amount, selected_addons, coupon_code,
    } = body || {}

    if (!client_name || !client_email || !event_date) {
      return NextResponse.json({ error: 'Faltan campos obligatorios (nombre, email, fecha)' }, { status: 400 })
    }

    // Si nos pasan service_id, comprobamos que la fecha no esté bloqueada
    if (service_id) {
      const { data: blocked } = await supabase
        .from('service_availability')
        .select('id')
        .eq('service_id', service_id)
        .eq('blocked_date', event_date)
        .maybeSingle()
      if (blocked) {
        return NextResponse.json({ error: 'La fecha seleccionada ya no está disponible para este servicio. Elige otra.' }, { status: 409 })
      }
    }

    // total_amount puede ser 0 cuando es "precio a consultar" — lo permitimos
    let amount = Number(total_amount) || 0

    // Aplicar cupón si viene y es válido (re-valida en el servidor, no fiamos
    // del cliente). Si es válido, descuenta el importe y reserva una "plaza"
    // del cupón incrementando used_count atómicamente.
    let appliedCoupon: { code: string; percent: number; amount: number } | null = null
    if (coupon_code && provider_id && amount > 0) {
      const normalized = String(coupon_code).toUpperCase().trim()
      const { data: c } = await supabase
        .from('coupons')
        .select('id, code, percent_off, max_uses, used_count, expires_at, active')
        .eq('provider_id', provider_id).eq('code', normalized).maybeSingle()

      const stillValid =
        c && c.active &&
        (!c.expires_at || new Date(c.expires_at) > new Date()) &&
        (c.max_uses == null || c.used_count < c.max_uses)

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

    const { data, error } = await supabase
      .from('bookings')
      .insert({
        booking_type: booking_type || 'provider',
        provider_id:  provider_id || null,
        pack_id:      pack_id || null,
        client_name, client_email,
        client_phone: client_phone || null,
        event_date, event_type: event_type || 'otro',
        city: city || null,
        guests: guests || null,
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
        status: 'pending',
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

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
    }

    return NextResponse.json({ booking: data, commission }, { status: 201 })
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
