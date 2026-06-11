'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { CATEGORIES, getPhoto } from '@/lib/constants'
import toast from 'react-hot-toast'

type ProviderItem = {
  id:            string
  slug?:         string
  name:          string
  city:          string
  category:      string
  price_base:    number
  price_unit?:   string
  rating:        number
  total_reviews: number
  photo_url?:    string | null
  photo_idx?:    number
  justification: string
}

type Pkg = {
  tier:     'economica' | 'estandar' | 'premium'
  title:    string
  subtitle: string
  estimated_total: number
  providers: ProviderItem[]
}

type Proposal = {
  id:           string
  event_type:   string
  guests:       number
  city:         string
  budget_total: number
  style:        string | null
  event_date:   string | null
  categories:   string[]
  packages:     Pkg[]
  created_at:   string
}

const EVENT_LABELS: Record<string, { label: string; icon: string }> = {
  boda:        { label: 'Boda',        icon: '💍' },
  cumpleanos:  { label: 'Cumpleaños',  icon: '🎂' },
  comunion:    { label: 'Comunión',    icon: '✨' },
  corporativo: { label: 'Corporativo', icon: '🏢' },
  otro:        { label: 'Otro',        icon: '🎉' },
}

const TIER_STYLE: Record<string, { color: string; bg: string; emoji: string }> = {
  economica: { color: '#3D7A52', bg: '#D1FAE5', emoji: '💰' },
  estandar:  { color: '#C8860A', bg: '#FEF3C7', emoji: '⭐' },
  premium:   { color: '#7C3AED', bg: '#EDE9FE', emoji: '👑' },
}

