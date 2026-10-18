import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import {
  EVENT_OPTIONS, AUDIENCE_OPTIONS, KIDS_AGE_OPTIONS, CORP_OPTIONS, getProfile, budgetSplit,
  type EventType, type Audience, type KidsAge, type CorpKind,
} from '@/lib/quiz'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/quiz — body: { event_type, audience?, kids_age?, corp_kind?,
// budget_total, guests, city, vibe, email? }
// El perfil (lib/quiz.ts) decide qué categorías recomendar y cómo repartir
// el presupuesto: un cumpleaños infantil no necesita lo mismo que uno de
// adultos. Devuelve los 3 mejores proveedores de cada categoría.

function scoreProvider(p: any, opts: {
  budget_for_cat: number
  styleKeywords: string[]
  audienceKeywords: string[]
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

  // Estilo y público en descripción/especialidades/nombre (heurística)
  const text = `${p.name || ''} ${p.description || ''} ${(p.specialties || []).join(' ')}`.toLowerCase()
  score += opts.styleKeywords.filter(k => text.includes(k)).length * 8
  score += Math.min(18, opts.audienceKeywords.filter(k => text.includes(k)).length * 6)

  return score
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const eventType   = (EVENT_OPTIONS.some(o => o.id === body.event_type) ? body.event_type : 'otro') as EventType
  const audience    = (AUDIENCE_OPTIONS.some(o => o.id === body.audience) ? body.audience : '') as Audience | ''
  const kidsAge     = (KIDS_AGE_OPTIONS.some(o => o.id === body.kids_age) ? body.kids_age : '') as KidsAge | ''
  const corpKind    = (CORP_OPTIONS.some(o => o.id === body.corp_kind) ? body.corp_kind : '') as CorpKind | ''
  const profile     = getProfile(eventType, { audience, age: kidsAge, corp: corpKind })
  const budgetTotal = Math.max(50, Math.min(parseInt(body.budget_total) || profile.budget.initial, 200_000))
  const guests      = Math.max(1, Math.min(parseInt(body.guests) || profile.guests, 1500))
  const city        = (body.city  || '').toString().trim()
  const vibe        = (body.vibe  || '').toString().trim().toLowerCase()
  const email       = (body.email || '').toString().trim().toLowerCase()

  const categories = Object.keys(profile.shares)
  const split      = budgetSplit(profile, budgetTotal)
  const style      = profile.styles.find(s => s.id === vibe)
  const supabase = createAdminClient()

  // Si llega email, lo añadimos a waitlist con source=quiz para
  // segmentación posterior. No bloqueante.
  if (email && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    supabase.from('waitlist').insert({
      email,
      city: city || null,
      event_type: profile.key.slice(0, 40),
      guests,
      source: 'quiz',
    }).then(() => {}, () => {})
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
  for (const cat of categories) {
    const budgetForCat = split[cat]
    const isPerPerson  = ['catering', 'belleza', 'papeleria'].includes(cat)
    const unitBudget   = isPerPerson ? Math.round(budgetForCat / guests) : budgetForCat

    matchesByCategory[cat] = all
      .filter((p: any) => p.category === cat)
      .map((p: any) => ({
        ...p,
        _score: scoreProvider(p, {
          budget_for_cat: unitBudget,
          styleKeywords: style?.keywords || [],
          audienceKeywords: profile.keywords,
        }),
      }))
      .sort((a: any, b: any) => b._score - a._score)
      .slice(0, 3)
  }

  return NextResponse.json({
    eventType,
    profileKey: profile.key,
    title: profile.title,
    guests,
    city,
    vibe,
    budgetTotal,
    budgetSplit: split,
    categories,
    matchesByCategory,
  })
}
