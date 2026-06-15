'use client'

import { useState, FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CATEGORIES, CITIES, getPhoto } from '@/lib/constants'
import { precioCliente, formatEuro, textoGarantiaIncluida } from '@/lib/pricing'
import toast from 'react-hot-toast'

type EventType = 'boda' | 'cumpleanos' | 'comunion' | 'corporativo' | 'otro'

// Cada tipo de evento sugiere categorías por defecto. El cliente puede
// luego añadir o quitar lo que quiera.
const DEFAULT_CATS_BY_EVENT: Record<EventType, string[]> = {
  boda:         ['foto','catering','espacios','musica','flores','planner'],
  cumpleanos:   ['catering','espacios','pastel','animacion','foto'],
  comunion:     ['catering','espacios','pastel','foto','papeleria'],
  corporativo:  ['catering','espacios','musica','animacion'],
  otro:         ['catering','espacios','musica'],
}

const EVENT_LABELS: Record<EventType, { label: string; icon: string; defaultGuests: number }> = {
  boda:        { label: 'Boda',                  icon: '💍', defaultGuests: 100 },
  cumpleanos:  { label: 'Cumpleaños',            icon: '🎂', defaultGuests: 30 },
  comunion:    { label: 'Comunión',              icon: '✨', defaultGuests: 50 },
  corporativo: { label: 'Evento corporativo',    icon: '🏢', defaultGuests: 80 },
  otro:        { label: 'Otro',                  icon: '🎉', defaultGuests: 50 },
}

type Result = {
  guests: number
  total: { min: number; avg: number; max: number }
  byCategory: Record<string, {
    unit: 'por_evento' | 'por_persona'
    source: 'real' | 'fallback'
    n_samples: number
    per_unit: { min: number; avg: number; max: number }
    total:    { min: number; avg: number; max: number }
    sampleProviders: any[]
  }>
}

const STYLES = [
  { id: 'rustico',  label: '🌾 Rústico',   hint: 'Madera, naturaleza, fincas campestres' },
  { id: 'clasico',  label: '🎩 Clásico',   hint: 'Elegancia tradicional, salones' },
  { id: 'moderno',  label: '✨ Moderno',   hint: 'Minimalista, urbano, industrial' },
  { id: 'playa',    label: '🌊 Playa',     hint: 'Aire libre, costero, descalzo' },
  { id: 'elegante', label: '💎 Elegante',  hint: 'Premium, refinado, exclusivo' },
]