export default function MiEventoProposalPage() {
  const params = useParams()
  const id = String(params?.id || '')
  const [proposal, setProposal] = useState<Proposal | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)
  const [activeTier, setActiveTier] = useState<string>('estandar')

  useEffect(() => {
    if (!id) { setLoading(false); return }
    fetch(`/api/event-proposal/${id}`)
      .then(r => r.json().then(d => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (!ok) { setError(d.error || 'Error cargando propuesta'); setLoading(false); return }
        setProposal(d.proposal)
        // Pre-seleccionar el tier estándar si existe, si no el primero
        const tiers = (d.proposal.packages || []).map((p: Pkg) => p.tier)
        if (tiers.includes('estandar')) setActiveTier('estandar')
        else if (tiers[0]) setActiveTier(tiers[0])
        setLoading(false)
      })
      .catch(err => { setError(err.message); setLoading(false) })
  }, [id])

  async function copyLink() {
    const url = `${window.location.origin}/mi-evento/${id}`
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Enlace copiado — pégalo donde quieras compartirlo')
    } catch {
      toast.error('No se pudo copiar — copia esta URL: ' + url)
    }
  }

  if (loading) {
    return <main className="bg-cream min-h-screen grid place-items-center"><div className="text-ink/40">Cargando propuesta...</div></main>
  }
  if (error || !proposal) {
    return (
      <main className="bg-cream min-h-screen grid place-items-center p-6 text-center">
        <div>
          <div className="text-5xl mb-3">🤷</div>
          <div className="font-semibold text-ink mb-2">{error || 'No encontramos esa propuesta'}</div>
          <Link href="/calculadora" className="text-coral underline text-sm">← Crea una nueva</Link>
        </div>
      </main>
    )
  }

  const eventInfo = EVENT_LABELS[proposal.event_type] || EVENT_LABELS.otro
  const activePkg = proposal.packages.find(p => p.tier === activeTier) || proposal.packages[0]

  return (
    <main className="bg-cream min-h-screen pb-20">
      {/* Hero resumen del evento */}
      <section className="bg-ink text-white py-12 px-6">
        <div className="max-w-3xl mx-auto">
          <Link href="/calculadora" className="text-xs text-white/60 hover:text-white inline-block mb-4">
            ← Hacer otra propuesta
          </Link>
          <div className="flex items-baseline gap-3 mb-2">
            <span className="text-3xl">{eventInfo.icon}</span>
            <h1 className="font-serif text-3xl md:text-4xl font-black leading-tight">
              Tu equipo para esta {eventInfo.label.toLowerCase()}
            </h1>
          </div>
          <div className="flex flex-wrap gap-3 text-sm text-white/75 mt-4">
            <Chip>📍 {proposal.city}</Chip>
            <Chip>👥 {proposal.guests} invitados</Chip>
            <Chip>💶 {proposal.budget_total.toLocaleString()}€ presupuesto</Chip>
            {proposal.style && <Chip>🎨 Estilo {proposal.style}</Chip>}
            {proposal.event_date && <Chip>📅 {new Date(proposal.event_date).toLocaleDateString('es-ES')}</Chip>}
          </div>
        </div>
      </section>

      {/* Selector de tier */}
      <section className="max-w-4xl mx-auto px-6 -mt-6">
        <div className="bg-white border border-stone-200 rounded-2xl p-3 shadow-card flex gap-2 overflow-x-auto">
          {proposal.packages.map(pkg => {
            const isSel = pkg.tier === activeTier
            const style = TIER_STYLE[pkg.tier] || TIER_STYLE.estandar
            return (
              <button key={pkg.tier} onClick={() => setActiveTier(pkg.tier)}
                className="flex-1 min-w-[140px] px-4 py-3 rounded-xl text-left transition-all"
                style={{
                  background: isSel ? style.bg : 'transparent',
                  color: isSel ? style.color : '#1C1108',
                  border: isSel ? `2px solid ${style.color}` : '2px solid transparent',
                }}>
                <div className="text-xs font-bold uppercase tracking-widest opacity-70">
                  {style.emoji} {pkg.tier}
                </div>
                <div className="font-bold text-sm">{pkg.title}</div>
                <div className="text-[10px] opacity-75">{pkg.estimated_total.toLocaleString()}€ aprox</div>
              </button>
            )
          })}
        </div>
      </section>

      {/* Paquete activo */}
      <section className="max-w-4xl mx-auto px-6 mt-8">
        {activePkg && (
          <>
            <div className="mb-6">
              <div className="text-xs font-bold uppercase tracking-widest mb-1"
                style={{ color: TIER_STYLE[activePkg.tier].color }}>
                {TIER_STYLE[activePkg.tier].emoji} {activePkg.tier}
              </div>
              <h2 className="font-serif text-2xl md:text-3xl font-black text-ink">{activePkg.title}</h2>
              <p className="text-ink/55 text-sm mt-1">{activePkg.subtitle}</p>
            </div>

            <div className="space-y-4">
              {activePkg.providers.map(prov => {
                const cat = CATEGORIES.find(c => c.id === prov.category)
                return (
                  <Link key={prov.id} href={`/proveedores/${prov.slug || prov.id}`}
                    className="group block bg-white border border-stone-200 rounded-2xl overflow-hidden hover:border-coral hover:shadow-card transition-all">
                    <div className="flex flex-col sm:flex-row">
                      <div className="sm:w-48 h-40 sm:h-32 bg-stone-100 overflow-hidden flex-shrink-0">
                        <img src={prov.photo_url || getPhoto(prov.category, prov.photo_idx || 0, 384, 256)} alt={prov.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"/>
                      </div>
                      <div className="flex-1 p-4 sm:p-5">
                        <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
                          <div>
                            <div className="text-[10px] font-bold uppercase tracking-widest mb-1"
                              style={{ color: cat?.color }}>
                              {cat?.icon} {cat?.label}
                            </div>
                            <div className="font-bold text-ink text-base group-hover:text-coral">{prov.name}</div>
                            <div className="text-xs text-ink/55 mt-0.5">
                              📍 {prov.city}
                              {prov.rating > 0 && <> · ★ {prov.rating.toFixed(1)} ({prov.total_reviews})</>}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-serif text-xl font-bold text-ink">
                              {prov.price_base.toLocaleString()}€
                            </div>
                            <div className="text-[10px] text-ink/45">{prov.price_unit || 'por evento'}</div>
                          </div>
                        </div>
                        {prov.justification && (
                          <p className="text-sm text-ink/70 leading-relaxed border-l-2 border-coral/30 pl-3 mt-2 italic">
                            {prov.justification}
                          </p>
                        )}
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>

            {/* Total + Acciones */}
            <div className="mt-8 bg-white border border-stone-200 rounded-2xl p-6 text-center shadow-card">
              <div className="text-xs text-ink/55 uppercase tracking-widest font-bold mb-2">
                Total estimado del equipo
              </div>
              <div className="font-serif text-4xl text-ink font-black">
                {activePkg.estimated_total.toLocaleString()}€
              </div>
              <div className="text-xs text-ink/55 mt-1">
                {activePkg.estimated_total <= proposal.budget_total
                  ? `✅ Dentro de tu presupuesto (${proposal.budget_total.toLocaleString()}€)`
                  : `⚠️ ${Math.round(((activePkg.estimated_total / proposal.budget_total) - 1) * 100)}% por encima de tu presupuesto`}
              </div>

              <div className="mt-6 flex flex-wrap gap-3 justify-center">
                <button onClick={copyLink}
                  className="bg-ink text-white font-bold px-5 py-3 rounded-xl text-sm hover:opacity-90">
                  🔗 Compartir esta propuesta
                </button>
                <Link href={`mailto:contacto@fiestago.es?subject=Quiero%20reservar%20mi%20equipo%20FiestaGo&body=Hola,%20me%20gustaría%20reservar%20el%20equipo%20${activePkg.title}%20que%20me%20propuso%20FiestaGo.%20Mi%20propuesta:%20${typeof window !== 'undefined' ? encodeURIComponent(window.location.href) : ''}`}
                  className="bg-coral text-white font-bold px-5 py-3 rounded-xl text-sm hover:bg-coral-dark">
                  💬 Hablar con un asesor
                </Link>
                <Link href="/proveedores"
                  className="border border-stone-200 text-ink px-5 py-3 rounded-xl text-sm font-semibold hover:border-coral hover:text-coral">
                  Ver más proveedores
                </Link>
              </div>
            </div>
          </>
        )}
      </section>

      {/* Footer info */}
      <section className="max-w-3xl mx-auto px-6 mt-12">
        <div className="bg-stone-100 border border-stone-200 rounded-xl p-5 text-xs text-ink/55 leading-relaxed text-center">
          ✨ Propuesta generada por nuestro AI Planner. Los precios son estimaciones basadas en
          las fichas de cada proveedor — el precio final puede variar según opciones y fecha.
          La <Link href="/garantia" className="text-coral underline">Garantía de Éxito</Link> aplica
          a cualquier reserva confirmada dentro de FiestaGo.
        </div>
      </section>
    </main>
  )
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="bg-white/10 border border-white/20 rounded-full px-3 py-1 text-xs">
      {children}
    </span>
  )
}
