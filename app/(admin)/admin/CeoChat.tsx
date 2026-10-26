'use client'

import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'

// Chat con el Agente CEO. Mariano escribe; el CEO contesta con las métricas
// de ahora (tarda unos segundos: piensa en segundo plano) y puede dejar
// acciones en cola. Lo que se le dice aquí lo tiene en cuenta en sus rutinas.

function adminHeaders() {
  const pass = typeof window !== 'undefined' ? localStorage.getItem('fg_admin_pass') || '' : ''
  return { 'Content-Type': 'application/json', 'x-admin-password': pass }
}

type Msg = { id: string; created_at: string; role: 'owner' | 'ceo'; content: string }

const C = { card: '#111827', border: '#1F2937', violet: '#8B5CF6', text: '#F0F4FF', muted: '#9CA3AF' }

export default function CeoChat({ onActions }: { onActions?: () => void }) {
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [text, setText] = useState('')
  const [waiting, setWaiting] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  async function load() {
    const res = await fetch('/api/admin/ceo/chat', { headers: adminHeaders(), cache: 'no-store' })
    const d = await res.json().catch(() => ({}))
    if (res.ok) setMsgs(d.messages || [])
    return (d.messages || []) as Msg[]
  }

  useEffect(() => { load() }, [])
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }) }, [msgs.length, waiting])

  // Mientras espera, consulta cada 3 s hasta que el último mensaje sea del CEO (máx. 3 min)
  useEffect(() => {
    if (!waiting) return
    const started = Date.now()
    const id = setInterval(async () => {
      const m = await load()
      if (m.length && m[m.length - 1].role === 'ceo') { setWaiting(false); onActions?.() }
      else if (Date.now() - started > 180_000) { setWaiting(false); toast.error('El CEO tarda más de lo normal. Actualiza en un rato.') }
    }, 3000)
    return () => clearInterval(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waiting])

  async function send() {
    const t = text.trim()
    if (!t || waiting) return
    setMsgs(m => [...m, { id: `tmp-${Date.now()}`, created_at: new Date().toISOString(), role: 'owner', content: t }])
    setText('')
    setWaiting(true)
    const res = await fetch('/api/admin/ceo/chat', { method: 'POST', headers: adminHeaders(), body: JSON.stringify({ message: t }) })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      toast.error(d.error || 'No se pudo enviar')
      setWaiting(false)
    }
  }

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16 }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 4 }}>💬 Habla con el CEO</div>
      <div style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>
        Pregúntale o dale instrucciones. Contesta con las métricas de ahora y lo tiene en cuenta en sus rutinas.
      </div>
      <div style={{ maxHeight: 380, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
        {msgs.length === 0 && <div style={{ fontSize: 13, color: C.muted }}>Aún no habéis hablado. Prueba: "¿Cómo vamos esta semana?"</div>}
        {msgs.map(m => (
          <div key={m.id} style={{
            alignSelf: m.role === 'owner' ? 'flex-end' : 'flex-start', maxWidth: '85%',
            background: m.role === 'owner' ? C.violet : '#0B0F19', color: C.text,
            border: m.role === 'owner' ? 'none' : `1px solid ${C.border}`,
            borderRadius: 12, padding: '8px 12px', fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap',
          }}>
            {m.content}
            <div style={{ fontSize: 10, color: m.role === 'owner' ? '#E9D5FF' : C.muted, marginTop: 4 }}>
              {new Date(m.created_at).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        ))}
        {waiting && <div style={{ fontSize: 12, color: C.muted }}>🧠 El CEO está pensando…</div>}
        <div ref={endRef} />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <textarea value={text} onChange={e => setText(e.target.value)} rows={2}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          placeholder="Escribe al CEO… (Enter para enviar)"
          style={{ flex: 1, background: '#0B0F19', color: C.text, border: `1px solid ${C.border}`, borderRadius: 10, padding: '8px 10px', fontSize: 13, resize: 'none' }} />
        <button onClick={send} disabled={waiting || !text.trim()}
          style={{ background: C.violet, color: '#fff', border: 'none', borderRadius: 10, padding: '0 16px', fontSize: 13, fontWeight: 700, cursor: waiting ? 'wait' : 'pointer', opacity: waiting || !text.trim() ? 0.5 : 1 }}>
          Enviar
        </button>
      </div>
    </div>
  )
}
