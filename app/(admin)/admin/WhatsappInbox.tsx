'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import toast from 'react-hot-toast'

// ─── Bandeja de WhatsApp · captación de proveedores ──────────────────────────
// Pestaña del panel admin. Toda la auth va por la cabecera x-admin-password
// (igual que el resto del panel). Los datos y las acciones pasan por
// /api/admin/whatsapp, protegido en el servidor.

function adminHeaders() {
  const pass = typeof window !== 'undefined' ? localStorage.getItem('fg_admin_pass') || '' : ''
  return { 'Content-Type': 'application/json', 'x-admin-password': pass }
}

type InboxProvider = {
  id: string
  name: string | null
  category: string | null
  city: string | null
  phone: string | null
  outreach_whatsapp: string | null
  outreach_sent: boolean | null
  contacted_via: string | null
  agent_fit_score: number | null
}

type InboxMessage = {
  id: string
  direction: 'inbound' | 'outbound'
  body: string | null
  type: string | null
  status: string | null
  created_at: string
  provider_id: string | null
}

const C = {
  card: '#111827',
  bg: '#0D1117',
  border: '#1F2937',
  text: '#F0F4FF',
  muted: '#9CA3AF',
  faint: '#4B5563',
  accent: '#F43F5E',
  green: '#10B981',
}

