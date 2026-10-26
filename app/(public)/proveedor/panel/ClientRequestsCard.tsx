'use client'

// Peticiones de clientes (presupuestos y fechas bloqueadas 48 h). El
// proveedor no ve el email ni el teléfono del cliente: responde aquí y
// FiestaGo le envía la respuesta. Verá sus datos cuando pague la señal.

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'

type Request = {
  id: string
  created_at: string
  kind: 'hold' | 'quote'
  status: string
  event_date: string | null
  expires_at: string | null
  client_name: string
  event_type: string | null
  guests: number | null
  message: string | null
  provider_reply: string | null
  replied_at: string | null
}

const fmtDate = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })

export default function ClientRequestsCard({ providerId, apiFetch }: {
  providerId: string
  apiFetch: (url: string, init?: RequestInit) => Promise<Response>
}) {
  const [requests, setRequests] = useState<Request[]>([])
  const [drafts,   setDrafts]   = useState<Record<string, string>>({})
  const [sending,  setSending]  = useState<string | null>(null)

  useEffect(() => {
    apiFetch(`/api/proveedor/requests?provider_id=${providerId}`)
      .then(r => r.json())
      .then(d => setRequests(d.requests || []))
      .catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providerId])

  async function reply(r: Request) {
    const text = (drafts[r.id] || '').trim()
    if (text.length < 5) { toast.error('Escribe tu respuesta'); return }
    setSending(r.id)
    try {
      const res = await apiFetch('/api/proveedor/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider_id: providerId, id: r.id, reply: text }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.error || 'No se pudo enviar')
      setRequests(rs => rs.map(x => x.id === r.id ? { ...x, provider_reply: text, replied_at: new Date().toISOString() } : x))
      toast.success('Respuesta enviada al cliente ✓')
    } catch (err: any) { toast.error(err.message) }
    setSending(null)
  }

  if (requests.length === 0) return null

  return (
    <div className="bg-white border border-stone-200 rounded-2xl p-5 mb-6 shadow-card">
      <h2 className="font-serif text-xl font-bold text-ink mb-1">Peticiones de clientes</h2>
      <p className="text-xs text-ink/55 mb-4 leading-relaxed">
        Presupuestos y fechas bloqueadas 48 h. Responde aquí y se lo enviamos al cliente al momento.
        Verás su email y teléfono cuando pague la señal; hasta entonces, cualquier dato de contacto que escribas se oculta.
      </p>
      <div className="space-y-4">
        {requests.map(r => (
          <div key={r.id} className="border border-stone-200 rounded-xl p-4">
            <div className="flex items-baseline justify-between gap-2 flex-wrap mb-1">
              <div className="font-semibold text-ink text-sm">
                {r.kind === 'hold' ? '📅 Fecha bloqueada 48 h' : '💬 Pide presupuesto'} · {r.client_name}
              </div>
              <div className="text-[11px] text-ink/45">{new Date(r.created_at).toLocaleDateString('es-ES')}</div>
            </div>
            <div className="text-xs text-ink/65 mb-2">
              {r.event_date ? fmtDate(r.event_date) : 'Fecha por concretar'}
              {r.event_type && ` · ${r.event_type}`}
              {r.guests && ` · ${r.guests} invitados`}
              {r.kind === 'hold' && r.status === 'active' && r.expires_at && ` · bloqueada hasta ${new Date(r.expires_at).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`}
              {r.status === 'converted' && ' · ✅ ya reservó'}
              {r.status === 'expired' && ' · bloqueo caducado'}
            </div>
            {r.message && <p className="text-sm text-ink/70 italic mb-3">“{r.message}”</p>}
            {r.provider_reply ? (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs text-emerald-800">
                <strong>Tu respuesta</strong> ({new Date(r.replied_at!).toLocaleDateString('es-ES')}): {r.provider_reply}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <textarea rows={3} value={drafts[r.id] || ''}
                  onChange={e => setDrafts(d => ({ ...d, [r.id]: e.target.value }))}
                  placeholder="Precio total para su caso, qué incluye, disponibilidad… (sin teléfonos ni emails)"
                  className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm text-ink outline-none focus:border-coral resize-none"/>
                <button type="button" onClick={() => reply(r)} disabled={sending === r.id}
                  className="self-end bg-coral text-white text-xs font-bold px-4 py-2 rounded-xl hover:bg-coral-dark disabled:opacity-50">
                  {sending === r.id ? 'Enviando…' : 'Enviar respuesta'}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
