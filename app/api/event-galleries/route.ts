import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/event-galleries — listado público de galerías publicadas.
// Filtros opcionales: ?event_type=boda&city=Valencia&featured=true&limit=20
//
// GET /api/event-galleries?slug=... → ficha individual con datos de
// los proveedores que participaron.
export async function GET(req: NextRequest) {
  const supabase = createAdminClient()
  const { searchParams } = new URL(req.url)
  const slug      = searchParams.get('slug')
  const eventType = searchParams.get('event_type')
  const city      = searchParams.get('city')
  const featured  = searchParams.get('featured')
  const limit     = Math.min(parseInt(searchParams.get('limit') || '24'), 50)

  // Lookup individual por slug → incluye datos públicos de los providers
  if (slug) {
    const { data: gallery, error } = await supabase
      .from('event_galleries')
      .select('*')
      .eq('slug', slug)
      .eq('status', 'published')
      .maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!gallery) return NextResponse.json({ gallery: null }, { status: 404 })

    let providers: any[] = []
    if (gallery.provider_ids && gallery.provider_ids.length > 0) {
      const { data: provs } = await supabase
        .from('providers')
        .select('id, slug, name, category, city, price_base, rating, total_reviews, photo_url, photo_idx, verified')
        .in('id', gallery.provider_ids)
        .eq('status', 'approved')
      providers = provs || []
    }

    return NextResponse.json({ gallery, providers })
  }

  // Listado
  let query = supabase
    .from('event_galleries')
    .select('*')
    .eq('status', 'published')
    .order('featured', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit)

  if (eventType) query = query.eq('event_type', eventType)
  if (city)      query = query.ilike('city', `%${city}%`)
  if (featured)  query = query.eq('featured', true)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ galleries: data })
}
