'use client'

// Referencias de clientes: el proveedor añade clientes que aceptan que
// FiestaGo les ponga en contacto con futuros clientes. En público solo se
// ve el resumen; el contacto lo usa FiestaGo para hacer la presentación.

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'

type Ref = { id: string; nombre: string; evento: string; fecha: string; ciudad: string; comentario: string; contacto: string; consentimiento: boolean }
const empty = (): Ref => ({ id: `ref${Date.now()}`, nombre: '', evento: '', fecha: '', ciudad: '', comentario: '', contacto: '', consentimiento: false })

export default function ReferencesCard({ providerId, apiFetch }: {
  providerId: string
  apiFetch: (url: string, init?: RequestInit) => Promise<Response>
}) {
  const [refs, setRefs] = useState<Ref[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    apiFetch(`/api/proveedor/references?provider_id=${providerId}`)
      .then(r => r.json()).then(d => setRefs(d.references || [])).catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providerId])

  const set = (i: number, patch: Partial<Ref>) => setRefs(rs => rs.map((r, j) => j === i ? { ...r, ...patch } : r))

  async function save() {
    const incomplete = refs.find(r => !r.nombre || !r.evento || !r.contacto || !r.consentimiento)
    if (incomplete) { toast.error('Cada referencia necesita nombre, evento, contacto y el consentimiento del cliente'); return }
    setSaving(true)
    try {
      const res = await apiFetch('/api/proveedor/references', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider_id: providerId, references: refs }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.error || 'No se pudo guardar')
      setRefs(d.references || [])
      toast.success('Referencias guardadas ✓')
    } catch (err: any) { toast.error(err.message) }
    setSaving(false)
  }

  const input = 'w-full border border-stone-200 rounded-xl px-3 py-2 text-sm text-ink outline-none focus:border-coral'
  return (
    <div className="bg-white border border-stone-200 rounded-2xl p-5 mb-6 shadow-card">
      <h2 className="font-serif text-xl font-bold text-ink mb-1">Referencias de clientes</h2>
      <p className="text-xs text-ink/55 mb-4 leading-relaxed">
        Clientes contentos que aceptan que un futuro cliente les pregunte por ti (sobre todo en bodas, lo piden mucho).
        Los clientes ven el nombre de pila, el evento, la fecha y su comentario. El contacto solo lo ve FiestaGo, que hace la presentación.
      </p>
      <div className="space-y-4">
        {refs.map((r, i) => (
          <div key={r.id} className="border border-stone-200 rounded-xl p-3 grid sm:grid-cols-2 gap-2">
            <input className={input} value={r.nombre} onChange={e => set(i, { nombre: e.target.value })} placeholder="Nombre de pila (p. ej. Laura y Dani)"/>
            <input className={input} value={r.evento} onChange={e => set(i, { evento: e.target.value })} placeholder="Evento (p. ej. Boda, 120 invitados)"/>
            <input className={input} value={r.fecha} onChange={e => set(i, { fecha: e.target.value })} placeholder="Fecha (p. ej. Junio 2025)"/>
            <input className={input} value={r.ciudad} onChange={e => set(i, { ciudad: e.target.value })} placeholder="Ciudad o lugar"/>
            <textarea className={`${input} sm:col-span-2 resize-none`} rows={2} value={r.comentario} onChange={e => set(i, { comentario: e.target.value })} placeholder="Qué dicen de tu trabajo (con sus palabras)"/>
            <input className={`${input} sm:col-span-2`} value={r.contacto} onChange={e => set(i, { contacto: e.target.value })} placeholder="Email o teléfono del cliente (solo lo ve FiestaGo)"/>
            <label className="sm:col-span-2 flex items-start gap-2 text-xs text-ink/70">
              <input type="checkbox" className="mt-0.5 accent-coral" checked={r.consentimiento} onChange={e => set(i, { consentimiento: e.target.checked })}/>
              Este cliente ha aceptado que FiestaGo le contacte para hablar de mi trabajo con futuros clientes.
            </label>
            <button type="button" onClick={() => setRefs(rs => rs.filter((_, j) => j !== i))} className="sm:col-span-2 justify-self-end text-xs text-ink/45">Quitar</button>
          </div>
        ))}
      </div>
      <div className="flex justify-between mt-3">
        {refs.length < 10 ? <button type="button" onClick={() => setRefs(rs => [...rs, empty()])} className="text-xs font-semibold text-coral">+ Añadir referencia</button> : <span/>}
        <button type="button" onClick={save} disabled={saving} className="bg-coral text-white text-xs font-bold px-4 py-2 rounded-xl disabled:opacity-50">
          {saving ? 'Guardando…' : 'Guardar referencias'}
        </button>
      </div>
    </div>
  )
}
