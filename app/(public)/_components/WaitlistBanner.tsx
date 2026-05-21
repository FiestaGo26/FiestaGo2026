'use client'

import { useState, useEffect, FormEvent } from 'react'
import toast from 'react-hot-toast'

const LAUNCH_DATE = new Date('2026-06-10T09:00:00+02:00')
const DISMISSED_KEY = 'fiestago_waitlist_dismissed'
const SUBSCRIBED_KEY = 'fiestago_waitlist_subscribed'

function daysUntilLaunch(): number {
  const ms = LAUNCH_DATE.getTime() - Date.now()
  return Math.max(0, Math.ceil(ms / 86_400_000))
}

type Props = {
  /** De qué página viene la inscripción — útil para analytics en BD. */
  source?: string
}

export default function WaitlistBanner({ source = 'home-banner' }: Props) {
  const [days, setDays] = useState<number | null>(null)
  const [hidden, setHidden] = useState(true)  // empieza oculto hasta hidratar
  const [modalOpen, setModalOpen] = useState(false)

  // Decisión de mostrar/ocultar — solo client-side para evitar mismatch
  useEffect(() => {
    if (typeof window === 'undefined') return
    const dismissed   = localStorage.getItem(DISMISSED_KEY) === '1'
    const subscribed  = localStorage.getItem(SUBSCRIBED_KEY) === '1'
    if (dismissed || subscribed) return       // queda hidden=true
    setDays(daysUntilLaunch())
    setHidden(false)
  }, [])

  function handleDismiss() {
    localStorage.setItem(DISMISSED_KEY, '1')
    setHidden(true)
  }

  if (hidden || days === null) return null
  if (days === 0) return null  // ya lanzado

  return (
    <>
      <div className="bg-gradient-to-r from-coral via-coral to-coral-dark text-white">
        <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-sm flex-1 min-w-0">
            <span className="text-lg">🎉</span>
            <span className="truncate">
              <strong>Faltan {days} día{days===1?'':'s'} para el lanzamiento.</strong>
              {' '}<span className="hidden sm:inline">Apúntate ahora y entra al sorteo de un evento de 300€.</span>
              <span className="sm:hidden">Sorteo 300€ para los primeros.</span>
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => setModalOpen(true)}
              className="bg-white text-coral text-xs sm:text-sm font-bold px-3 sm:px-4 py-1.5 rounded-full hover:bg-cream transition-colors">
              Apuntarme
            </button>
            <button onClick={handleDismiss}
              aria-label="Cerrar"
              className="w-7 h-7 rounded-full hover:bg-white/15 transition-colors flex items-center justify-center opacity-70 hover:opacity-100 text-base">
              ×
            </button>
          </div>
        </div>
      </div>
      {modalOpen && (
        <WaitlistModal
          source={source}
          onClose={() => setModalOpen(false)}
          onSubscribed={() => {
            localStorage.setItem(SUBSCRIBED_KEY, '1')
            setHidden(true)
            setModalOpen(false)
          }}
        />
      )}
    </>
  )
}

function WaitlistModal({ source, onClose, onSubscribed }: {
  source: string
  onClose: () => void
  onSubscribed: () => void
}) {
  const [email, setEmail]         = useState('')
  const [name, setName]           = useState('')
  const [city, setCity]           = useState('')
  const [eventType, setEventType] = useState('')
  const [sending, setSending]     = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSending(true)
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, city, event_type: eventType, source }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Algo no fue bien')
        setSending(false)
        return
      }
      if (data.alreadyExists) {
        toast.success('Ya estabas apuntado 🎉')
      } else {
        toast.success('¡Apuntado! Revisa tu correo')
      }
      onSubscribed()
    } catch (err: any) {
      toast.error('Sin conexión, prueba de nuevo')
      setSending(false)
    }
  }

  return (
    <div onClick={onClose}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
      <div onClick={e => e.stopPropagation()}
        className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-br from-coral to-coral-dark text-white p-6 text-center">
          <div className="text-4xl mb-2">🎉</div>
          <h2 className="font-serif text-2xl font-bold leading-tight">Únete a la waitlist de FiestaGo</h2>
          <p className="text-sm opacity-90 mt-2">Lanzamos el 10 de junio. Tú entras antes que nadie.</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-ink/60 uppercase tracking-wide mb-1.5">Email *</label>
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
              autoFocus
              placeholder="tu@email.com"
              className="w-full px-3 py-2.5 rounded-xl border border-stone-200 focus:border-coral focus:ring-2 focus:ring-coral/20 focus:outline-none text-sm"/>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-ink/60 uppercase tracking-wide mb-1.5">Nombre</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)}
                placeholder="Marta"
                className="w-full px-3 py-2.5 rounded-xl border border-stone-200 focus:border-coral focus:ring-2 focus:ring-coral/20 focus:outline-none text-sm"/>
            </div>
            <div>
              <label className="block text-xs font-bold text-ink/60 uppercase tracking-wide mb-1.5">Ciudad</label>
              <input type="text" value={city} onChange={e => setCity(e.target.value)}
                placeholder="Madrid"
                className="w-full px-3 py-2.5 rounded-xl border border-stone-200 focus:border-coral focus:ring-2 focus:ring-coral/20 focus:outline-none text-sm"/>
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-ink/60 uppercase tracking-wide mb-1.5">¿Qué evento?</label>
            <select value={eventType} onChange={e => setEventType(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-stone-200 focus:border-coral focus:ring-2 focus:ring-coral/20 focus:outline-none text-sm bg-white">
              <option value="">— Elige (opcional) —</option>
              <option value="boda">Boda</option>
              <option value="cumpleanos">Cumpleaños</option>
              <option value="comunion">Comunión</option>
              <option value="corporativo">Evento corporativo / despedida</option>
              <option value="otro">Otro</option>
            </select>
          </div>

          <ul className="text-xs text-ink/65 space-y-1.5 bg-cream rounded-xl p-3 leading-relaxed">
            <li>🔓 <strong>Acceso prioritario</strong> el día del lanzamiento.</li>
            <li>🎁 <strong>Sorteo</strong> de un evento de 300€ entre los primeros 100.</li>
            <li>🛡️ <strong>Garantía de Éxito</strong> — si tu proveedor falla, te respondemos.</li>
          </ul>

          <button type="submit" disabled={sending}
            className="w-full bg-coral text-white font-bold py-3 rounded-xl text-sm hover:bg-coral-dark transition-colors disabled:opacity-60">
            {sending ? 'Enviando…' : 'Apuntarme a la waitlist'}
          </button>
          <p className="text-[10px] text-ink/45 text-center">
            Solo te escribiremos para confirmar y avisarte del lanzamiento. Cero spam.
          </p>
        </form>
      </div>
    </div>
  )
}
