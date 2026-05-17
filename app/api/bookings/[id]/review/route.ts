import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/bookings/[id]/review
// body: { client_email, rating (1-5), text? }
// El cliente solo puede reseñar reservas suyas (mismo email), confirmadas
// o completadas, cuya fecha ya haya pasado, y solo una vez.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createAdminClient()
  const bookingId = params.id
  const { client_email, rating, text } = await req.json().catch(() => ({}))

  const ratingNum = Number(rating)
  if (!client_email || !Number.isFinite(ratingNum) || ratingNum < 1 || ratingNum > 5) {
    return NextResponse.json({ error: 'Email y rating (1-5) requeridos' }, { status: 400 })
  }

  const { data: booking, error: getErr } = await supabase
    .from('bookings')
    .select('id, client_email, provider_id, status, event_date, review_rating')
    .eq('id', bookingId)
    .maybeSingle()

  if (getErr) return NextResponse.json({ error: getErr.message }, { status: 500 })
  if (!booking) return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 })

  if ((booking.client_email || '').toLowerCase() !== String(client_email).toLowerCase()) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }
  if (booking.review_rating != null) {
    return NextResponse.json({ error: 'Ya has dejado una reseña para esta reserva' }, { status: 409 })
  }
  if (!['confirmed', 'completed'].includes(booking.status)) {
    return NextResponse.json({ error: 'Solo puedes reseñar reservas confirmadas' }, { status: 400 })
  }
  const eventDate = booking.event_date ? new Date(booking.event_date) : null
  const today = new Date(); today.setHours(0, 0, 0, 0)
  if (!eventDate || eventDate > today) {
    return NextResponse.json({ error: 'Aún no puedes reseñar: el evento todavía no ha pasado' }, { status: 400 })
  }

  const cleanText = typeof text === 'string'
    ? text.trim().slice(0, 1000) || null
    : null

  const { data: updated, error: updErr } = await supabase
    .from('bookings')
    .update({
      review_rating: ratingNum,
      review_text:   cleanText,
      reviewed_at:   new Date().toISOString(),
    })
    .eq('id', bookingId)
    .select('id, review_rating, review_text, reviewed_at')
    .single()

  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

  // Recalcular nota agregada del proveedor
  if (booking.provider_id) {
    const { data: stats } = await supabase
      .from('bookings')
      .select('review_rating')
      .eq('provider_id', booking.provider_id)
      .not('review_rating', 'is', null)

    const ratings = (stats || []).map((s: any) => Number(s.review_rating)).filter(Number.isFinite)
    const total = ratings.length
    const avg = total > 0 ? ratings.reduce((a: number, b: number) => a + b, 0) / total : 0

    await supabase
      .from('providers')
      .update({ rating: Number(avg.toFixed(2)), total_reviews: total })
      .eq('id', booking.provider_id)
      .then(() => {})
  }

  return NextResponse.json({ booking: updated })
}
