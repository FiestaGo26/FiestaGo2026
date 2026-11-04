'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import { formatEuro } from '@/lib/pricing'

export default function PayButtons({ token, deposit, remaining, depositPaid }: { token: string; deposit: number; remaining: number; depositPaid: boolean }) {
  const [busy, setBusy] = useState<string | null>(null)
  async function pay(kind: 'senal' | 'resto' | 'total') {
    setBusy(kind)
    const res = await fetch(`/api/acuerdo/${token}/pay`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind }) })
    const d = await res.json().catch(() => ({}))
    if (!res.ok || !d.url) { toast.error(d.error || 'No se ha podido abrir el pago'); setBusy(null); return }
    window.location.href = d.url
  }
  if (remaining <= 0.5) return <p className="mt-4 text-sm font-semibold text-emerald-700">✓ Todo pagado.</p>
  const btn = 'flex-1 bg-coral text-white font-bold py-3 rounded-xl disabled:opacity-50'
  return (
    <div className="mt-5 print:hidden">
      <div className="flex gap-2 flex-wrap">
        {deposit > 0 && !depositPaid && <button onClick={() => pay('senal')} disabled={!!busy} className={btn}>{busy === 'senal' ? 'Abriendo…' : `Pagar la señal (${formatEuro(deposit)})`}</button>}
        <button onClick={() => pay(depositPaid ? 'resto' : 'total')} disabled={!!busy} className={deposit > 0 && !depositPaid ? 'flex-1 border border-coral text-coral font-bold py-3 rounded-xl disabled:opacity-50' : btn}>
          {busy && busy !== 'senal' ? 'Abriendo…' : depositPaid ? `Pagar el resto (${formatEuro(remaining)})` : `Pagar todo (${formatEuro(remaining)})`}
        </button>
      </div>
      <p className="text-[11px] text-ink/50 mt-2">Pago seguro con tarjeta a través de Stripe. Recibirás el justificante por email y quedará registrado aquí.</p>
    </div>
  )
}
