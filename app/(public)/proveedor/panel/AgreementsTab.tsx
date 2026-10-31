'use client'

// Acuerdos con clientes (lib/agreements.ts): el proveedor escribe lo que
// incluye su servicio, el precio y las condiciones, y se lo envía al
// cliente para que lo acepte. Queda registrado para los dos.

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { formatEuro, precioCliente } from '@/lib/pricing'

type Row = { id: string; status: string; created_at: string; client_name: string; client_email: string; event_date: string | null; service_title: string; price_total: number; guarantee_offered: boolean; guarantee_chosen: boolean | null; accepted_at: string | null; url: string }

const EMPTY = { client_name: '', client_email: '', client_phone: '', event_type: '', event_date: '', event_place: '', guests: '', hours: '',
  service_title: '', includes: '', not_includes: '', price_total: '', deposit_amount: '', payment_terms: '', cancellation_terms: '', other_terms: '', guarantee_offered: true }
const STATUS: Record<string, string> = { enviado: '📨 Enviado, sin aceptar', aceptado: '✅ Aceptado', cancelado: 'Anulado' }

const input = 'w-full border border-stone-200 rounded-xl px-3 py-2 text-sm text-ink outline-none focus:border-coral'

export default function AgreementsTab({ providerId, apiFetch }: { providerId: string; apiFetch: (url: string, init?: RequestInit) => Promise<Response> }) {
  const [rows, setRows] = useState<Row[]>([])
  const [form, setForm] = useState<any>(EMPTY)
  const [open, setOpen] = useState(false)
  const [sending, setSending] = useState(false)
  const set = (k: string) => (e: any) => setForm((f: any) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  const load = () => apiFetch(`/api/proveedor/agreements?provider_id=${providerId}`).then(r => r.json()).then(d => setRows(d.agreements || [])).catch(() => {})
  useEffect(() => { load() }, [providerId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function send() {
    setSending(true)
    const res = await apiFetch('/api/proveedor/agreements', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider_id: providerId, ...form }) })
    const d = await res.json().catch(() => ({}))
    setSending(false)
    if (!res.ok) { toast.error(d.error || 'No se pudo enviar'); return }
    toast.success('Acuerdo enviado al cliente ✓')
    setForm(EMPTY); setOpen(false); load()
  }
  async function cancel(id: string) {
    const res = await apiFetch('/api/proveedor/agreements', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider_id: providerId, cancel_id: id }) })
    if (res.ok) { toast.success('Anulado'); load() } else toast.error('No se puede anular')
  }

  const price = Number(String(form.price_total).replace(',', '.')) || 0
  return (
    <div className="max-w-2xl">
      <div className="bg-white border border-stone-200 rounded-2xl p-5 mb-5 shadow-card">
        <h2 className="font-serif text-xl font-bold text-ink mb-1">Acuerdos con tus clientes</h2>
        <p className="text-xs text-ink/60 mb-3 leading-relaxed">
          Envía a tu cliente, por escrito, lo que incluye tu servicio, el precio, cómo se paga y qué pasa si hay que cancelar. Lo acepta con su nombre desde
          el enlace y queda registrado con fecha y hora: seguridad para los dos. Arriba solo sale FiestaGo; los compromisos son entre tú y tu cliente.
          No tiene ningún coste para ti. Puedes ofrecerle la Garantía de Éxito FiestaGo (la paga el cliente si la elige: un 8 % más).
        </p>
        {!open && <button onClick={() => setOpen(true)} className="bg-coral text-white text-sm font-bold px-4 py-2 rounded-xl">+ Nuevo acuerdo</button>}
        {open && (
          <div className="flex flex-col gap-2">
            <div className="grid sm:grid-cols-3 gap-2">
              <input className={input} placeholder="Nombre del cliente" value={form.client_name} onChange={set('client_name')}/>
              <input className={input} placeholder="Email del cliente" type="email" value={form.client_email} onChange={set('client_email')}/>
              <input className={input} placeholder="Teléfono (opcional)" value={form.client_phone} onChange={set('client_phone')}/>
            </div>
            <div className="grid sm:grid-cols-3 gap-2">
              <input className={input} placeholder="Celebración (boda, comunión…)" value={form.event_type} onChange={set('event_type')}/>
              <input className={input} type="date" value={form.event_date} onChange={set('event_date')}/>
              <input className={input} placeholder="Lugar" value={form.event_place} onChange={set('event_place')}/>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input className={input} type="number" min={0} placeholder="Invitados" value={form.guests} onChange={set('guests')}/>
              <input className={input} type="number" min={0} placeholder="Horas" value={form.hours} onChange={set('hours')}/>
            </div>
            <input className={input} placeholder="Servicio (ej.: Fotografía de la comunión, reportaje completo)" value={form.service_title} onChange={set('service_title')}/>
            <textarea className={input} rows={3} placeholder="Qué incluye exactamente (horas, personal, material, entregas y plazos, menú…)" value={form.includes} onChange={set('includes')}/>
            <textarea className={input} rows={2} placeholder="Qué no incluye (opcional)" value={form.not_includes} onChange={set('not_includes')}/>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs font-semibold text-ink">Precio total, IVA incluido (€)
                <input className={`${input} mt-1`} type="number" min={0} value={form.price_total} onChange={set('price_total')}/>
              </label>
              <label className="text-xs font-semibold text-ink">Señal (€, opcional)
                <input className={`${input} mt-1`} type="number" min={0} value={form.deposit_amount} onChange={set('deposit_amount')}/>
              </label>
            </div>
            <textarea className={input} rows={2} placeholder="Cómo se paga (ej.: señal al aceptar y el resto el día del evento)" value={form.payment_terms} onChange={set('payment_terms')}/>
            <textarea className={input} rows={2} placeholder="Si hay que cancelar (ej.: hasta 30 días antes se devuelve la señal; después no)" value={form.cancellation_terms} onChange={set('cancellation_terms')}/>
            <textarea className={input} rows={2} placeholder="Otras condiciones (opcional)" value={form.other_terms} onChange={set('other_terms')}/>
            <label className="flex items-start gap-2 text-xs text-ink">
              <input type="checkbox" checked={form.guarantee_offered} onChange={set('guarantee_offered')} className="mt-0.5 accent-coral"/>
              <span>Ofrecer al cliente la Garantía de Éxito FiestaGo{price > 0 ? ` (la verá como opción: ${formatEuro(precioCliente(price))} en vez de ${formatEuro(price)})` : ''}.</span>
            </label>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setOpen(false)} className="text-sm text-ink/60 px-3">Cancelar</button>
              <button onClick={send} disabled={sending} className="bg-coral text-white text-sm font-bold px-4 py-2 rounded-xl disabled:opacity-50">{sending ? 'Enviando…' : 'Enviar al cliente'}</button>
            </div>
          </div>
        )}
      </div>

      {rows.map(r => (
        <div key={r.id} className="bg-white border border-stone-200 rounded-xl p-4 mb-3 text-sm">
          <div className="flex justify-between gap-2 flex-wrap">
            <div className="font-semibold text-ink">{r.client_name} · {r.service_title}</div>
            <div className="font-bold text-ink">{formatEuro(r.guarantee_chosen ? precioCliente(r.price_total) : r.price_total)}</div>
          </div>
          <div className="text-xs text-ink/60 mt-1">
            {STATUS[r.status] || r.status}{r.accepted_at ? ` el ${new Date(r.accepted_at).toLocaleDateString('es-ES')}` : ''}
            {r.event_date ? ` · evento ${new Date(`${r.event_date}T12:00:00`).toLocaleDateString('es-ES')}` : ''}
            {r.guarantee_chosen ? ' · con Garantía de Éxito' : ''}
          </div>
          <div className="flex gap-3 mt-2 text-xs">
            <a href={r.url} target="_blank" rel="noreferrer" className="underline text-coral font-semibold">Ver el acuerdo</a>
            <button onClick={() => { navigator.clipboard?.writeText(r.url); toast.success('Enlace copiado') }} className="underline text-ink/60">Copiar enlace</button>
            {r.status === 'enviado' && <button onClick={() => cancel(r.id)} className="underline text-ink/50">Anular</button>}
          </div>
        </div>
      ))}
    </div>
  )
}
