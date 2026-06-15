'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { CATEGORIES, getPhoto } from '@/lib/constants'
import { precioCliente, formatEuro, textoGarantiaIncluida } from '@/lib/pricing'
import FavoriteButton from '../../_components/FavoriteButton'

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
  date_held: string | null
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

export default function EventoRealDetail() {
  const params  = useParams<{ slug: string }>()
  const slug    = params?.slug as string
  const [gallery,   setGallery]   = useState<Gallery | null>(null)
  const [providers, setProviders] = useState<any[]>([])
  const [loading,   setLoading]   = useState(true)
  const [activePhoto, setActivePhoto] = useState<string | null>(null)

  useEffect(() => {
    if (!slug) return
    fetch(`/api/event-galleries?slug=${slug}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) { setLoading(false); return }
        setGallery(d.gallery)
        setProviders(d.providers || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [slug])

  if (loading) return <main className="bg-cream min-h-screen py-20 text-center text-ink/55">Cargando…</main>
  if (!gallery) return (
    <main className="bg-cream min-h-screen py-20 text-center">
      <div className="text-5xl mb-3">🤷‍♀️</div>
      <h2 className="font-serif text-xl text-ink mb-2">Evento no encontrado</h2>
      <Link href="/eventos-reales" className="text-coral underline">← Volver a la galería</Link>
    </main>
  )

  const event = EVENT_LABELS[gallery.event_type] || { label: gallery.event_type, icon: '🎉' }
  const allPhotos = [gallery.cover_photo_url, ...(gallery.photos || [])].filter(Boolean)

  return (
    <>
      {/* Lightbox al hacer click en una foto */}
      {activePhoto && (
        <div onClick={() => setActivePhoto(null)}
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4 cursor-zoom-out">
          <img src={activePhoto} alt="" className="max-w-full max-h-full rounded-xl"/>
          <button onClick={() => setActivePhoto(null)}
            className="absolute top-4 right-4 text-white text-2xl w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center">
            ×
          </button>
        </div>
      )}

      <main className="bg-cream min-h-screen">
        {/* Hero con foto principal */}
        <section className="relative h-[55vh] min-h-[400px] max-h-[600px] overflow-hidden">
          <img src={gallery.cover_photo_url} alt={gallery.title}
            className="w-full h-full object-cover"/>
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent"/>
          <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10">
            <div className="max-w-5xl mx-auto">
              <Link href="/eventos-reales" className="inline-block text-xs text-white/85 hover:text-white mb-3">
                ← Volver
              </Link>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-white text-ink flex items-center gap-1">
                  <span>{event.icon}</span> {event.label}
                </span>
                {gallery.vibe && (
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-coral text-white capitalize">
                    {gallery.vibe}
                  </span>
                )}
              </div>
              <h1 className="font-serif text-3xl md:text-5xl font-bold text-white leading-tight tracking-tight drop-shadow-lg">
                {gallery.title}
              </h1>
              <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-white/90 mt-3 drop-shadow">
                <span>📍 {gallery.city}</span>
                {gallery.guests && <span>👥 {gallery.guests} invitados</span>}
                {gallery.date_held && <span>📅 {new Date(gallery.date_held).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}</span>}
              </div>
            </div>
          </div>
        </section>

        {/* Descripción */}
        {gallery.description && (
          <section className="max-w-3xl mx-auto px-6 py-10">
            <p className="font-serif text-lg md:text-xl text-ink/85 leading-relaxed">
              {gallery.description}
            </p>
          </section>
        )}

        {/* Mosaico de fotos */}
        {allPhotos.length > 1 && (
          <section className="max-w-5xl mx-auto px-6 pb-10">
            <h2 className="font-serif text-2xl text-ink font-bold mb-4">El día en fotos</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {allPhotos.map((url, i) => (
                <button key={i} onClick={() => setActivePhoto(url)}
                  className="relative aspect-square overflow-hidden rounded-xl bg-stone-100 group cursor-zoom-in">
                  <img src={url} alt={`Foto ${i + 1}`}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"/>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Proveedores que participaron */}
        {providers.length > 0 && (
          <section className="bg-white border-t border-stone-200 py-12">
            <div className="max-w-5xl mx-auto px-6">
              <h2 className="font-serif text-2xl md:text-3xl text-ink font-bold mb-2">
                Proveedores que hicieron este evento
              </h2>
              <p className="text-sm text-ink/60 mb-6">
                Reserva a los mismos para tener un resultado similar.
              </p>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {providers.map(p => {
                  const cat = CATEGORIES.find(c => c.id === p.category)
                  return (
                    <div key={p.id} className="bg-cream/40 border border-stone-200 rounded-2xl overflow-hidden flex flex-col">
                      <Link href={`/proveedores/${p.slug || p.id}`} className="block relative h-32 bg-stone-100 overflow-hidden">
                        <img src={p.photo_url || getPhoto(p.category, p.photo_idx || 0, 400, 250)} alt={p.name}
                          className="w-full h-full object-cover hover:scale-105 transition-transform"/>
                      </Link>
                      <div className="p-3 flex-1 flex flex-col">
                        <div className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: cat?.color || '#E8553E' }}>
                          {cat?.icon} {cat?.label}
                        </div>
                        <Link href={`/proveedores/${p.slug || p.id}`}>
                          <h3 className="font-serif text-base font-bold text-ink hover:text-coral">{p.name}</h3>
                        </Link>
                        <div className="text-xs text-ink/55 mb-2">📍 {p.city}</div>
                        <div className="flex items-center justify-between mt-auto gap-2">
                          {p.price_base ? (
                            <div title={textoGarantiaIncluida(p.price_base)}>
                              <span className="text-[10px] text-ink/40">desde </span>
                              <span className="font-serif font-bold" style={{ color: cat?.color || '#E8553E' }}>
                                {formatEuro(precioCliente(p.price_base))}
                              </span>
                              <div className="text-[10px] text-ink/45">garantía incl.</div>
                            </div>
                          ) : <span className="text-xs text-ink/40">Consultar</span>}
                          <FavoriteButton providerId={p.id} variant="inline"/>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </section>
        )}

        {/* CTA final */}
        <section className="bg-gradient-to-br from-coral to-coral-dark text-white">
          <div className="max-w-3xl mx-auto px-6 py-12 text-center">
            <h2 className="font-serif text-2xl md:text-3xl font-bold leading-tight">
              ¿Quieres un evento como éste?
            </h2>
            <p className="text-sm md:text-base opacity-90 mt-2">
              Reserva los proveedores que más te encajen — con Garantía de Éxito incluida.
            </p>
            <div className="mt-6 flex gap-3 justify-center flex-wrap">
              <Link href="/quiz" className="bg-white text-coral font-bold px-6 py-3 rounded-xl text-sm hover:bg-cream transition-colors">
                ✨ Quiz: encuentra tu proveedor ideal
              </Link>
              <Link href="/calculadora" className="border border-white/40 text-white font-bold px-6 py-3 rounded-xl text-sm hover:bg-white/10 transition-colors">
                🧮 Calcular presupuesto
              </Link>
            </div>
          </div>
        </section>
      </main>
    </>
  )
}
