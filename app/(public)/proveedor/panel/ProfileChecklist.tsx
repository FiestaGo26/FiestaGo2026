'use client'

// "Tu ficha": lo que le falta al proveedor para que los clientes reserven
// (precio, fotos de trabajos y verificación). Se oculta cuando está completa.

import { useEffect, useState } from 'react'

type C = { priced_services: number; photos: number; verified: boolean; complete: boolean }

export default function ProfileChecklist({ providerId, apiFetch }: {
  providerId: string
  apiFetch: (url: string, init?: RequestInit) => Promise<Response>
}) {
  const [c, setC] = useState<C | null>(null)
  const [min, setMin] = useState(6)
  useEffect(() => {
    apiFetch(`/api/proveedor/completeness?provider_id=${providerId}`)
      .then(r => r.json()).then(d => { setC(d.completeness); setMin(d.min_photos || 6) }).catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providerId])
  if (!c || c.complete) return null

  const items = [
    { ok: c.priced_services > 0, label: 'Un servicio con su precio (IVA incluido)', hint: 'Pestaña Servicios' },
    { ok: c.photos >= min, label: `${min} fotos de trabajos tuyos (tienes ${c.photos})`, hint: 'En cada servicio, añade fotos de eventos parecidos' },
    { ok: c.verified, label: 'Identidad verificada (DNI o CIF)', hint: 'Pestaña Verificación' },
  ]
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-6">
      <h2 className="font-serif text-xl font-bold text-ink mb-1">Completa tu ficha para recibir reservas</h2>
      <p className="text-xs text-ink/60 mb-3 leading-relaxed">
        Lo hemos probado con clientes: sin precio a la vista y sin fotos de trabajos parecidos al suyo, casi nadie reserva.
        Las fichas completas salen primero en FiestaGo.
      </p>
      <ul className="space-y-2">
        {items.map(i => (
          <li key={i.label} className="flex items-start gap-2 text-sm">
            <span className={i.ok ? 'text-emerald-600' : 'text-amber-600'}>{i.ok ? '✓' : '○'}</span>
            <span className={i.ok ? 'text-ink/50 line-through' : 'text-ink'}>{i.label}{!i.ok && <span className="block text-[11px] text-ink/50 no-underline">{i.hint}</span>}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
