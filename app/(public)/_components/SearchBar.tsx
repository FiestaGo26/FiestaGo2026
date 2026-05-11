'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const CITIES = ['Madrid','Barcelona','Valencia','Sevilla','Bilbao','Málaga','Zaragoza','Murcia']

type Tab = 'packs' | 'servicios'

const TABS: { id: Tab; label: string; icon: string; placeholder: string; cta: string }[] = [
  { id: 'packs',     label: 'Packs',     icon: '🎉', placeholder: 'Cumpleaños, boda, comunión...',      cta: 'Buscar packs' },
  { id: 'servicios', label: 'Servicios', icon: '✨', placeholder: 'Sesión foto, mago, food truck...',   cta: 'Buscar servicios' },
]

export default function SearchBar() {
  const router = useRouter()
  const [tab,    setTab]    = useState<Tab>('servicios')
  const [q,      setQ]      = useState('')
  const [ciudad, setCiudad] = useState('')
  const [fecha,  setFecha]  = useState('')

  const today = new Date().toISOString().slice(0, 10)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const params = new URLSearchParams()
    if (q)      params.set('q', q)
    if (ciudad) params.set('ciudad', ciudad)
    if (fecha)  params.set('fecha', fecha)
    params.set('tipo', tab)
    router.push(`/buscar?${params.toString()}`)
  }

  const current = TABS.find(t => t.id === tab)!

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

      {/* Search form */}
      <form onSubmit={handleSubmit}
        className="flex flex-col md:flex-row bg-white border-2 border-stone-200 rounded-2xl overflow-hidden shadow-lg">
        {/* Qué buscas */}
        <div className="flex flex-1 items-center md:border-r md:border-stone-200">
          <span className="px-4 text-xl text-stone-400">🔍</span>
          <input type="text" value={q} onChange={e => setQ(e.target.value)}
            placeholder={current.placeholder}
            className="flex-1 border-0 outline-none text-base py-4 bg-transparent text-ink font-sans pr-3"/>
        </div>

        {/* Ciudad */}
        <div className="flex items-center md:w-44 border-t md:border-t-0 md:border-r border-stone-200">
          <span className="px-4 text-xl text-stone-400">📍</span>
          <select value={ciudad} onChange={e => setCiudad(e.target.value)}
            className="flex-1 border-0 outline-none text-base py-4 bg-transparent text-ink font-sans pr-2">
            <option value="">Cualquier ciudad</option>
            {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* Fecha */}
        <div className="flex items-center md:w-44 border-t md:border-t-0 border-stone-200">
          <span className="px-4 text-xl text-stone-400">📅</span>
          <input type="date" min={today} value={fecha} onChange={e => setFecha(e.target.value)}
            className="flex-1 border-0 outline-none text-base py-4 bg-transparent text-ink font-sans pr-2"/>
        </div>

        <button type="submit"
          className="bg-coral text-white px-7 py-4 font-bold text-base hover:bg-coral-dark transition-colors whitespace-nowrap">
          {current.cta}
        </button>
      </form>
    </div>
  )
}
