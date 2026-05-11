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
  const [search,    setSearch]    = useState(sp?.get('q')         || '')
  const [sortBy,    setSortBy]    = useState<'price_asc'|'price_desc'|'rating'|'recent'>('rating')

  const fetchServices = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filterCat)  params.set('categoria', filterCat)
    if (filterCity) params.set('ciudad', filterCity)
    if (search)     params.set('q', search)
    params.set('only_priced', '1')
    const res  = await fetch(`/api/services?${params}`)
    const data = await res.json()
    setServices(data.services || [])
    setLoading(false)
    // Sincronizar URL
    const urlParams = new URLSearchParams()
    if (filterCat)  urlParams.set('categoria', filterCat)
    if (filterCity) urlParams.set('ciudad', filterCity)
    if (search)     urlParams.set('q', search)
    router.replace(`/servicios${urlParams.toString() ? `?${urlParams}` : ''}`, { scroll: false })
  }, [filterCat, filterCity, search, router])

  useEffect(() => { fetchServices() }, [fetchServices])

  // Cliente-side sort
  const sorted = [...services].sort((a, b) => {
    if (sortBy === 'price_asc')  return a.price - b.price
    if (sortBy === 'price_desc') return b.price - a.price
    if (sortBy === 'rating')     return (b.provider?.rating || 0) - (a.provider?.rating || 0)
    return 0 // recent (orden natural del API)
  })

  return (
    <div className="min-h-screen bg-cream">
      <div className="max-w-6xl mx-auto px-6 py-10">
        {/* HEADER */}
        <div className="mb-8">
          <div className="text-xs font-bold tracking-widest uppercase text-coral mb-3">✨ Catálogo de servicios</div>
          <h1 className="font-serif text-4xl md:text-5xl font-black text-ink mb-3">
            Servicios listos para <span className="italic text-coral">reservar</span>.
          </h1>
          <p className="text-ink/55 text-base max-w-2xl">
            Todos con precio cerrado. Sin negociaciones, sin presupuestos. Eliges, reservas, y a celebrar.
          </p>
        </div>

        {/* BARRA DE FILTROS */}
        <div className="bg-white border border-stone-200 rounded-2xl p-4 mb-6 shadow-sm">
          <div className="flex flex-col md:flex-row gap-2 mb-3">
            <div className="flex flex-1 items-center border border-stone-200 rounded-xl">
              <span className="px-3 text-stone-400">🔍</span>
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por nombre o descripción..."
                className="flex-1 border-0 outline-none text-sm py-2.5 bg-transparent text-ink"/>
            </div>
            <select value={filterCity} onChange={e => setFilterCity(e.target.value)}
              className="border border-stone-200 rounded-xl text-sm py-2.5 px-3 bg-white text-ink outline-none md:w-44">
              <option value="">Todas las ciudades</option>
              {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={sortBy} onChange={e => setSortBy(e.target.value as any)}
              className="border border-stone-200 rounded-xl text-sm py-2.5 px-3 bg-white text-ink outline-none md:w-44">
              <option value="rating">Mejor valorados</option>
              <option value="price_asc">Precio ↑</option>
              <option value="price_desc">Precio ↓</option>
              <option value="recent">Más recientes</option>
            </select>
          </div>

          {/* Chips categorías */}
          <div className="flex flex-wrap gap-1.5">
            <button onClick={() => setFilterCat('')}
              className={`text-[11px] font-bold px-3 py-1.5 rounded-xl border transition-all ${
                !filterCat ? 'bg-coral text-white border-coral' : 'bg-white text-ink/60 border-stone-200 hover:border-coral'
              }`}>
              Todas
            </button>
            {CATEGORIES.map((c: any) => (
              <button key={c.id} onClick={() => setFilterCat(c.id)}
                className={`text-[11px] font-bold px-3 py-1.5 rounded-xl border transition-all ${
                  filterCat === c.id ? 'bg-coral text-white border-coral' : 'bg-white text-ink/60 border-stone-200 hover:border-coral'
                }`}>
                {c.icon ? `${c.icon} ` : ''}{c.label}
              </button>
            ))}
          </div>
        </div>

        {/* RESULTADOS */}
        {loading ? (
          <div className="text-center py-20 text-ink/40">Cargando servicios...</div>
        ) : sorted.length === 0 ? (
          <div className="bg-white border border-stone-200 rounded-2xl p-12 text-center">
            <div className="text-5xl mb-3">✨</div>
            <div className="font-serif text-2xl font-bold text-ink mb-2">No hay servicios todavía</div>
            <p className="text-ink/55 text-sm mb-4">Prueba a cambiar filtros o vuelve pronto — los profesionales están subiendo los suyos.</p>
            <Link href="/" className="text-coral text-sm font-semibold hover:underline">← Volver al inicio</Link>
          </div>
        ) : (
          <>
            <div className="mb-4 text-xs text-ink/45">
              {sorted.length} {sorted.length === 1 ? 'servicio disponible' : 'servicios disponibles'}
              {filterCity ? ` en ${filterCity}` : ''}
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {sorted.filter(s => !filterCat || s.provider?.category === filterCat).map(svc => {
                const cat = CATEGORIES.find((c: any) => c.id === svc.provider?.category)
                const providerKey = svc.provider?.slug || svc.provider?.id
                return (
                  <Link key={svc.id}
                    href={providerKey ? `/proveedores/${providerKey}?svc=${svc.id}#booking-form` : '#'}
                    className="group bg-white border border-stone-200 rounded-2xl overflow-hidden hover:-translate-y-1 hover:shadow-xl transition-all duration-200 flex flex-col">
                    <div className="relative h-44 overflow-hidden bg-stone-100">
                      {svc.media_url && svc.media_type === 'video' ? (
                        <video src={svc.media_url} muted loop autoPlay playsInline
                          className="w-full h-full object-cover"/>
                      ) : (
                        <img src={svc.media_url || getPhoto(svc.provider?.category || 'party', 0, 600, 400)} alt={svc.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          onError={e => { (e.target as HTMLImageElement).src = `https://picsum.photos/seed/${svc.id}/600/400` }}/>
                      )}
                      <div className="absolute top-2 left-2 bg-white/95 text-ink text-[10px] font-bold tracking-widest uppercase px-2 py-1 rounded-full shadow-sm">
                        {cat?.icon ? `${cat.icon} ` : ''}{cat?.label || svc.provider?.category}
                      </div>
                      <div className="absolute bottom-2 right-2 bg-coral text-white text-sm font-bold px-3 py-1 rounded-full shadow-md">
                        {svc.price.toLocaleString()}€
                      </div>
                    </div>
                    <div className="p-4 flex flex-col flex-1">
                      <div className="flex items-center gap-2 text-xs text-ink/45 mb-1">
                        <span className="truncate">{svc.provider?.name}</span>
                        {svc.provider?.city && <><span>·</span><span>{svc.provider.city}</span></>}
                      </div>
                      <h3 className="font-serif text-lg font-bold text-ink mb-1.5 line-clamp-2">{svc.name}</h3>
                      {svc.description && (
                        <p className="text-xs text-ink/55 line-clamp-2 mb-3 flex-1">{svc.description}</p>
                      )}
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {svc.duration    && <span className="text-[10px] text-ink/55 bg-stone-100 px-2 py-0.5 rounded-full">⏱ {svc.duration}</span>}
                        {svc.max_guests != null && <span className="text-[10px] text-ink/55 bg-stone-100 px-2 py-0.5 rounded-full">👥 hasta {svc.max_guests}</span>}
                        {svc.provider?.rating > 0 && (
                          <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">⭐ {Number(svc.provider.rating).toFixed(1)}</span>
                        )}
                      </div>
                      <div className="flex justify-between items-center pt-2 border-t border-stone-100">
                        <div>
                          <span className="font-serif text-xl font-bold text-coral">{svc.price.toLocaleString()}€</span>
                          <span className="text-[10px] text-ink/40 ml-1">{svc.price_unit}</span>
                        </div>
                        <span className="text-xs font-bold bg-coral/10 text-coral group-hover:bg-coral group-hover:text-white transition-colors px-3 py-1.5 rounded-xl">Reservar →</span>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function ServiciosPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-cream flex items-center justify-center text-ink/40">Cargando...</div>}>
      <ServiciosContent />
    </Suspense>
  )
}
