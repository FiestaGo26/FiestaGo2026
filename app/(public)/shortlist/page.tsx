'use client'

import { Suspense, useState, useEffect } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { getPhoto, CATEGORIES } from '@/lib/constants'
import { toggleFavorite, useIsFavorite } from '@/lib/favorites'
import toast from 'react-hot-toast'

type Provider = {
  id: string
  name: string
  category: string
  city: string
  description: string | null
  price_base: number | null
  rating: number
  total_reviews: number
  photo_url: string | null
  photo_idx: number
}

function AddToMyFavsButton({ id }: { id: string }) {
  const isFav = useIsFavorite(id)
  return (
    <button onClick={() => {
        const nowFav = toggleFavorite(id)
        toast.success(nowFav ? 'Añadido a tus favoritos' : 'Quitado de tus favoritos')
      }}
      className={`w-full mt-3 text-xs font-semibold py-2 rounded-lg border transition-colors
        ${isFav
          ? 'bg-coral/10 border-coral text-coral'
          : 'bg-white border-stone-200 text-ink/70 hover:border-coral hover:text-coral'}`}>
      {isFav ? '❤️ En tus favoritos' : '🤍 Añadir a mis favoritos'}
    </button>
  )
}

function ShortlistContent() {
  const params = useSearchParams()
  const idsParam = params.get('ids') || ''
  const ids = idsParam.split(',').map(s => s.trim()).filter(Boolean)

  const [providers, setProviders] = useState<Provider[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (ids.length === 0) {
        setProviders([])
        setLoading(false)
        return
      }
      setLoading(true)
      const results = await Promise.all(
        ids.map(id =>
          fetch(`/api/providers?id=${id}`)
            .then(r => r.ok ? r.json() : null)
            .then(j => j?.provider as Provider | null)
            .catch(() => null)
        )
      )
      if (cancelled) return
      setProviders(results.filter((p): p is Provider => !!p))
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [idsParam])

  return (
    <main className="bg-cream min-h-screen">
      <div className="max-w-6xl mx-auto px-6 py-8 md:py-12">
        <div className="mb-6">
          <Link href="/proveedores" className="inline-flex items-center gap-2 text-sm text-ink/55 hover:text-ink mb-3 transition-colors">
            ← Volver al catálogo
          </Link>
          <h1 className="font-serif text-3xl md:text-4xl text-ink leading-tight">
            Shortlist compartida
          </h1>
          <p className="text-ink/60 text-sm mt-2">
            {ids.length === 0
              ? 'Esta shortlist no tiene proveedores. ¿Te ha llegado mal el link?'
              : providers.length === 0 && !loading
                ? 'Ningún proveedor de esta lista está disponible. Es posible que el link sea antiguo.'
                : `${providers.length} proveedor${providers.length===1?'':'es'} en esta selección. Puedes guardarlos en tu propia shortlist.`}
          </p>
        </div>

        {loading ? (
          <div className="py-20 text-center text-ink/55">Cargando…</div>
        ) : providers.length === 0 ? (
          <div className="bg-white rounded-2xl border border-stone-200 p-10 text-center">
            <div className="text-5xl mb-4">🔗</div>
            <Link href="/proveedores"
              className="inline-block bg-coral text-white font-bold px-6 py-2.5 rounded-xl text-sm hover:bg-coral-dark transition-colors">
              Explorar el catálogo
            </Link>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {providers.map(p => {
              const cat = CATEGORIES.find(c => c.id === p.category)
              return (
                <div key={p.id} className="group bg-white border border-stone-200 rounded-2xl overflow-hidden flex flex-col">
                  <Link href={`/proveedores/${p.id}`} className="relative h-44 overflow-hidden bg-stone-100 block">
                    <img src={p.photo_url || getPhoto(p.category, p.photo_idx || 0, 600, 400)} alt={p.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"/>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent"/>
                    {p.rating > 0 && (
                      <div className="absolute bottom-3 right-3 flex items-center gap-1 bg-white/90 rounded-full px-2.5 py-1">
                        <span className="text-gold text-xs">★</span>
                        <span className="text-xs font-bold text-ink">{p.rating}</span>
                      </div>
                    )}
                  </Link>
                  <div className="p-4 flex flex-col flex-1">
                    <div className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: cat?.color || '#E8553E' }}>
                      {cat?.icon} {cat?.label}
                    </div>
                    <Link href={`/proveedores/${p.id}`}>
                      <h3 className="font-serif text-lg font-bold text-ink mb-1 hover:text-coral transition-colors">{p.name}</h3>
                    </Link>
                    <div className="text-xs text-ink/50 mb-3">📍 {p.city}</div>
                    {p.description && (
                      <p className="text-xs text-ink/55 leading-relaxed mb-3 line-clamp-2 flex-1">{p.description}</p>
                    )}
                    <div className="flex justify-between items-center border-t border-stone-100 pt-3 mt-auto">
                      {p.price_base ? (
                        <div>
                          <span className="text-xs text-ink/40">desde </span>
                          <span className="font-serif text-lg font-bold" style={{ color: cat?.color || '#E8553E' }}>
                            {p.price_base.toLocaleString()}€
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-ink/40">Bajo presupuesto</span>
                      )}
                    </div>
                    <AddToMyFavsButton id={p.id}/>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}

export default function ShortlistPage() {
  return (
    <Suspense fallback={<main className="bg-cream min-h-screen py-20 text-center text-ink/55">Cargando…</main>}>
      <ShortlistContent/>
    </Suspense>
  )
}
