// ───────────────────────────────────────────────────────────────────────
// OSM Search · Buscador 100% gratis vía Overpass API (OpenStreetMap).
// No requiere API key, sin tarjeta, sin signup, ~10k queries/día por IP.
//
// Estrategia:
//   1. Geocoding de la ciudad → bounding box (vía Nominatim, también gratis).
//   2. Query Overpass por los tags relevantes a la categoría.
//   3. Mapear a nuestro formato { name, phone, website, email, instagram }.
//
// Cobertura por categoría: muy buena para tiendas/locales físicos
// (floristas, pastelerías, fincas, joyería); pobre para freelancers
// puros (DJ, planners, animadores) — esos los cubrimos con DDG.
// ───────────────────────────────────────────────────────────────────────

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.openstreetmap.fr/api/interpreter',
]

type OsmProvider = {
  name: string
  phone: string | null
  website: string | null
  email: string | null
  instagram: string | null
  address: string | null
  lat: number
  lng: number
  osmId: string
}

// Mapeo categoría → filtros Overpass. Cada entrada es una sentencia OQL
// completa que se inyecta en la query. Si está vacío, OSM no es la
// fuente adecuada para esa categoría (mejor usar DDG/PA).
const CATEGORY_FILTERS: Record<string, string[]> = {
  // OJO: shop=photo son labs/Kodak/foto-carnet, NO fotógrafos de boda.
  // Mantenemos solo craft/office=photographer (profesionales).
  foto:       ['node["craft"="photographer"]', 'node["office"="photographer"]'],
  catering:   ['node["cuisine"="catering"]', 'node["craft"="catering"]', 'node["amenity"="restaurant"]["catering"="yes"]'],
  espacios:   ['node["amenity"="events_venue"]', 'node["amenity"="conference_centre"]', 'node["leisure"="hall_of_fame"]'],
  musica:     [], // OSM no marca DJs — usar DDG
  flores:     ['node["shop"="florist"]'],
  pastel:     ['node["shop"="pastry"]', 'node["shop"="bakery"]["cake"="yes"]', 'node["shop"="confectionery"]'],
  belleza:    ['node["shop"="hairdresser"]["wedding"="yes"]', 'node["shop"="beauty"]', 'node["shop"="cosmetics"]'],
  animacion:  [], // OSM no marca animadores — usar DDG
  transporte: ['node["amenity"="car_rental"]["car_rental"="limousine"]'],
  papeleria:  ['node["shop"="stationery"]', 'node["craft"="bookbinder"]'],
  planner:    [], // OSM no marca planners — usar DDG
  joyeria:    ['node["shop"="jewelry"]'],
}

// True si OSM tiene cobertura razonable de esta categoría
export function osmSupportsCategory(categoryId: string): boolean {
  const filters = CATEGORY_FILTERS[categoryId]
  return !!filters && filters.length > 0
}

async function fetchJson(url: string, body: string, timeoutMs: number = 25_000): Promise<any | null> {
  const controller = new AbortController()
  const tick = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'FiestaGoBot/1.0 (+https://fiestago.es)',
      },
      body,
      signal: controller.signal,
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  } finally {
    clearTimeout(tick)
  }
}

// Geocode ciudad → bounding box vía Nominatim (también gratis, sin key).
// Devuelve [south, west, north, east] o null si no encuentra.
async function geocodeCity(city: string): Promise<[number, number, number, number] | null> {
  const controller = new AbortController()
  const tick = setTimeout(() => controller.abort(), 8000)
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city + ', España')}&format=json&limit=1`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'FiestaGoBot/1.0 (+https://fiestago.es)' },
      signal: controller.signal,
    })
    if (!res.ok) return null
    const data: any[] = await res.json()
    if (!data[0]?.boundingbox) return null
    const [s, n, w, e] = data[0].boundingbox.map(parseFloat)
    return [s, w, n, e]
  } catch {
    return null
  } finally {
    clearTimeout(tick)
  }
}

// Normaliza handle de Instagram desde un valor de tag OSM que puede ser
// un URL completo, "@handle" o "handle".
function normalizeInstagram(value: string | undefined): string | null {
  if (!value) return null
  const v = value.trim()
  if (!v) return null
  const m = v.match(/(?:instagram\.com\/)?@?([A-Za-z0-9_.]{1,30})/i)
  return m ? '@' + m[1] : null
}

// Normaliza URL: asegura https://, descarta los de Instagram (van al campo IG).
function normalizeWebsite(value: string | undefined): string | null {
  if (!value) return null
  let v = value.trim()
  if (!v) return null
  if (/instagram\.com|facebook\.com|tiktok\.com/i.test(v)) return null
  if (!/^https?:\/\//i.test(v)) v = 'https://' + v.replace(/^\/+/, '')
  return v
}

/**
 * Busca proveedores en OSM para una categoría en una ciudad española.
 * Devuelve un array vacío si OSM no cubre la categoría o no hay resultados.
 * Máximo 50 resultados por query para no saturar.
 */
export async function osmSearch(categoryId: string, city: string): Promise<OsmProvider[]> {
  const filters = CATEGORY_FILTERS[categoryId]
  if (!filters || !filters.length) return []

  const bbox = await geocodeCity(city)
  if (!bbox) return []

  // Construir query Overpass con todos los filtros en un union.
  const [s, w, n, e] = bbox
  const filterBlock = filters.map(f => `${f}(${s},${w},${n},${e});`).join('\n  ')
  const query = `[out:json][timeout:20];
(
  ${filterBlock}
);
out body 150;`

  // Probar endpoints en orden (failover).
  let data: any = null
  for (const endpoint of OVERPASS_ENDPOINTS) {
    data = await fetchJson(endpoint, 'data=' + encodeURIComponent(query))
    if (data?.elements) break
  }
  if (!data?.elements?.length) return []

  return (data.elements as any[])
    .filter(el => el.tags?.name)
    .map(el => {
      const t = el.tags
      const phoneRaw = t['contact:phone'] || t.phone || null
      const phone = phoneRaw ? phoneRaw.replace(/[^\d+]/g, '') : null
      const email = t['contact:email'] || t.email || null
      const websiteRaw = t['contact:website'] || t.website || null
      const igRaw = t['contact:instagram'] || t['brand:instagram'] || null
      const street = [t['addr:street'], t['addr:housenumber']].filter(Boolean).join(' ')
      const cityTag = t['addr:city'] || ''
      const address = [street, cityTag].filter(Boolean).join(', ') || null

      return {
        name:      t.name as string,
        phone,
        email,
        website:   normalizeWebsite(websiteRaw || undefined),
        instagram: normalizeInstagram(igRaw || undefined),
        address,
        lat:       el.lat || 0,
        lng:       el.lon || 0,
        osmId:     `osm:${el.type}/${el.id}`,
      }
    })
}

export type { OsmProvider }
