import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/quiz — body: { event_type, budget_total, guests, city, vibe }
// Devuelve top 3 proveedores por cada una de las 3-4 categorías
// principales del tipo de evento, scored por presupuesto + ciudad + vibe.

const CATEGORIES_BY_EVENT: Record<string, string[]> = {
  boda:        ['foto','catering','espacios','musica','flores','planner'],
  cumpleanos:  ['catering','espacios','pastel','animacion','foto'],
  comunion:    ['catering','espacios','pastel','foto','papeleria'],
  corporativo: ['catering','espacios','musica','animacion'],
  otro:        ['catering','espacios','musica','animacion','foto'],
}

// Reparto sugerido del presupuesto por categoría (% sobre total).
// Útil para puntuar fit de proveedores cuyo precio se acerque al
// "trozo" que esa categoría debería tener en la celebración.
const BUDGET_SHARE: Record<string, number> = {
  catering:   0.45,
  espacios:   0.18,
  foto:       0.08,
  musica:     0.06,
  flores:     0.07,
  pastel:     0.04,
  planner:    0.05,
  animacion:  0.04,
  belleza:    0.04,
  transporte: 0.03,
  papeleria:  0.02,
  joyeria:    0.10,
}

function scoreProvider(p: any, opts: {
  budget_for_cat: number
  vibe: string
  guests: number
}): number {
  let score = 0

  // Match presupuesto: cuanto más cerca del budget_for_cat, mejor.
  if (p.price_base && opts.budget_for_cat > 0) {
    const diff = Math.abs(p.price_base - opts.budget_for_cat)
    const ratio = diff / opts.budget_for_cat   // 0 = perfect, 1+ = lejos
    score += Math.max(0, 30 * (1 - ratio))     // hasta 30 puntos
  }

  // Rating
  if (p.rating && p.rating > 0) score += p.rating * 4  // hasta 20 puntos

  // Reseñas (volumen)
  score += Math.min(10, (p.total_reviews || 0) * 2)

  // Verificado
  if (p.verified) score += 5

  // Featured
  if (p.featured) score += 5

  // Vibe match en descripción/especialidades (heurística)
  if (opts.vibe) {
    const text = `${p.description || ''} ${(p.specialties || []).join(' ')}`.toLowerCase()
    const vibeKeywords: Record<string, string[]> = {
      clasico:   ['clásico', 'tradicional', 'elegante', 'formal'],
      moderno:   ['moderno', 'minimalista', 'contemporáneo', 'urbano'],
      rustico:   ['rústico', 'natural', 'campo', 'boho', 'masía'],
      lujo:      ['premium', 'lujo', 'exclusivo', 'alta gama'],
      intimo:    ['íntimo', 'pequeño', 'familiar', 'cercano'],
      divertido: ['divertido', 'fiesta', 'energía', 'animación', 'show'],
    }
    const keys = vibeKeywords[opts.vibe] || []
    const hits = keys.filter(k => text.includes(k)).length
    score += hits * 8
  }

  return score
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const eventType   = (body.event_type   || 'boda').toString()
  const budgetTotal = Math.max(500, Math.min(parseInt(body.budget_total) || 5000, 200_000))
  const guests      = Math.max(1, Math.min(parseInt(body.guests) || 50, 1500))
  const city        = (body.city  || '').toString().trim()
  const vibe        = (body.vibe  || '').toString().trim().toLowerCase()
  const email       = (body.email || '').toString().trim().toLowerCase()

  const categories = CATEGORIES_BY_EVENT[eventType] || CATEGORIES_BY_EVENT.boda
  const supabase = createAdminClient()

  // Si llega email, lo añadimos a waitlist con source=quiz para
  // segmentación posterior. No bloqueante.
  if (email && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    supabase.from('waitlist').insert({
      email,
      city: city || null,
      event_type: eventType,
      source: 'quiz',
    }).then(() => {}).catch(() => {})
  }

  let query = supabase
    .from('providers')
    .select('id, slug, name, category, city, description, price_base, price_unit, rating, total_reviews, verified, featured, photo_url, photo_idx, specialties')
    .eq('status', 'approved')
    .in('category', categories)
    .gt('price_base', 0)

  if (city) query = query.ilike('city', `%${city.split(' ')[0]}%`)

  const { data: providers } = await query.limit(500)
  const all = providers || []

  // Para cada categoría, escogemos top 3 según score
  const matchesByCategory: Record<string, any[]> = {}
  let totalEstimate = 0
  for (const cat of categories) {
    const share          = BUDGET_SHARE[cat] || 0.05
    const budgetForCat   = Math.round(budgetTotal * share)
    const isPerPerson    = ['catering','pastel','belleza','papeleria'].includes(cat)
    const unitBudget     = isPerPerson ? Math.round(budgetForCat / guests) : budgetForCat

    const inCat = all
      .filter((p: any) => p.category === cat)
      .map((p: any) => ({
        ...p,
        _score: scoreProvider(p, { budget_for_cat: unitBudget, vibe, guests }),
      }))
      .sort((a: any, b: any) => b._score - a._score)
      .slice(0, 3)

    matchesByCategory[cat] = inCat
    totalEstimate += budgetForCat
  }

  return NextResponse.json({
    eventType,
    guests,
    city,
    vibe,
    budgetTotal,
    estimatedTotal: totalEstimate,
    matchesByCategory,
  })
}
