import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { priceFor, precioCliente, pricingUnit, perPerson } from '@/lib/pricing'
import { venueSummary, type VenueFeatures } from '@/lib/venue'
import { zoneOf } from '@/lib/captacion'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/celebracion?zone=valencia|asturias&guests=50&hours=4&categories=espacios,catering,…
// "Monta tu celebración" (simulaciones 14-15): para cada servicio, los
// proveedores de la zona con su precio final exacto para tus invitados y
// horas (IVA y Garantía incluidos) y si son la opción económica, media o
// premium de su categoría. Los locales con aforo menor que tus invitados no salen.
export async function GET(req: NextRequest) {
  const q = new URL(req.url).searchParams
  const zone = q.get('zone') === 'asturias' ? 'asturias' : 'valencia'
  const guests = Math.min(Math.max(parseInt(q.get('guests') || '0') || 0, 0), 2000)
  const hours = Math.min(Math.max(Number(q.get('hours')) || 0, 0), 24)
  const cats = (q.get('categories') || '').split(',').map(s => s.trim()).filter(Boolean).slice(0, 12)
  if (!cats.length) return NextResponse.json({ error: 'Faltan categorías' }, { status: 400 })

  const { data } = await createAdminClient().from('providers')
    .select('id, name, slug, city, category, photo_url, rating, total_reviews, google_rating, google_rating_count, venue_type, venue_features, provider_services(id, name, price, pricing_unit, included_guests, extra_guest_price, included_hours, extra_hour_price, status)')
    .eq('status', 'approved').in('category', cats)

  const byCategory: Record<string, any[]> = Object.fromEntries(cats.map(c => [c, []]))
  for (const p of (data || []) as any[]) {
    if (zoneOf(p.city) !== zone) continue
    const vf = (p.venue_features || {}) as VenueFeatures
    if (p.category === 'espacios' && vf.aforo && guests && vf.aforo < guests) continue
    // Su servicio con precio que mejor encaja: el más barato para este caso
    const options = (p.provider_services || [])
      .filter((s: any) => s.status !== 'inactive' && Number(s.price) > 0)
      .map((s: any) => ({ s, base: priceFor(s, { guests, hours }) }))
      .sort((a: any, b: any) => a.base - b.base)
    const best = options[0]
    if (!best) continue
    const price = precioCliente(best.base)
    byCategory[p.category]?.push({
      provider_id: p.id, slug: p.slug, name: p.name, city: p.city, photo_url: p.photo_url,
      rating: p.google_rating || p.rating || null, reviews: p.google_rating_count || p.total_reviews || 0,
      service_id: best.s.id, service_name: best.s.name, unit: pricingUnit(best.s),
      price, per_person: perPerson(price, guests),
      venue_type: p.venue_type || null, venue_features: p.category === 'espacios' ? vf : null,
      venue_summary: p.category === 'espacios' ? venueSummary(p.venue_type, vf) : null,
    })
  }
  // Económica / media / premium según el precio dentro de su categoría
  for (const list of Object.values(byCategory)) {
    list.sort((a, b) => a.price - b.price)
    list.forEach((x, i) => { x.tier = list.length < 3 ? null : i < list.length / 3 ? 'economica' : i < (2 * list.length) / 3 ? 'media' : 'premium' })
  }
  return NextResponse.json({ zone, guests, hours, byCategory })
}
