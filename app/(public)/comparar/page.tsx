'use client'

import { Suspense, useState, useEffect } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { getPhoto, CATEGORIES } from '@/lib/constants'
import { precioCliente, formatEuro, textoGarantiaIncluida } from '@/lib/pricing'
import { toggleFavorite, useIsFavorite } from '@/lib/favorites'
import toast from 'react-hot-toast'

type Provider = {
  id: string
  slug?: string
  name: string
  category: string
  city: string
  description: string | null
  short_desc: string | null
  price_base: number | null
  price_unit: string
  rating: number
  total_reviews: number
  total_bookings: number
  verified: boolean
  featured: boolean
  specialties: string[]
  photo_url: string | null
  photo_idx: number
}

// Filas de la tabla comparativa. Cada una recibe la lista de
// providers y renderiza una celda por cada uno.
type Row = {
  key: string
  label: string
  render: (p: Provider) => React.ReactNode
}

function buildRows(): Row[] {
  return [
    {
      key: 'price', label: 'Precio',
      render: p => p.price_base
        ? (
          <span title={textoGarantiaIncluida(p.price_base)}>
            <span className="font-serif text-xl font-bold text-coral">{formatEuro(precioCliente(p.price_base))} <span className="text-xs text-ink/50 font-sans font-normal">{p.price_unit}</span></span>
            <span className="block text-[10px] text-ink/45 font-sans font-normal mt-0.5">{textoGarantiaIncluida(p.price_base)}</span>
          </span>
        )
        : <span className="text-ink/50 text-sm">Bajo presupuesto</span>
    },
    {
      key: 'rating', label: 'Valoración',
      render: p => p.rating > 0
        ? <span className="flex items-center gap-1 text-sm"><span className="text-gold">★</span><span className="font-bold">{Number(p.rating).toFixed(1)}</span><span className="text-ink/55">({p.total_reviews})</span></span>
        : <span className="text-ink/40 text-sm">Sin reseñas aún</span>
    },
    {
      key: 'city', label: 'Ciudad',
      render: p => <span className="text-sm">📍 {p.city}</span>
    },
    {
      key: 'bookings', label: 'Reservas',
      render: p => p.total_bookings > 0
        ? <span className="text-sm">{p.total_bookings} {p.total_bookings === 1 ? 'reserva' : 'reservas'}</span>
        : <span className="text-ink/40 text-sm">Aún sin reservas</span>
    },
    {
      key: 'verified', label: 'Verificado',
      render: p => p.verified
        ? <span className="text-sm text-emerald-700 font-semibold">🛡️ Sí</span>
        : <span className="text-ink/40 text-sm">—</span>
    },
    {
      key: 'specialties', label: 'Especialidades',
      render: p => (p.specialties && p.specialties.length > 0)
        ? (
          <div className="flex flex-wrap gap-1">
            {p.specialties.slice(0, 6).map(s => (
              <span key={s} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-stone-100 text-ink/70">{s}</span>
            ))}
          </div>
        )
        : <span className="text-ink/40 text-sm">—</span>
    },
    {
      key: 'description', label: 'Descripción',
      render: p => (
        <p className="text-xs text-ink/65 leading-relaxed line-clamp-5">
          {p.short_desc || p.description || <span className="text-ink/40">Sin descripción.</span>}
        </p>
      )
    },
    {
      key: 'guarantee', label: 'Garantía de Éxito',
      render: () => <span className="text-sm text-emerald-700">✓ Incluida (la paga el cliente)</span>
    },
  ]
}

function FavToggle({ id }: { id: string }) {
  const isFav = useIsFavorite(id)
  return (
    <button onClick={() => {
        const nowFav = toggleFavorite(id)
        toast.success(nowFav ? 'Guardado en favoritos' : 'Quitado de favoritos')
      }}
      className={`text-xs px-3 py-1.5 rounded-lg border font-semibold transition-colors
        ${isFav ? 'bg-coral/10 border-coral text-coral' : 'border-stone-200 text-ink/65 hover:border-coral hover:text-coral'}`}>
      {isFav ? '❤️ Guardado' : '🤍 Guardar'}
    </button>
  )
}

