import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Categorías cuyo precio escala por nº de invitados. Para el resto
// asumimos precio fijo por evento.
const PER_PERSON_CATEGORIES = new Set(['catering', 'pastel', 'belleza', 'papeleria'])

// Cuando NO hay datos reales para una categoría/ciudad, usamos estos
// fallbacks (medianas de mercado español 2026). Mejor algo que nada.
const FALLBACK_PRICE: Record<string, { min: number; avg: number; max: number; unit: 'por_evento' | 'por_persona' }> = {
  foto:       { min: 800,  avg: 1500, max: 3000, unit: 'por_evento' },
  catering:   { min: 35,   avg: 65,   max: 110,  unit: 'por_persona' },
  espacios:   { min: 1500, avg: 3500, max: 8000, unit: 'por_evento' },
  musica:     { min: 400,  avg: 800,  max: 1500, unit: 'por_evento' },
  flores:     { min: 500,  avg: 1200, max: 2500, unit: 'por_evento' },
  pastel:     { min: 4,    avg: 7,    max: 14,   unit: 'por_persona' },
  belleza:    { min: 80,   avg: 180,  max: 350,  unit: 'por_persona' },
  animacion:  { min: 400,  avg: 900,  max: 1800, unit: 'por_evento' },
  transporte: { min: 300,  avg: 600,  max: 1200, unit: 'por_evento' },
  papeleria:  { min: 2,    avg: 4,    max: 8,    unit: 'por_persona' },
  planner:    { min: 800,  avg: 2000, max: 4500, unit: 'por_evento' },
  joyeria:    { min: 300,  avg: 1200, max: 5000, unit: 'por_evento' },
}

// p25 y p75 de un array de números, evitando outliers.
function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0
  const sorted = [...arr].sort((a, b) => a - b)
  const idx = Math.min(sorted.length - 1, Math.floor(p * sorted.length))
  return sorted[idx]
}

// POST /api/calculadora — público. Body:
// { event_type, guests: number, city?: string, categories: string[] }
//
// Devuelve por cada categoría: { min, avg, max, n_samples, sample_providers[] }
// + total estimado (rango).
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const guests       = Math.max(1, Math.min(parseInt(body.guests) || 50, 1500))
  const city         = (body.city || '').toString().trim()
  const categories   = Array.isArray(body.categories) ? body.categories.filter((x: any) => typeof x === 'string').slice(0, 12) : []
  const eventType    = body.event_type || ''

  if (categories.length === 0) {
    return NextResponse.json({ error: 'Selecciona al menos una categoría' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Una query única que trae todos los providers aprobados de las
  // categorías pedidas (y la ciudad si hay). Filtramos por price > 0
  // para no contar los que no han puesto precio.
  let query = supabase
    .from('providers')
    .select('id, slug, name, category, city, price_base, price_unit, rating, total_reviews, photo_url, photo_idx')
    .eq('status', 'approved')
    .in('category', categories)
    .gt('price_base', 0)

  if (city) query = query.ilike('city', `%${city.split(' ')[0]}%`)

  const { data: providers, error } = await query.limit(500)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const byCategory: Record<string, any> = {}
  let totalMin = 0, totalAvg = 0, totalMax = 0

  for (const cat of categories) {
    const matches = (providers || []).filter((p: any) => p.category === cat)
    const prices  = matches.map((p: any) => p.price_base as number)

    let min: number, avg: number, max: number, unit: 'por_evento' | 'por_persona', source: 'real' | 'fallback'

    if (prices.length >= 3) {
      // Suficientes datos reales — usar percentiles 25/50/75
      min = Math.round(percentile(prices, 0.25))
      avg = Math.round(percentile(prices, 0.50))
      max = Math.round(percentile(prices, 0.75))
      source = 'real'
      // Detectar unit por mayoría del price_unit en los proveedores reales
      const perPerson = matches.filter((p: any) =>
        /persona|invitad/i.test(p.price_unit || '')).length
      unit = perPerson > matches.length / 2 || PER_PERSON_CATEGORIES.has(cat)
        ? 'por_persona' : 'por_evento'
    } else {
      const fb = FALLBACK_PRICE[cat] || { min: 500, avg: 1000, max: 2000, unit: 'por_evento' as const }
      min = fb.min; avg = fb.avg; max = fb.max; unit = fb.unit
      source = 'fallback'
    }

    // Si la categoría escala por persona, multiplicamos por invitados.
    const mult = unit === 'por_persona' ? guests : 1
    const minT = min * mult, avgT = avg * mult, maxT = max * mult

    totalMin += minT; totalAvg += avgT; totalMax += maxT

    // Top 3 proveedores cuyo precio cae cerca de la mediana
    const sampleProviders = matches
      .sort((a: any, b: any) => Math.abs(a.price_base - avg) - Math.abs(b.price_base - avg))
      .slice(0, 3)
      .map((p: any) => ({
        id: p.id, slug: p.slug, name: p.name, city: p.city,
        price_base: p.price_base, price_unit: p.price_unit,
        rating: p.rating, total_reviews: p.total_reviews,
        photo_url: p.photo_url, photo_idx: p.photo_idx, category: p.category,
      }))

    byCategory[cat] = {
      unit, source, n_samples: prices.length,
      per_unit:  { min, avg, max },                   // precio unitario (€/persona o €/evento)
      total:     { min: minT, avg: avgT, max: maxT }, // ya multiplicado si aplica
      sampleProviders,
    }
  }

  return NextResponse.json({
    guests, city, eventType,
    total: { min: Math.round(totalMin), avg: Math.round(totalAvg), max: Math.round(totalMax) },
    byCategory,
  })
}
