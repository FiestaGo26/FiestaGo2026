'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getPhoto, CATEGORIES } from '@/lib/constants'
import { precioCliente, formatEuro, textoGarantiaIncluida } from '@/lib/pricing'
import { useFavorites, removeFavorite, clearFavorites } from '@/lib/favorites'
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

export default function FavoritosPage() {
  const favs = useFavorites()
  const [providers, setProviders] = useState<Provider[]>([])
  const [loading, setLoading] = useState(true)
  // Selección para comparador. Si está vacía o tiene <2, no se muestra CTA.
  // Cap a 4: más columnas no caben razonablemente en la tabla comparativa.
  const [compareSel, setCompareSel] = useState<Set<string>>(new Set())

  function toggleCompare(id: string) {
    setCompareSel(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else if (next.size < 4) next.add(id)
      else toast.error('Máximo 4 proveedores en la comparación')
      return next
    })
  }
  const compareIds = providers.filter(p => compareSel.has(p.id)).map(p => p.id)
  const compareHref = `/comparar?ids=${encodeURIComponent(compareIds.join(','))}`

  // Carga los datos públicos de cada provider favorito. Los favoritos
  // que ya no estén aprobados (status≠approved) los descarta el API y
  // se quitarán del localStorage al final del effect.
  useEffect(() => {
    let cancelled = false
    async function load() {
      if (favs.length === 0) {
        setProviders([])
        setLoading(false)
        return
      }
      setLoading(true)
      // El endpoint público solo devuelve aprobados. Pedimos uno a uno
      // (en paralelo) para que los IDs que ya no existan se ignoren.
      const results = await Promise.all(
        favs.map(id =>
          fetch(`/api/providers?id=${id}`)
            .then(r => r.ok ? r.json() : null)
            .then(j => j?.provider as Provider | null)
            .catch(() => null)
        )
      )
      if (cancelled) return
      const list = results.filter((p): p is Provider => !!p)
      setProviders(list)
      setLoading(false)

      // Limpieza: si algún favorito ya no existe en el catálogo público,
      // lo quitamos para que el contador refleje la realidad.
      const validIds = new Set(list.map(p => p.id))
      favs.filter(id => !validIds.has(id)).forEach(id => removeFavorite(id))
    }
    load()
    return () => { cancelled = true }
  }, [favs.join(',')])  // dependemos del contenido, no de la referencia

  function handleShare() {
    if (providers.length === 0) return
    const ids = providers.map(p => p.id).join(',')
    const url = `${window.location.origin}/shortlist?ids=${encodeURIComponent(ids)}`

    // Web Share API (móvil) → fallback a copiar al portapapeles
    if (navigator.share) {
      navigator.share({
        title: `Mi shortlist en FiestaGo (${providers.length} proveedores)`,
        text:  'Esta es mi selección de proveedores para mi evento. Échale un ojo.',
        url,
      }).catch(() => {/* el usuario canceló */})
      return
    }
    navigator.clipboard.writeText(url).then(
      () => toast.success('Link copiado al portapapeles'),
      () => toast.error('No se pudo copiar — el link es: ' + url),
    )
  }

  function handleClearAll() {
    if (!confirm(`¿Quitar los ${providers.length} favoritos?`)) return
    clearFavorites()
    toast.success('Favoritos vaciados')
  }

  return (
    <main className="bg-cream min-h-screen">
      <div className="max-w-6xl mx-auto px-6 py-8 md:py-12">
        <div className="flex items-end justify-between flex-wrap gap-3 mb-2">
          <div>
            <h1 className="font-serif text-3xl md:text-4xl text-ink leading-tight">
              Mis favoritos <span className="text-coral">❤️</span>
            </h1>
            <p className="text-ink/60 text-sm mt-2">
              {providers.length === 0
                ? 'Aún no has guardado ningún proveedor. Pincha el corazón en cualquier ficha para añadirlo.'
                : `Tienes ${providers.length} proveedor${providers.length===1?'':'es'} guardado${providers.length===1?'':'s'}. Comparte la lista con tu pareja, familia o quien decida contigo.`}
            </p>
          </div>
          {providers.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              <button onClick={handleShare}
                className="bg-coral text-white font-bold px-5 py-2.5 rounded-xl text-sm hover:bg-coral-dark transition-colors flex items-center gap-2">
                🔗 Compartir
              </button>
              <button onClick={handleClearAll}
                className="border border-stone-200 text-ink/70 hover:border-coral hover:text-coral font-semibold px-4 py-2.5 rounded-xl text-sm transition-colors">
                Vaciar
              </button>
            </div>
          )}
        </div>

        {loading ? (
          <div className="py-20 text-center text-ink/55">Cargando…</div>
        ) : providers.length === 0 ? (
          <div className="bg-white rounded-2xl border border-stone-200 p-10 text-center mt-6">
            <div className="text-6xl mb-4">🤍</div>
            <h2 className="font-serif text-xl text-ink mb-2">Tu shortlist está vacía</h2>
            <p className="text-ink/55 mb-6 max-w-md mx-auto">
              Explora el catálogo y guarda los proveedores que te encajen. Después podrás compararlos y compartir la lista.
            </p>
            <Link href="/proveedores"
              className="inline-block bg-coral text-white font-bold px-6 py-2.5 rounded-xl text-sm hover:bg-coral-dark transition-colors">
              Explorar proveedores
            </Link>
          </div>
        ) : (
          <>
          {providers.length >= 2 && (
            <div className="bg-white border border-stone-200 rounded-2xl p-3 px-4 mt-6 text-xs text-ink/65 flex items-center gap-2">
              <span>📊</span>
              <span>Marca 2-4 proveedores con el círculo de la esquina para compararlos lado a lado.</span>
            </div>
          )}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-6">
            {providers.map(p => {
              const cat = CATEGORIES.find(c => c.id === p.category)
              const selected = compareSel.has(p.id)
              return (
                <div key={p.id}
                  className={`group bg-white border rounded-2xl overflow-hidden flex flex-col transition-colors
                    ${selected ? 'border-coral ring-2 ring-coral/30' : 'border-stone-200'}`}>
                  <div className="relative h-44 overflow-hidden bg-stone-100">
                    <Link href={`/proveedores/${p.id}`} className="block w-full h-full">
                      <img src={p.photo_url || getPhoto(p.category, p.photo_idx || 0, 600, 400)} alt={p.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"/>
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent"/>
                    </Link>
                    {p.rating > 0 && (
                      <div className="absolute bottom-3 right-3 flex items-center gap-1 bg-white/90 rounded-full px-2.5 py-1">
                        <span className="text-gold text-xs">★</span>
                        <span className="text-xs font-bold text-ink">{p.rating}</span>
                      </div>
                    )}
                    {/* Botón de selección para comparador — círculo arriba a la izquierda */}
                    <button onClick={() => toggleCompare(p.id)}
                      aria-pressed={selected}
                      aria-label={selected ? 'Quitar de la comparación' : 'Añadir a la comparación'}
                      className={`absolute top-3 left-3 w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all shadow-sm
                        ${selected
                          ? 'bg-coral border-coral text-white'
                          : 'bg-white/90 border-white/90 text-ink/0 hover:text-coral/60'}`}>
                      <span className="text-xs font-bold leading-none">{selected ? '✓' : ''}</span>
                    </button>
                  </div>
                  <div className="p-4 flex flex-col flex-1">
                    <div className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: cat?.color || '#E8553E' }}>
                      {cat?.icon} {cat?.label}
                    </div>
                    <Link href={`/proveedores/${p.id}`}>
                      <h3 className="font-serif text-lg font-bold text-ink mb-1 hover:text-coral transition-colors">{p.name}</h3>
                    </Link>
                    <div className="text-xs text-ink/50 mb-3">📍 {p.city}</div>
                    {p.description && (
                      <p className="text-xs text-ink/55 leading-relaxed mb-4 line-clamp-2 flex-1">{p.description}</p>
                    )}
                    <div className="flex justify-between items-center border-t border-stone-100 pt-3 mt-auto gap-2">
                      <div>
                        {p.price_base ? (
                          <>
                            <span className="text-xs text-ink/40">desde </span>
                            <span className="font-serif text-lg font-bold" style={{ color: cat?.color || '#E8553E' }}
                              title={textoGarantiaIncluida(p.price_base)}>
                              {formatEuro(precioCliente(p.price_base))}
                            </span>
                            <div className="text-[10px] text-ink/45 mt-0.5">{textoGarantiaIncluida(p.price_base)}</div>
                          </>
                        ) : (
                          <span className="text-xs text-ink/40">Bajo presupuesto</span>
                        )}
                      </div>
                      <button onClick={() => removeFavorite(p.id)}
                        aria-label="Quitar de favoritos"
                        className="w-8 h-8 rounded-full border border-stone-200 hover:border-coral hover:text-coral text-ink/55 flex items-center justify-center transition-colors">
                        ✕
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          </>
        )}
      </div>

      {/* Sticky CTA de comparar cuando hay 2-4 seleccionados */}
      {compareSel.size >= 2 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 px-4 w-full max-w-md">
          <Link href={compareHref}
            className="flex items-center justify-between gap-3 bg-ink text-white rounded-2xl shadow-xl px-5 py-3 hover:bg-ink/85 transition-colors">
            <span className="text-sm font-semibold">📊 Comparar {compareSel.size} proveedores</span>
            <span className="text-xs bg-coral px-3 py-1 rounded-full font-bold">Ver tabla →</span>
          </Link>
        </div>
      )}
    </main>
  )
}
