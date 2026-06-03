// Cliente del HERE Maps Discover API. Sustituye a Google Places por
// volumen gratuito muy superior (250K llamadas/mes sin tarjeta).
//
// Setup:
// 1. https://developer.here.com → Sign up (no tarjeta requerida)
// 2. En el Project default → Generate API Key
// 3. Copiar la key (formato alfanumérico de ~43 chars, p. ej. 'aB3...xY')
// 4. Añadir HERE_API_KEY en env de Netlify
//
// Docs: https://www.here.com/docs/bundle/discover-api-developer-guide

const DISCOVER_API = 'https://discover.search.hereapi.com/v1/discover'

// Coordenadas de centros de ciudad para sesgar el Discover. Si la ciudad no
// está mapeada, usamos el centroide de España como fallback (HERE deduce por
// el texto del query igualmente).
const CITY_COORDS: Record<string, [number, number]> = {
  'valencia':   [39.4699, -0.3763],
  'madrid':     [40.4168, -3.7038],
  'barcelona':  [41.3851,  2.1734],
  'sevilla':    [37.3891, -5.9845],
  'bilbao':     [43.2630, -2.9350],
  'malaga':     [36.7213, -4.4214],
  'málaga':     [36.7213, -4.4214],
  'alicante':   [38.3452, -0.4810],
  'zaragoza':   [41.6488, -0.8891],
  'palma':      [39.5696,  2.6502],
  'murcia':     [37.9922, -1.1307],
  'pamplona':   [42.8125, -1.6458],
  'vigo':       [42.2406, -8.7207],
  'gijon':      [43.5453, -5.6619],
  'gijón':      [43.5453, -5.6619],
  'granada':    [37.1773, -3.5986],
  'a coruña':   [43.3623, -8.4115],
  'la coruña':  [43.3623, -8.4115],
  'coruña':     [43.3623, -8.4115],
  'salamanca':  [40.9701, -5.6635],
  'cordoba':    [37.8882, -4.7794],
  'córdoba':    [37.8882, -4.7794],
  'sant cugat': [41.4708,  2.0846],
}
const SPAIN_CENTROID: [number, number] = [40.0, -3.7]

export type HerePlace = {
  id:        string                                  // ID interno de HERE
  title:     string                                  // Nombre del negocio
  address?:  {
    label?:        string
    countryCode?:  string
    countryName?:  string
    state?:        string
    city?:         string
    district?:     string
    street?:       string
    postalCode?:   string
    houseNumber?:  string
  }
  position?: { lat: number; lng: number }
  contacts?: Array<{
    phone?:  Array<{ value: string }>
    mobile?: Array<{ value: string }>
    fax?:    Array<{ value: string }>
    www?:    Array<{ value: string }>
    email?:  Array<{ value: string }>
  }>
  categories?: Array<{ id: string; name: string; primary?: boolean }>
  openingHours?: Array<{ text?: string[] }>
  distance?: number
}

export type HereSearchOpts = {
  query:        string
  city?:        string
  maxResults?:  number    // 1-100
}

export async function searchPlaces(opts: HereSearchOpts): Promise<{
  ok:     boolean
  places: HerePlace[]
  error?: string
}> {
  const key = process.env.HERE_API_KEY
  if (!key) return { ok: false, places: [], error: 'HERE_API_KEY no configurada' }

  const cityKey = (opts.city || '').toLowerCase().trim()
  const at = CITY_COORDS[cityKey] || SPAIN_CENTROID
  const q  = opts.city && !opts.query.toLowerCase().includes(opts.city.toLowerCase())
    ? `${opts.query} en ${opts.city}`
    : opts.query

  const params = new URLSearchParams({
    q,
    at:     `${at[0]},${at[1]}`,
    in:     'countryCode:ESP',
    limit:  String(Math.min(Math.max(opts.maxResults || 20, 1), 100)),
    lang:   'es-ES',
    apiKey: key,
  })

  try {
    const res = await fetch(`${DISCOVER_API}?${params.toString()}`)
    const data = await res.json().catch(() => ({} as any))
    if (!res.ok) {
      return { ok: false, places: [], error: data?.error_description || data?.title || `HTTP ${res.status}` }
    }
    return { ok: true, places: (data.items || []) as HerePlace[] }
  } catch (err: any) {
    return { ok: false, places: [], error: err.message || 'fetch error' }
  }
}

// Helpers de extracción
export function extractPhone(place: HerePlace): string | null {
  for (const c of place.contacts || []) {
    if (c.phone?.[0]?.value)  return c.phone[0].value
    if (c.mobile?.[0]?.value) return c.mobile[0].value
  }
  return null
}

export function extractWebsite(place: HerePlace): string | null {
  for (const c of place.contacts || []) {
    if (c.www?.[0]?.value) return c.www[0].value
  }
  return null
}

export function extractEmail(place: HerePlace): string | null {
  for (const c of place.contacts || []) {
    if (c.email?.[0]?.value) return c.email[0].value
  }
  return null
}

export function extractCity(place: HerePlace): string | null {
  return place.address?.city || place.address?.district || null
}
