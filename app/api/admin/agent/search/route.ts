import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { searchPlaces, extractCity } from '@/lib/google-places'
import { CATEGORIES } from '@/lib/constants'

// POST /api/admin/agent/search
//
// Búsqueda agéntica de proveedores vía Google Places. Crea leads en la tabla
// `providers` con status='pending', source='agent', tag='Lead Google Places'.
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

  // Mapeamos cada Place a una fila de provider. Idempotencia por google_place_id:
  // si ya existe esa fila (por google_place_id o por mismo nombre+ciudad), no la
  // duplicamos.
  const placeIds = search.places.map(p => p.id).filter(Boolean)
  let existingPlaceIds = new Set<string>()
  if (placeIds.length > 0) {
    const { data: existing } = await supabase
      .from('providers').select('google_place_id')
      .in('google_place_id', placeIds)
    existingPlaceIds = new Set((existing || []).map((r: any) => r.google_place_id))
  }

  const newRows: any[] = []
  const skipped: any[] = []

  for (const place of search.places) {
    if (existingPlaceIds.has(place.id)) {
      skipped.push({ place_id: place.id, name: place.displayName?.text, reason: 'ya existe' })
      continue
    }

    // Cerrado permanente → no nos interesa
    if (place.businessStatus === 'CLOSED_PERMANENTLY') {
      skipped.push({ place_id: place.id, name: place.displayName?.text, reason: 'cerrado permanente' })
      continue
    }

    const phone = place.internationalPhoneNumber || place.nationalPhoneNumber || null
    const website = place.websiteUri || null
    const placeCity = extractCity(place) || city
    const desc = place.editorialSummary?.text || null

    newRows.push({
      name:               place.displayName?.text || '(sin nombre)',
      category,
      city:               placeCity,
      address:            place.formattedAddress || null,
      description:        desc,
      phone,
      website,
      email:              null,                 // Google Places no expone email; el Enricher lo sacará
      price_unit:         'por evento',
      specialties:        [],
      source:             'agent',
      status:             'pending',
      tag:                'Lead Google Places',
      contactable:        !!(phone || website),
      google_place_id:    place.id,
      google_rating:      place.rating || null,
      google_rating_count: place.userRatingCount || null,
      google_maps_uri:    place.googleMapsUri || null,
      google_lat:         place.location?.latitude  || null,
      google_lng:         place.location?.longitude || null,
      agent_metadata: {
        searched_at:      new Date().toISOString(),
        searched_query:   query,
        place_types:      place.types || [],
        price_level:      place.priceLevel || null,
      },
    })
  }

  let inserted: any[] = []
  let insertError: any = null
  if (newRows.length > 0) {
    const { data, error } = await supabase
      .from('providers').insert(newRows).select('id, name, city, phone, website, google_rating')
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
