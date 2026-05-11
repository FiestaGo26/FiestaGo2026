import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/services?categoria=...&ciudad=...&q=...&only_priced=1
// Listado público de servicios activos con su proveedor embebido.
export async function GET(req: NextRequest) {
  const supabase = createAdminClient()
  const { searchParams } = new URL(req.url)
  const categoria   = searchParams.get('categoria') || ''
  const ciudad      = searchParams.get('ciudad') || ''
  const q           = (searchParams.get('q') || '').trim()
  const onlyPriced  = searchParams.get('only_priced') === '1'
  const limit       = Math.min(parseInt(searchParams.get('limit') || '60'), 120)

  let query = supabase
    .from('provider_services')
    .select(`
      id, name, description, price, price_unit, duration, max_guests,
      media_type, media_url, thumbnail_url, status, created_at,
      providers!inner(id, name, slug, city, category, rating, total_reviews, photo_url, photo_idx, status)
    `)
    .eq('status', 'active')
    .eq('providers.status', 'approved')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (onlyPriced) query = query.not('price', 'is', null)
  if (categoria)  query = query.eq('providers.category', categoria)
  if (ciudad)     query = query.eq('providers.city', ciudad)
  if (q)          query = query.or(`name.ilike.%${q}%,description.ilike.%${q}%`)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Aplanar la nested table
  const services = (data || []).map((s: any) => ({
    ...s,
    provider: s.providers,
  }))

  return NextResponse.json({ services })
}
