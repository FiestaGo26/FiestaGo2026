'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { CATEGORIES, CITIES } from '@/lib/constants'
import { getChecklist, bucketize, type ChecklistItem } from '@/lib/checklist'
import toast from 'react-hot-toast'

type UserEvent = {
  id: string
  event_type: string
  event_date: string
  city: string | null
  guests: number | null
  name: string | null
  vibe: string | null
  budget_total: number | null
}

type Progress = { item_key: string; done_at: string }

const EVENT_LABELS: Record<string, { label: string; icon: string }> = {
  boda:        { label: 'Boda',        icon: '💍' },
  cumpleanos:  { label: 'Cumpleaños',  icon: '🎂' },
  comunion:    { label: 'Comunión',    icon: '✨' },
  corporativo: { label: 'Corporativo', icon: '🏢' },
  otro:        { label: 'Otro',        icon: '🎉' },
}

function daysBetween(a: Date, b: Date): number {
  return Math.ceil((b.getTime() - a.getTime()) / 86_400_000)
}

function monthsBetween(a: Date, b: Date): number {
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth())
    + (b.getDate() >= a.getDate() ? 0 : -1)
}

export default function MiEventoPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [authChecked, setAuthChecked] = useState(false)
  const [userEmail, setUserEmail]     = useState<string | null>(null)
  const [event,       setEvent]       = useState<UserEvent | null>(null)
  const [progress,    setProgress]    = useState<Progress[]>([])
  const [loading,     setLoading]     = useState(true)
  const [editing,     setEditing]     = useState(false)
  const [form, setForm] = useState({
    name:'', event_type:'boda', event_date:'', city:'', guests:'',
  })

  // Auth + carga inicial
  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (cancelled) return
      if (!user) {
        setAuthChecked(true)
        setLoading(false)
        return
      }
      setUserEmail(user.email || null)
      const res = await fetch('/api/user-event')
      const data = await res.json()
      if (cancelled) return
      setEvent(data.event)
      setProgress(data.progress || [])
      if (!data.event) {
        // No tiene evento aún → mostramos form
        setEditing(true)
      } else {
        setForm({
          name:       data.event.name || '',
          event_type: data.event.event_type,
          event_date: data.event.event_date,
          city:       data.event.city || '',
          guests:     String(data.event.guests || ''),
        })
      }
      setAuthChecked(true)
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [supabase])

  async function saveEvent(e: React.FormEvent) {
    e.preventDefault()
    if (!form.event_date) {
      toast.error('Pon una fecha para el evento')
      return
    }
    const res = await fetch('/api/user-event', {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({
        event_type: form.event_type,
        event_date: form.event_date,
        city:       form.city || null,
        guests:     form.guests ? parseInt(form.guests) : null,
        name:       form.name || null,
      }),
    })
    const data = await res.json()
    if (!res.ok) { toast.error(data.error || 'Error'); return }
    setEvent(data.event)
    setEditing(false)
    toast.success('Guardado')
  }

  async function toggleItem(itemKey: string, currentlyDone: boolean) {
    if (!event) return
    const next = !currentlyDone
    // Optimistic update
    setProgress(prev => next
      ? [...prev, { item_key: itemKey, done_at: new Date().toISOString() }]
      : prev.filter(p => p.item_key !== itemKey)
    )
    await fetch('/api/user-event', {
      method: 'PATCH',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({
        user_event_id: event.id,
        item_key:      itemKey,
        done:          next,
      }),
    })
  }

  // Loading / no-auth
  if (!authChecked || loading) {
    return <main className="bg-cream min-h-screen py-20 text-center text-ink/55">Cargando…</main>
  }
  if (!userEmail) {
    return (
      <main className="bg-cream min-h-screen flex items-center justify-center px-6">
        <div className="bg-white rounded-2xl border border-stone-200 p-8 max-w-md text-center">
          <div className="text-4xl mb-3">📅</div>
          <h1 className="font-serif text-2xl text-ink font-bold mb-2">Para usar Mi Evento</h1>
          <p className="text-sm text-ink/65 mb-5">
            Crea una cuenta gratis (60 segundos). Así guardamos tu fecha,
            ciudad y progreso de checklist en cualquier dispositivo.
          </p>
          <div className="flex gap-2 justify-center">
            <Link href="/login" className="border border-stone-200 text-ink font-semibold px-5 py-2 rounded-xl text-sm hover:border-coral hover:text-coral transition-colors">
              Acceder
            </Link>
            <Link href="/registro" className="bg-coral text-white font-bold px-5 py-2 rounded-xl text-sm hover:bg-coral-dark transition-colors">
              Crear cuenta gratis
            </Link>
          </div>
        </div>
      </main>
    )
  }

  // Setup form
  if (editing || !event) {
    return (
      <main className="bg-cream min-h-screen">
        <section className="max-w-2xl mx-auto px-6 py-12">
          <h1 className="font-serif text-3xl md:text-4xl font-bold text-ink leading-tight mb-2">
            {event ? 'Edita tu evento' : 'Cuéntanos sobre tu evento'}
          </h1>
          <p className="text-sm text-ink/60 mb-8">
            Con estos datos te montamos la cuenta atrás y un checklist personalizado.
          </p>

          <form onSubmit={saveEvent} className="bg-white border border-stone-200 rounded-2xl p-6 space-y-4">
            <div>
              <label className="block text-xs font-bold text-ink/60 uppercase tracking-wide mb-1.5">Nombre (opcional)</label>
              <input value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="Boda Marta & Juan"
                className="w-full px-3 py-2.5 rounded-xl border border-stone-200 focus:border-coral focus:ring-2 focus:ring-coral/20 focus:outline-none text-sm"/>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-ink/60 uppercase tracking-wide mb-1.5">Tipo</label>
                <select value={form.event_type}
                  onChange={e => setForm({ ...form, event_type: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-stone-200 focus:border-coral focus:ring-2 focus:ring-coral/20 focus:outline-none text-sm bg-white">
                  <option value="boda">💍 Boda</option>
                  <option value="cumpleanos">🎂 Cumpleaños</option>
                  <option value="comunion">✨ Comunión</option>
                  <option value="corporativo">🏢 Corporativo</option>
                  <option value="otro">🎉 Otro</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-ink/60 uppercase tracking-wide mb-1.5">Fecha del evento *</label>
                <input type="date" required
                  value={form.event_date}
                  onChange={e => setForm({ ...form, event_date: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-stone-200 focus:border-coral focus:ring-2 focus:ring-coral/20 focus:outline-none text-sm"/>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-ink/60 uppercase tracking-wide mb-1.5">Ciudad</label>
                <select value={form.city}
                  onChange={e => setForm({ ...form, city: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-stone-200 focus:border-coral focus:ring-2 focus:ring-coral/20 focus:outline-none text-sm bg-white">
                  <option value="">—</option>
                  {CITIES.map((c: string) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-ink/60 uppercase tracking-wide mb-1.5">Invitados</label>
                <input type="number" value={form.guests}
                  onChange={e => setForm({ ...form, guests: e.target.value })}
                  placeholder="80"
                  className="w-full px-3 py-2.5 rounded-xl border border-stone-200 focus:border-coral focus:ring-2 focus:ring-coral/20 focus:outline-none text-sm"/>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              {event && (
                <button type="button" onClick={() => setEditing(false)}
                  className="border border-stone-200 text-ink/65 font-semibold px-5 py-2.5 rounded-xl text-sm hover:border-coral hover:text-coral transition-colors">
                  Cancelar
                </button>
              )}
              <button type="submit"
                className="flex-1 bg-coral text-white font-bold py-2.5 rounded-xl text-sm hover:bg-coral-dark transition-colors">
                {event ? 'Guardar cambios' : 'Crear mi cuenta atrás'}
              </button>
            </div>
          </form>
        </section>
      </main>
    )
  }

  // Vista principal: countdown + checklist
  const eventDate = new Date(event.event_date)
  const now       = new Date()
  const daysLeft  = daysBetween(now, eventDate)
  const monthsLeft = monthsBetween(now, eventDate)
  const items     = getChecklist(event.event_type)
  const buckets   = bucketize(items, monthsLeft)
  const doneKeys  = new Set(progress.map(p => p.item_key))
  const total     = items.length
  const done      = items.filter(i => doneKeys.has(i.key)).length
  const pct       = total > 0 ? Math.round((done / total) * 100) : 0
  const eventLbl  = EVENT_LABELS[event.event_type] || { label: event.event_type, icon: '🎉' }

  return (
    <main className="bg-cream min-h-screen pb-16">
      {/* Hero countdown */}
      <section className="bg-gradient-to-br from-ink via-ink to-coral text-white">
        <div className="max-w-4xl mx-auto px-6 py-12 md:py-16">
          <div className="flex items-baseline gap-2 mb-2 text-xs font-bold uppercase tracking-[0.25em] opacity-80">
            <span>{eventLbl.icon}</span>
            <span>{eventLbl.label}</span>
            {event.city && <span>· {event.city}</span>}
            {event.guests && <span>· {event.guests} invitados</span>}
          </div>
          <h1 className="font-serif text-3xl md:text-5xl font-bold leading-tight mb-1">
            {event.name || `Tu ${eventLbl.label.toLowerCase()}`}
          </h1>
          <div className="opacity-90 text-sm md:text-base">
            {eventDate.toLocaleDateString('es-ES', { weekday: 'long', day:'numeric', month:'long', year:'numeric' })}
          </div>

          {/* Countdown grande */}
          <div className="mt-8 inline-flex items-center gap-3 md:gap-6 bg-white/10 backdrop-blur-sm rounded-2xl px-5 py-4">
            <div className="text-center">
              <div className="font-serif text-4xl md:text-6xl font-bold leading-none">
                {Math.max(0, daysLeft)}
              </div>
              <div className="text-[10px] md:text-xs uppercase tracking-wider mt-1 opacity-80">
                {daysLeft === 1 ? 'día' : 'días'}
              </div>
            </div>
            <div className="w-px h-12 md:h-16 bg-white/30"/>
            <div className="text-left">
              <div className="text-xs md:text-sm font-semibold opacity-90">
                {daysLeft <= 0 ? '¡Es hoy o ya pasó!' : daysLeft <= 30 ? 'Recta final 🚀' : daysLeft <= 180 ? 'Tiempo razonable' : 'Aún hay margen'}
              </div>
              <div className="text-[10px] md:text-xs opacity-70 mt-1">
                {monthsLeft >= 1 && `${monthsLeft} ${monthsLeft === 1 ? 'mes' : 'meses'} aprox.`}
              </div>
            </div>
          </div>

          <button onClick={() => setEditing(true)}
            className="ml-3 md:ml-6 text-xs underline opacity-75 hover:opacity-100 transition-opacity">
            Editar datos
          </button>
        </div>
      </section>

      {/* Progress bar */}
      <section className="bg-white border-b border-stone-200 sticky top-16 z-30">
        <div className="max-w-4xl mx-auto px-6 py-3">
          <div className="flex justify-between text-xs text-ink/65 mb-1">
            <span><strong className="text-ink">{done}</strong> de {total} hecho ({pct}%)</span>
            <span className="text-coral font-semibold">{pct === 100 ? '¡Listo! 🎉' : `Faltan ${total - done}`}</span>
          </div>
          <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
            <div className="h-full bg-coral transition-all" style={{ width: `${pct}%` }}/>
          </div>
        </div>
      </section>

      {/* Checklist por buckets */}
      <section className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {buckets.map(b => (
          <div key={b.key}
            className={`bg-white border rounded-2xl overflow-hidden
              ${b.status === 'now' ? 'border-coral shadow-lg' :
                b.status === 'past' ? 'border-stone-200 opacity-95' : 'border-stone-200'}`}>
            <div className={`px-5 py-3 border-b border-stone-100 flex items-center justify-between
              ${b.status === 'now' ? 'bg-coral/5' : b.status === 'past' ? 'bg-stone-50' : ''}`}>
              <div className="flex items-center gap-2">
                <h2 className="font-serif text-lg font-bold text-ink">{b.label}</h2>
                {b.status === 'now' && (
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-coral text-white px-2 py-0.5 rounded-full">
                    Toca AHORA
                  </span>
                )}
                {b.status === 'past' && (
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-stone-200 text-stone-600 px-2 py-0.5 rounded-full">
                    Ya debería estar
                  </span>
                )}
              </div>
              <span className="text-xs text-ink/55">
                {b.items.filter(i => doneKeys.has(i.key)).length}/{b.items.length}
              </span>
            </div>
            <ul>
              {b.items.map(item => {
                const isDone = doneKeys.has(item.key)
                const cat    = item.category ? CATEGORIES.find(c => c.id === item.category) : null
                return (
                  <li key={item.key}
                    className={`flex items-start gap-3 px-5 py-3.5 border-b border-stone-100 last:border-b-0 transition-colors
                      ${isDone ? 'bg-cream/40' : 'hover:bg-cream/30'}`}>
                    <button onClick={() => toggleItem(item.key, isDone)}
                      aria-pressed={isDone}
                      className={`mt-0.5 w-6 h-6 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all
                        ${isDone
                          ? 'bg-coral border-coral text-white'
                          : 'border-stone-300 hover:border-coral'}`}>
                      {isDone && <span className="text-xs font-bold">✓</span>}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-medium ${isDone ? 'text-ink/45 line-through' : 'text-ink'}`}>
                        {item.label}
                      </div>
                      {item.description && !isDone && (
                        <div className="text-xs text-ink/55 mt-0.5">{item.description}</div>
                      )}
                    </div>
                    {cat && !isDone && (
                      <Link href={`/proveedores?categoria=${cat.id}${event.city ? `&ciudad=${event.city}` : ''}`}
                        className="text-[10px] font-bold uppercase tracking-wider text-coral hover:underline whitespace-nowrap flex-shrink-0">
                        {cat.icon} Buscar →
                      </Link>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </section>

      {/* CTA final */}
      <section className="max-w-4xl mx-auto px-6">
        <div className="bg-white border border-stone-200 rounded-2xl p-6 text-center">
          <h3 className="font-serif text-lg font-bold text-ink mb-2">¿Quieres una segunda opinión?</h3>
          <p className="text-sm text-ink/60 mb-4">
            Comparte tus favoritos con tu pareja o familia.
          </p>
          <div className="flex gap-2 justify-center flex-wrap">
            <Link href="/favoritos" className="bg-coral text-white font-bold px-5 py-2.5 rounded-xl text-sm hover:bg-coral-dark transition-colors">
              Ver mis favoritos
            </Link>
            <Link href="/quiz" className="border border-stone-200 text-ink font-semibold px-5 py-2.5 rounded-xl text-sm hover:border-coral hover:text-coral transition-colors">
              ✨ Hacer el quiz
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
