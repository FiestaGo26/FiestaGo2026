'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { getPhoto, CATEGORIES, CITIES } from '@/lib/constants'

type Provider = {
  id: string
  name: string
  category: string
  city: string
  description: string | null
  price_base: number | null
  price_unit: string
  tag: string | null
  rating: number
  total_reviews: number
  featured: boolean
  verified: boolean
  photo_idx: number
  specialties: string[]
}

const TAG_COLORS: Record<string, string> = {
  'Top vendedor':  '#3D7A52',
  'Más reservado': '#1F4E79',
  'Premium':       '#7C3AED',
  'Nuevo':         '#C8860A',
}

export default function ProveedoresPage() {
  const [providers,  setProviders]  = useState<Provider[]>([])
  const [loading,    setLoading]    = useState(true)
  const [filterCat,  setFilterCat]  = useState('')
  const [filterCity, setFilterCity] = useState('')
  const [search,     setSearch]     = useState('')
  const [sortBy,     setSortBy]     = useState('featured')

  const fetchProviders = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterCat)  params.set('category', filterCat)
      if (filterCity) params.set('city', filterCity)
      params.set('limit', '100')
      const res  = await fetch(`/api/providers?${params}`)
      const data = await res.json()
      setProviders(data.providers || [])
    } catch (err) {
      console.error(err)
    }
    setLoading(false)
  }, [filterCat, filterCity])

  useEffect(() => { fetchProviders() }, [fetchProviders])

  const filtered = providers
    .filter(p => {
      if (!search) return true
      const q = search.toLowerCase()
      return p.name.toLowerCase().includes(q) ||
             p.description?.toLowerCase().includes(q) ||
             p.city.toLowerCase().includes(q)
    })
    .sort((a, b) => {
      if (sortBy === 'featured')   return (b.featured ? 1 : 0) - (a.featured ? 1 : 0)
      if (sortBy === 'rating')     return (b.rating || 0) - (a.rating || 0)
      if (sortBy === 'price_asc')  return (a.price_base || 0) - (b.price_base || 0)
      if (sortBy === 'price_desc') return (b.price_base || 0) - (a.price_base || 0)
      return 0
    })

  const activeCat = CATEGORIES.find(c => c.id === filterCat)

  return (
    <div className="min-h-screen bg-cream">
      <div className="bg-white border-b border-stone-200 py-10 px-6">
        <div className="max-w-6xl mx-auto">
          <h1 className="font-serif text-4xl font-black text-ink tracking-tight mb-3">
            {activeCat ? `${activeCat.icon} ${activeCat.label}` : 'Todos los proveedores'}
          </h1>
          <p className="text-ink/55 text-base">
            {filtered.length} profesional{filtered.length !== 1 ? 'es' : ''} verificado{filtered.length !== 1 ? 's' : ''}
            {filterCity ? ` en ${filterCity}` : ' en toda España'}
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-8 items-center">
          <div className="flex-1 min-w-[200px] relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/40">🔍</span>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nombre, servicio..."
              className="w-full pl-9 pr-4 py-2.5 border border-stone-200 rounded-xl text-sm text-ink bg-white outline-none focus:border-coral transition-colors"/>
          </div>
          <select value={filterCity} onChange={e => setFilterCity(e.target.value)}
            className="border border-stone-200 rounded-xl px-3 py-2.5 text-sm text-ink bg-white outline-none">
            <option value="">📍 Todas las ciudades</option>
            {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={sortBy} onChange={e => setSortBy(e.target.value)}
            className="border border-stone-200 rounded-xl px-3 py-2.5 text-sm text-ink bg-white outline-none">
            <option value="featured">⭐ Destacados primero</option>
            <option value="rating">🏆 Mejor valorados</option>
            <option value="price_asc">💶 Precio: menor a mayor</option>
            <option value="price_desc">💶 Precio: mayor a menor</option>
          </select>
          {filterCat && (
            <button onClick={() => setFilterCat('')}
              className="text-sm text-ink/60 border border-stone-200 rounded-xl px-3 py-2.5 bg-white hover:border-coral hover:text-coral transition-colors">
              ✕ Quitar filtro
            </button>
          )}
        </div>

        {/* Category pills */}
        <div className="flex gap-2 flex-wrap mb-8">
          <button onClick={() => setFilterCat('')}
            className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
              filterCat === '' ? 'bg-ink text-white border-ink' : 'bg-white text-ink/60 border-stone-200'
            }`}>
            Todos
          </button>
          {CATEGORIES.map(cat => (
            <button key={cat.id} onClick={() => setFilterCat(cat.id)}
              className="text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors"
              style={{
                background:  filterCat === cat.id ? cat.color : '#fff',
                color:       filterCat === cat.id ? '#fff' : cat.color,
                borderColor: filterCat === cat.id ? cat.color : cat.color + '44',
              }}>
              {cat.icon} {cat.label}
            </button>
          ))}
        </div>

        {/* Grid */}
        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1,2,3,4,5,6].map(i => (
              <div key={i} className="bg-white rounded-2xl overflow-hidden animate-pulse">
                <div className="h-48 bg-stone-200"/>
                <div className="p-4">
                  <div className="h-4 bg-stone-200 rounded mb-2 w-3/4"/>
                  <div className="h-3 bg-stone-100 rounded w-1/2"/>
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">😔</div>
            <h3 className="font-serif text-xl font-bold text-ink mb-2">Sin resultados</h3>
            <p className="text-ink/55 mb-6">
              No hay proveedores{filterCity ? ` en ${filterCity}` : ''} para esta categoría todavía.
            </p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => { setFilterCat(''); setFilterCity(''); setSearch('') }}
                className="bg-coral text-white font-bold px-6 py-2.5 rounded-xl text-sm">
                Ver todos los proveedores
              </button>
              <Link href="/registro-proveedor"
                className="border border-stone-200 text-ink font-semibold px-6 py-2.5 rounded-xl text-sm hover:border-coral hover:text-coral transition-colors">
                Registrar mi negocio
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map(p => {
              const cat = CATEGORIES.find(c => c.id === p.category)
              return (
                <Link key={p.id} href={`/proveedores/${p.id}`}
                  className="group bg-white border border-stone-200 rounded-2xl overflow-hidden hover:-translate-y-1 hover:shadow-xl transition-all duration-200 flex flex-col">
                  <div className="relative h-48 overflow-hidden bg-stone-100">
                    <img src={getPhoto(p.category, p.photo_idx || 0, 600, 400)} alt={p.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={e => { (e.target as HTMLImageElement).src = `https://picsum.photos/seed/${p.id}/600/400` }}/>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent"/>
                    <div className="absolute top-3 left-3 flex gap-2">
                      {p.tag && (
                        <span className="text-xs font-bold px-2.5 py-1 rounded-full text-white"
                          style={{ background: TAG_COLORS[p.tag] || '#1C1108' }}>{p.tag}</span>
                      )}
                      {p.verified && (
                        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-white/90 text-ink">🛡️</span>
                      )}
                    </div>
                    {p.rating > 0 && (
                      <div className="absolute bottom-3 right-3 flex items-center gap-1 bg-white/90 rounded-full px-2.5 py-1">
                        <span className="text-gold text-xs">★</span>
                        <span className="text-xs font-bold text-ink">{p.rating}</span>
                      </div>
                    )}
                  </div>
                  <div className="p-4 flex flex-col flex-1">
                    <div className="text-xs font-bold uppercase tracking-wide mb-1.5" style={{ color: cat?.color || '#E8553E' }}>
                      {cat?.icon} {cat?.label}
                    </div>
                    <h3 className="font-serif text-lg font-bold text-ink mb-1">{p.name}</h3>
                    <div className="text-xs text-ink/50 mb-3">📍 {p.city}</div>
                    {p.description && (
                      <p className="text-xs text-ink/55 leading-relaxed mb-4 line-clamp-2 flex-1">{p.description}</p>
                    )}
                    <div className="flex justify-between items-center border-t border-stone-100 pt-3 mt-auto">
                      <div>
                        {p.price_base ? (
                          <>
                            <span className="text-xs text-ink/40">desde </span>
                            <span className="font-serif text-lg font-bold" style={{ color: cat?.color || '#E8553E' }}>
                              {p.price_base.toLocaleString()}€
                            </span>
                            <span className="text-xs text-ink/40"> {p.price_unit}</span>
                          </>
                        ) : (
                          <span className="text-sm text-ink/40">Precio a consultar</span>
                        )}
                      </div>
                      <span className="text-xs font-bold text-coral group-hover:underline">Ver perfil →</span>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}

        <div className="mt-16 bg-white border border-stone-200 rounded-3xl p-8 text-center">
          <div className="text-3xl mb-3">🏪</div>
          <h3 className="font-serif text-2xl font-black text-ink mb-2">¿Eres proveedor?</h3>
          <p className="text-ink/55 mb-6 max-w-md mx-auto">Regístrate gratis. Primera transacción sin comisión.</p>
          <Link href="/registro-proveedor"
            className="inline-block bg-coral text-white font-bold px-8 py-3 rounded-xl hover:bg-coral-dark transition-colors">
            Registrar mi negocio gratis →
          </Link>
        </div>
      </div>
    </div>
  )
}
