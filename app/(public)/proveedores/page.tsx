import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase'
import { CATEGORIES } from '@/lib/constants'

const CATEGORY_PHOTOS: Record<string, string> = {
  foto:       'https://images.unsplash.com/photo-1519741497674-611481863552?w=900&q=80&auto=format&fit=crop',
  catering:   'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=900&q=80&auto=format&fit=crop',
  espacios:   'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=900&q=80&auto=format&fit=crop',
  musica:     'https://images.unsplash.com/photo-1493676304819-0d7a8d026dcf?w=900&q=80&auto=format&fit=crop',
  flores:     'https://images.unsplash.com/photo-1465495976277-4387d4b0b4af?w=900&q=80&auto=format&fit=crop',
  pastel:     'https://images.unsplash.com/photo-1530023367847-a683933f4172?w=900&q=80&auto=format&fit=crop',
  belleza:    'https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?w=900&q=80&auto=format&fit=crop',
  animacion:  'https://images.unsplash.com/photo-1513151233558-d860c5398176?w=900&q=80&auto=format&fit=crop',
  transporte: 'https://images.unsplash.com/photo-1485291571150-772bcfc10da5?w=900&q=80&auto=format&fit=crop',
  papeleria:  'https://images.unsplash.com/photo-1521017432531-fbd92d768814?w=900&q=80&auto=format&fit=crop',
  planner:    'https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?w=900&q=80&auto=format&fit=crop',
  joyeria:    'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=900&q=80&auto=format&fit=crop',
}

const CITIES = ['Valencia','Madrid','Barcelona','Sevilla','Bilbao','Málaga','Zaragoza','Murcia','Alicante','Granada']

async function getProviders(filters: { ciudad?: string; categoria?: string; q?: string }) {
  const supabase = createAdminClient()
  let q = supabase.from('providers').select('*').eq('status', 'approved').order('rating', { ascending: false })
  if (filters.ciudad)    q = q.eq('city', filters.ciudad)
  if (filters.categoria) q = q.eq('category', filters.categoria)
  if (filters.q)         q = q.or(`name.ilike.%${filters.q}%,description.ilike.%${filters.q}%`)
  const { data } = await q.limit(48)
  return data || []
}

export default async function ProveedoresPage({ searchParams }: { searchParams: { ciudad?: string; categoria?: string; q?: string } }) {
  const providers = await getProviders(searchParams)
  const activeCity = searchParams.ciudad || ''
  const activeCat  = searchParams.categoria || ''

  return (
    <main className="pt-32 md:pt-40 pb-32">
      {/* HEADER */}
      <header className="px-6 md:px-10 pb-12 md:pb-16">
        <div className="max-w-7xl mx-auto">
          <p className="eyebrow mb-4">Catálogo</p>
          <h1 className="font-serif text-5xl md:text-6xl leading-tight max-w-3xl">
            Los profesionales <span className="serif-italic">más queridos</span> para tu celebración.
          </h1>
          <p className="text-ink-soft text-lg mt-6 max-w-2xl leading-relaxed">
            Filtra por ciudad o tipo de servicio. Todos verificados, todos con reseñas reales.
          </p>
        </div>
      </header>

      {/* FILTROS */}
      <section className="px-6 md:px-10 mb-14">
        <div className="max-w-7xl mx-auto">
          <form method="GET" className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] tracking-[0.18em] uppercase text-ink-muted mr-2">Ciudad:</span>
              <Link href="/proveedores" className={['px-4 py-2 text-[12px] rounded-full border transition-colors', !activeCity ? 'bg-ink text-white border-ink' : 'bg-transparent text-ink-soft border-bone-dark hover:border-ink'].join(' ')}>
                Todas
              </Link>
              {CITIES.map(c => {
                const params = new URLSearchParams(searchParams as any); params.set('ciudad', c); if (activeCat) params.set('categoria', activeCat)
                return (
                  <Link key={c} href={`/proveedores?${params}`} className={['px-4 py-2 text-[12px] rounded-full border transition-colors', activeCity === c ? 'bg-ink text-white border-ink' : 'bg-transparent text-ink-soft border-bone-dark hover:border-ink'].join(' ')}>
                    {c}
                  </Link>
                )
              })}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] tracking-[0.18em] uppercase text-ink-muted mr-2">Categoría:</span>
              <Link href={`/proveedores${activeCity ? `?ciudad=${activeCity}` : ''}`} className={['px-4 py-2 text-[12px] rounded-full border transition-colors', !activeCat ? 'bg-ink text-white border-ink' : 'bg-transparent text-ink-soft border-bone-dark hover:border-ink'].join(' ')}>
                Todas
              </Link>
              {CATEGORIES.map(cat => {
                const params = new URLSearchParams(searchParams as any); params.set('categoria', cat.id); if (activeCity) params.set('ciudad', activeCity)
                return (
                  <Link key={cat.id} href={`/proveedores?${params}`} className={['px-4 py-2 text-[12px] rounded-full border transition-colors', activeCat === cat.id ? 'bg-ink text-white border-ink' : 'bg-transparent text-ink-soft border-bone-dark hover:border-ink'].join(' ')}>
                    {cat.label}
                  </Link>
                )
              })}
            </div>
          </form>
        </div>
      </section>

      <div className="section-rule max-w-7xl mx-auto" />

      {/* RESULTADOS */}
      <section className="px-6 md:px-10 pt-12">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-baseline mb-10">
            <div className="text-[11px] tracking-[0.18em] uppercase text-ink-muted">
              {providers.length} resultado{providers.length !== 1 ? 's' : ''}
            </div>
            <div className="text-[11px] tracking-[0.15em] uppercase text-ink-muted hidden md:block">
              Ordenado por valoración
            </div>
          </div>

          {providers.length === 0 ? (
            <div className="text-center py-24">
              <div className="font-serif text-3xl mb-4">Sin resultados.</div>
              <p className="text-ink-soft mb-8">Prueba con otra ciudad o categoría.</p>
              <Link href="/proveedores" className="text-[11px] tracking-[0.18em] uppercase font-medium pb-1 border-b border-ink">
                Ver todos los proveedores →
              </Link>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
              {providers.map((p: any) => (
                <Link key={p.id} href={`/proveedores/${p.slug || p.id}`} className="group lift bg-white border border-bone-dark block">
                  <div className="zoom-parent aspect-[4/3] bg-bone-dark">
                    <img src={CATEGORY_PHOTOS[p.category] || CATEGORY_PHOTOS.foto} alt={p.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-2">
                      <div className="eyebrow" style={{fontSize:'10px'}}>{CATEGORIES.find(c=>c.id===p.category)?.label || ''}</div>
                      {p.featured && <div className="text-[10px] tracking-[0.15em] uppercase text-gold">★ Destacado</div>}
                    </div>
                    <h3 className="font-serif italic text-xl mb-1 font-normal">{p.name}</h3>
                    <div className="text-[13px] text-ink-soft mb-4">{p.city}</div>
                    {p.rating > 0 && (
                      <div className="flex items-center gap-2 text-[12px] text-ink-soft mb-4">
                        <span className="text-gold">★</span> {Number(p.rating).toFixed(1)} <span className="text-ink-muted">· {p.total_reviews || 0} reseñas</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center pt-4 border-t border-bone-dark">
                      <div className="text-sm">
                        desde <span className="font-serif text-lg">{(p.price_base || 0).toLocaleString('es-ES')}<span className="text-gold">€</span></span>
                      </div>
                      <span className="text-[10px] tracking-[0.15em] uppercase font-medium group-hover:text-gold transition-colors">Ver perfil →</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
