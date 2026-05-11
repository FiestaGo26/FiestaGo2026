'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import { getPhoto, CATEGORIES, CITIES } from '@/lib/constants'

type Service = {
  id: string
  name: string
  description: string | null
  price: number
  price_unit: string
  duration: string | null
  max_guests: number | null
  media_type: 'image' | 'video' | 'none'
  media_url: string | null
  thumbnail_url: string | null
  provider: {
    id: string
    name: string
    slug: string | null
    city: string
    category: string
    rating: number
    total_reviews: number
    photo_url: string | null
    photo_idx: number
  }
}

function ServiciosContent() {
  const sp     = useSearchParams()
  const router = useRouter()

  const [services,  setServices]  = useState<Service[]>([])
  const [loading,   setLoading]   = useState(true)
  const [filterCat, setFilterCat] = useState(sp?.get('categoria') || '')
  const [filterCity,setFilterCity]= useState(sp?.get('ciudad')    || '')
  const [filterDate,setFilterDate]= useState(sp?.get('fecha')     || '')
  const [search,    setSearch]    = useState(sp?.get('q')         || '')
  const [sortBy,    setSortBy]    = useState<'price_asc'|'price_desc'|'rating'|'recent'>('rating')

  const today = new Date().toISOString().slice(0, 10)

  const fetchServices = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filterCat)  params.set('categoria', filterCat)
    if (filterCity) params.set('ciudad', filterCity)
    if (search)     params.set('q', search)
    if (filterDate) params.set('fecha', filterDate)
    params.set('only_priced', '1')
    const res  = await fetch(`/api/services?${params}`)
    const data = await res.json()
    setServices(data.services || [])
    setLoading(false)
    const urlParams = new URLSearchParams()
    if (filterCat)  urlParams.set('categoria', filterCat)
    if (filterCity) urlParams.set('ciudad', filterCity)
    if (search)     urlParams.set('q', search)
    if (filterDate) urlParams.set('fecha', filterDate)
    router.replace(`/servicios${urlParams.toString() ? `?${urlParams}` : ''}`, { scroll: false })
  }, [filterCat, filterCity, search, filterDate, router])

  useEffect(() => { fetchServices() }, [fetchServices])

  const sorted = [...services].sort((a, b) => {
    if (sortBy === 'price_asc')  return a.price - b.price
    if (sortBy === 'price_desc') return b.price - a.price
    if (sortBy === 'rating')     return (b.provider?.rating || 0) - (a.provider?.rating || 0)
    return 0
  })

  const visible = sorted.filter(s => !filterCat || s.provider?.category === filterCat)

  return (
    <main>
      {/* CATEGORIES STRIP (Airbnb-style sticky) */}
      <section className="sticky top-16 z-30 bg-white/95 backdrop-blur-sm border-b border-stone-200/70">
        <div className="max-w-7xl mx-auto px-2 md:px-6 py-3 overflow-x-auto scrollbar-hide">
          <div className="flex gap-7 md:gap-10 px-3 min-w-fit">
            <button onClick={() => setFilterCat('')}
              className={`group flex flex-col items-center gap-1.5 pb-2.5 border-b-2 whitespace-nowrap transition-colors ${
                !filterCat ? 'text-ink border-ink' : 'text-ink/55 border-transparent hover:text-ink hover:border-stone-300'
              }`}>
              <span className="text-2xl">✨</span>
              <span className="text-[11px] font-medium tracking-wide">Todos</span>
            </button>
            {CATEGORIES.map((c: any) => (
              <button key={c.id} onClick={() => setFilterCat(filterCat === c.id ? '' : c.id)}
                className={`group flex flex-col items-center gap-1.5 pb-2.5 border-b-2 whitespace-nowrap transition-colors ${
                  filterCat === c.id ? 'text-ink border-ink' : 'text-ink/55 border-transparent hover:text-ink hover:border-stone-300'
                }`}>
                <span className="text-2xl">{c.icon}</span>
                <span className="text-[11px] font-medium tracking-wide">{c.label.split(' & ')[0]}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-6 pt-10 pb-20">
        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
          <div>
            <h1 className="font-serif text-3xl md:text-4xl text-ink leading-tight tracking-tight">
              Servicios <span className="italic font-light">listos para reservar</span>
            </h1>
            <p className="text-ink/55 text-sm mt-2">
              Todos con precio cerrado. Sin negociaciones, sin presupuestos. Eliges, reservas, y a celebrar.
            </p>
          </div>

          {/* Sort + Counter */}
          <div className="flex items-center gap-3 text-sm">
            <span className="text-ink/45 text-xs">{visible.length} resultado{visible.length !== 1 ? 's' : ''}</span>
            <select value={sortBy} onChange={e => setSortBy(e.target.value as any)}
              className="border border-stone-200 rounded-xl text-xs py-2 px-3 bg-white text-ink outline-none focus:border-ink">
              <option value="rating">Mejor valorados</option>
              <option value="price_asc">Precio ↑</option>
              <option value="price_desc">Precio ↓</option>
              <option value="recent">Más recientes</option>
            </select>
          </div>
        </div>

        {/* FILTER BAR */}
        <div className="flex flex-col sm:flex-row gap-2 mb-10">
          <div className="flex flex-1 items-center border border-stone-200 rounded-xl bg-white">
            <span className="px-3 text-stone-400 text-sm">🔍</span>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nombre o descripción..."
              className="flex-1 border-0 outline-none text-sm py-2.5 bg-transparent text-ink"/>
          </div>
          <select value={filterCity} onChange={e => setFilterCity(e.target.value)}
            className="border border-stone-200 rounded-xl text-sm py-2.5 px-3 bg-white text-ink outline-none sm:w-44 focus:border-ink">
            <option value="">Cualquier ciudad</option>
            {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <div className="flex items-center border border-stone-200 rounded-xl bg-white sm:w-44">
            <span className="px-3 text-stone-400 text-sm">📅</span>
            <input type="date" min={today} value={filterDate}
              onChange={e => setFilterDate(e.target.value)}
              className="flex-1 border-0 outline-none text-sm py-2.5 bg-transparent text-ink pr-2"/>
            {filterDate && (
              <button onClick={() => setFilterDate('')}
                className="text-xs text-ink/40 hover:text-ink px-2"
                title="Quitar fecha">×</button>
            )}
          </div>
        </div>

        {/* RESULTS */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-5 gap-y-10">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i}>
                <div className="aspect-square rounded-2xl bg-stone-100 animate-pulse mb-3"/>
                <div className="h-3 bg-stone-100 rounded animate-pulse mb-2 w-3/4"/>
                <div className="h-3 bg-stone-100 rounded animate-pulse w-1/2"/>
              </div>
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">✨</div>
            <div className="font-serif text-3xl text-ink mb-3">No hay resultados</div>
            <p className="text-ink/55 text-sm mb-6 max-w-md mx-auto">Prueba con otra ciudad, otra categoría o vuelve pronto — los profesionales están subiendo nuevos servicios cada semana.</p>
            <Link href="/" className="inline-block text-sm font-semibold text-ink underline underline-offset-4 hover:text-coral transition-colors">
              ← Volver al inicio
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-5 gap-y-10">
            {visible.map(svc => {
              const cat = CATEGORIES.find((c: any) => c.id === svc.provider?.category)
              const providerKey = svc.provider?.slug || svc.provider?.id
              return (
                <Link key={svc.id}
                  href={providerKey ? `/proveedores/${providerKey}?svc=${svc.id}` : '#'}
                  className="group block">
                  <div className="relative aspect-square rounded-2xl overflow-hidden bg-stone-100 mb-3">
                    {svc.media_url && svc.media_type === 'video' ? (
                      <video src={svc.media_url} muted loop autoPlay playsInline
                        className="w-full h-full object-cover" />
                    ) : (
                      <img src={svc.media_url || getPhoto(svc.provider?.category || 'party', 0, 600, 600)} alt={svc.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        onError={e => { (e.target as HTMLImageElement).src = `https://picsum.photos/seed/${svc.id}/600/600` }}/>
                    )}
                  </div>
                  <div>
                    <div className="flex items-baseline justify-between gap-2 mb-0.5">
                      <h3 className="font-medium text-ink text-[15px] truncate">{svc.name}</h3>
                      {svc.provider?.rating > 0 && (
                        <span className="text-xs text-ink/70 whitespace-nowrap">★ {Number(svc.provider.rating).toFixed(1)}</span>
                      )}
                    </div>
                    <div className="text-sm text-ink/55 mb-1.5">
                      {cat?.label || ''} · {svc.provider?.city}
                    </div>
                    <div className="text-sm text-ink">
                      <span className="font-semibold">{svc.price.toLocaleString()}€</span>
                      <span className="text-ink/50"> {svc.price_unit}</span>
                    </div>
                    {(svc.duration || svc.max_guests != null) && (
                      <div className="flex gap-2 mt-1.5 text-[10px] text-ink/45">
                        {svc.duration && <span>⏱ {svc.duration}</span>}
                        {svc.max_guests != null && <span>· 👥 hasta {svc.max_guests}</span>}
                      </div>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}

export default function ServiciosPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-ink/40">Cargando...</div>}>
      <ServiciosContent />
    </Suspense>
  )
}
