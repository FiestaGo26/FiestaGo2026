import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { calcCommission } from '@/lib/constants'

// POST /api/bookings — create new booking
export async function POST(req: NextRequest) {
  const supabase = createAdminClient()
  const body = await req.json()

  const {
    booking_type, provider_id, pack_id,
    client_name, client_email, client_phone,
    event_date, event_type, city, guests, message,
    total_amount,
  } = body

  if (!client_name || !client_email || !event_date || !total_amount) {
    return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 })
  }

  // Calculate commission
  let commission = { rate: 0, amount: 0, providerEarns: total_amount, isFree: true }
  if (provider_id) {
    const { data: provider } = await supabase
      .from('providers')
      .select('total_bookings')
      .eq('id', provider_id)
      .single()
    if (provider) {
      commission = calcCommission(total_amount, provider.total_bookings)
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
      total_amount,
      commission_rate:  commission.rate,
      commission_amt:   commission.amount,
      provider_earns:   commission.providerEarns,
      is_free_txn:      commission.isFree,
      status: 'pending',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Update provider booking count
  if (provider_id) {
    await supabase.rpc('increment_provider_bookings', { p_id: provider_id })
      .catch(() => {}) // non-critical
  }

  return NextResponse.json({ booking: data, commission }, { status: 201 })
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
