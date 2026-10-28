'use client'

// Pestaña Captación (lib/captacion.ts): a quién llamar o visitar hoy, con
// el guion, el botón de llamar, el WhatsApp ya escrito y dónde apuntar el
// resultado. El agente programa solo el siguiente contacto.

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'

function adminHeaders() {
  const pass = typeof window !== 'undefined' ? localStorage.getItem('fg_admin_pass') || '' : ''
  return { 'Content-Type': 'application/json', 'x-admin-password': pass }
}

type Item = {
  id: string; kind: 'provider' | 'org'; name: string; category: string | null; city: string | null; zone: string
  phone: string | null; mobile: boolean; email: string | null; website: string | null; instagram: string | null
  call_status: string; last_note: string | null; attempts: number; whatsapp_url: string | null; tel_url: string | null; script: string
}

const C = { card: '#111827', border: '#1F2937', text: '#F0F4FF', muted: '#9CA3AF', accent: '#06B6D4', good: '#10B981' }
const btn = (bg: string): React.CSSProperties => ({ background: bg, color: '#fff', border: 'none', borderRadius: 8, padding: '6px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer', textDecoration: 'none', display: 'inline-block' })

export default function Captacion() {
  const [zone, setZone] = useState<'asturias' | 'valencia' | 'all'>('asturias')
  const [items, setItems] = useState<Item[]>([])
  const [outcomes, setOutcomes] = useState<Record<string, string>>({})
  const [totals, setTotals] = useState<Record<string, number>>({})
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [dates, setDates] = useState<Record<string, string>>({})
  const [open, setOpen] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  async function load(z = zone) {
    setLoading(true)
    const r = await fetch(`/api/admin/captacion?zone=${z}`, { headers: adminHeaders() }).then(r => r.json()).catch(() => ({}))
    setItems(r.items || []); setOutcomes(r.outcomes || {}); setTotals(r.totals || {})
    setLoading(false)
  }
  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function record(i: Item, outcome: string) {
    const res = await fetch('/api/admin/captacion', {
      method: 'POST', headers: adminHeaders(),
      body: JSON.stringify({ kind: i.kind, id: i.id, outcome, note: notes[i.id] || '', next_at: dates[i.id] || null }),
    })
    const d = await res.json().catch(() => ({}))
    if (!res.ok) { toast.error(d.error || 'No se pudo guardar'); return }
    toast.success(d.next_call_at ? `Apuntado. Siguiente contacto: ${new Date(d.next_call_at).toLocaleDateString('es-ES')}` : 'Apuntado ✓')
    if (d.whatsapp_url) window.open(d.whatsapp_url, '_blank')
    setItems(xs => xs.filter(x => x.id !== i.id))
  }

  return (
    <div style={{ maxWidth: 900 }}>
      <h2 style={{ color: C.text, fontSize: 20, fontWeight: 800, marginBottom: 4 }}>Captación de proveedores</h2>
      <p style={{ color: C.muted, fontSize: 13, marginBottom: 12 }}>
        A quién llamar o visitar hoy, por prioridad: asociaciones, locales, catering, peluquería… Apunta cómo ha ido y el agente programa el siguiente contacto.
        Cada mañana te llega este plan por email. Guion completo y respuestas a objeciones: docs/CAPTACION.md.
      </p>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        {(['asturias', 'valencia', 'all'] as const).map(z => (
          <button key={z} onClick={() => { setZone(z); load(z) }} style={{ ...btn(zone === z ? C.accent : '#374151') }}>
            {z === 'asturias' ? 'Asturias' : z === 'valencia' ? 'Valencia' : 'Todo'}
          </button>
        ))}
        <span style={{ color: C.muted, fontSize: 12 }}>
          {Object.entries(totals).map(([k, v]) => `${outcomes[k] || k}: ${v}`).join(' · ')}
        </span>
      </div>
      {loading && <p style={{ color: C.muted }}>Cargando…</p>}
      {!loading && items.length === 0 && <p style={{ color: C.muted }}>No hay nadie pendiente en esta zona. La búsqueda diaria irá añadiendo locales nuevos.</p>}
      {items.map(i => (
        <div key={i.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <div>
              <div style={{ color: C.text, fontWeight: 700, fontSize: 14 }}>{i.kind === 'org' ? '🤝 ' : ''}{i.name}</div>
              <div style={{ color: C.muted, fontSize: 12 }}>
                {i.category} · {i.city}{i.attempts ? ` · ${i.attempts} intento${i.attempts > 1 ? 's' : ''}` : ''}{i.last_note ? ` · ${i.last_note}` : ''}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {i.tel_url && <a href={i.tel_url} style={btn(C.good)}>📞 {i.phone}</a>}
              {i.whatsapp_url && <a href={i.whatsapp_url} target="_blank" rel="noreferrer" style={btn('#16A34A')}>WhatsApp</a>}
              {i.website && <a href={i.website} target="_blank" rel="noreferrer" style={btn('#374151')}>Web</a>}
              {i.email && <a href={`mailto:${i.email}`} style={btn('#374151')}>Email</a>}
              <button onClick={() => setOpen(open === i.id ? null : i.id)} style={btn('#4B5563')}>{open === i.id ? 'Cerrar' : 'Apuntar resultado'}</button>
            </div>
          </div>
          <p style={{ color: '#CBD5E1', fontSize: 12, marginTop: 8 }}>🗣️ {i.script}</p>
          {open === i.id && (
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <input value={notes[i.id] || ''} onChange={e => setNotes(n => ({ ...n, [i.id]: e.target.value }))} placeholder="Nota (con quién hablaste, qué dijo…)"
                style={{ background: '#0B1220', border: `1px solid ${C.border}`, color: C.text, borderRadius: 8, padding: '6px 8px', fontSize: 13 }} />
              <label style={{ color: C.muted, fontSize: 12 }}>Fecha del siguiente contacto (opcional; si no, la pone el agente)
                <input type="date" value={dates[i.id] || ''} onChange={e => setDates(d => ({ ...d, [i.id]: e.target.value }))}
                  style={{ marginLeft: 8, background: '#0B1220', border: `1px solid ${C.border}`, color: C.text, borderRadius: 8, padding: '4px 6px' }} />
              </label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {Object.entries(outcomes).map(([k, label]) => (
                  <button key={k} onClick={() => record(i, k)} style={btn(k === 'alta' ? C.good : k === 'no_interesa' ? '#991B1B' : k === 'interesado' ? '#2563EB' : '#374151')}>{label}</button>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