export default function CalculadoraPage() {
  const router = useRouter()
  const [eventType, setEventType] = useState<EventType>('boda')
  const [guests, setGuests]       = useState(100)
  const [city, setCity]           = useState('')
  const [selectedCats, setSelectedCats] = useState<string[]>(DEFAULT_CATS_BY_EVENT.boda)
  const [result, setResult]       = useState<Result | null>(null)
  const [loading, setLoading]     = useState(false)
  const [email, setEmail]         = useState('')
  const [emailSent, setEmailSent] = useState(false)
  // AI Planner state
  const [style,    setStyle]      = useState<string>('')
  const [eventDate, setEventDate] = useState<string>('')
  const [planning, setPlanning]   = useState(false)

  // Cuando cambia el tipo, actualizamos categorías y nº de invitados.
  function handleEventTypeChange(t: EventType) {
    setEventType(t)
    setSelectedCats(DEFAULT_CATS_BY_EVENT[t])
    setGuests(EVENT_LABELS[t].defaultGuests)
    setResult(null)
  }

  function toggleCat(catId: string) {
    setSelectedCats(s => s.includes(catId) ? s.filter(x => x !== catId) : [...s, catId])
    setResult(null)
  }

  async function calculate(e: FormEvent) {
    e.preventDefault()
    if (selectedCats.length === 0) {
      toast.error('Elige al menos una categoría')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/calculadora', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_type: eventType, guests, city, categories: selectedCats }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Algo no fue bien')
      } else {
        setResult(data)
        // scroll al resultado tras pintar
        setTimeout(() => {
          document.getElementById('resultado')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }, 80)
      }
    } catch {
      toast.error('Sin conexión')
    }
    setLoading(false)
  }

  // Llama al AI Planner. Necesita ciudad + presupuesto definidos
  // (usamos la mediana del cálculo previo como presupuesto si no nos
  // han dado uno explícito).
  async function generatePlan() {
    if (!result) { toast.error('Calcula primero el presupuesto'); return }
    if (!city) {
      toast.error('Selecciona tu ciudad arriba para personalizar la propuesta')
      // Scroll suave al formulario para que vea el selector
      document.querySelector<HTMLElement>('select[aria-label="ciudad"], select')?.scrollIntoView({ behavior:'smooth', block:'center' })
      return
    }
    setPlanning(true)
    try {
      const res = await fetch('/api/calculadora/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_type:    eventType,
          guests,
          city,
          categories:    selectedCats,
          budget_total:  result.total.avg,
          style:         style || null,
          event_date:    eventDate || null,
          client_email:  email || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'No se pudo generar la propuesta')
      } else if (data.proposal_id) {
        toast.success('¡Equipo recomendado listo!')
        router.push(`/mi-evento/${data.proposal_id}`)
      } else {
        toast.error('La propuesta se generó pero no se pudo guardar.')
      }
    } catch (err: any) {
      toast.error(err?.message || 'Sin conexión')
    }
    setPlanning(false)
  }

  async function handleEmailCapture(e: FormEvent) {
    e.preventDefault()
    if (!email || emailSent) return
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          city,
          event_type: eventType,
          source: 'calculadora',
        }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(data.alreadyExists ? 'Ya estabas en la lista 🎉' : 'Hecho — te llegará un correo')
        setEmailSent(true)
      } else {
        toast.error(data.error || 'No se pudo enviar')
      }
    } catch {
      toast.error('Sin conexión')
    }
  }

  return (
    <main className="bg-cream min-h-screen">
      {/* Hero */}
      <section className="bg-gradient-to-br from-ink via-ink to-coral text-white">
        <div className="max-w-4xl mx-auto px-6 py-12 md:py-16 text-center">
          <div className="text-5xl mb-3">🧮</div>
          <h1 className="font-serif text-3xl md:text-5xl font-bold leading-tight tracking-tight">
            ¿Cuánto cuesta tu evento?
          </h1>
          <p className="text-base md:text-lg opacity-90 mt-3 max-w-xl mx-auto leading-relaxed">
            Estima el presupuesto con precios reales de proveedores de FiestaGo en tu ciudad.
            Sin compromiso, sin spam.
          </p>
        </div>
      </section>

      {/* Form */}
      <section className="max-w-4xl mx-auto px-6 -mt-8 mb-10">
        <form onSubmit={calculate} className="bg-white border border-stone-200 rounded-2xl shadow-xl p-6 md:p-8 space-y-6">

          {/* Tipo de evento */}
          <div>
            <label className="block text-sm font-bold text-ink mb-3">¿Qué celebras?</label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {(Object.keys(EVENT_LABELS) as EventType[]).map(t => {
                const opt = EVENT_LABELS[t]
                const active = eventType === t
                return (
                  <button key={t} type="button" onClick={() => handleEventTypeChange(t)}
                    className={`p-3 rounded-xl border text-center transition-colors
                      ${active ? 'border-coral bg-coral/10 text-coral' : 'border-stone-200 text-ink/65 hover:border-coral/40'}`}>
                    <div className="text-xl mb-1">{opt.icon}</div>
                    <div className="text-xs font-semibold">{opt.label}</div>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-5">
            {/* Invitados */}
            <div>
              <label className="block text-sm font-bold text-ink mb-2">Invitados</label>
              <input type="number" min={1} max={1500} value={guests}
                onChange={e => { setGuests(parseInt(e.target.value) || 1); setResult(null) }}
                className="w-full px-3 py-2.5 rounded-xl border border-stone-200 focus:border-coral focus:ring-2 focus:ring-coral/20 focus:outline-none text-sm"/>
            </div>
            {/* Ciudad */}
            <div>
              <label className="block text-sm font-bold text-ink mb-2">Ciudad (opcional)</label>
              <select value={city} onChange={e => { setCity(e.target.value); setResult(null) }}
                className="w-full px-3 py-2.5 rounded-xl border border-stone-200 focus:border-coral focus:ring-2 focus:ring-coral/20 focus:outline-none text-sm bg-white">
                <option value="">Toda España</option>
                {CITIES.map((c: string) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Estilo + Fecha (opcionales, para la IA Planner) */}
          <div className="grid sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-bold text-ink mb-2">
                Estilo <span className="text-ink/50 font-normal">(para la IA)</span>
              </label>
              <select value={style} onChange={e => { setStyle(e.target.value); setResult(null) }}
                className="w-full px-3 py-2.5 rounded-xl border border-stone-200 focus:border-coral focus:ring-2 focus:ring-coral/20 focus:outline-none text-sm bg-white">
                <option value="">Sin preferencia</option>
                {STYLES.map(s => <option key={s.id} value={s.id}>{s.label} — {s.hint}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-ink mb-2">
                Fecha <span className="text-ink/50 font-normal">(opcional, filtra por disponibilidad)</span>
              </label>
              <input type="date" value={eventDate}
                onChange={e => { setEventDate(e.target.value); setResult(null) }}
                className="w-full px-3 py-2.5 rounded-xl border border-stone-200 focus:border-coral focus:ring-2 focus:ring-coral/20 focus:outline-none text-sm"/>
            </div>
          </div>

          {/* Categorías */}
          <div>
            <label className="block text-sm font-bold text-ink mb-3">¿Qué necesitas? <span className="text-ink/50 font-normal">(toca para añadir/quitar)</span></label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {CATEGORIES.map(c => {
                const active = selectedCats.includes(c.id)
                return (
                  <button key={c.id} type="button" onClick={() => toggleCat(c.id)}
                    className={`px-3 py-2.5 rounded-xl border text-xs font-semibold transition-colors flex items-center gap-2
                      ${active ? 'border-coral bg-coral/10 text-coral' : 'border-stone-200 text-ink/65 hover:border-coral/40'}`}>
                    <span>{c.icon}</span><span className="truncate">{c.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <button type="submit" disabled={loading}
            className="w-full bg-coral text-white font-bold py-3 rounded-xl text-sm hover:bg-coral-dark transition-colors disabled:opacity-60">
            {loading ? 'Calculando…' : 'Calcular mi presupuesto'}
          </button>
        </form>
      </section>

      {/* Resultado */}
      {result && (
        <section id="resultado" className="max-w-4xl mx-auto px-6 pb-16">
          <div className="bg-white border border-stone-200 rounded-2xl p-6 md:p-8 shadow-sm">
            <div className="text-center mb-8">
              <div className="text-xs font-bold uppercase tracking-wider text-coral mb-2">Presupuesto estimado</div>
              <div className="font-serif text-4xl md:text-5xl text-ink font-bold leading-tight" title={textoGarantiaIncluida(result.total.avg)}>
                {formatEuro(precioCliente(result.total.min))} – {formatEuro(precioCliente(result.total.max))}
              </div>
              <div className="text-sm text-ink/55 mt-2">
                Mediana: <strong>{formatEuro(precioCliente(result.total.avg))}</strong> · Para {result.guests} invitado{result.guests===1?'':'s'}
              </div>
              <div className="text-xs text-ink/45 mt-1">{textoGarantiaIncluida(result.total.avg)}</div>
            </div>

            {/* Desglose por categoría */}
            <div className="space-y-3 mb-8">
              {selectedCats.map(catId => {
                const cat = CATEGORIES.find(c => c.id === catId)
                const r   = result.byCategory[catId]
                if (!cat || !r) return null
                const pct = result.total.avg > 0 ? Math.round((r.total.avg / result.total.avg) * 100) : 0
                return (
                  <div key={catId} className="bg-cream/50 rounded-xl p-4 border border-stone-100">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-2xl">{cat.icon}</span>
                        <div>
                          <div className="font-semibold text-ink text-sm">{cat.label}</div>
                          <div className="text-[10px] text-ink/50">
                            {r.source === 'real'
                              ? `Basado en ${r.n_samples} proveedor${r.n_samples===1?'':'es'} reales${city ? ` en ${city}` : ''}`
                              : 'Estimación de mercado (aún sin proveedores suficientes)'}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-serif text-lg font-bold" style={{ color: cat.color }}
                          title={textoGarantiaIncluida(r.total.avg)}>
                          {formatEuro(precioCliente(r.total.min))} – {formatEuro(precioCliente(r.total.max))}
                        </div>
                        <div className="text-[10px] text-ink/50">{pct}% del total · garantía incl.</div>
                      </div>
                    </div>

                    {/* Sample providers reales */}
                    {r.sampleProviders.length > 0 && (
                      <div className="mt-3 grid grid-cols-3 gap-2">
                        {r.sampleProviders.map((p: any) => (
                          <Link key={p.id} href={`/proveedores/${p.id}`}
                            className="group block">
                            <div className="h-16 rounded-lg overflow-hidden bg-stone-100 mb-1">
                              <img src={p.photo_url || getPhoto(p.category, p.photo_idx || 0, 240, 120)} alt={p.name}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform"/>
                            </div>
                            <div className="text-[10px] font-semibold text-ink truncate group-hover:text-coral">{p.name}</div>
                            <div className="text-[9px] text-ink/50" title={p.price_base ? textoGarantiaIncluida(p.price_base) : ''}>{p.city} · {p.price_base ? formatEuro(precioCliente(p.price_base)) : ''}</div>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* ✨ AI Planner — botón hero antes del email capture */}
            <div className="bg-gradient-to-br from-violet-600 to-coral text-white rounded-2xl p-6 mb-5 text-center">
              <div className="text-3xl mb-2">🎯</div>
              <h3 className="font-serif text-xl md:text-2xl font-bold mb-1">
                ¿Quieres que te arme el equipo entero?
              </h3>
              <p className="text-sm opacity-90 mb-5 max-w-md mx-auto">
                Nuestro AI Planner elige los mejores proveedores reales de {city || 'tu ciudad'} y te
                arma 3 propuestas (económica, estándar, premium) en 10 segundos.
              </p>
              <button onClick={generatePlan} disabled={planning}
                className="bg-white text-violet-700 font-bold px-6 py-3 rounded-xl text-sm hover:bg-cream transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
                {planning ? '✨ Pensando tu equipo...' : '🎯 Generar mi equipo con IA'}
              </button>
              {!city && (
                <p className="text-xs opacity-90 mt-3">
                  💡 <strong>Tip:</strong> selecciona tu ciudad arriba para una propuesta más personalizada (al pulsar te llevamos)
                </p>
              )}
            </div>

            {/* CTA Email capture */}
            {!emailSent ? (
              <div className="bg-gradient-to-br from-coral to-coral-dark text-white rounded-2xl p-6">
                <div className="text-center mb-4">
                  <div className="text-3xl mb-2">📧</div>
                  <h3 className="font-serif text-xl font-bold">¿Quieres este presupuesto en tu correo?</h3>
                  <p className="text-sm opacity-90 mt-1">
                    Te mandamos el desglose + 3 proveedores recomendados de tu ciudad. Y te avisamos cuando abramos reservas el 10 de junio.
                  </p>
                </div>
                <form onSubmit={handleEmailCapture} className="flex flex-col sm:flex-row gap-2">
                  <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="tu@email.com"
                    className="flex-1 px-3 py-2.5 rounded-xl text-ink text-sm focus:outline-none focus:ring-2 focus:ring-white/50"/>
                  <button type="submit"
                    className="bg-white text-coral font-bold px-5 py-2.5 rounded-xl text-sm hover:bg-cream transition-colors">
                    Enviármelo
                  </button>
                </form>
                <p className="text-[10px] opacity-75 text-center mt-3">Cero spam. Solo te escribimos para el lanzamiento.</p>
              </div>
            ) : (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl p-5 text-center">
                <div className="text-2xl mb-1">✅</div>
                <div className="font-semibold text-sm">Apuntado en la waitlist</div>
                <p className="text-xs opacity-85 mt-1">Te avisaremos cuando abramos reservas el 10 de junio.</p>
              </div>
            )}

            {/* Acción secundaria */}
            <div className="mt-6 text-center">
              <Link href="/proveedores"
                className="text-sm text-coral font-semibold hover:underline">
                Ver todos los proveedores →
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* SEO chunk debajo (mejora ranking de "cuánto cuesta una boda") */}
      <section className="bg-white border-t border-stone-200 py-12">
        <div className="max-w-3xl mx-auto px-6 prose prose-sm">
          <h2 className="font-serif text-2xl text-ink font-bold mb-3">Cuánto cuesta un evento en España (2026)</h2>
          <p className="text-ink/70 leading-relaxed mb-3">
            Una <strong>boda media en España</strong> ronda los 18.000–25.000€ para 100 invitados, según datos del mercado actual. El catering es el coste mayor (40–50%), seguido del espacio (15–20%) y la fotografía (5–8%).
          </p>
          <p className="text-ink/70 leading-relaxed mb-3">
            Para un <strong>cumpleaños o comunión</strong> el presupuesto baja a 2.500–6.000€ porque el catering por persona se mantiene pero baja el número de invitados y la complejidad.
          </p>
          <p className="text-ink/70 leading-relaxed">
            Esta calculadora usa <strong>precios reales</strong> de los proveedores aprobados en FiestaGo. Cuando hay menos de 3 proveedores en una categoría/ciudad, usamos medianas de mercado como fallback.
          </p>
        </div>
      </section>
    </main>
  )
}
