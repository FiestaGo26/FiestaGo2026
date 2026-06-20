'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CATEGORIES } from '@/lib/constants'

const CITIES = ['Madrid','Barcelona','Valencia','Sevilla','Bilbao','Málaga','Zaragoza','Murcia']

// Tipos de evento — solo aplica al tab de Packs.
const EVENT_TYPES = [
  { id: 'cumple',      label: 'Cumpleaños',             icon: '🎂' },
  { id: 'boda',        label: 'Boda',                   icon: '💍' },
  { id: 'comunion',    label: 'Comunión o bautizo',     icon: '🕊️' },
  { id: 'corporativo', label: 'Evento corporativo',     icon: '🏢' },
  { id: 'otro',        label: 'Otro tipo de evento',    icon: '✨' },
]

type Tab = 'packs' | 'servicios'

const TABS: { id: Tab; label: string; icon: string; cta: string }[] = [
  { id: 'packs',     label: 'Packs',     icon: '🎉', cta: 'Ver packs' },
  { id: 'servicios', label: 'Servicios', icon: '✨', cta: 'Buscar servicios' },
]

export default function SearchBar() {
  const router = useRouter()
  const [tab,         setTab]         = useState<Tab>('servicios')
  const [categoria,   setCategoria]   = useState('')   // solo servicios
  const [eventType,   setEventType]   = useState('')   // solo packs
  const [ciudad,      setCiudad]      = useState('')
  const [fecha,       setFecha]       = useState('')

  const today = new Date().toISOString().slice(0, 10)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const params = new URLSearchParams()
    if (ciudad) params.set('ciudad', ciudad)
    if (fecha)  params.set('fecha', fecha)
    if (tab === 'packs') {
      if (eventType) params.set('tipo', eventType)
      router.push(`/packs${params.toString() ? '?' + params.toString() : ''}`)
    } else {
      if (categoria) params.set('categoria', categoria)
      params.set('tipo', 'servicios')
      router.push(`/buscar?${params.toString()}`)
    }
  }

  const current = TABS.find(t => t.id === tab)!

  // Dispara el calendario nativo al hacer foco en el input type=date —
  // soluciona el "no salta el calendario" en Safari iOS.
  const openPicker = (e: React.SyntheticEvent<HTMLInputElement>) => {
    const el = e.currentTarget as HTMLInputElement & { showPicker?: () => void }
    try { el.showPicker?.() } catch {}
  }

  return (
    <div className="mb-5">
      {/* Tabs */}
      <div className="flex gap-1 mb-2 bg-white/70 backdrop-blur-sm border border-stone-200 rounded-2xl p-1 w-fit">
        {TABS.map(t => (
          <button key={t.id} type="button" onClick={() => setTab(t.id)}
            className={`text-xs font-bold px-4 py-2 rounded-xl transition-all ${
              tab === t.id ? 'bg-coral text-white shadow-md' : 'text-ink/60 hover:text-ink'
            }`}>
            <span className="mr-1.5">{t.icon}</span>{t.label}
          </button>
        ))}
      </div>

      {/* ─── FORM (cambia según tab) ─── */}
      <form onSubmit={handleSubmit}
        className="flex flex-col md:flex-row bg-white border-2 border-stone-200 rounded-2xl overflow-hidden shadow-lg">

        {tab === 'servicios' ? (
          // ─── SERVICIOS: categoría de servicio (foto, dj, etc) ───
          <div className="flex flex-1 items-center md:border-r md:border-stone-200 min-w-0">
            <span className="px-4 text-xl text-stone-400 shrink-0" aria-hidden="true">🔍</span>
            <select value={categoria} onChange={e => setCategoria(e.target.value)}
              className={`
                flex-1 min-w-0 border-0 outline-none py-4 bg-transparent font-sans pr-3
                appearance-none cursor-pointer
                ${categoria ? 'text-ink font-semibold' : 'text-stone-400'}
              `}
              style={{ fontSize: 16 }}
              aria-label="Categoría de servicio">
              <option value="">¿Qué necesitas? Elige categoría…</option>
              {CATEGORIES.map(c => (
                <option key={c.id} value={c.id}>
                  {c.icon} {c.label}
                </option>
              ))}
            </select>
            <span className="px-3 text-stone-400 shrink-0 pointer-events-none" aria-hidden="true">▾</span>
          </div>
        ) : (
          // ─── PACKS: tipo de evento (boda, cumple, comunión...) ───
          <div className="flex flex-1 items-center md:border-r md:border-stone-200 min-w-0">
            <span className="px-4 text-xl text-stone-400 shrink-0" aria-hidden="true">🎉</span>
            <select value={eventType} onChange={e => setEventType(e.target.value)}
              className={`
                flex-1 min-w-0 border-0 outline-none py-4 bg-transparent font-sans pr-3
                appearance-none cursor-pointer
                ${eventType ? 'text-ink font-semibold' : 'text-stone-400'}
              `}
              style={{ fontSize: 16 }}
              aria-label="Tipo de evento">
              <option value="">¿Qué celebras? Elige tipo de evento…</option>
              {EVENT_TYPES.map(t => (
                <option key={t.id} value={t.id}>
                  {t.icon} {t.label}
                </option>
              ))}
            </select>
            <span className="px-3 text-stone-400 shrink-0 pointer-events-none" aria-hidden="true">▾</span>
          </div>
        )}

        {/* Ciudad */}
        <div className="flex items-center md:w-44 border-t md:border-t-0 md:border-r border-stone-200">
          <span className="px-4 text-xl text-stone-400" aria-hidden="true">📍</span>
          <select value={ciudad} onChange={e => setCiudad(e.target.value)}
            className={`flex-1 border-0 outline-none py-4 bg-transparent font-sans pr-2 appearance-none cursor-pointer ${ciudad ? 'text-ink font-semibold' : 'text-stone-400'}`}
            style={{ fontSize: 16 }}
            aria-label="Ciudad">
            <option value="">Cualquier ciudad</option>
            {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* Fecha — toda la celda es clickable, abre picker nativo */}
        <label className="flex items-center md:w-44 border-t md:border-t-0 border-stone-200 cursor-pointer">
          <span className="px-4 text-xl text-stone-400 shrink-0" aria-hidden="true">📅</span>
          <input type="date" min={today} value={fecha}
            onChange={e => setFecha(e.target.value)}
            onClick={openPicker}
            onFocus={openPicker}
            className={`flex-1 border-0 outline-none py-4 bg-transparent font-sans pr-2 cursor-pointer min-w-0 ${fecha ? 'text-ink font-semibold' : 'text-stone-400'}`}
            style={{ fontSize: 16 }}
            aria-label="Fecha del evento"/>
        </label>

        <button type="submit"
          className="bg-coral text-white px-7 py-4 font-bold text-base hover:bg-coral-dark transition-colors whitespace-nowrap">
          {current.cta}
        </button>
      </form>

      {/* ─── Chips de acceso rápido — cambian según el tab ─── */}
      {tab === 'servicios' ? (
        <div className="hidden sm:flex flex-wrap gap-1.5 mt-3 px-1">
          <span className="text-[11px] text-white/70 self-center mr-1">Popular:</span>
          {CATEGORIES.filter((c: any) => c.hot).slice(0, 6).map((c: any) => (
            <button key={c.id} type="button"
              onClick={() => setCategoria(c.id)}
              className={`
                text-[11px] px-3 py-1 rounded-full border transition-all
                ${categoria === c.id
                  ? 'bg-coral text-white border-coral'
                  : 'bg-white/15 backdrop-blur-sm text-white border-white/30 hover:bg-white/25'}
              `}>
              {c.icon} {c.label.split(' &')[0]}
            </button>
          ))}
        </div>
      ) : (
        <div className="hidden sm:flex flex-wrap gap-1.5 mt-3 px-1">
          <span className="text-[11px] text-white/70 self-center mr-1">Más buscado:</span>
          {EVENT_TYPES.slice(0, 4).map(t => (
            <button key={t.id} type="button"
              onClick={() => setEventType(t.id)}
              className={`
                text-[11px] px-3 py-1 rounded-full border transition-all
                ${eventType === t.id
                  ? 'bg-coral text-white border-coral'
                  : 'bg-white/15 backdrop-blur-sm text-white border-white/30 hover:bg-white/25'}
              `}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
