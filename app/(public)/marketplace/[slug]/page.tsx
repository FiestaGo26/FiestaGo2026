import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase'
import { CATEGORIES, CITIES, getPhoto } from '@/lib/constants'

// Slug structure: "{categoryId}-en-{citySlug}"
//   ej: "fotografia-en-madrid", "catering-en-barcelona"

function citySlug(city: string): string {
  return city.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function parseSlug(slug: string): { categoryId: string; city: string } | null {
  // Pattern: <category>-en-<city-with-dashes>
  const match = slug.match(/^([a-z]+)-en-([a-z0-9-]+)$/)
  if (!match) return null
  const categoryId = match[1]
  const cityKey    = match[2]
  // Cruzar contra constantes
  if (!CATEGORIES.find(c => c.id === categoryId)) return null
  const cityMatch = CITIES.find((c: string) => citySlug(c) === cityKey)
  if (!cityMatch) return null
  return { categoryId, city: cityMatch }
}

type Props = { params: { slug: string } }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const parsed = parseSlug(params.slug)
  if (!parsed) return { title: 'Página no encontrada' }
  const cat = CATEGORIES.find(c => c.id === parsed.categoryId)!
  const city = parsed.city
  const title       = `${cat.label} en ${city} · FiestaGo (alternativa a Bodas.net)`
  const description = `Reserva ${cat.label.toLowerCase()} en ${city} sin pagar cuota anual. Marketplace de bodas y eventos con Garantía de Éxito incluida. Compara precios reales de profesionales locales.`
  return {
    title,
    description,
    alternates: { canonical: `https://fiestago.es/marketplace/${params.slug}` },
    openGraph: { title, description, url: `https://fiestago.es/marketplace/${params.slug}`, type: 'website' },
  }
}

