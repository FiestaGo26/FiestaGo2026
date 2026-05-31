'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CATEGORIES, CITIES, getPhoto } from '@/lib/constants'
import { toggleFavorite, useIsFavorite } from '@/lib/favorites'
import toast from 'react-hot-toast'

type EventType = 'boda' | 'cumpleanos' | 'comunion' | 'corporativo' | 'otro'
type Vibe      = 'clasico' | 'moderno' | 'rustico' | 'lujo' | 'intimo' | 'divertido'

const STEPS = ['evento', 'invitados', 'ciudad', 'vibe', 'presupuesto', 'email'] as const
type Step = typeof STEPS[number]

const EVENT_OPTIONS: Array<{ id: EventType; label: string; icon: string }> = [
  { id: 'boda',        label: 'Boda',          icon: '💍' },
  { id: 'cumpleanos',  label: 'Cumpleaños',    icon: '🎂' },
  { id: 'comunion',    label: 'Comunión',      icon: '✨' },
  { id: 'corporativo', label: 'Corporativo',   icon: '🏢' },
  { id: 'otro',        label: 'Otro',          icon: '🎉' },
]

const VIBE_OPTIONS: Array<{ id: Vibe; label: string; icon: string; desc: string }> = [
  { id: 'clasico',   label: 'Clásico',   icon: '🤍', desc: 'Elegante, tradicional' },
  { id: 'moderno',   label: 'Moderno',   icon: '⚪', desc: 'Minimalista, urbano' },
  { id: 'rustico',   label: 'Rústico',   icon: '🌿', desc: 'Natural, campo, boho' },
  { id: 'lujo',      label: 'Premium',   icon: '✨', desc: 'Alta gama, exclusivo' },
  { id: 'intimo',    label: 'Íntimo',    icon: '🕯️', desc: 'Familiar, cercano' },
  { id: 'divertido', label: 'Divertido', icon: '🎊', desc: 'Fiesta con mucha energía' },
]

function FavBtn({ id }: { id: string }) {
  const fav = useIsFavorite(id)
  return (
    <button onClick={(e) => {
        e.preventDefault()
        const next = toggleFavorite(id)
        toast.success(next ? 'Guardado' : 'Quitado')
      }}
      className={`text-xs px-2 py-1 rounded-md border font-semibold transition-colors
        ${fav ? 'bg-coral/10 border-coral text-coral' : 'border-stone-200 text-ink/60 hover:border-coral'}`}>
      {fav ? '❤️' : '🤍'}
    </button>
  )
}

