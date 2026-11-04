'use client'

// Cobros por FiestaGo (lib/stripe-connect.ts): abrir la cuenta de cobros,
// ver el saldo y pasarlo al banco cuando el proveedor quiera (hasta 90 días).

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { formatEuro } from '@/lib/pricing'

type Status = { configured: boolean; account?: boolean; ready?: boolean; payouts_ready?: boolean; details_submitted?: boolean; available?: number; pending?: number; deadline?: string | null; error?: string }

export default function StripeCard({ providerId, apiFetch }: { providerId: string; apiFetch: (url: string, init?: RequestInit) => Promise<Response> }) {
  const [s, setS] = useState<Status | null>(null)
  const [busy, setBusy] = useState(false)
  const load = () => apiFetch(`/api/proveedor/stripe?provider_id=${providerId}`).then(r => r.json()).then(setS).catch(() => setS({ configured: false }))
  useEffect(() => { load() }, [providerId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function act(action: 'onboard' | 'payout') {
    setBusy(true)
    const res = await apiFetch('/api/proveedor/stripe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider_id: providerId, action }) })
    const d = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) { toast.error(d.error || 'No se ha podido'); return }
    if (action === 'onboard' && d.url) { window.location.href = d.url; return }
    toast.success(`${formatEuro(d.amount)} en camino a tu banco (llega hacia el ${new Date(d.arrival).toLocaleDateString('es-ES')})`)
    load()
  }

  if (!s) return null
  const box = 'bg-white border border-stone-200 rounded-2xl p-5 mb-5 shadow-card'
  if (!s.configured) return (
    <div className={box}>
      <h2 className="font-serif text-xl font-bold text-ink mb-1">Cobrar por FiestaGo</h2>
      <p className="text-xs text-ink/60">Muy pronto podrás mandar a tu cliente un enlace para pagar con tarjeta desde el acuerdo, y dejar el dinero guardado hasta que quieras cobrarlo.</p>
    </div>
  )
  const days = s.deadline ? Math.ceil((new Date(s.deadline).getTime() - Date.now()) / 86400_000) : null
  return (
    <div className={box}>
      <h2 className="font-serif text-xl font-bold text-ink mb-1">Cobrar por FiestaGo</h2>
      <p className="text-xs text-ink/60 mb-3 leading-relaxed">
        Tu cliente paga con tarjeta desde el acuerdo. El dinero se queda guardado en tu cuenta de cobros hasta que pulses «Cobrar» (máximo 90 días)
        y entonces llega a tu banco en 2-3 días. FiestaGo no se queda nada: solo se descuenta lo que cobra el banco por el pago con tarjeta (≈ 1,5 % + 0,25 €).
      </p>
      {s.error && <p className="text-xs text-red-600 mb-2">{s.error}</p>}
      {!s.account || !s.ready ? (
        <button onClick={() => act('onboard')} disabled={busy} className="bg-coral text-white text-sm font-bold px-4 py-2 rounded-xl disabled:opacity-50">
          {busy ? 'Abriendo…' : s.account ? 'Terminar de abrir mi cuenta de cobros' : 'Abrir mi cuenta de cobros (5 minutos)'}
        </button>
      ) : (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="text-sm text-ink">
            Disponible: <strong>{formatEuro(s.available || 0)}</strong>
            {!!s.pending && <span className="text-ink/60"> · en camino: {formatEuro(s.pending)}</span>}
            {days != null && <div className={`text-xs ${days <= 15 ? 'text-red-600 font-semibold' : 'text-ink/60'}`}>Tienes {Math.max(days, 0)} días para cobrarlo (luego Stripe lo manda a tu banco).</div>}
          </div>
          <button onClick={() => act('payout')} disabled={busy || !(s.available! > 0) || !s.payouts_ready} className="bg-coral text-white text-sm font-bold px-4 py-2 rounded-xl disabled:opacity-50">
            {busy ? 'Enviando…' : 'Cobrar ahora'}
          </button>
        </div>
      )}
    </div>
  )
}