export default async function MarketplaceCatCityPage({ params }: Props) {
  const parsed = parseSlug(params.slug)
  if (!parsed) notFound()
  const cat = CATEGORIES.find(c => c.id === parsed.categoryId)!
  const city = parsed.city

  // Proveedores aprobados de esta categoría/ciudad. ilike para que
  // "Madrid" matchee también "Madrid centro" / "Madrid provincia".
  const supabase = createAdminClient()
  const { data: providersRaw } = await supabase
    .from('providers')
    .select('id, slug, name, city, description, price_base, price_unit, rating, total_reviews, photo_url, photo_idx, verified, featured, specialties')
    .eq('status', 'approved')
    .eq('category', cat.id)
    .ilike('city', `%${city.split(' ')[0]}%`)
    .order('featured', { ascending: false })
    .order('rating', { ascending: false })
    .limit(30)

  const providers = providersRaw || []
  const hasAny = providers.length > 0
  const prices = providers.map((p: any) => p.price_base).filter((x: number) => x > 0)
  const minPrice = prices.length ? Math.min(...prices) : null
  const avgPrice = prices.length ? Math.round(prices.reduce((a: number, b: number) => a + b, 0) / prices.length) : null

  // JSON-LD ItemList para que Google entienda que es un listado.
  const jsonLd = hasAny ? {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${cat.label} en ${city}`,
    itemListElement: providers.slice(0, 10).map((p: any, i: number) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'LocalBusiness',
        name: p.name,
        address: { '@type': 'PostalAddress', addressLocality: p.city, addressCountry: 'ES' },
        aggregateRating: p.rating > 0 ? {
          '@type': 'AggregateRating',
          ratingValue: p.rating,
          reviewCount: p.total_reviews || 1,
        } : undefined,
        url: `https://fiestago.es/proveedores/${p.slug || p.id}`,
      },
    })),
  } : null

  return (
    <>
      {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}/>}

      <main className="bg-cream">
        {/* Hero */}
        <section className="bg-gradient-to-br from-ink via-ink to-coral text-white">
          <div className="max-w-5xl mx-auto px-6 py-12 md:py-16">
            <div className="text-xs font-bold uppercase tracking-[0.25em] opacity-75 mb-2">
              {cat.icon} {cat.label} · {city}
            </div>
            <h1 className="font-serif text-3xl md:text-5xl font-bold leading-tight tracking-tight">
              {cat.label} en {city}
            </h1>
            <p className="text-base md:text-lg opacity-90 mt-4 max-w-2xl leading-relaxed">
              {hasAny
                ? `${providers.length} profesional${providers.length === 1 ? '' : 'es'} de ${cat.label.toLowerCase()} en ${city} y alrededores. Reservas con Garantía de Éxito, sin cuota anual ni intermediarios.`
                : `Reserva ${cat.label.toLowerCase()} en ${city} con FiestaGo. Lanzamiento el 10 de junio de 2026.`}
            </p>
            {(minPrice && avgPrice) ? (
              <div className="mt-5 inline-flex items-center gap-4 bg-white/10 rounded-xl px-4 py-2 backdrop-blur-sm">
                <div>
                  <div className="text-[10px] uppercase tracking-wider opacity-75">Desde</div>
                  <div className="font-serif text-xl font-bold">{minPrice.toLocaleString()}€</div>
                </div>
                <div className="w-px h-8 bg-white/30"/>
                <div>
                  <div className="text-[10px] uppercase tracking-wider opacity-75">Media</div>
                  <div className="font-serif text-xl font-bold">{avgPrice.toLocaleString()}€</div>
                </div>
              </div>
            ) : null}
          </div>
        </section>

        {/* Listado de providers */}
        <section className="max-w-5xl mx-auto px-6 py-10">
          {hasAny ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {providers.map((p: any) => (
                <Link key={p.id} href={`/proveedores/${p.slug || p.id}`}
                  className="group bg-white border border-stone-200 rounded-2xl overflow-hidden hover:-translate-y-1 hover:shadow-xl transition-all duration-200 flex flex-col">
                  <div className="relative h-44 overflow-hidden bg-stone-100">
                    <img src={p.photo_url || getPhoto(p.category || cat.id, p.photo_idx || 0, 600, 400)} alt={p.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"/>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent"/>
                    {p.verified && (
                      <span className="absolute top-3 left-3 text-xs font-bold px-2.5 py-1 rounded-full bg-white/90 text-ink">🛡️</span>
                    )}
                    {p.rating > 0 && (
                      <div className="absolute bottom-3 right-3 flex items-center gap-1 bg-white/90 rounded-full px-2.5 py-1">
                        <span className="text-gold text-xs">★</span>
                        <span className="text-xs font-bold text-ink">{Number(p.rating).toFixed(1)}</span>
                      </div>
                    )}
                  </div>
                  <div className="p-4 flex flex-col flex-1">
                    <h3 className="font-serif text-lg font-bold text-ink mb-1">{p.name}</h3>
                    <div className="text-xs text-ink/50 mb-2">📍 {p.city}</div>
                    {p.description && (
                      <p className="text-xs text-ink/55 leading-relaxed mb-3 line-clamp-2 flex-1">{p.description}</p>
                    )}
                    {p.price_base && (
                      <div className="border-t border-stone-100 pt-2 mt-auto">
                        <span className="text-xs text-ink/40">desde </span>
                        <span className="font-serif text-lg font-bold" style={{ color: cat.color }}>
                          {p.price_base.toLocaleString()}€
                        </span>
                      </div>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="bg-white border border-stone-200 rounded-2xl p-10 text-center">
              <div className="text-5xl mb-3">{cat.icon}</div>
              <h2 className="font-serif text-xl text-ink font-bold mb-2">
                Aún no hay proveedores de {cat.label.toLowerCase()} en {city}
              </h2>
              <p className="text-sm text-ink/60 mb-5 max-w-md mx-auto">
                Estamos construyendo el catálogo para el lanzamiento del 10 de junio. Si tienes un evento concreto, apúntate y avisamos cuando haya disponibilidad.
              </p>
              <Link href="/proveedores" className="inline-block bg-coral text-white font-bold px-6 py-2.5 rounded-xl text-sm hover:bg-coral-dark transition-colors">
                Ver otros profesionales
              </Link>
            </div>
          )}
        </section>

        {/* Por qué FiestaGo en lugar de Bodas.net (chunk SEO específico) */}
        <section className="bg-white border-y border-stone-200 py-12">
          <div className="max-w-3xl mx-auto px-6">
            <h2 className="font-serif text-2xl text-ink font-bold mb-4">
              {cat.label} en {city} sin cuota anual: por qué reservar en FiestaGo
            </h2>
            <p className="text-sm text-ink/70 leading-relaxed mb-3">
              Reservar {cat.label.toLowerCase()} para un evento en {city} suele implicar comparar entre {providers.length || 'varios'} profesionales en directorios tipo Bodas.net o Zankyou.
              Esos portales viven de cobrar al proveedor: cuota anual de 600 a 2.500€. Como cliente, eso no te afecta directamente — pero sí encarece el precio final, porque el proveedor incluye esa cuota en su presupuesto.
            </p>
            <p className="text-sm text-ink/70 leading-relaxed mb-3">
              En FiestaGo el modelo es al revés: el profesional no paga nada. Tú, como cliente, pagas un 8% adicional al precio de tu proveedor como Garantía de Éxito. Es lo que sostiene la garantía: si tu proveedor falla — cancela última hora, no aparece, calidad muy por debajo — FiestaGo te devuelve hasta el 110% del importe. Eso no lo encontrarás en ningún directorio publicitario.
            </p>
            <p className="text-sm text-ink/70 leading-relaxed">
              Para profesionales de {cat.label.toLowerCase()} en {city}, FiestaGo es la <Link href="/alternativas-bodas-net" className="text-coral underline">alternativa real a Bodas.net</Link>: sin cuota, sin permanencia, y solo pagan comisión cuando hay reserva.
            </p>
          </div>
        </section>

        {/* CTAs cruzados */}
        <section className="max-w-5xl mx-auto px-6 py-12">
          <div className="grid md:grid-cols-2 gap-5">
            <Link href="/calculadora" className="bg-white border border-stone-200 rounded-2xl p-6 hover:border-coral transition-colors group">
              <div className="text-3xl mb-2">🧮</div>
              <h3 className="font-serif text-lg text-ink font-bold mb-1 group-hover:text-coral">Calcula tu presupuesto</h3>
              <p className="text-sm text-ink/60 leading-relaxed">Estima cuánto te costará tu evento completo en {city} con precios reales.</p>
            </Link>
            <Link href="/profesionales" className="bg-white border border-stone-200 rounded-2xl p-6 hover:border-coral transition-colors group">
              <div className="text-3xl mb-2">🛠</div>
              <h3 className="font-serif text-lg text-ink font-bold mb-1 group-hover:text-coral">¿Eres profesional?</h3>
              <p className="text-sm text-ink/60 leading-relaxed">Inscríbete gratis antes del lanzamiento del 10 de junio y entra en el catálogo inicial.</p>
            </Link>
          </div>
        </section>
      </main>
    </>
  )
}
