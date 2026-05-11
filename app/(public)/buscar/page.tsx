'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import { getPhoto, CATEGORIES } from '@/lib/constants'

const CITIES = ['Madrid','Barcelona','Valencia','Sevilla','Bilbao','Málaga','Zaragoza','Murcia']

type Tipo = 'todo' | 'packs' | 'proveedores' | 'servicios'

function ResultsInner() {
  const sp     = useSearchParams()
  const router = useRouter()

  const [q,      setQ]      = useState(sp?.get('q') || '')
  const [ciudad, setCiudad] = useState(sp?.get('ciudad') || '')
  const [tipo,   setTipo]   = useState<Tipo>((sp?.get('tipo') as Tipo) || 'todo')

  const [data,    setData]    = useState<any>({ packs: [], providers: [], services: [], counts: { total: 0 } })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (q)      params.set('q', q)
    if (ciudad) params.set('ciudad', ciudad)
    params.set('tipo', tipo)
    fetch(`/api/search?${params}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
    // Sync URL
    router.replace(`/buscar?${params}`, { scroll: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo, ciudad])

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const params = new URLSearchParams()
    if (q)      params.set('q', q)
    if (ciudad) params.set('ciudad', ciudad)
    params.set('tipo', tipo)
    fetch(`/api/search?${params}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
    router.replace(`/buscar?${params}`, { scroll: false })
  }

  // Mezclar resultados intercalados (mejor UX para "todo")
  const mixed: any[] = []
  if (tipo === 'todo') {
    const max = Math.max(data.packs.length, data.providers.length, data.services.length)
    for (let i = 0; i < max; i++) {
      if (data.providers[i]) mixed.push(data.providers[i])
      if (data.services[i])  mixed.push(data.services[i])
      if (data.packs[i])     mixed.push(data.packs[i])
    }
  } else if (tipo === 'packs')       mixed.push(...data.packs)
  else if (tipo === 'proveedores')   mixed.push(...data.providers)
  else if (tipo === 'servicios')     mixed.push(...data.services)

  const total = data.counts?.total || 0

  return (
    <div className="min-h-screen bg-cream">
      <div className="max-w-6xl mx-auto px-6 py-10">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-ink/50 hover:text-coral mb-6 transition-colors">
          ← Volver al inicio
        </Link>

        {/* HEADER + buscador */}
        <h1 className="font-serif text-3xl md:text-4xl font-black text-ink mb-2">
          {q ? <>Resultados para <span className="italic text-coral">"{q}"</span></> : 'Encuentra todo para tu fiesta'}
        </h1>
        <p className="text-ink/55 text-sm mb-6">
          {loading ? 'Buscando...' : <>{total} {total === 1 ? 'resultado' : 'resultados'}{ciudad ? ` en ${ciudad}` : ''}</>}
        </p>

        {/* Filter bar */}
        <div className="bg-white border border-stone-200 rounded-2xl p-3 mb-6 shadow-sm">
          <form onSubmit={onSubmit} className="flex flex-col md:flex-row gap-2">
            <div className="flex flex-1 items-center border border-stone-200 rounded-xl">
              <span className="px-3 text-stone-400">🔍</span>
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="¿Qué buscas?"
                className="flex-1 border-0 outline-none text-sm py-2.5 bg-transparent text-ink"/>
            </div>
            <div className="flex items-center border border-stone-200 rounded-xl md:w-44">
              <span className="px-3 text-stone-400">📍</span>
              <select value={ciudad} onChange={e => setCiudad(e.target.value)}
                className="flex-1 border-0 outline-none text-sm py-2.5 bg-transparent text-ink">
                <option value="">Cualquier ciudad</option>
                {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <button type="submit" className="bg-coral text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-coral-dark transition-colors">
              Buscar
            </button>
          </form>
        </div>

        {/* Tipo tabs */}
        <div className="flex flex-wrap gap-2 mb-8">
          {([
            ['todo',         'Todo',         data.counts?.total || 0],
            ['packs',        'Packs',        data.counts?.packs || 0],
            ['proveedores',  'Proveedores',  data.counts?.providers || 0],
            ['servicios',    'Servicios',    data.counts?.services || 0],
          ] as [Tipo, string, number][]).map(([id, label, count]) => (
            <button key={id} onClick={() => setTipo(id)}
              className={`text-xs font-bold px-4 py-2 rounded-xl border transition-all ${
                tipo === id
                  ? 'bg-coral text-white border-coral'
                  : 'bg-white text-ink/65 border-stone-200 hover:border-coral'
              }`}>
              {label}{count > 0 && <span className={`ml-2 text-[10px] ${tipo===id ? 'opacity-90' : 'opacity-50'}`}>{count}</span>}
            </button>
          ))}
        </div>

        {/* RESULTADOS */}
        {loading ? (
          <div className="text-center py-20 text-ink/40">Cargando resultados...</div>
        ) : mixed.length === 0 ? (
          <div className="bg-white border border-stone-200 rounded-2xl p-12 text-center">
            <div className="text-5xl mb-3">🔎</div>
            <div className="font-serif text-2xl font-bold text-ink mb-2">Sin resultados</div>
            <p className="text-ink/55 text-sm mb-4">Prueba con otros términos o cambia la ciudad.</p>
            <Link href="/" className="text-coral text-sm font-semibold hover:underline">← Volver al inicio</Link>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {mixed.map((item, idx) => {
              if (item._kind === 'pack')      return <PackCard      key={`pack-${item.id}-${idx}`}     pack={item} />
              if (item._kind === 'provider')  return <ProviderCard  key={`prov-${item.id}-${idx}`}     provider={item} />
              if (item._kind === 'service')   return <ServiceCard   key={`svc-${item.id}-${idx}`}      service={item} />
              return null
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function PackCard({ pack }: { pack: any }) {
  return (
    <Link href={`/packs/${pack.slug || pack.id}`}
      className="group bg-white border border-stone-200 rounded-2xl overflow-hidden hover:-translate-y-1 hover:shadow-xl transition-all duration-200 flex flex-col">
      <div className="relative h-44 overflow-hidden bg-stone-100">
        <img src={getPhoto(pack.photo_seed || 'party', 0, 600, 400)} alt={pack.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"/>
        <div className="absolute top-2 left-2 bg-purple-600 text-white text-[10px] font-bold tracking-widest uppercase px-2 py-1 rounded-full">🎉 Pack</div>
      </div>
      <div className="p-4 flex flex-col flex-1">
        <h3 className="font-serif text-lg font-bold text-ink mb-1.5">{pack.name}</h3>
        <p className="text-xs text-ink/55 line-clamp-2 mb-3 flex-1">{pack.description}</p>
        <div className="flex justify-between items-end pt-2 border-t border-stone-100">
          <div>
            <span className="text-[10px] text-ink/40">desde </span>
            <span className="font-serif text-lg font-bold text-coral">{(pack.price || 0).toLocaleString()}€</span>
          </div>
          <span className="text-[10px] font-bold text-coral group-hover:underline">Ver pack →</span>
        </div>
      </div>
    </Link>
  )
}

function ProviderCard({ provider }: { provider: any }) {
  const cat = CATEGORIES.find((c: any) => c.id === provider.category)
  return (
    <Link href={`/proveedores/${provider.slug || provider.id}`}
      className="group bg-white border border-stone-200 rounded-2xl overflow-hidden hover:-translate-y-1 hover:shadow-xl transition-all duration-200 flex flex-col">
      <div className="relative h-44 overflow-hidden bg-stone-100">
        <img src={provider.photo_url || getPhoto(provider.category, provider.photo_idx || 0, 600, 400)} alt={provider.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          onError={e => { (e.target as HTMLImageElement).src = `https://picsum.photos/seed/${provider.id}/600/400` }}/>
        <div className="absolute top-2 left-2 bg-blue-600 text-white text-[10px] font-bold tracking-widest uppercase px-2 py-1 rounded-full">👤 Proveedor</div>
        {provider.featured && (
          <div className="absolute top-2 right-2 bg-amber-500 text-white text-[10px] font-bold tracking-widest uppercase px-2 py-1 rounded-full">⭐ DESTACADO</div>
        )}
      </div>
      <div className="p-4 flex flex-col flex-1">
        <div className="flex items-center gap-2 text-xs text-ink/45 mb-1">
          <span>{cat?.label || provider.category}</span>
          <span>·</span>
          <span>{provider.city}</span>
        </div>
        <h3 className="font-serif text-lg font-bold text-ink mb-1.5">{provider.name}</h3>
        {provider.description && (
          <p className="text-xs text-ink/55 line-clamp-2 mb-3 flex-1">{provider.description}</p>
        )}
        <div className="flex justify-between items-end pt-2 border-t border-stone-100">
          <div>
            {provider.price_base ? (
              <>
                <span className="text-[10px] text-ink/40">desde </span>
                <span className="font-serif text-lg font-bold" style={{ color: cat?.color || '#E8553E' }}>
                  {provider.price_base.toLocaleString()}€
                </span>
              </>
            ) : <span className="text-xs text-ink/40">Precio a consultar</span>}
          </div>
          <span className="text-[10px] font-bold text-coral group-hover:underline">Ver perfil →</span>
        </div>
      </div>
    </Link>
  )
}

function ServiceCard({ service }: { service: any }) {
  const cat = CATEGORIES.find((c: any) => c.id === service.provider?.category)
  const providerKey = service.provider?.slug || service.provider?.id
  return (
    <Link href={providerKey ? `/proveedores/${providerKey}#booking-form` : '#'}
      className="group bg-white border border-stone-200 rounded-2xl overflow-hidden hover:-translate-y-1 hover:shadow-xl transition-all duration-200 flex flex-col">
      <div className="relative h-44 overflow-hidden bg-stone-100">
        {service.media_url && service.media_type === 'video' ? (
          <video src={service.media_url} muted loop autoPlay playsInline
            className="w-full h-full object-cover"/>
        ) : (
          <img src={service.media_url || getPhoto(service.provider?.category || 'party', 0, 600, 400)} alt={service.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"/>
        )}
        <div className="absolute top-2 left-2 bg-emerald-600 text-white text-[10px] font-bold tracking-widest uppercase px-2 py-1 rounded-full">✨ Servicio</div>
      </div>
      <div className="p-4 flex flex-col flex-1">
        <div className="flex items-center gap-2 text-xs text-ink/45 mb-1">
          <span className="truncate">{service.provider?.name}</span>
          {service.provider?.city && <><span>·</span><span>{service.provider.city}</span></>}
        </div>
        <h3 className="font-serif text-lg font-bold text-ink mb-1.5">{service.name}</h3>
        {service.description && (
          <p className="text-xs text-ink/55 line-clamp-2 mb-3 flex-1">{service.description}</p>
        )}
        <div className="flex flex-wrap gap-1.5 mb-2">
          {service.duration && <span className="text-[10px] text-ink/55 bg-stone-100 px-2 py-0.5 rounded-full">⏱ {service.duration}</span>}
          {service.max_guests != null && <span className="text-[10px] text-ink/55 bg-stone-100 px-2 py-0.5 rounded-full">👥 {service.max_guests}</span>}
        </div>
        <div className="flex justify-between items-end pt-2 border-t border-stone-100">
          <div>
            {service.price != null ? (
              <span className="font-serif text-lg font-bold" style={{ color: cat?.color || '#E8553E' }}>
                {service.price.toLocaleString()}€
              </span>
            ) : <span className="text-xs text-ink/40">A consultar</span>}
          </div>
          <span className="text-[10px] font-bold text-coral group-hover:underline">Reservar →</span>
        </div>
      </div>
    </Link>
  )
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-cream flex items-center justify-center text-ink/40">Cargando...</div>}>
      <ResultsInner />
    </Suspense>
  )
}
