// Componente reutilizable de landing por vertical (cumpleaños,
// comuniones, corporativo). Server component que carga proveedores
// reales aprobados de las categorías relevantes para ese vertical.

import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase'
import { precioCliente, formatEuro, textoGarantiaIncluida } from '@/lib/pricing'
import { CATEGORIES, getPhoto } from '@/lib/constants'
import FavoriteButton from './FavoriteButton'

export type VerticalConfig = {
  slug:       string                  // 'cumpleanos' | 'comuniones' | 'corporativo'
  eventType:  string                  // valor en BD (event_type) — 'cumpleanos' | 'comunion' | 'corporativo'
  title:      string                  // "Cumpleaños inolvidables"
  emoji:      string                  // "🎂"
  hero: {
    headline:  string                 // H1
    subhead:   string                 // sub bajo H1
    img:       string                 // url foto hero
  }
  intro:      string                  // párrafo 1-2 frases
  categories: string[]                // ids de categorías relevantes en orden de prioridad
  benefits: Array<{ icon: string; title: string; body: string }>
  faq: Array<{ q: string; a: string }>
  ctaBudget?: { min: number; avg: number; max: number; per: 'persona' | 'evento' }   // rango orientativo del presupuesto
}

export async function VerticalLandingPage({ config }: { config: VerticalConfig }) {
  const supabase = createAdminClient()
  const { data: providersRaw } = await supabase
    .from('providers')
    .select('id, slug, name, category, city, description, price_base, rating, total_reviews, photo_url, photo_idx, verified, featured')
    .eq('status', 'approved')
    .in('category', config.categories)
    .order('featured', { ascending: false })
    .order('rating', { ascending: false })
    .limit(24)

  const providers = providersRaw || []

  // Agrupamos providers por categoría para mostrar bloques organizados
  const byCategory: Record<string, any[]> = {}
  for (const cat of config.categories) {
    byCategory[cat] = providers.filter((p: any) => p.category === cat)
  }

  return (
    <main className="bg-cream">
      {/* HERO */}
      <section className="relative h-[60vh] min-h-[440px] flex items-end overflow-hidden">
        <img src={config.hero.img} alt={config.title}
          className="absolute inset-0 w-full h-full object-cover"/>
        <div className="absolute inset-0 bg-gradient-to-b from-black/15 via-black/30 to-black/75"/>
        <div className="relative max-w-5xl mx-auto px-6 pb-12 md:pb-16 w-full text-white">
          <div className="inline-flex items-center gap-2 text-xs font-bold tracking-[0.22em] uppercase mb-4 bg-coral/95 text-white px-4 py-1.5 rounded-full">
            {config.emoji} {config.title}
          </div>
          <h1 className="font-serif text-3xl md:text-5xl lg:text-6xl leading-[1.05] tracking-tight max-w-3xl">
            {config.hero.headline}
          </h1>
          <p className="text-base md:text-xl text-white/95 mt-4 max-w-2xl leading-relaxed">
            {config.hero.subhead}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/quiz"
              className="bg-white text-coral font-bold px-6 py-3 rounded-xl text-sm hover:bg-cream transition-colors">
              ✨ Empezar el quiz (2 min) →
            </Link>
            <Link href={`/proveedores?categoria=${config.categories[0]}`}
              className="border border-white/40 text-white font-bold px-6 py-3 rounded-xl text-sm hover:bg-white/10 transition-colors">
              Ver proveedores
            </Link>
          </div>
        </div>
      </section>

      {/* INTRO */}
      <section className="max-w-3xl mx-auto px-6 py-12 md:py-16 text-center">
        <p className="font-serif text-xl md:text-2xl text-ink/85 leading-relaxed">
          {config.intro}
        </p>
        {config.ctaBudget && (
          <div className="mt-8 inline-flex items-center gap-5 bg-white rounded-2xl border border-stone-200 px-6 py-4">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-ink/45 font-bold">Presupuesto medio</div>
              <div className="font-serif text-2xl font-bold text-coral">
                {config.ctaBudget.min}€ – {config.ctaBudget.max}€
              </div>
              <div className="text-[10px] text-ink/50">por {config.ctaBudget.per}</div>
            </div>
            <div className="w-px h-12 bg-stone-200"/>
            <Link href="/calculadora"
              className="text-sm font-semibold text-coral hover:underline">
              Calcular el mío →
            </Link>
          </div>
        )}
      </section>

      {/* PROVEEDORES POR CATEGORÍA */}
      <section className="max-w-6xl mx-auto px-6 pb-16">
        {config.categories.map(catId => {
          const cat   = CATEGORIES.find(c => c.id === catId)
          const items = byCategory[catId] || []
          if (!cat || items.length === 0) return null
          return (
            <div key={catId} className="mb-12">
              <div className="flex items-baseline justify-between mb-5 flex-wrap gap-2">
                <h2 className="font-serif text-2xl md:text-3xl text-ink font-bold flex items-center gap-2">
                  <span>{cat.icon}</span> {cat.label}
                </h2>
                <Link href={`/proveedores?categoria=${cat.id}`}
                  className="text-xs font-semibold text-coral hover:underline">
                  Ver todos →
                </Link>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {items.slice(0, 6).map((p: any) => (
                  <Link key={p.id} href={`/proveedores/${p.slug || p.id}`}
                    className="group bg-white border border-stone-200 rounded-2xl overflow-hidden hover:-translate-y-1 hover:shadow-xl transition-all duration-200 flex flex-col">
                    <div className="relative h-44 bg-stone-100 overflow-hidden">
                      <img src={p.photo_url || getPhoto(p.category, p.photo_idx || 0, 600, 400)} alt={p.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"/>
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent"/>
                      {p.rating > 0 && (
                        <div className="absolute bottom-3 right-3 flex items-center gap-1 bg-white/90 rounded-full px-2.5 py-1">
                          <span className="text-gold text-xs">★</span>
                          <span className="text-xs font-bold text-ink">{Number(p.rating).toFixed(1)}</span>
                        </div>
                      )}
                      {p.verified && (
                        <span className="absolute top-3 left-3 text-xs font-bold px-2.5 py-1 rounded-full bg-white/90 text-ink">🛡️</span>
                      )}
                    </div>
                    <div className="p-4 flex flex-col flex-1">
                      <h3 className="font-serif text-lg font-bold text-ink mb-1">{p.name}</h3>
                      <div className="text-xs text-ink/50 mb-3">📍 {p.city}</div>
                      {p.description && (
                        <p className="text-xs text-ink/55 leading-relaxed mb-3 line-clamp-2 flex-1">{p.description}</p>
                      )}
                      {p.price_base && (
                        <div className="border-t border-stone-100 pt-3 mt-auto">
                          <span className="text-xs text-ink/40">desde </span>
                          <span className="font-serif text-lg font-bold" style={{ color: cat.color }}
                            title={textoGarantiaIncluida(p.price_base)}>
                            {formatEuro(precioCliente(p.price_base))}
                          </span>
                          <div className="text-[10px] text-ink/45 mt-0.5">{textoGarantiaIncluida(p.price_base)}</div>
                        </div>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )
        })}
      </section>

      {/* BENEFITS */}
      <section className="bg-white border-t border-stone-200 py-14 md:py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-10">
            <p className="text-xs font-bold tracking-[0.25em] uppercase text-coral mb-3">Por qué FiestaGo</p>
            <h2 className="font-serif text-3xl md:text-4xl text-ink leading-tight tracking-tight">
              Reservar con respaldo, no a ciegas
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {config.benefits.map(b => (
              <div key={b.title} className="bg-cream/40 border border-stone-100 rounded-2xl p-6">
                <div className="text-3xl mb-3">{b.icon}</div>
                <h3 className="font-serif text-lg text-ink font-bold mb-2">{b.title}</h3>
                <p className="text-sm text-ink/70 leading-relaxed">{b.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-3xl mx-auto px-6 py-14 md:py-16">
        <h2 className="font-serif text-2xl md:text-3xl text-ink font-bold text-center mb-8">
          Preguntas frecuentes
        </h2>
        <div className="space-y-3">
          {config.faq.map((q, i) => (
            <details key={i} className="bg-white border border-stone-200 rounded-xl overflow-hidden group">
              <summary className="px-5 py-4 cursor-pointer font-semibold text-ink text-sm flex items-center justify-between hover:bg-cream/40">
                {q.q}
                <span className="text-coral group-open:rotate-45 transition-transform">+</span>
              </summary>
              <div className="px-5 pb-4 text-sm text-ink/70 leading-relaxed">{q.a}</div>
            </details>
          ))}
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="bg-gradient-to-br from-coral to-coral-dark text-white">
        <div className="max-w-3xl mx-auto px-6 py-14 text-center">
          <h2 className="font-serif text-2xl md:text-4xl font-bold leading-tight">
            {config.title} sin estrés, en 3 pasos
          </h2>
          <p className="text-sm md:text-base opacity-90 mt-3 max-w-xl mx-auto">
            Elige proveedores verificados, reserva con pago seguro y respaldo si algo va mal.
          </p>
          <div className="mt-7 flex gap-3 justify-center flex-wrap">
            <Link href="/quiz" className="bg-white text-coral font-bold px-6 py-3 rounded-xl text-sm hover:bg-cream transition-colors">
              ✨ Encuentra tus proveedores en 2 minutos
            </Link>
            <Link href="/calculadora" className="border border-white/40 text-white font-bold px-6 py-3 rounded-xl text-sm hover:bg-white/10 transition-colors">
              🧮 Calcular mi presupuesto
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
