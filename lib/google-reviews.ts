// ───────────────────────────────────────────────────────────────────────
// Opiniones de Google de los proveedores (6.ª simulación: el 78 % pedía
// reseñas reales y comprobables antes de pagar la señal).
//
// Busca cada proveedor en Google Maps con Apify (actor
// compass/crawler-google-places), comprueba que el sitio encontrado es el
// suyo (nombre parecido) y guarda nota, número de opiniones y las más
// relevantes en providers.google_*. Se muestran en la ficha y en la
// propuesta como "Opiniones de Google", sin nombre de quien las escribe.
// ───────────────────────────────────────────────────────────────────────

import type { SupabaseClient } from '@supabase/supabase-js'

const ACTOR = 'compass~crawler-google-places'
const MAX_REVIEWS = 8

export type GoogleReview = { text: string; stars: number; date: string | null }

function apifyToken() {
  return process.env.APIFY_API_KEY || process.env.APIFY_API_TOKEN || null
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(w => w.length > 2)

/** ¿El sitio de Google es este proveedor? (≥ 60 % de las palabras del nombre) */
function sameBusiness(ours: string, theirs: string) {
  const a = norm(ours), b = new Set(norm(theirs))
  if (!a.length) return false
  return a.filter(w => b.has(w)).length / a.length >= 0.6
}

export async function fetchGoogleReviews(name: string, city: string | null) {
  const token = apifyToken()
  if (!token) throw new Error('Falta APIFY_API_KEY')
  const res = await fetch(
    `https://api.apify.com/v2/acts/${ACTOR}/run-sync-get-dataset-items?token=${token}&timeout=240`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        searchStringsArray: [`${name.trim()} ${city || ''}`.trim()],
        maxCrawledPlacesPerSearch: 1,
        language: 'es',
        maxReviews: MAX_REVIEWS,
        reviewsSort: 'mostRelevant',
        scrapeReviewsPersonalData: false,
        maxImages: 0,
      }),
    },
  )
  if (!res.ok) throw new Error(`Apify ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const items = await res.json() as any[]
  const place = items?.[0]
  if (!place?.title || !sameBusiness(name, place.title)) return null
  const reviews: GoogleReview[] = (place.reviews || [])
    .filter((r: any) => r?.text && String(r.text).trim().length > 20)
    .slice(0, MAX_REVIEWS)
    .map((r: any) => ({ text: String(r.text).trim().slice(0, 600), stars: Number(r.stars) || 0, date: r.publishedAtDate || r.publishAtDate || null }))
  return {
    place_id: place.placeId || null,
    rating: Number(place.totalScore) || null,
    count: Number(place.reviewsCount) || 0,
    maps_uri: place.url || null,
    reviews,
  }
}

/** Actualiza las opiniones de Google de los proveedores aprobados. */
export async function refreshGoogleReviews(supabase: SupabaseClient, opts: { maxAgeDays?: number; limit?: number } = {}) {
  const since = new Date(Date.now() - (opts.maxAgeDays ?? 30) * 86400_000).toISOString()
  const { data: provs } = await supabase.from('providers')
    .select('id, name, city').eq('status', 'approved')
    .or(`google_reviews_at.is.null,google_reviews_at.lt.${since}`)
    .limit(opts.limit ?? 40)

  const out = { checked: 0, found: 0, errors: [] as string[] }
  const queue = [...(provs || [])]
  await Promise.all(Array.from({ length: 4 }, async () => {
    for (let p = queue.shift(); p; p = queue.shift()) {
      out.checked++
      try {
        const g = await fetchGoogleReviews(p.name, p.city)
        await supabase.from('providers').update({
          google_reviews_at: new Date().toISOString(),
          ...(g ? {
            google_place_id: g.place_id, google_rating: g.rating, google_rating_count: g.count,
            google_maps_uri: g.maps_uri, google_reviews: g.reviews,
          } : {}),
        }).eq('id', p.id)
        if (g) out.found++
      } catch (err: any) {
        out.errors.push(`${p.name}: ${err.message}`)
      }
    }
  }))
  return out
}
