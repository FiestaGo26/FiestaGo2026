'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

// Botón cliente que dispara el pago del segundo tramo. En modo TEST
// simula el cobro instantáneamente vía POST al endpoint mock. Cuando
// Stripe esté vivo, este mismo componente disparará el checkout real.
export default function PayRestButton({
  bookingId, email, amount,
}: {
  bookingId: string
  email: string
  amount: number
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [err, setErr]   = useState<string | null>(null)

  async function pay() {
    setBusy(true)
    setErr(null)
    try {
      const res = await fetch(`/api/mock/pay-second/${bookingId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error || 'Error procesando el pago')
      // Refrescar la página server-side para ver el nuevo estado
      router.refresh()
    } catch (e: any) {
      setErr(e.message || 'Error inesperado')
      setBusy(false)
    }
  }

  const eur = new Intl.NumberFormat('es-ES', {
    style: 'currency', currency: 'EUR', minimumFractionDigits: 0,
  }).format(amount)

  return (
    <div>
      <button onClick={pay} disabled={busy}
        className="w-full bg-coral text-white font-bold py-4 rounded-2xl text-base hover:bg-coral-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
        {busy ? 'Procesando pago…' : `Pagar ${eur}`}
      </button>
      {err && (
        <div className="mt-3 bg-red-50 border border-red-200 text-red-700 rounded-xl px-3 py-2 text-xs">
          {err}
        </div>
      )}
    </div>
  )
}
