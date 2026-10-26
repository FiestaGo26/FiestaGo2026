'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import type { ProposalQuestion } from '@/lib/proposals'

// Preguntas al proveedor antes de reservar, con su respuesta por escrito.
export default function ProposalQuestions({ token, providerName, initial }: {
  token: string
  providerName: string
  initial: ProposalQuestion[]
}) {
  const [qs, setQs] = useState(initial)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)

  async function ask() {
    if (text.trim().length < 5) { toast.error('Escribe tu pregunta'); return }
    setSending(true)
    try {
      const res = await fetch(`/api/propuesta/${token}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: text }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.error || 'No se pudo enviar')
      const next: ProposalQuestion[] = d.questions || qs
      setQs(next)
      setText('')
      toast.success(next[next.length - 1]?.by === 'fiestago' && next[next.length - 1]?.a
        ? 'Te hemos contestado desde FiestaGo ✓'
        : `Enviada a ${providerName}. Te avisamos por email cuando conteste.`)
    } catch (err: any) { toast.error(err.message) }
    setSending(false)
  }

  return (
    <div className="bg-white border border-stone-200 rounded-2xl p-6 mb-5">
      <h2 className="font-serif text-xl font-bold text-ink mb-1">Pregunta antes de reservar</h2>
      <p className="text-sm text-ink/65 mb-4">Alergias, plan B si llueve, horarios, espacio… {providerName} te contesta por escrito y la respuesta queda aquí. Lo de la garantía, los pagos y las cancelaciones te lo contestamos al momento desde FiestaGo.</p>
      {qs.length > 0 && (
        <div className="space-y-3 mb-4">
          {qs.map((q, i) => (
            <div key={i} className="text-sm">
              <div className="font-semibold text-ink">❓ {q.q}</div>
              {q.a
                ? <div className="mt-1 bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-ink/80"><strong>{q.by === 'fiestago' ? 'FiestaGo' : providerName}:</strong> {q.a}</div>
                : <div className="mt-1 text-xs text-ink/50">Pendiente de respuesta. Te avisamos por email.</div>}
            </div>
          ))}
        </div>
      )}
      <textarea rows={2} value={text} onChange={e => setText(e.target.value)}
        placeholder="Escribe tu pregunta…"
        className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm text-ink outline-none focus:border-coral resize-none"/>
      <button type="button" onClick={ask} disabled={sending}
        className="mt-2 bg-ink text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-ink/85 disabled:opacity-50">
        {sending ? 'Enviando…' : 'Enviar pregunta'}
      </button>
    </div>
  )
}