function CompararContent() {
  const params = useSearchParams()
  const idsParam = params.get('ids') || ''
  const ids = idsParam.split(',').map(s => s.trim()).filter(Boolean).slice(0, 4)

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
      // Preserva el orden de la URL para que el cliente vea sus opciones
      // en el orden en que las marcó.
      setProviders(results.filter((p): p is Provider => !!p))
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [idsParam])

  const rows = buildRows()

  return (
    <main className="bg-cream min-h-screen">
      <div className="max-w-6xl mx-auto px-6 py-8 md:py-12">
        <Link href="/favoritos" className="inline-flex items-center gap-2 text-sm text-ink/55 hover:text-ink mb-3 transition-colors">
          ← Volver a favoritos
        </Link>
        <div className="flex items-end justify-between flex-wrap gap-3 mb-8">
          <div>
            <h1 className="font-serif text-3xl md:text-4xl text-ink leading-tight">
              Comparar proveedores
            </h1>
            <p className="text-ink/60 text-sm mt-2">
              {loading ? 'Cargando…'
                : providers.length < 2
                  ? 'Para comparar necesitas al menos 2 proveedores en tu shortlist.'
                  : `Mira lado a lado los ${providers.length} que has seleccionado.`}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="py-20 text-center text-ink/55">Cargando…</div>
        ) : providers.length === 0 ? (
          <div className="bg-white rounded-2xl border border-stone-200 p-10 text-center">
            <div className="text-5xl mb-4">🤷‍♀️</div>
            <h2 className="font-serif text-xl text-ink mb-3">No hay proveedores que comparar</h2>
            <p className="text-ink/55 mb-6 max-w-md mx-auto">
              Guarda algunos como favoritos y vuelve aquí para verlos lado a lado.
            </p>
            <Link href="/proveedores"
              className="inline-block bg-coral text-white font-bold px-6 py-2.5 rounded-xl text-sm hover:bg-coral-dark transition-colors">
              Explorar el catálogo
            </Link>
          </div>
        ) : (
          // Tabla scrollable en horizontal en móvil. Cada provider ocupa
          // una columna; las filas son atributos.
          <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead>
                  <tr className="border-b border-stone-200">
                    <th className="sticky left-0 bg-white z-10 text-left text-xs font-bold text-ink/55 uppercase tracking-wide p-4 w-32 align-bottom">
                      <span className="text-ink/40">Compara</span>
                    </th>
                    {providers.map(p => {
                      const cat = CATEGORIES.find(c => c.id === p.category)
                      return (
                        <th key={p.id} className="text-left p-4 align-bottom min-w-[220px]">
                          <Link href={`/proveedores/${p.id}`} className="block group">
                            <div className="h-32 rounded-xl overflow-hidden bg-stone-100 mb-3">
                              <img src={p.photo_url || getPhoto(p.category, p.photo_idx || 0, 400, 250)} alt={p.name}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"/>
                            </div>
                            <div className="text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: cat?.color || '#E8553E' }}>
                              {cat?.icon} {cat?.label}
                            </div>
                            <div className="font-serif text-base font-bold text-ink group-hover:text-coral transition-colors leading-tight">{p.name}</div>
                          </Link>
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={row.key} className={i % 2 === 0 ? 'bg-cream/40' : 'bg-white'}>
                      <td className="sticky left-0 z-10 text-xs font-bold text-ink/65 uppercase tracking-wide p-4 align-top w-32"
                        style={{ background: i % 2 === 0 ? '#FBF7F0' : '#FFFFFF' }}>
                        {row.label}
                      </td>
                      {providers.map(p => (
                        <td key={p.id} className="p-4 align-top text-ink/80">
                          {row.render(p)}
                        </td>
                      ))}
                    </tr>
                  ))}
                  <tr className="border-t border-stone-200">
                    <td className="sticky left-0 bg-white p-4"></td>
                    {providers.map(p => (
                      <td key={p.id} className="p-4 space-y-2">
                        <Link href={`/proveedores/${p.id}`}
                          className="block text-center bg-coral text-white font-bold py-2 rounded-lg text-sm hover:bg-coral-dark transition-colors">
                          Ver y reservar
                        </Link>
                        <FavToggle id={p.id}/>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

export default function CompararPage() {
  return (
    <Suspense fallback={<main className="bg-cream min-h-screen py-20 text-center text-ink/55">Cargando…</main>}>
      <CompararContent/>
    </Suspense>
  )
}
