import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { searchPlaces, extractCity, extractPhone, extractWebsite, extractEmail } from '@/lib/here-places'
import { CATEGORIES } from '@/lib/constants'

// POST /api/admin/agent/search
//
// Búsqueda agéntica de proveedores vía HERE Maps Discover API. Crea leads
// en `providers` con status='pending', source='agent', tag='Lead búsqueda'.
// El admin después los aprueba/descarta desde /admin o desde la UI del agente.
//
// Body: { category: 'catering', city: 'Valencia', extraQuery?: '', maxResults?: 20 }
// Protegido por x-admin-token.

export async function POST(req: NextRequest) {
  const expected = process.env.ADMIN_TOKEN
  if (!expected) return NextResponse.json({ error: 'ADMIN_TOKEN no configurada' }, { status: 503 })
  if (req.headers.get('x-admin-token') !== expected) {
    return NextResponse.json({ error: 'token inválido' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({} as any))
  const { category, city, extraQuery, maxResults } = body
  if (!category || !city) {
    return NextResponse.json({ error: 'Faltan category y city' }, { status: 400 })
  }

  const cat = CATEGORIES.find((c: any) => c.id === category)
  if (!cat) return NextResponse.json({ error: `Categoría desconocida: ${category}` }, { status: 400 })

  const query = extraQuery ? `${cat.query} ${extraQuery}`.trim() : cat.query

  const search = await searchPlaces({ query, city, maxResults: maxResults || 20 })
  if (!search.ok) {
    return NextResponse.json({ error: search.error }, { status: 500 })
  }

  const supabase = createAdminClient()

  // Idempotencia: por external_place_id si lo tenemos, o por (name + city)
  // como fallback cuando el ID no es estable entre fuentes.
  const placeIds = search.places.map(p => p.id).filter(Boolean)
  let existingPlaceIds = new Set<string>()
  if (placeIds.length > 0) {
    const { data: existing } = await supabase
      .from('providers').select('external_place_id')
      .in('external_place_id', placeIds)
    existingPlaceIds = new Set((existing || []).map((r: any) => r.external_place_id))
  }

  const newRows: any[] = []
  const skipped: Array<{ name?: string; reason: string; place_id?: string }> = []

  for (const place of search.places) {
    if (existingPlaceIds.has(place.id)) {
      skipped.push({ place_id: place.id, name: place.title, reason: 'ya existe' })
      continue
    }

    const phone   = extractPhone(place)
    const website = extractWebsite(place)
    const email   = extractEmail(place)
    const placeCity = extractCity(place) || city

    newRows.push({
      name:               place.title || '(sin nombre)',
      category,
      city:               placeCity,
      address:            place.address?.label || null,
      description:        null,
      phone,
      website,
      email,
      price_unit:         'por evento',
      specialties:        [],
      source:             'agent',
      status:             'pending',
      tag:                'Lead búsqueda',
      contactable:        !!(phone || website || email),
      external_place_id:  place.id,
      external_source:    'here',
      external_lat:       place.position?.lat || null,
      external_lng:       place.position?.lng || null,
      agent_metadata: {
        searched_at:    new Date().toISOString(),
        searched_query: query,
        categories:     (place.categories || []).map(c => c.name),
        postal_code:    place.address?.postalCode || null,
        state:          place.address?.state || null,
      },
    })
  }

  let inserted: any[] = []
  let insertError: any = null
  if (newRows.length > 0) {
    const { data, error } = await supabase
      .from('providers').insert(newRows)
      .select('id, name, city, phone, website, email')
    if (error) {
      insertError = error.message
      console.error('[agent/search] INSERT failed:', JSON.stringify(error))
    } else {
      inserted = data || []
    }
  }

  return NextResponse.json({
    ok:           !insertError,
    searched:     search.places.length,
    inserted:     inserted.length,
    skipped:      skipped.length,
    skippedItems: skipped,
    insertedItems: inserted,
    error:        insertError,
    query,
    city,
  }, { status: insertError ? 500 : 200 })
}
