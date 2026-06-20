'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import { getPhoto } from '@/lib/constants'
import { precioCliente, formatEuro } from '@/lib/pricing'
import PackInquiryButton from './PackInquiryButton'

// Las categorías temáticas de los packs (no coinciden con CATEGORIES
// de proveedores — los packs son por tipo de EVENTO, no por servicio).
const PACK_TYPES: Array<{ id: string; label: string; emoji: string; match: (p: any) => boolean }> = [
  { id: 'todos',    label: 'Todos',                  emoji: '✨', match: () => true },
  { id: 'cumple',   label: 'Cumpleaños',             emoji: '🎂', match: p => /cumple|fiesta en casa/i.test(p.name) },
  { id: 'boda',     label: 'Bodas',                  emoji: '💍', match: p => /boda/i.test(p.name) },
  { id: 'comunion', label: 'Comuniones y bautizos',  emoji: '🕊️', match: p => /comuni|bautiz/i.test(p.name) },
  { id: 'corporativo', label: 'Eventos corporativos', emoji: '🏢', match: p => /corporativ|empresa/i.test(p.name) },
]

const CITIES = ['Madrid','Barcelona','Valencia','Sevilla','Bilbao','Málaga','Zaragoza','Murcia']

export default function PacksClient({
  packs, initialCity, initialDate,
}: {
  packs: any[]
  initialCity: string
  initialDate: string
}) {
  const [type,   setType]   = useState<string>('todos')
  const [city,   setCity]   = useState(initialCity)
  const [date,   setDate]   = useState(initialDate)

  const today = new Date().toISOString().slice(0, 10)
  const visible = useMemo(() => {
    const filter = PACK_TYPES.find(t => t.id === type)
    return packs.filter(p => filter ? filter.match(p) : true)
  }, [packs, type])

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-20">

      {/* ─── BARRA DE FILTROS ─── */}
      <div className="bg-white border border-stone-200 rounded-2xl p-3 md:p-4 mb-8 md:mb-10 shadow-sm">
        {/* Tipo de evento (chips) */}
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-2 -mx-1 px-1">
          {PACK_TYPES.map(t => (
            <button key={t.id} onClick={() => setType(t.id)}
              className={`
                shrink-0 text-xs font-bold px-3.5 py-2 rounded-xl transition-all whitespace-nowrap
                ${type === t.id
                  ? 'bg-coral text-white shadow-md'
                  : 'bg-stone-100 text-ink/70 hover:bg-stone-200'}
              `}>
              {t.emoji} {t.label}
            </button>
          ))}
        </div>

        {/* Ciudad + Fecha (preselección para el form de solicitud) */}
        <div className="grid grid-cols-2 gap-2 mt-2 pt-3 border-t border-stone-200">
          <label className="flex items-center bg-stone-100 rounded-xl px-3 py-2.5">
            <span className="text-base mr-2 shrink-0" aria-hidden="true">📍</span>
            <select value={city} onChange={e => setCity(e.target.value)}
              className={`flex-1 bg-transparent border-0 outline-none text-sm font-sans appearance-none cursor-pointer ${city ? 'text-ink font-semibold' : 'text-ink/50'}`}
              aria-label="Ciudad del evento">
              <option value="">Ciudad del evento</option>
              {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <span className="text-ink/40 ml-1 shrink-0 pointer-events-none" aria-hidden="true">▾</span>
          </label>

          <label className="flex items-center bg-stone-100 rounded-xl px-3 py-2.5">
            <span className="text-base mr-2 shrink-0" aria-hidden="true">📅</span>
            <input type="date" min={today} value={date} onChange={e => setDate(e.target.value)}
              placeholder="Fecha"
              className={`flex-1 bg-transparent border-0 outline-none text-sm font-sans min-w-0 ${date ? 'text-ink font-semibold' : 'text-ink/50'}`}
              aria-label="Fecha del evento"/>
          </label>
        </div>

        {(city || date) && (
          <p className="text-[11px] text-ink/55 mt-2.5 pl-1">
            ℹ️ {city && date ? `Tus datos (${city} · ${new Date(date).toLocaleDateString('es-ES')}) ` :
                  city      ? `Tu ciudad (${city}) ` :
                             `Tu fecha (${new Date(date).toLocaleDateString('es-ES')}) `}
            se añadirán automáticamente al solicitar el pack.
          </p>
        )}
      </div>

      {/* ─── LISTADO DE PACKS ─── */}
      {visible.length === 0 ? (
        <div className="text-center py-16 text-ink/55">
          <div className="text-4xl mb-3">🔎</div>
          <p>No hay packs en esa categoría. Prueba con otra.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
          {visible.map(pack => {
            const priceClient = precioCliente(Number(pack.price_base))
            return (
              <article key={pack.id}
                className="bg-white border border-stone-200 rounded-3xl overflow-hidden flex flex-col">

                {/* Foto */}
                <div className="relative aspect-[4/3] bg-stone-100">
                  <Image
                    src={getPhoto(pack.photo_seed || 'party', 0, 800, 600)}
                    alt={pack.name}
                    fill className="object-cover"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"/>
                  {pack.highlight && (
                    <div className="absolute top-3 left-3 bg-coral text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full">
                      {pack.highlight}
                    </div>
                  )}
                </div>

                {/* Cuerpo */}
                <div className="p-5 md:p-6 flex-1 flex flex-col">
                  <div className="flex items-start gap-3 mb-3">
                    <span className="text-3xl shrink-0 leading-none">{pack.emoji}</span>
                    <div className="min-w-0">
                      <h2 className="font-serif text-xl text-ink font-bold leading-tight">
                        {pack.name}
                      </h2>
                      {pack.duration && (
                        <div className="text-xs text-ink/50 mt-1">
                          ⏱ {pack.duration}
                          {pack.max_guests && <> · 👥 hasta {pack.max_guests} invitados</>}
                        </div>
                      )}
                    </div>
                  </div>

                  <p className="text-sm text-ink/70 leading-relaxed mb-4">
                    {pack.description}
                  </p>

                  {pack.includes && pack.includes.length > 0 && (
                    <ul className="space-y-1.5 mb-5">
                      {pack.includes.slice(0, 5).map((it: string) => (
                        <li key={it} className="flex items-start gap-2 text-xs text-ink/70 leading-snug">
                          <span className="text-coral shrink-0 mt-0.5">✓</span>
                          <span>{it}</span>
                        </li>
                      ))}
                      {pack.includes.length > 5 && (
                        <li className="text-xs text-ink/45 italic pl-5">
                          + {pack.includes.length - 5} más…
                        </li>
                      )}
                    </ul>
                  )}

                  {/* Precio + CTA */}
                  <div className="mt-auto pt-4 border-t border-stone-200">
                    <div className="flex items-baseline justify-between mb-3">
                      <div>
                        <div className="text-xs text-ink/50 uppercase tracking-wider mb-0.5">
                          Desde
                        </div>
                        <div className="font-serif text-2xl font-bold text-ink">
                          {formatEuro(priceClient)}
                        </div>
                        {pack.price_note && (
                          <div className="text-[10px] text-ink/45 mt-0.5">
                            {pack.price_note}
                          </div>
                        )}
                      </div>
                      <div className="text-[10px] text-ink/45 text-right max-w-[100px] leading-snug">
                        🛡 Garantía<br/>de Éxito<br/>incluida
                      </div>
                    </div>

                    <PackInquiryButton
                      packId={pack.id}
                      packName={pack.name}
                      packPrice={priceClient}
                      prefillCity={city}
                      prefillDate={date}/>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
