'use client'

import { useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { formatEuro } from '@/lib/pricing'

// Reservar desde la propuesta (con su precio exacto) o compartirla con
// quien decide contigo. Nada de cuentas atrás ni prisas: la simulación
// mostró que la presión aleja.

export default function ProposalActions({ token, firstPayment, converted, hasDate, holdUntil, providerName, fichaUrl }: {
  token: string
  firstPayment: number
  converted: boolean
  hasDate: boolean
  holdUntil: string | null
  providerName: string
  fichaUrl: string
}) {
  const [phone, setPhone] = useState('')
  const [accepted, setAccepted] = useState(false)
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(converted)

  async function share() {
    const url = window.location.href
    const text = `Mira la propuesta de ${providerName} para nuestro evento:`
    try {
      if (navigator.share) { await navigator.share({ title: 'Propuesta · FiestaGo', text, url }); return }
    } catch { return }
    window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`, '_blank')
  }

  async function book() {
    if (!accepted) { toast.error('Marca que has leído las condiciones'); return }
    setSending(true)
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposal_token: token, client_phone: phone || null }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok || d.error) throw new Error(d.error || `Error ${res.status}`)
      setDone(true)
      toast.success('¡Reserva enviada!')
    } catch (err: any) { toast.error(err.message || 'No se pudo reservar') }
    setSending(false)
  }

  if (done) return (
    <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-emerald-900">
      <div className="font-serif text-xl font-bold mb-1">Reserva enviada ✓</div>
      <p className="text-sm">Se la hemos pasado a {providerName} para que la confirme. En cuanto lo haga te enviamos por email el enlace para pagar la señal; hasta entonces no pagas nada. Si tienes cualquier duda, contesta a ese email y te llamamos.</p>
    </div>
  )

  return (
    <div className="bg-white border-2 border-coral/40 rounded-2xl p-6">
      <h2 className="font-serif text-xl font-bold text-ink mb-1">¿Os encaja?</h2>
      {holdUntil && <p className="text-xs text-ink/60 mb-3">Tu fecha está bloqueada hasta el {new Date(holdUntil).toLocaleString('es-ES', { timeZone: 'Europe/Madrid', weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}. Sin pagar nada.</p>}
      {hasDate ? (
        <>
          <label className="block text-xs font-semibold text-ink mb-1">Teléfono (opcional, por si hay que avisarte de algo)</label>
          <input value={phone} onChange={e => setPhone(e.target.value)} inputMode="tel" placeholder="600 000 000"
            className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm text-ink outline-none focus:border-coral mb-3"/>
          <label className="flex items-start gap-2 text-xs text-ink/70 mb-4">
            <input type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)} className="mt-0.5 accent-coral"/>
            He leído el precio, qué incluye y las condiciones de esta propuesta.
          </label>
          <button type="button" onClick={book} disabled={sending}
            className="w-full bg-coral text-white font-bold py-3 rounded-xl hover:bg-coral-dark disabled:opacity-50">
            {sending ? 'Reservando…' : `Reservar con señal de ${formatEuro(firstPayment)}`}
          </button>
        </>
      ) : (
        <p className="text-sm text-ink/70 mb-3">Falta concretar la fecha. Escríbenos respondiendo al email y la cerramos contigo, o mira su <Link href={fichaUrl} className="underline">ficha</Link>.</p>
      )}
      <button type="button" onClick={share}
        className="w-full mt-3 border border-stone-300 text-ink font-semibold py-3 rounded-xl hover:bg-cream">
        Compartir con quien lo decide conmigo
      </button>
      <p className="text-xs text-ink/55 mt-3 text-center">¿Prefieres hablarlo? Responde al email de la propuesta con tu número y una hora y te llamamos desde FiestaGo.</p>
    </div>
  )
}