export default function QuizPage() {
  const [step, setStep] = useState<Step>('evento')
  const [eventType,  setEventType]  = useState<EventType>('boda')
  const [guests,     setGuests]     = useState(100)
  const [city,       setCity]       = useState('')
  const [vibe,       setVibe]       = useState<Vibe | ''>('')
  const [budget,     setBudget]     = useState(15000)
  const [email,      setEmail]      = useState('')
  const [loading,    setLoading]    = useState(false)
  const [result,     setResult]     = useState<any>(null)

  const stepIdx = STEPS.indexOf(step)
  const progress = ((stepIdx + 1) / STEPS.length) * 100

  function next() {
    const i = STEPS.indexOf(step)
    if (i < STEPS.length - 1) setStep(STEPS[i + 1])
  }
  function prev() {
    const i = STEPS.indexOf(step)
    if (i > 0) setStep(STEPS[i - 1])
  }

  async function submit() {
    setLoading(true)
    try {
      const res = await fetch('/api/quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_type: eventType, guests, city, vibe,
          budget_total: budget,
          email: email || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Algo salió mal')
      } else {
        setResult(data)
        setTimeout(() => document.getElementById('resultado')?.scrollIntoView({ behavior:'smooth' }), 80)
      }
    } catch {
      toast.error('Sin conexión')
    }
    setLoading(false)
  }

  function handleShare() {
    if (!result) return
    const url = window.location.href.split('?')[0]
    if (navigator.share) {
      navigator.share({
        title: '¿Conoces FiestaGo? Mira mis matches',
        text:  `Mi evento es una ${eventType} para ${guests} personas. Mira qué proveedores me recomienda FiestaGo:`,
        url,
      }).catch(() => {})
      return
    }
    navigator.clipboard.writeText(url).then(() => toast.success('Link copiado'))
  }

  // ── RESULTADO ─────────────────────────────────────────────────────
  if (result) {
    return (
      <main id="resultado" className="bg-cream min-h-screen">
        <section className="bg-gradient-to-br from-ink via-ink to-coral text-white">
          <div className="max-w-4xl mx-auto px-6 py-12 text-center">
            <div className="text-xs font-bold uppercase tracking-[0.25em] opacity-75 mb-2">Tus matches</div>
            <h1 className="font-serif text-3xl md:text-4xl font-bold leading-tight">
              Estos son los proveedores que mejor encajan contigo
            </h1>
            <p className="text-sm md:text-base opacity-90 mt-3 max-w-xl mx-auto">
              Basado en tu {eventType}, {result.guests} invitados{city ? `, ${city}` : ''} y presupuesto.
            </p>
            <div className="mt-6 flex gap-3 justify-center flex-wrap">
              <button onClick={handleShare}
                className="bg-white text-coral font-bold px-5 py-2.5 rounded-xl text-sm hover:bg-cream transition-colors">
                🔗 Compartir mis matches
              </button>
              <Link href="/favoritos"
                className="border border-white/30 text-white font-bold px-5 py-2.5 rounded-xl text-sm hover:bg-white/10 transition-colors">
                Ver mis favoritos
              </Link>
            </div>
          </div>
        </section>

        <section className="max-w-5xl mx-auto px-6 py-10 space-y-8">
          {Object.entries(result.matchesByCategory).map(([catId, providers]: [string, any]) => {
            const cat = CATEGORIES.find(c => c.id === catId)
            if (!cat || !providers || providers.length === 0) return null
            return (
              <div key={catId}>
                <div className="flex items-baseline gap-2 mb-4">
                  <span className="text-2xl">{cat.icon}</span>
                  <h2 className="font-serif text-2xl font-bold text-ink">{cat.label}</h2>
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {providers.map((p: any) => (
                    <div key={p.id} className="bg-white border border-stone-200 rounded-2xl overflow-hidden">
                      <Link href={`/proveedores/${p.id}`} className="block relative h-36 bg-stone-100 overflow-hidden">
                        <img src={p.photo_url || getPhoto(p.category, p.photo_idx || 0, 400, 250)} alt={p.name}
                          className="w-full h-full object-cover hover:scale-105 transition-transform"/>
                        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent"/>
                        {p.rating > 0 && (
                          <div className="absolute bottom-2 right-2 bg-white/90 rounded-full px-2 py-0.5 text-xs font-bold flex items-center gap-1">
                            <span className="text-gold">★</span>{Number(p.rating).toFixed(1)}
                          </div>
                        )}
                      </Link>
                      <div className="p-3">
                        <Link href={`/proveedores/${p.id}`}>
                          <h3 className="font-serif text-base font-bold text-ink leading-tight hover:text-coral">{p.name}</h3>
                        </Link>
                        <div className="text-xs text-ink/55 mt-1 mb-2">📍 {p.city}</div>
                        <div className="flex items-center justify-between gap-2">
                          {p.price_base ? (
                            <div>
                              <span className="text-[10px] text-ink/45">desde </span>
                              <span className="font-serif font-bold text-base" style={{ color: cat.color }}>
                                {p.price_base.toLocaleString()}€
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-ink/40">Consultar</span>
                          )}
                          <FavBtn id={p.id}/>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}

          <div className="bg-white border border-stone-200 rounded-2xl p-6 text-center mt-8">
            <h3 className="font-serif text-xl font-bold text-ink mb-2">¿Quieres comparar dos o más lado a lado?</h3>
            <p className="text-sm text-ink/60 mb-4">Guarda los que más te gusten como favoritos y úsalos en el comparador.</p>
            <div className="flex gap-3 justify-center flex-wrap">
              <Link href="/favoritos" className="bg-coral text-white font-bold px-5 py-2.5 rounded-xl text-sm hover:bg-coral-dark transition-colors">
                Ir a mis favoritos
              </Link>
              <button onClick={() => { setResult(null); setStep('evento') }}
                className="border border-stone-200 text-ink font-semibold px-5 py-2.5 rounded-xl text-sm hover:border-coral hover:text-coral transition-colors">
                Rehacer el quiz
              </button>
            </div>
          </div>
        </section>
      </main>
    )
  }

  // ── QUIZ ──────────────────────────────────────────────────────────
  return (
    <main className="bg-cream min-h-screen">
      <section className="bg-gradient-to-br from-ink via-ink to-coral text-white">
        <div className="max-w-3xl mx-auto px-6 py-10 text-center">
          <div className="text-xs font-bold uppercase tracking-[0.25em] opacity-75 mb-2">Quiz · 2 minutos</div>
          <h1 className="font-serif text-3xl md:text-4xl font-bold leading-tight">
            Encuentra tu proveedor ideal
          </h1>
          <p className="text-sm md:text-base opacity-90 mt-3">
            6 preguntas. Te recomendamos los proveedores que mejor encajan contigo.
          </p>
        </div>
      </section>

      <section className="max-w-2xl mx-auto px-6 -mt-6 pb-16">
        <div className="bg-white border border-stone-200 rounded-3xl shadow-xl p-6 md:p-8">
          {/* Progress bar */}
          <div className="mb-6">
            <div className="flex justify-between text-xs text-ink/55 mb-1.5">
              <span>Pregunta {stepIdx + 1} de {STEPS.length}</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
              <div className="h-full bg-coral transition-all" style={{ width: `${progress}%` }}/>
            </div>
          </div>

          {/* Step: Evento */}
          {step === 'evento' && (
            <div>
              <h2 className="font-serif text-2xl text-ink font-bold mb-4">¿Qué celebras?</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {EVENT_OPTIONS.map(opt => (
                  <button key={opt.id}
                    onClick={() => { setEventType(opt.id); next() }}
                    className={`p-4 rounded-xl border-2 text-center transition-colors
                      ${eventType === opt.id ? 'border-coral bg-coral/10 text-coral' : 'border-stone-200 text-ink hover:border-coral/40'}`}>
                    <div className="text-3xl mb-1">{opt.icon}</div>
                    <div className="text-sm font-semibold">{opt.label}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step: Invitados */}
          {step === 'invitados' && (
            <div>
              <h2 className="font-serif text-2xl text-ink font-bold mb-2">¿Cuántos invitados?</h2>
              <p className="text-sm text-ink/55 mb-6">Aproximado, no hace falta cifra exacta.</p>
              <div className="flex items-center gap-3 mb-4">
                <input type="number" min={1} max={1500} value={guests}
                  onChange={e => setGuests(parseInt(e.target.value) || 1)}
                  className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:border-coral focus:ring-2 focus:ring-coral/20 focus:outline-none text-2xl font-serif font-bold text-center"/>
                <span className="text-ink/60 font-semibold">personas</span>
              </div>
              <div className="grid grid-cols-4 gap-2 mb-6">
                {[20, 50, 100, 200].map(n => (
                  <button key={n} type="button"
                    onClick={() => setGuests(n)}
                    className={`py-2 rounded-lg border text-sm font-semibold transition-colors
                      ${guests === n ? 'border-coral bg-coral/10 text-coral' : 'border-stone-200 text-ink/65 hover:border-coral/40'}`}>
                    {n}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step: Ciudad */}
          {step === 'ciudad' && (
            <div>
              <h2 className="font-serif text-2xl text-ink font-bold mb-2">¿En qué ciudad?</h2>
              <p className="text-sm text-ink/55 mb-6">Si tienes una ciudad pensada, nos ayuda a ajustar las recomendaciones.</p>
              <select value={city} onChange={e => setCity(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:border-coral focus:ring-2 focus:ring-coral/20 focus:outline-none text-base bg-white mb-2">
                <option value="">Toda España / aún no lo sé</option>
                {CITIES.map((c: string) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          )}

          {/* Step: Vibe */}
          {step === 'vibe' && (
            <div>
              <h2 className="font-serif text-2xl text-ink font-bold mb-2">¿Qué estilo te imaginas?</h2>
              <p className="text-sm text-ink/55 mb-6">Elige el que más se acerque (no hay respuesta mala).</p>
              <div className="grid grid-cols-2 gap-2">
                {VIBE_OPTIONS.map(opt => (
                  <button key={opt.id} type="button"
                    onClick={() => setVibe(opt.id)}
                    className={`p-4 rounded-xl border-2 text-left transition-colors
                      ${vibe === opt.id ? 'border-coral bg-coral/10' : 'border-stone-200 hover:border-coral/40'}`}>
                    <div className="text-2xl mb-1">{opt.icon}</div>
                    <div className={`text-sm font-bold ${vibe === opt.id ? 'text-coral' : 'text-ink'}`}>{opt.label}</div>
                    <div className="text-[10px] text-ink/55">{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step: Presupuesto */}
          {step === 'presupuesto' && (
            <div>
              <h2 className="font-serif text-2xl text-ink font-bold mb-2">¿Cuál es tu presupuesto total?</h2>
              <p className="text-sm text-ink/55 mb-6">Aproximado, para ajustar la búsqueda a tu rango.</p>
              <div className="text-center mb-4">
                <div className="font-serif text-4xl font-bold text-coral">
                  {budget.toLocaleString()} €
                </div>
              </div>
              <input type="range" min={500} max={60000} step={500} value={budget}
                onChange={e => setBudget(parseInt(e.target.value))}
                className="w-full accent-coral mb-2"/>
              <div className="flex justify-between text-[10px] text-ink/50 mb-6">
                <span>500€</span><span>30k€</span><span>60k€+</span>
              </div>
            </div>
          )}

          {/* Step: Email */}
          {step === 'email' && (
            <div>
              <h2 className="font-serif text-2xl text-ink font-bold mb-2">¿Te mandamos los matches al email?</h2>
              <p className="text-sm text-ink/55 mb-6">
                Opcional. Si nos lo dejas, te avisamos también del lanzamiento del 10 de junio
                y entras en el sorteo de un evento de 300€.
              </p>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="tu@email.com"
                className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:border-coral focus:ring-2 focus:ring-coral/20 focus:outline-none text-base mb-2"/>
              <p className="text-[10px] text-ink/45">Sin spam, prometido.</p>
            </div>
          )}

          {/* Navegación */}
          <div className="flex gap-3 mt-8">
            {stepIdx > 0 && (
              <button onClick={prev}
                className="px-5 py-3 rounded-xl border border-stone-200 text-ink/65 font-semibold text-sm hover:border-coral hover:text-coral transition-colors">
                ← Atrás
              </button>
            )}
            {step !== 'email' ? (
              <button onClick={next}
                className="flex-1 px-5 py-3 rounded-xl bg-coral text-white font-bold text-sm hover:bg-coral-dark transition-colors">
                Siguiente →
              </button>
            ) : (
              <button onClick={submit} disabled={loading}
                className="flex-1 px-5 py-3 rounded-xl bg-coral text-white font-bold text-sm hover:bg-coral-dark transition-colors disabled:opacity-60">
                {loading ? 'Calculando matches…' : 'Ver mis matches →'}
              </button>
            )}
          </div>
        </div>
      </section>
    </main>
  )
}
