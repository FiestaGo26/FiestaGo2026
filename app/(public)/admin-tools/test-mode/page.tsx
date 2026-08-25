'use client'

import { useState, useEffect } from 'react'
import toast, { Toaster } from 'react-hot-toast'

// Consola de control TEST · para probar el flujo end-to-end sin Stripe
// ni esperar días reales. Requiere ADMIN_PASSWORD guardado en localStorage
// (mismo patrón que el resto de /admin-tools).

type Booking = {
  id: string
  client_name: string
  client_email: string
  event_date: string
  event_type: string | null
  total_amount: number
  status: string
  first_payment_status: string
  second_payment_status: string
  second_payment_due_date: string | null
  second_payment_amount: number | null
  provider_id: string | null
  providers?: { name: string } | null
}

type Invoice = {
  id: string
  full_number: string
  issue_date: string
  invoice_type: string
  issuer_tax_name: string
  recipient_name: string
  recipient_email: string
  total_amount: number
  cancelled_at: string | null
}

const EUR = (n: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 }).format(n)

export default function TestModePage() {
  const [pass, setPass] = useState('')
  const [authed, setAuthed] = useState(false)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [busy, setBusy] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [tab, setTab] = useState<'bookings' | 'invoices'>('bookings')

  useEffect(() => {
    try {
      const stored = localStorage.getItem('fg_admin_pass')
      if (stored) { setPass(stored); setAuthed(true); loadAll(stored) }
    } catch {}
  }, [])

  function headers(p?: string): HeadersInit {
    return { 'Content-Type': 'application/json', 'x-admin-password': p || pass }
  }

  async function login() {
    try { localStorage.setItem('fg_admin_pass', pass) } catch {}
    setAuthed(true)
    loadAll(pass)
  }

  async function loadAll(p?: string) {
    setBusy(true)
    try {
      const [b, i] = await Promise.all([
        fetch('/api/admin/test', { method: 'POST', headers: headers(p), body: JSON.stringify({ action: 'list-bookings' }) }),
        fetch('/api/admin/test', { method: 'POST', headers: headers(p), body: JSON.stringify({ action: 'list-invoices' }) }),
      ])
      if (b.status === 401) { setAuthed(false); toast.error('Contraseña admin incorrecta'); return }
      if (b.status === 403) { toast.error('Test mode desactivado. Añade FIESTAGO_TEST_MODE=true'); return }
      const bd = await b.json()
      const id = await i.json()
      setBookings(bd.bookings || [])
      setInvoices(id.invoices || [])
    } catch (e: any) { toast.error(e.message || 'Error') }
    setBusy(false)
  }

  async function action(payload: any, msg: string) {
    setBusy(true)
    try {
      const res = await fetch('/api/admin/test', { method: 'POST', headers: headers(), body: JSON.stringify(payload) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      toast.success(msg)
      await loadAll()
    } catch (e: any) { toast.error(e.message || 'Error') }
    setBusy(false)
  }

  async function payFirst(bookingId: string) {
    setBusy(true)
    try {
      const res = await fetch(`/api/mock/pay-first/${bookingId}`, { method: 'POST', headers: headers() })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      toast.success(data.message || 'Primer pago simulado')
      await loadAll()
    } catch (e: any) { toast.error(e.message || 'Error') }
    setBusy(false)
  }

  async function paySecond(bookingId: string, email: string) {
    setBusy(true)
    try {
      const res = await fetch(`/api/mock/pay-second/${bookingId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      toast.success(`Segundo pago simulado (${EUR(Number(data.amount || 0))})`)
      await loadAll()
    } catch (e: any) { toast.error(e.message || 'Error') }
    setBusy(false)
  }

  if (!authed) {
    return (
      <main className="min-h-screen bg-cream grid place-items-center px-6">
        <div className="max-w-sm w-full bg-white border border-stone-200 rounded-2xl p-6 shadow-card">
          <h1 className="font-serif text-2xl text-ink mb-4">Test mode · admin</h1>
          <input type="password" placeholder="Contraseña admin"
            value={pass} onChange={e => setPass(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') login() }}
            className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-coral" />
          <button onClick={login}
            className="w-full mt-3 bg-ink text-white font-bold py-3 rounded-xl text-sm hover:bg-ink/85 transition-colors">
            Entrar
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-cream py-8 px-6">
      <Toaster position="top-right" />
      <div className="max-w-6xl mx-auto">
        <div className="flex items-baseline justify-between gap-2 mb-6 flex-wrap">
          <div>
            <div className="text-[10px] font-bold tracking-widest uppercase text-amber-700 mb-1">Modo test · FiestaGo</div>
            <h1 className="font-serif text-3xl font-black text-ink">Consola E2E</h1>
            <p className="text-ink/55 text-sm mt-1">
              Herramientas para simular el flujo completo sin Stripe ni esperar días reales.
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => action({ action: 'run-cron' }, 'Cron ejecutado')} disabled={busy}
              className="bg-emerald-600 text-white text-xs font-bold px-4 py-2 rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50">
              ▶ Disparar cron ahora
            </button>
            <button onClick={() => loadAll()} disabled={busy}
              className="bg-white border border-stone-200 text-ink text-xs font-semibold px-4 py-2 rounded-xl hover:bg-stone-50 transition-colors disabled:opacity-50">
              ↻ Recargar
            </button>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6 text-sm text-amber-900">
          <strong>Estás en modo TEST.</strong> Los mocks de pago simulan cobros sin dinero real. El time-travel altera fechas de reservas para que el cron las procese como si hubieran pasado los días. Todo queda registrado con `test_mode: true` en las notifications.
        </div>

        <div className="flex gap-2 mb-4 border-b border-stone-200">
          {(['bookings', 'invoices'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`text-sm font-semibold px-4 py-3 transition-all border-b-2 ${
                tab === t ? 'border-coral text-coral' : 'border-transparent text-ink/55 hover:text-ink'
              }`}>
              {t === 'bookings' ? `📋 Reservas (${bookings.length})` : `📄 Facturas (${invoices.length})`}
            </button>
          ))}
        </div>

        {tab === 'bookings' && (
          <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-stone-50 border-b border-stone-200 text-[10px] font-bold text-ink/45 uppercase tracking-widest">
                    <th className="text-left px-4 py-3">Cliente / Evento</th>
                    <th className="text-left px-4 py-3">1er pago</th>
                    <th className="text-left px-4 py-3">2º pago</th>
                    <th className="text-left px-4 py-3">Estado</th>
                    <th className="text-right px-4 py-3">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map(b => (
                    <tr key={b.id} className="border-b border-stone-100 last:border-0">
                      <td className="px-4 py-3 text-xs">
                        <div className="font-semibold text-ink">{b.client_name}</div>
                        <div className="text-ink/45 mt-0.5">{b.client_email}</div>
                        <div className="text-ink/60 mt-1">
                          <strong>{b.providers?.name || '—'}</strong> · {new Date(b.event_date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: '2-digit' })}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <StatusPill status={b.first_payment_status} />
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <StatusPill status={b.second_payment_status} />
                        {b.second_payment_amount && (b.second_payment_amount ?? 0) > 0 && (
                          <div className="text-ink/50 text-[10px] mt-1">
                            {EUR(Number(b.second_payment_amount))} · vence {b.second_payment_due_date ? new Date(b.second_payment_due_date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : '—'}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <StatusPill status={b.status} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex flex-col gap-1 items-end">
                          {b.first_payment_status !== 'paid' && (
                            <button onClick={() => payFirst(b.id)} disabled={busy}
                              className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-lg hover:bg-emerald-100">
                              Simular 1er pago
                            </button>
                          )}
                          {['pending', 'overdue'].includes(b.second_payment_status) && (
                            <button onClick={() => paySecond(b.id, b.client_email)} disabled={busy}
                              className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-lg hover:bg-emerald-100">
                              Simular 2º pago
                            </button>
                          )}
                          {b.second_payment_due_date && (
                            <>
                              <button onClick={() => action({ action: 'time-travel', booking_id: b.id, days_backward: 5 }, 'Adelantado 5 días')} disabled={busy}
                                className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-lg hover:bg-amber-100">
                                ⏩ +5 días
                              </button>
                              <button onClick={() => action({ action: 'time-travel', booking_id: b.id, days_backward: 8, reset_reminders: true }, 'Adelantado 8 días (post-gracia)')} disabled={busy}
                                className="text-[10px] font-bold text-red-700 bg-red-50 border border-red-200 px-2 py-1 rounded-lg hover:bg-red-100">
                                ⏩ +8 días (cancela)
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {bookings.length === 0 && (
                    <tr><td colSpan={5} className="text-center text-ink/40 py-10">Sin reservas. Crea una desde la ficha pública de cualquier proveedor.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'invoices' && (
          <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-stone-50 border-b border-stone-200 text-[10px] font-bold text-ink/45 uppercase tracking-widest">
                    <th className="text-left px-4 py-3">Nº</th>
                    <th className="text-left px-4 py-3">Fecha</th>
                    <th className="text-left px-4 py-3">Tipo</th>
                    <th className="text-left px-4 py-3">Emisor</th>
                    <th className="text-left px-4 py-3">Receptor</th>
                    <th className="text-right px-4 py-3">Total</th>
                    <th className="text-right px-4 py-3">PDF</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map(inv => (
                    <tr key={inv.id} className="border-b border-stone-100 last:border-0">
                      <td className="px-4 py-3 font-mono text-xs font-semibold whitespace-nowrap">{inv.full_number}</td>
                      <td className="px-4 py-3 text-xs text-ink/65 whitespace-nowrap">{new Date(inv.issue_date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: '2-digit' })}</td>
                      <td className="px-4 py-3 text-xs">
                        {inv.invoice_type === 'commission_fiestago'
                          ? <span className="text-[10px] font-bold text-coral bg-coral/10 px-2 py-0.5 rounded-full">COMISIÓN</span>
                          : <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">DELEGADA</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-ink/70">{inv.issuer_tax_name}</td>
                      <td className="px-4 py-3 text-xs text-ink/70">{inv.recipient_name} · {inv.recipient_email}</td>
                      <td className="px-4 py-3 text-ink font-semibold tabular-nums text-right">{EUR(Number(inv.total_amount))}</td>
                      <td className="px-4 py-3 text-right">
                        <a href={`/api/invoices/${inv.id}/pdf?email=${encodeURIComponent(inv.recipient_email)}`} target="_blank" rel="noreferrer"
                          className="text-xs font-semibold text-coral hover:underline">Abrir ↗</a>
                      </td>
                    </tr>
                  ))}
                  {invoices.length === 0 && (
                    <tr><td colSpan={7} className="text-center text-ink/40 py-10">Sin facturas emitidas todavía. Confirma una reserva para que se emitan.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

function StatusPill({ status }: { status: string }) {
  const meta: Record<string, { color: string; bg: string; label: string }> = {
    pending:      { color: '#F59E0B', bg: '#FEF3C7', label: 'PENDING' },
    paid:         { color: '#10B981', bg: '#D1FAE5', label: 'PAID' },
    confirmed:    { color: '#10B981', bg: '#D1FAE5', label: 'CONFIRMED' },
    cancelled:    { color: '#DC2626', bg: '#FEE2E2', label: 'CANCELLED' },
    overdue:      { color: '#DC2626', bg: '#FEE2E2', label: 'OVERDUE' },
    not_needed:   { color: '#6B7280', bg: '#F3F4F6', label: 'N/A' },
    completed:    { color: '#3B82F6', bg: '#DBEAFE', label: 'COMPLETED' },
    refunded:     { color: '#8B5CF6', bg: '#EDE9FE', label: 'REFUNDED' },
  }
  const m = meta[status] || { color: '#6B7280', bg: '#F3F4F6', label: (status || '—').toUpperCase() }
  return (
    <span className="text-[9px] font-bold tracking-widest px-2 py-0.5 rounded-full inline-block"
      style={{ color: m.color, background: m.bg }}>
      {m.label}
    </span>
  )
}
