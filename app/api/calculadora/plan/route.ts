import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { CATEGORIES } from '@/lib/constants'
import { generateEventPlan, type PlannerInput } from '@/lib/planner-ai'

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

// Máximo de candidatos por categoría que pasamos al prompt — equilibra
// calidad de selección vs. coste de tokens. Claude Haiku no se atraganta
// con 20, pero más allá empezamos a malgastar.
const MAX_CANDIDATES_PER_CATEGORY = 18

// POST /api/calculadora/plan
// Body: {
//   event_type, guests, city, categories[],
//   budget_total,       // presupuesto objetivo
//   style?,             // 'rustico' | 'clasico' | 'moderno' | 'playa' | 'elegante'
//   event_date?,        // YYYY-MM-DD — si está, filtramos por availability
//   client_email?,
// }
// Devuelve: { proposal_id, share_url, packages, summary }
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const event_type   = (body.event_type || 'otro').toString()
  const guests       = Math.max(1, Math.min(parseInt(body.guests) || 50, 1500))
  const city         = (body.city || '').toString().trim()
  const budget_total = Math.max(0, Math.min(parseInt(body.budget_total) || 0, 500_000))
  const style        = (body.style || '').toString().trim() || null
  const event_date   = (body.event_date || '').toString().trim() || null
  const client_email = (body.client_email || '').toString().trim() || null
  const categories   = Array.isArray(body.categories)
    ? body.categories.filter((x: any) => typeof x === 'string').slice(0, 12)
    : []

  if (categories.length === 0) {
    return NextResponse.json({ error: 'Selecciona al menos una categoría' }, { status: 400 })
  }
  if (!city) {
    return NextResponse.json({ error: 'Indica una ciudad para personalizar la propuesta' }, { status: 400 })
  }
  if (budget_total <= 0) {
    return NextResponse.json({ error: 'Indica tu presupuesto objetivo' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // 1. Cargar candidatos por categoría, filtrados por ciudad y disponibilidad
  //    si hay fecha. Ordenados por rating × volumen de reseñas para que las
  //    sugerencias sean de calidad.
  const candidates: PlannerInput['candidates'] = []

  // Si hay fecha, primero sacamos los provider_id BLOQUEADOS esa fecha.
  let blockedProviderIds = new Set<string>()
  if (event_date) {
    const { data: blocked } = await supabase
      .from('service_availability')
      .select('service_id, provider_services!inner(provider_id)')
      .eq('blocked_date', event_date)
    blockedProviderIds = new Set(
      (blocked || []).map((row: any) => row.provider_services?.provider_id).filter(Boolean)
    )
  }

  for (const catId of categories) {
    const cat = CATEGORIES.find(c => c.id === catId)
    if (!cat) continue

    let q = supabase
      .from('providers')
      .select('id, name, city, category, price_base, rating, total_reviews, description, specialties')
      .eq('status', 'approved')
      .eq('category', catId)
      .gt('price_base', 0)

    if (city) q = q.ilike('city', `%${city.split(' ')[0]}%`)

    const { data: providers } = await q
      .order('rating', { ascending: false, nullsFirst: false })
      .order('total_reviews', { ascending: false, nullsFirst: false })
      .limit(60)

    let items = providers || []
    if (blockedProviderIds.size > 0) {
      items = items.filter((p: any) => !blockedProviderIds.has(p.id))
    }

    candidates.push({
      category: catId,
      label:    cat.label,
      items: items.slice(0, MAX_CANDIDATES_PER_CATEGORY).map((p: any) => ({
        id:             p.id,
        name:           p.name,
        city:           p.city,
        price_base:     p.price_base,
        rating:         p.rating || 0,
        total_reviews:  p.total_reviews || 0,
        description:    (p.description || '').slice(0, 200),
        specialties:    p.specialties || [],
      })),
    })
  }

  // ¿Hay candidatos en al menos 1 categoría? Si todas están vacías,
  // no podemos generar nada útil.
  const totalCandidates = candidates.reduce((acc, c) => acc + c.items.length, 0)
  if (totalCandidates === 0) {
    return NextResponse.json({
      error: 'Aún no tenemos proveedores aprobados en esas categorías para esa ciudad. Estamos cerrando el catálogo inicial.',
    }, { status: 404 })
  }

  // 2. Llamar al planner IA
  const planResult = await generateEventPlan({
    event_type, guests, city, budget_total,
    style, event_date,
    categories,
    candidates,
  })
  if (!planResult.ok) {
    return NextResponse.json({ error: 'No se pudo generar la propuesta: ' + planResult.error }, { status: 502 })
  }

  // 3. Validar que Claude solo eligió providers del catálogo y enriquecer
  //    cada provider con los datos completos para el render del cliente.
  const allCandidateIds = new Set<string>()
  const candidatesById  = new Map<string, any>()
  for (const block of candidates) {
    for (const it of block.items) {
      allCandidateIds.add(it.id)
      candidatesById.set(it.id, it)
    }
  }

  // Re-fetch metadatos visuales (photo_url, photo_idx, slug) — no los pasamos
  // a Claude para ahorrar tokens, pero el front los necesita.
  const usedIds = new Set<string>()
  for (const pkg of planResult.data.packages) {
    for (const p of pkg.providers) {
      if (allCandidateIds.has(p.id)) usedIds.add(p.id)
    }
  }
  let visualData = new Map<string, any>()
  if (usedIds.size > 0) {
    const { data: full } = await supabase
      .from('providers')
      .select('id, slug, name, photo_url, photo_idx, city, category, price_base, price_unit, rating, total_reviews')
      .in('id', Array.from(usedIds))
    for (const p of full || []) {
      visualData.set(p.id, p)
    }
  }

  // Limpiar paquetes: eliminar IDs que Claude se inventó, enriquecer los reales
  const enrichedPackages = planResult.data.packages.map(pkg => ({
    tier:     pkg.tier,
    title:    pkg.title,
    subtitle: pkg.subtitle,
    estimated_total: pkg.estimated_total,
    providers: pkg.providers
      .filter(p => allCandidateIds.has(p.id))
      .map(p => ({
        ...p,
        ...visualData.get(p.id),
      })),
  })).filter(pkg => pkg.providers.length > 0)

  if (enrichedPackages.length === 0) {
    return NextResponse.json({
      error: 'La IA no pudo armar paquetes válidos. Inténtalo de nuevo en un momento.',
    }, { status: 502 })
  }

  // 4. Guardar en BD para que el cliente pueda compartir el link
  const { data: saved, error: saveErr } = await supabase
    .from('event_proposals')
    .insert({
      event_type, guests, city,
      budget_total,
      style, event_date,
      categories,
      packages: enrichedPackages,
      client_email,
    })
    .select('id')
    .single()

  if (saveErr || !saved) {
    // No bloqueamos al cliente si BD falla — devolvemos la propuesta igual.
    return NextResponse.json({
      proposal_id: null,
      share_url:   null,
      packages:    enrichedPackages,
      summary:     planResult.data.summary,
      warning:     'No se pudo guardar la propuesta para compartir: ' + (saveErr?.message || 'desconocido'),
    })
  }

  return NextResponse.json({
    proposal_id: saved.id,
    share_url:   `/mi-evento/${saved.id}`,
    packages:    enrichedPackages,
    summary:     planResult.data.summary,
  })
}
