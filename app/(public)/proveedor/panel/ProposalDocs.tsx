'use client'

// Documentos de una propuesta: el proveedor sube el menú, el boceto, la
// póliza o el certificado y quedan registrados en el documento de reserva
// del cliente. Una vez reservado no se pueden quitar.

import { useState } from 'react'
import toast from 'react-hot-toast'
import { PROPOSAL_DOC_LABELS } from '@/lib/proposal-docs'

type Doc = { id: string; label: keyof typeof PROPOSAL_DOC_LABELS; name: string }

export default function ProposalDocs({ providerId, holdId, booked, initial, apiFetch }: {
  providerId: string
  holdId: string
  booked: boolean
  initial: Doc[]
  apiFetch: (url: string, init?: RequestInit) => Promise<Response>
}) {
  const [docs, setDocs] = useState<Doc[]>(initial)
  const [label, setLabel] = useState<Doc['label']>('menu')
  const [busy, setBusy] = useState(false)

  async function upload(file: File) {
    setBusy(true)
    try {
      const fd = new FormData()
      fd.append('file', file); fd.append('provider_id', providerId); fd.append('hold_id', holdId); fd.append('label', label)
      const res = await apiFetch('/api/proveedor/requests/documents', { method: 'POST', body: fd })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.error || 'No se pudo subir')
      setDocs(x => [...x, d.document])
      toast.success('Documento añadido a la propuesta ✓')
    } catch (err: any) { toast.error(err.message) }
    setBusy(false)
  }

  async function remove(doc: Doc) {
    const res = await apiFetch('/api/proveedor/requests/documents', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider_id: providerId, hold_id: holdId, doc_id: doc.id }),
    })
    const d = await res.json().catch(() => ({}))
    if (!res.ok) { toast.error(d.error || 'No se pudo quitar'); return }
    setDocs(x => x.filter(y => y.id !== doc.id))
  }

  return (
    <div className="mt-3 border-t border-stone-100 pt-3">
      <div className="text-xs font-semibold text-ink">Documentos de la propuesta</div>
      <p className="text-[11px] text-ink/55 mt-0.5 mb-2">
        El menú, el boceto, el plano del montaje, tu póliza o el certificado del hinchable: el cliente los ve en su documento de reserva
        y quedan registrados como lo acordado. Sin teléfonos, emails ni precios en los documentos.
      </p>
      {docs.map(d => (
        <div key={d.id} className="flex items-center justify-between gap-2 text-xs text-ink/75 py-1">
          <span>📎 {PROPOSAL_DOC_LABELS[d.label] || 'Documento'} · {d.name}</span>
          {!booked && <button type="button" onClick={() => remove(d)} className="text-ink/40 px-2">✕</button>}
        </div>
      ))}
      {!booked && docs.length < 10 && (
        <div className="flex gap-2 items-center mt-1 flex-wrap">
          <select value={label} onChange={e => setLabel(e.target.value as Doc['label'])}
            className="border border-stone-200 rounded-xl px-2 py-1.5 text-xs text-ink outline-none focus:border-coral">
            {Object.entries(PROPOSAL_DOC_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <label className={`text-[11px] font-semibold text-coral cursor-pointer ${busy ? 'opacity-50 pointer-events-none' : ''}`}>
            {busy ? 'Subiendo…' : '+ Subir PDF o foto'}
            <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = '' }}/>
          </label>
        </div>
      )}
    </div>
  )
}
