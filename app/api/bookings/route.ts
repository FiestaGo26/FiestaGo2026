import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { calcCommission } from '@/lib/constants'
import { emailAdminNewBooking, emailProviderNewBooking } from '@/lib/resend'

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
      total_amount,
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
    const amount = Number(total_amount) || 0

    // Calculate commission
    let commission = { rate: 0, amount: 0, providerEarns: amount, isFree: true }
    if (provider_id) {
      const { data: provider } = await supabase
        .from('providers')
        .select('total_bookings')
        .eq('id', provider_id)
        .single()
      if (provider) {
        commission = calcCommission(amount, provider.total_bookings || 0)
      }
    }

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
        total_amount: amount,
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

    // Notificar via email (admin + proveedor). No bloquea la respuesta si falla.
    if (provider_id) {
      try {
        const { data: prov } = await supabase
          .from('providers')
          .select('id, name, slug, email, city, category')
          .eq('id', provider_id)
          .single()
        if (prov) {
          // Ejecuta en paralelo, sin esperar — errores silenciados
          emailAdminNewBooking(data, prov).catch(err =>
            console.error('emailAdminNewBooking:', err?.message))
          emailProviderNewBooking(data, prov).catch(err =>
            console.error('emailProviderNewBooking:', err?.message))
        }
      } catch { /* no-op */ }
    }

    return NextResponse.json({ booking: data, commission }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Error inesperado en la reserva' }, { status: 500 })
  }
}

// GET /api/bookings — get bookings for client
export async function GET(req: NextRequest) {
  const supabase = createAdminClient()
  const { searchParams } = new URL(req.url)
  const email = searchParams.get('email')

  if (!email) return NextResponse.json({ error: 'Email requerido' }, { status: 400 })

  const { data, error } = await supabase
    .from('bookings')
    .select(`*, providers(name, category, city, photo_idx), packs(name, emoji, color)`)
    .eq('client_email', email)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ bookings: data })
}
