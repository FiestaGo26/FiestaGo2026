import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/providers/reviews?provider_id=...&limit=20
// Devuelve las reseñas reales del proveedor (de la tabla bookings). Nunca
// expone email/teléfono del cliente — solo nombre de pila.
export async function GET(req: NextRequest) {
  const supabase = createAdminClient()
  const { searchParams } = new URL(req.url)
  const providerId = searchParams.get('provider_id')
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 60)

  if (!providerId) {
    return NextResponse.json({ error: 'provider_id requerido' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('bookings')
    .select('id, client_name, event_type, review_rating, review_text, reviewed_at')
    .eq('provider_id', providerId)
    .not('review_rating', 'is', null)
    .order('reviewed_at', { ascending: false })
    .limit(limit)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const reviews = (data || []).map((r: any) => {
    const first = (r.client_name || '').split(/\s+/)[0] || 'Cliente'
    return {
      id: r.id,
      author: first,
      rating: r.review_rating,
      text: r.review_text || '',
      event_type: r.event_type || null,
      date: r.reviewed_at,
    }
  })

  const total = reviews.length
  const avg = total > 0
    ? reviews.reduce((s: number, r: any) => s + (r.rating || 0), 0) / total
    : 0

  const distribution = [5, 4, 3, 2, 1].map(stars => ({
    stars,
    count: reviews.filter((r: any) => r.rating === stars).length,
  }))

  return NextResponse.json({
    reviews,
    total,
    average: Number(avg.toFixed(2)),
    distribution,
  })
}
