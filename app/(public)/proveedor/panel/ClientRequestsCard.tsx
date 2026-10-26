'use client'

// Peticiones de clientes (presupuestos y fechas bloqueadas 48 h). El
// proveedor no ve el email ni el teléfono del cliente: responde aquí con
// su propuesta (precio cerrado para ese cliente, qué incluye y la señal) y
// FiestaGo se la envía como página para revisar, compartir y reservar.
// Verá los datos del cliente cuando pague la señal.

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { DEPOSIT_MIN, DEPOSIT_MAX, formatEuro, precioCliente } from '@/lib/pricing'

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
  service_name: string | null
  suggested_total: number | null
  suggested_deposit_pct: number
  quote_total: number | null
  proposal_url: string | null
  questions: Array<{ q: string; a: string | null; by?: 'fiestago' | 'proveedor' }> | null
  hours: number | null
}

type Draft = { total: string; includes: string; deposit: number; note: string; fechaOk: boolean; noIncluye: string; planB: string }

const fmtDate = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })

export default function ClientRequestsCard({ providerId, apiFetch }: {
  providerId: string
  apiFetch: (url: string, init?: RequestInit) => Promise<Response>
}) {
  const [requests, setRequests] = useState<Request[]>([])
  const [drafts,   setDrafts]   = useState<Record<string, Draft>>({})
  const [sending,  setSending]  = useState<string | null>(null)
  const [answers,  setAnswers]  = useState<Record<string, string>>({})

  async function answer(r: Request, i: number) {
    const key = `${r.id}:${i}`
    const text = (answers[key] || '').trim()
    if (text.length < 2) { toast.error('Escribe tu respuesta'); return }
    setSending(key)
    try {
      const res = await apiFetch('/api/proveedor/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider_id: providerId, id: r.id, question_index: i, answer: text }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.error || 'No se pudo enviar')
      setRequests(rs => rs.map(x => x.id === r.id ? { ...x, questions: (x.questions || []).map((q, j) => j === i ? { ...q, a: text } : q) } : x))
      toast.success('Respuesta enviada ✓')
    } catch (err: any) { toast.error(err.message) }
    setSending(null)
  }

  useEffect(() => {
    apiFetch(`/api/proveedor/requests?provider_id=${providerId}`)
      .then(r => r.json())
      .then(d => setRequests(d.requests || []))
      .catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providerId])

  const draftOf = (r: Request): Draft => drafts[r.id] || {
    total: r.suggested_total ? String(r.suggested_total) : '', includes: '', deposit: r.suggested_deposit_pct || DEPOSIT_MIN, note: '',
    fechaOk: false, noIncluye: '', planB: '',
  }
  const setDraft = (r: Request, patch: Partial<Draft>) => setDrafts(d => ({ ...d, [r.id]: { ...draftOf(r), ...patch } }))

  async function reply(r: Request) {
    const d0 = draftOf(r)
    const total = Number(String(d0.total).replace(',', '.')) || 0
    if (total <= 0) { toast.error('Pon el precio total para este cliente'); return }
    if (d0.includes.trim().length < 5) { toast.error('Explica qué incluye el precio'); return }
    if (r.event_date && !d0.fechaOk) { toast.error('Confirma que tienes libre su fecha'); return }
    if (d0.noIncluye.trim().length < 3) { toast.error('Di qué NO incluye (o "nada más")'); return }
    setSending(r.id)
    try {
      const res = await apiFetch('/api/proveedor/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider_id: providerId, id: r.id, total, includes: d0.includes, deposit_pct: d0.deposit, reply: d0.note,
          details: { fecha_confirmada: d0.fechaOk, no_incluye: d0.noIncluye, plan_b: d0.planB } }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.error || 'No se pudo enviar')
      setRequests(rs => rs.map(x => x.id === r.id ? { ...x, provider_reply: d0.note || null, quote_total: total, proposal_url: d.proposal_url, replied_at: new Date().toISOString() } : x))
      toast.success('Propuesta enviada al cliente ✓')
    } catch (err: any) { toast.error(err.message) }
    setSending(null)
  }

  if (requests.length === 0) return null

  return (
    <div className="bg-white border border-stone-200 rounded-2xl p-5 mb-6 shadow-card">
      <h2 className="font-serif text-xl font-bold text-ink mb-1">Peticiones de clientes</h2>
      <p className="text-xs text-ink/55 mb-4 leading-relaxed">
        Presupuestos y fechas bloqueadas 48 h. Mándale tu propuesta: precio total para su caso, qué incluye y la señal.
        Se la enviamos como una página que puede compartir con su pareja o su familia y desde la que reserva.
        Casi nadie reserva sin un precio cerrado por escrito, así que cuanto antes, mejor.
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
              {r.hours && ` · ${r.hours} h`}
              {r.kind === 'hold' && r.status === 'active' && r.expires_at && ` · bloqueada hasta ${new Date(r.expires_at).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`}
              {r.status === 'converted' && ' · ✅ ya reservó'}
              {r.status === 'expired' && ' · bloqueo caducado'}
            </div>
            {r.message && <p className="text-sm text-ink/70 italic mb-3">“{r.message}”</p>}
            {r.replied_at ? (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs text-emerald-800">
                <strong>Respondida</strong> ({new Date(r.replied_at).toLocaleDateString('es-ES')})
                {r.quote_total ? ` · propuesta de ${formatEuro(r.quote_total)} (el cliente ve ${formatEuro(precioCliente(r.quote_total))} con la Garantía)` : ''}
                {r.provider_reply ? `: ${r.provider_reply}` : ''}
                {r.proposal_url && <> · <a href={r.proposal_url} target="_blank" rel="noreferrer" className="underline font-semibold">ver propuesta</a></>}
              </div>
            ) : (() => {
              const d = draftOf(r)
              const total = Number(String(d.total).replace(',', '.')) || 0
              return (
                <div className="flex flex-col gap-2">
                  {r.service_name && <div className="text-[11px] text-ink/55">Servicio: {r.service_name}{r.suggested_total ? ` · tu tarifa para ${r.guests || 'estos'} invitados: ${formatEuro(r.suggested_total)}` : ''}</div>}
                  <label className="text-xs font-semibold text-ink">Precio total para este cliente, IVA incluido (lo que cobras tú)
                    <input type="number" min={0} step="1" value={d.total} onChange={e => setDraft(r, { total: e.target.value })}
                      placeholder="Ej. 1250"
                      className="mt-1 w-full border border-stone-200 rounded-xl px-3 py-2 text-sm text-ink outline-none focus:border-coral"/>
                  </label>
                  {total > 0 && <div className="text-[11px] text-ink/55">El cliente verá {formatEuro(precioCliente(total))} con la Garantía de Éxito incluida.</div>}
                  <label className="text-xs font-semibold text-ink">Qué incluye (y qué no)
                    <textarea rows={3} value={d.includes} onChange={e => setDraft(r, { includes: e.target.value })}
                      placeholder="Horas, personas, material, desplazamiento, entregas y plazos, plan B si llueve, alergias… y lo que no entra."
                      className="mt-1 w-full border border-stone-200 rounded-xl px-3 py-2 text-sm text-ink outline-none focus:border-coral resize-none"/>
                  </label>
                  <label className="text-xs font-semibold text-ink">Qué NO incluye
                    <textarea rows={2} value={d.noIncluye} onChange={e => setDraft(r, { noIncluye: e.target.value })}
                      placeholder="Ej.: el local, la bebida, horas extra (a X € la hora)… o «nada más»"
                      className="mt-1 w-full border border-stone-200 rounded-xl px-3 py-2 text-sm text-ink outline-none focus:border-coral resize-none"/>
                  </label>
                  <label className="text-xs font-semibold text-ink">Plan B si llueve o hay un imprevisto (si aplica)
                    <textarea rows={2} value={d.planB} onChange={e => setDraft(r, { planB: e.target.value })}
                      placeholder="Ej.: montamos en el salón interior / llevo equipo de repuesto"
                      className="mt-1 w-full border border-stone-200 rounded-xl px-3 py-2 text-sm text-ink outline-none focus:border-coral resize-none"/>
                  </label>
                  {r.event_date && (
                    <label className="flex items-center gap-2 text-xs font-semibold text-ink">
                      <input type="checkbox" checked={d.fechaOk} onChange={e => setDraft(r, { fechaOk: e.target.checked })} className="accent-coral"/>
                      Confirmo que tengo libre el {fmtDate(r.event_date)}
                    </label>
                  )}
                  <p className="text-[11px] text-ink/50">La garantía, los pagos y las cancelaciones se los explica FiestaGo: no hace falta que los pongas.</p>
                  <label className="text-xs font-semibold text-ink">Señal al reservar: {d.deposit} %
                    <input type="range" min={DEPOSIT_MIN} max={DEPOSIT_MAX} step={1} value={d.deposit}
                      onChange={e => setDraft(r, { deposit: Number(e.target.value) })} className="mt-1 w-full accent-coral"/>
                  </label>
                  <textarea rows={2} value={d.note} onChange={e => setDraft(r, { note: e.target.value })}
                    placeholder="Mensaje para el cliente (opcional). Sin precios: el cliente solo ve el de la propuesta. Sin teléfonos ni emails."
                    className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm text-ink outline-none focus:border-coral resize-none"/>
                  <button type="button" onClick={() => reply(r)} disabled={sending === r.id}
                    className="self-end bg-coral text-white text-xs font-bold px-4 py-2 rounded-xl hover:bg-coral-dark disabled:opacity-50">
                    {sending === r.id ? 'Enviando…' : 'Enviar propuesta'}
                  </button>
                </div>
              )
            })()}
            {(r.questions || []).map((q, i) => (
              <div key={i} className="mt-3 border-t border-stone-100 pt-3 text-sm">
                <div className="font-semibold text-ink">❓ {q.q}</div>
                {q.a ? (
                  <div className="text-xs text-emerald-800 mt-1">{q.by === 'fiestago' ? 'Contestada por FiestaGo' : 'Tu respuesta'}: {q.a}</div>
                ) : (
                  <div className="flex gap-2 mt-2">
                    <input value={answers[`${r.id}:${i}`] || ''} onChange={e => setAnswers(a => ({ ...a, [`${r.id}:${i}`]: e.target.value }))}
                      placeholder="Respuesta concreta (queda por escrito en su propuesta)"
                      className="flex-1 border border-stone-200 rounded-xl px-3 py-2 text-sm text-ink outline-none focus:border-coral"/>
                    <button type="button" onClick={() => answer(r, i)} disabled={sending === `${r.id}:${i}`}
                      className="bg-coral text-white text-xs font-bold px-3 py-2 rounded-xl disabled:opacity-50">Responder</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
