// Cliente del Google Places API (New v1). Usado por el agente Searcher
// para encontrar proveedores reales en una zona/categoría.
//
// Setup:
// 1. Crear proyecto en https://console.cloud.google.com
// 2. Activar 'Places API (New)' en APIs & Services → Enable
// 3. Crear API key en Credentials → Restrict to Places API (New)
// 4. Añadir GOOGLE_PLACES_API_KEY en env de Netlify
//
// Coste: ~$32 por 1000 Text Search calls + $17 por 1000 Place Details.
// Google da $200/mes de crédito gratuito (≈6.000 búsquedas).

const PLACES_API = 'https://places.googleapis.com/v1/places:searchText'

const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.addressComponents',
  'places.nationalPhoneNumber',
  'places.internationalPhoneNumber',
  'places.websiteUri',
  'places.rating',
  'places.userRatingCount',
  'places.googleMapsUri',
  'places.location',
  'places.types',
  'places.businessStatus',
  'places.editorialSummary',
  'places.priceLevel',
].join(',')

export type PlaceResult = {
  id:                  string                            // 'ChIJ...'
  displayName:         { text: string; languageCode?: string }
  formattedAddress?:   string
  addressComponents?:  Array<{ longText: string; shortText: string; types: string[] }>
  nationalPhoneNumber?: string
  internationalPhoneNumber?: string
  websiteUri?:         string
  rating?:             number
  userRatingCount?:    number
  googleMapsUri?:      string
  location?:           { latitude: number; longitude: number }
  types?:              string[]
  businessStatus?:     'OPERATIONAL' | 'CLOSED_TEMPORARILY' | 'CLOSED_PERMANENTLY'
  editorialSummary?:   { text: string }
  priceLevel?:         'PRICE_LEVEL_FREE' | 'PRICE_LEVEL_INEXPENSIVE' | 'PRICE_LEVEL_MODERATE' | 'PRICE_LEVEL_EXPENSIVE' | 'PRICE_LEVEL_VERY_EXPENSIVE'
}

export type SearchOpts = {
  query:        string           // ej. 'catering eventos bodas en Valencia'
  city?:        string           // se concatena al query si no está dentro
  maxResults?:  number           // 1-20 (default 20, el max permitido por petición)
  languageCode?: string          // default 'es'
  regionCode?:  string           // default 'ES'
}

export async function searchPlaces(opts: SearchOpts): Promise<{ ok: boolean; places: PlaceResult[]; error?: string }> {
  const key = process.env.GOOGLE_PLACES_API_KEY
  if (!key) return { ok: false, places: [], error: 'GOOGLE_PLACES_API_KEY no configurada' }

  const textQuery = opts.city && !opts.query.toLowerCase().includes(opts.city.toLowerCase())
    ? `${opts.query} en ${opts.city}`
    : opts.query

  try {
    const res = await fetch(PLACES_API, {
      method: 'POST',
      headers: {
        'Content-Type':    'application/json',
        'X-Goog-Api-Key':  key,
        'X-Goog-FieldMask': FIELD_MASK,
      },
      body: JSON.stringify({
        textQuery,
        maxResultCount: Math.min(Math.max(opts.maxResults || 20, 1), 20),
        languageCode:   opts.languageCode || 'es',
        regionCode:     opts.regionCode   || 'ES',
      }),
    })

    const data = await res.json().catch(() => ({} as any))
    if (!res.ok) {
      return { ok: false, places: [], error: data?.error?.message || `HTTP ${res.status}` }
    }
    return { ok: true, places: (data.places || []) as PlaceResult[] }
  } catch (err: any) {
    return { ok: false, places: [], error: err.message || 'fetch error' }
  }
}

// Extrae la ciudad del address_components si está disponible, si no del
// formatted_address. Devuelve string ('Valencia') o null.
export function extractCity(place: PlaceResult): string | null {
  const components = place.addressComponents || []
  // locality > postal_town > administrative_area_level_2 > administrative_area_level_1
  const preferenceOrder = ['locality', 'postal_town', 'administrative_area_level_2', 'administrative_area_level_1']
  for (const prefType of preferenceOrder) {
    const found = components.find(c => c.types?.includes(prefType))
    if (found) return found.longText
  }
  return null
}
