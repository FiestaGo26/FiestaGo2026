'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { CATEGORIES } from '@/lib/constants'

type Gallery = {
  id: string
  slug: string
  title: string
  event_type: string
  city: string
  cover_photo_url: string
  description: string | null
  guests: number | null
  vibe: string | null
  featured: boolean
  photos: string[]
  provider_ids: string[]
}

const EVENT_LABELS: Record<string, { label: string; icon: string }> = {
  boda:        { label: 'Boda',         icon: '💍' },
  cumpleanos:  { label: 'Cumpleaños',   icon: '🎂' },
  comunion:    { label: 'Comunión',     icon: '✨' },
  corporativo: { label: 'Corporativo',  icon: '🏢' },
  otro:        { label: 'Otro',         icon: '🎉' },
}

export default function EventosRealesPage() {
  const [galleries, setGalleries] = useState<Gallery[]>([])
  const [loading,   setLoading]   = useState(true)
  const [filter,    setFilter]    = useState<string>('')

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ limit: '48' })
    if (filter) params.set('event_type', filter)
    const res = await fetch(`/api/event-galleries?${params}`)
    const data = await res.json()
    setGalleries(data.galleries || [])
    setLoading(false)
  }, [filter])

  useEffect(() => { load() }, [load])

  return (
    <main className="bg-cream min-h-screen">
      {/* Hero */}
      <section className="bg-gradient-to-br from-ink via-ink to-coral text-white">
        <div className="max-w-5xl mx-auto px-6 py-12 md:py-16">
          <div className="text-xs font-bold uppercase tracking-[0.25em] opacity-75 mb-2">
            Inspiración
          </div>
          <h1 className="font-serif text-3xl md:text-5xl font-bold leading-tight tracking-tight">
            Eventos reales en FiestaGo
          </h1>
          <p className="text-base md:text-lg opacity-90 mt-4 max-w-2xl leading-relaxed">
            Bodas, comuniones, cumpleaños y eventos privados llevados a cabo por nuestros profesionales.
            Toca cualquiera para ver fotos y reservar a los mismos proveedores.
          </p>
        </div>
      </section>

      {/* Filtros */}
      <section className="max-w-5xl mx-auto px-6 py-6">
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setFilter('')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-colors
              ${filter === '' ? 'bg-ink text-white border-ink' : 'bg-white text-ink/70 border-stone-200 hover:border-coral'}`}>
            Todos
          </button>
          {Object.entries(EVENT_LABELS).map(([id, opt]) => (
            <button key={id} onClick={() => setFilter(id)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-colors flex items-center gap-1.5
                ${filter === id ? 'bg-ink text-white border-ink' : 'bg-white text-ink/70 border-stone-200 hover:border-coral'}`}>
              <span>{opt.icon}</span> {opt.label}
            </button>
          ))}
        </div>
      </section>

      {/* Grilla */}
      <section className="max-w-5xl mx-auto px-6 pb-16">
        {loading ? (
          <div className="py-20 text-center text-ink/55">Cargando…</div>
        ) : galleries.length === 0 ? (
          <div className="bg-white rounded-2xl border border-stone-200 p-10 text-center">
            <div className="text-5xl mb-3">📸</div>
            <h2 className="font-serif text-xl text-ink font-bold mb-2">Aún no hay eventos publicados</h2>
            <p className="text-sm text-ink/60 mb-5 max-w-md mx-auto">
              Estamos preparando la galería para el lanzamiento del 10 de junio.
              Vuelve pronto.
            </p>
            <Link href="/proveedores" className="inline-block bg-coral text-white font-bold px-6 py-2.5 rounded-xl text-sm hover:bg-coral-dark transition-colors">
              Mientras tanto, explora proveedores
            </Link>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {galleries.map(g => {
              const event = EVENT_LABELS[g.event_type] || { label: g.event_type, icon: '🎉' }
              return (
                <Link key={g.id} href={`/eventos-reales/${g.slug}`}
                  className="group bg-white border border-stone-200 rounded-2xl overflow-hidden hover:-translate-y-1 hover:shadow-xl transition-all duration-200 flex flex-col">
                  <div className="relative h-56 overflow-hidden bg-stone-100">
                    <img src={g.cover_photo_url} alt={g.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"/>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/15 to-transparent"/>
                    <div className="absolute top-3 left-3">
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-white/95 text-ink flex items-center gap-1">
                        <span>{event.icon}</span> {event.label}
                      </span>
                    </div>
                    {g.featured && (
                      <div className="absolute top-3 right-3">
                        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-coral text-white">⭐ Destacado</span>
                      </div>
                    )}
                    <div className="absolute bottom-3 left-4 right-4">
                      <h3 className="font-serif text-lg font-bold text-white leading-tight drop-shadow-md">
                        {g.title}
                      </h3>
                      <div className="text-xs text-white/85 mt-1 flex items-center gap-3">
                        <span>📍 {g.city}</span>
                        {g.guests && <span>· {g.guests} invitados</span>}
                      </div>
                    </div>
                  </div>
                  {g.description && (
                    <div className="p-4">
                      <p className="text-xs text-ink/60 leading-relaxed line-clamp-2">{g.description}</p>
                    </div>
                  )}
                  <div className="px-4 pb-4 mt-auto">
                    <div className="text-xs font-semibold text-coral group-hover:underline">
                      Ver fotos + proveedores →
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </section>
    </main>
  )
}
