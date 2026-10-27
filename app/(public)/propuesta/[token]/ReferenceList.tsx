'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'

type Ref = { id: string; nombre: string; evento: string; fecha: string; ciudad: string; comentario: string }

export default function ReferenceList({ token, providerName, references }: { token: string; providerName: string; references: Ref[] }) {
  const [asked, setAsked] = useState<Set<string>>(new Set())
  async function ask(id: string) {
    const res = await fetch(`/api/propuesta/${token}/referencia`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reference_id: id }) })
    if (res.ok) { setAsked(a => new Set(a).add(id)); toast.success('Hecho. Te ponemos en contacto desde FiestaGo.') }
    else toast.error('No se pudo pedir')
  }
  return (
    <div className="bg-white border border-stone-200 rounded-2xl p-6 mb-5">
      <h2 className="font-serif text-xl font-bold text-ink mb-1">Habla con clientes de {providerName}</h2>
      <p className="text-xs text-ink/55 mb-4">Han aceptado que les preguntes por su experiencia. Te ponemos en contacto desde FiestaGo.</p>
      <div className="space-y-3">
        {references.map(r => (
          <div key={r.id} className="bg-cream rounded-xl p-3 text-sm flex items-start justify-between gap-3">
            <div>
              <div className="font-semibold text-ink">{r.nombre}</div>
              <div className="text-xs text-ink/55">{[r.evento, r.fecha, r.ciudad].filter(Boolean).join(' · ')}</div>
              {r.comentario && <div className="text-ink/75 mt-1">“{r.comentario}”</div>}
            </div>
            {asked.has(r.id)
              ? <span className="text-xs text-emerald-700 whitespace-nowrap">✓ Pedido</span>
              : <button type="button" onClick={() => ask(r.id)} className="text-xs font-semibold text-coral whitespace-nowrap">Quiero hablar con {r.nombre.split(/\s+/)[0]}</button>}
          </div>
        ))}
      </div>
    </div>
  )
}
