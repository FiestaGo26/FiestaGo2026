'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { formatEuro } from '@/lib/pricing'

export default function AcceptAgreement({ token, guaranteeOffered, price, priceWithGuarantee }: {
  token: string; guaranteeOffered: boolean; price: number; priceWithGuarantee: number
}) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [agree, setAgree] = useState(false)
  const [guarantee, setGuarantee] = useState(false)
  const [sending, setSending] = useState(false)

  async function accept() {
    if (name.trim().length < 3 || !agree) { toast.error('Escribe tu nombre completo y marca la casilla'); return }
    setSending(true)
    const res = await fetch(`/api/acuerdo/${token}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, agree, guarantee }) })
    const d = await res.json().catch(() => ({}))
    setSending(false)
    if (!res.ok) { toast.error(d.error || 'No se ha podido guardar'); return }
    toast.success('Acuerdo aceptado ✓')
    router.refresh()
  }

  return (
    <div className="mt-6 border-t border-stone-200 pt-5 print:hidden">
      <h2 className="font-semibold text-ink mb-2">Aceptar el acuerdo</h2>
      {guaranteeOffered && (
        <label className="flex items-start gap-2 text-sm text-ink mb-3">
          <input type="checkbox" checked={guarantee} onChange={e => setGuarantee(e.target.checked)} className="mt-1 accent-coral"/>
          <span>Quiero la Garantía de Éxito FiestaGo: el total pasa de {formatEuro(price)} a {formatEuro(priceWithGuarantee)}.</span>
        </label>
      )}
      <input value={name} onChange={e => setName(e.target.value)} placeholder="Tu nombre y apellidos"
        className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm mb-2"/>
      <label className="flex items-start gap-2 text-sm text-ink mb-3">
        <input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} className="mt-1 accent-coral"/>
        <span>He leído el acuerdo y acepto lo que incluye, el precio y las condiciones.</span>
      </label>
      <button onClick={accept} disabled={sending} className="w-full bg-coral text-white font-bold py-3 rounded-xl disabled:opacity-50">
        {sending ? 'Guardando…' : `Aceptar por ${formatEuro(guarantee ? priceWithGuarantee : price)}`}
      </button>
      <p className="text-[11px] text-ink/50 mt-2">Quedará registrado con la fecha y la hora, y os llegará una copia por email a los dos.</p>
    </div>
  )
}