export default function WhatsappInbox() {
  const [providers, setProviders] = useState<InboxProvider[]>([])
  const [messages, setMessages] = useState<InboxMessage[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [pending, startTransition] = useTransition()

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/whatsapp', { headers: adminHeaders() })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al cargar')
      setProviders(data.providers || [])
      setMessages(data.messages || [])
      setSelectedId((cur) => cur ?? data.providers?.[0]?.id ?? null)
    } catch (e: any) {
      toast.error(e?.message || 'Error al cargar la bandeja')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const byProvider = useMemo(() => {
    const map = new Map<string, InboxMessage[]>()
    for (const m of messages) {
      if (!m.provider_id) continue
      const arr = map.get(m.provider_id) ?? []
      arr.push(m)
      map.set(m.provider_id, arr)
    }
    return map
  }, [messages])

  const selected = providers.find((p) => p.id === selectedId) ?? null
  const thread = selectedId ? byProvider.get(selectedId) ?? [] : []
  const lastInboundAt = lastInboundTime(thread)
  const within24h = lastInboundAt != null && Date.now() - lastInboundAt < 24 * 60 * 60 * 1000

  async function post(op: string, extra?: Record<string, any>) {
    if (!selected) return { ok: false }
    const res = await fetch('/api/admin/whatsapp', {
      method: 'POST',
      headers: adminHeaders(),
      body: JSON.stringify({ op, providerId: selected.id, ...extra }),
    })
    const data = await res.json().catch(() => ({}))
    return { ok: res.ok, ...data }
  }

  function doOutreach() {
    startTransition(async () => {
      const res = await post('outreach')
      if (res.ok) {
        toast.success('Plantilla de captación enviada')
        load()
      } else toast.error(res.error || 'Error')
    })
  }

  function doDraft() {
    startTransition(async () => {
      const res = await post('draft')
      if (res.ok) setDraft(res.text || '')
      else toast.error(res.error || 'Error')
    })
  }

  function doSend() {
    startTransition(async () => {
      const res = await post('send', { text: draft })
      if (res.ok) {
        toast.success('Mensaje enviado')
        setDraft('')
        load()
      } else toast.error(res.error || 'Error')
    })
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: C.muted }}>
          Inicia la conversación con la plantilla de captación. Cuando el proveedor responda, el
          agente IA continúa solo.
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 16, alignItems: 'start' }}>
        {/* Lista de proveedores */}
        <div
          style={{
            background: C.card,
            border: `1px solid ${C.border}`,
            borderRadius: 14,
            overflow: 'hidden',
            maxHeight: '72vh',
            overflowY: 'auto',
          }}
        >
          {loading && <div style={{ padding: 16, fontSize: 13, color: C.faint }}>Cargando…</div>}
          {!loading && providers.length === 0 && (
            <div style={{ padding: 16, fontSize: 13, color: C.faint }}>
              No hay proveedores con número.
            </div>
          )}
          {providers.map((p) => {
            const t = byProvider.get(p.id) ?? []
            const last = t[t.length - 1]
            const isSel = p.id === selectedId
            return (
              <button
                key={p.id}
                onClick={() => {
                  setSelectedId(p.id)
                  setDraft('')
                }}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '12px 14px',
                  borderBottom: `1px solid ${C.border}`,
                  background: isSel ? `${C.accent}18` : 'transparent',
                  border: 'none',
                  borderLeft: isSel ? `3px solid ${C.accent}` : '3px solid transparent',
                  cursor: 'pointer',
                  display: 'block',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, fontSize: 13, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.name || 'Sin nombre'}
                  </span>
                  {(p.contacted_via === 'whatsapp' || t.length > 0) && (
                    <span style={{ fontSize: 10, fontWeight: 800, color: C.green, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {t.length > 0 ? `${t.length} msg` : 'enviado'}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: C.faint, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {[p.category, p.city].filter(Boolean).join(' · ') || '—'}
                </div>
                {last?.body && (
                  <div style={{ fontSize: 11, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>
                    {last.body}
                  </div>
                )}
              </button>
            )
          })}
        </div>

        {/* Conversación */}
        <div
          style={{
            background: C.card,
            border: `1px solid ${C.border}`,
            borderRadius: 14,
            display: 'flex',
            flexDirection: 'column',
            minHeight: '72vh',
          }}
        >
          {!selected ? (
            <div style={{ flex: 1, display: 'grid', placeItems: 'center', color: C.faint, fontSize: 13 }}>
              Selecciona un proveedor.
            </div>
          ) : (
            <>
              <div style={{ padding: '14px 18px', borderBottom: `1px solid ${C.border}` }}>
                <div style={{ fontWeight: 700, color: C.text }}>{selected.name || 'Sin nombre'}</div>
                <div style={{ fontSize: 11, color: C.faint }}>
                  {[selected.category, selected.city].filter(Boolean).join(' · ')} ·{' '}
                  {selected.outreach_whatsapp || selected.phone || 'sin número'}
                </div>
              </div>

              {/* Hilo */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {thread.length === 0 && (
                  <div style={{ fontSize: 13, color: C.faint }}>
                    Sin mensajes todavía. Envía la plantilla de captación para empezar.
                  </div>
                )}
                {thread.map((m) => (
                  <div
                    key={m.id}
                    style={{
                      maxWidth: '80%',
                      borderRadius: 14,
                      padding: '8px 12px',
                      fontSize: 13,
                      alignSelf: m.direction === 'outbound' ? 'flex-end' : 'flex-start',
                      background: m.direction === 'outbound' ? C.accent : C.bg,
                      color: m.direction === 'outbound' ? '#fff' : C.text,
                      border: m.direction === 'outbound' ? 'none' : `1px solid ${C.border}`,
                    }}
                  >
                    {m.body}
                    <div style={{ fontSize: 10, marginTop: 4, color: m.direction === 'outbound' ? 'rgba(255,255,255,0.7)' : C.faint }}>
                      {new Date(m.created_at).toLocaleString('es-ES')}
                    </div>
                  </div>
                ))}
              </div>

              {/* Acciones */}
              <div style={{ borderTop: `1px solid ${C.border}`, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  <button
                    disabled={pending}
                    onClick={doOutreach}
                    style={{
                      fontSize: 13, fontWeight: 700, background: C.accent, color: '#fff',
                      padding: '8px 16px', borderRadius: 10, border: 'none',
                      cursor: pending ? 'default' : 'pointer', opacity: pending ? 0.5 : 1,
                    }}
                  >
                    Enviar plantilla de captación
                  </button>
                  <button
                    disabled={pending}
                    onClick={doDraft}
                    style={{
                      fontSize: 13, fontWeight: 600, background: 'transparent', color: C.text,
                      padding: '8px 16px', borderRadius: 10, border: `1px solid ${C.border}`,
                      cursor: pending ? 'default' : 'pointer', opacity: pending ? 0.5 : 1,
                    }}
                  >
                    Borrador con IA
                  </button>
                </div>

                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={3}
                  placeholder={
                    within24h
                      ? 'Escribe un mensaje…'
                      : 'Texto libre solo disponible si el proveedor ha respondido en las últimas 24h (regla de WhatsApp).'
                  }
                  style={{
                    width: '100%', fontSize: 13, background: C.bg, color: C.text,
                    border: `1px solid ${C.border}`, borderRadius: 10, padding: '8px 12px',
                    outline: 'none', resize: 'vertical', fontFamily: 'inherit',
                  }}
                />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontSize: 11, color: C.faint }}>
                    {within24h
                      ? 'Ventana de 24h abierta: puedes enviar texto libre.'
                      : 'Fuera de la ventana de 24h: usa la plantilla.'}
                  </span>
                  <button
                    disabled={pending || !within24h || !draft.trim()}
                    onClick={doSend}
                    style={{
                      fontSize: 13, fontWeight: 700, background: C.text, color: '#000',
                      padding: '8px 16px', borderRadius: 10, border: 'none',
                      cursor: 'pointer',
                      opacity: pending || !within24h || !draft.trim() ? 0.4 : 1,
                    }}
                  >
                    Enviar texto
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function lastInboundTime(thread: InboxMessage[]): number | null {
  let t: number | null = null
  for (const m of thread) {
    if (m.direction === 'inbound') {
      const ts = new Date(m.created_at).getTime()
      if (t == null || ts > t) t = ts
    }
  }
  return t
}
