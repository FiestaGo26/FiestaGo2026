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
  whatsapp_invalid: boolean | null
  whatsapp_invalid_reason: string | null
}

// Validador cliente-side espejo de lib/whatsapp isValidPhoneE164ES.
// Evita mostrar el botón "enviar" cuando el número claramente no es válido,
// ahorrando llamadas Cloud API. La validación canónica sigue en el server.
function isPhoneLooksValid(raw: string | null | undefined): boolean {
  if (!raw) return false
  const digits = String(raw).replace(/[^\d]/g, '')
  if (!digits) return false
  if (digits.length === 9 && /^[6789]/.test(digits)) return true
  if (digits.length === 11 && digits.startsWith('34') && /^[6789]/.test(digits.slice(2))) return true
  if (digits.length >= 10 && digits.length <= 15 && !/^[01]/.test(digits)) {
    if (digits.startsWith('34') && digits.length === 11) return false
    return true
  }
  return false
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

  // ── Ad-hoc: enviar plantilla a cualquier teléfono sin necesidad de que
  //    esté en la BD. Si no existe ficha, se crea una mínima al vuelo.
  const [adhocPhone, setAdhocPhone] = useState('')
  const [adhocName,  setAdhocName]  = useState('')

  // ── Limpieza: borrar de la bandeja proveedores cuyo número no es WA real.
  //    No borra el provider, solo anula phone/outreach_whatsapp y los marca
  //    como whatsapp_invalid → caen del filtro de la pestaña.
  function doCleanupInvalid() {
    if (!window.confirm(
      '¿Limpiar de la bandeja los proveedores cuyo número no sea un WhatsApp válido?\n\n' +
      'Se les vaciará el campo de teléfono y dejarán de aparecer aquí. ' +
      'La ficha del proveedor se mantiene (email, nombre, etc.).'
    )) return
    startTransition(async () => {
      const res = await fetch('/api/admin/whatsapp', {
        method: 'POST',
        headers: adminHeaders(),
        body: JSON.stringify({ op: 'cleanup_invalid' }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        toast.success(`${data.cleaned || 0} limpiados de ${data.total || 0}`)
        await load()
      } else {
        toast.error(data.error || 'Error')
      }
    })
  }

  // Reenvía la plantilla de follow-up a los proveedores contactados por WA
  // que NO han respondido en 7+ días. Primero dry-run para enseñar a quién
  // impactaría, y solo si el admin confirma se lanza el envío real.
  function doFollowupWa() {
    startTransition(async () => {
      // Dry-run primero — ver candidatos sin gastar nada.
      const dry = await fetch('/api/admin/whatsapp/followup', {
        method: 'POST', headers: adminHeaders(),
        body: JSON.stringify({ dry_run: true, days_since_first: 7, limit: 200 }),
      })
      const dryData = await dry.json().catch(() => ({}))
      if (!dry.ok) {
        toast.error(dryData.error || 'Error al previsualizar')
        return
      }
      const eligible = dryData.eligible || 0
      if (eligible === 0) {
        toast(`Sin candidatos · ${dryData.candidates || 0} contactados, ${dryData.respondedOut || 0} ya respondieron`)
        return
      }
      const preview = (dryData.preview || []).slice(0, 5).map((p: any) => `· ${p.name} (${p.city})`).join('\n')
      const more = eligible > 5 ? `\n…y ${eligible - 5} más` : ''
      if (!window.confirm(
        `Vas a reenviar la plantilla de WhatsApp a ${eligible} proveedor${eligible > 1 ? 'es' : ''} que NO respondieron al primer toque (>7 días).\n\n` +
        `Primeros candidatos:\n${preview}${more}\n\n` +
        `Continuar?`
      )) return

      const send = await fetch('/api/admin/whatsapp/followup', {
        method: 'POST', headers: adminHeaders(),
        body: JSON.stringify({ days_since_first: 7, limit: 200 }),
      })
      const sendData = await send.json().catch(() => ({}))
      if (!send.ok) {
        toast.error(sendData.error || 'Error al enviar')
        return
      }
      toast.success(`Follow-ups enviados: ${sendData.sent} · fallidos: ${sendData.failed} · saltados: ${sendData.skipped}`)
      await load()
    })
  }

  function doAdhocOutreach() {
    if (!adhocPhone.trim()) { toast.error('Introduce un teléfono'); return }
    startTransition(async () => {
      const res = await fetch('/api/admin/whatsapp', {
        method: 'POST',
        headers: adminHeaders(),
        body: JSON.stringify({
          op: 'outreach_adhoc',
          phone: adhocPhone.trim(),
          name:  adhocName.trim(),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        toast.success(data.reused
          ? `Plantilla enviada a ficha existente`
          : `Plantilla enviada · ficha creada`)
        setAdhocPhone('')
        setAdhocName('')
        await load()
        if (data.provider_id) setSelectedId(data.provider_id)
      } else {
        toast.error(data.error || 'Error')
      }
    })
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: C.muted, marginBottom: 12 }}>
          Inicia la conversación con la plantilla de captación. Cuando el proveedor responda, el
          agente IA continúa solo.
        </div>

        {/* Ad-hoc: enviar a cualquier número sin estar en la lista */}
        <div style={{
          background: C.card, border: `1px solid ${C.border}`, borderRadius: 12,
          padding: 14, display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap',
        }}>
          <div style={{ flex: '1 1 220px', minWidth: 200 }}>
            <label style={{ fontSize: 10, fontWeight: 700, color: C.faint,
              letterSpacing: '0.07em', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
              ✨ Enviar plantilla a un número nuevo
            </label>
            <input value={adhocPhone} onChange={e => setAdhocPhone(e.target.value)}
              placeholder="+34612345678 o 612345678"
              style={{
                width: '100%', padding: '8px 12px',
                background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8,
                color: C.text, fontSize: 13, outline: 'none', fontFamily: 'monospace',
              }}/>
          </div>
          <div style={{ flex: '1 1 180px', minWidth: 150 }}>
            <input value={adhocName} onChange={e => setAdhocName(e.target.value)}
              placeholder="Nombre (opcional)"
              style={{
                width: '100%', padding: '8px 12px',
                background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8,
                color: C.text, fontSize: 13, outline: 'none',
              }}/>
          </div>
          <button onClick={doAdhocOutreach} disabled={pending || !adhocPhone.trim()}
            style={{
              padding: '8px 16px', borderRadius: 8, border: 'none',
              background: (pending || !adhocPhone.trim()) ? C.faint : C.green,
              color: '#000', fontSize: 12, fontWeight: 700,
              cursor: (pending || !adhocPhone.trim()) ? 'not-allowed' : 'pointer',
              fontFamily: 'IBM Plex Mono, monospace',
            }}>
            {pending ? '⏳' : '💬 ENVIAR'}
          </button>
          <button onClick={doFollowupWa} disabled={pending}
            title="Reenvía la plantilla de WhatsApp a los proveedores que recibieron el primer toque hace 7+ días y NO han respondido. Primero te muestra a quién va a impactar."
            style={{
              padding: '8px 12px', borderRadius: 8,
              border: `1px solid ${C.accent}`,
              background: `${C.accent}15`, color: C.accent,
              fontSize: 11, fontWeight: 700, cursor: pending ? 'not-allowed' : 'pointer',
              fontFamily: 'IBM Plex Mono, monospace',
            }}>
            📤 REENVIAR A NO RESPONDEDORES
          </button>
          <button onClick={doCleanupInvalid} disabled={pending}
            title="Quita de la bandeja los proveedores cuyo número no es un WhatsApp válido"
            style={{
              padding: '8px 12px', borderRadius: 8,
              border: `1px solid ${C.border}`,
              background: 'transparent', color: C.muted,
              fontSize: 11, fontWeight: 700, cursor: pending ? 'not-allowed' : 'pointer',
              fontFamily: 'IBM Plex Mono, monospace',
            }}>
            🧹 LIMPIAR INVÁLIDOS
          </button>
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
                {/* Alerta si el proveedor está marcado como WhatsApp inválido
                    o si el número no parece un teléfono real. */}
                {(() => {
                  const phone = selected.outreach_whatsapp || selected.phone
                  const flagged = selected.whatsapp_invalid === true
                  const looksOk = isPhoneLooksValid(phone)
                  if (flagged || !looksOk) {
                    return (
                      <div style={{
                        background: '#7F1D1D33', border: `1px solid #DC2626`, color: '#FCA5A5',
                        borderRadius: 10, padding: '8px 12px', fontSize: 12,
                      }}>
                        ⚠ Este proveedor no tiene WhatsApp válido.{' '}
                        {flagged && selected.whatsapp_invalid_reason
                          ? `Motivo: ${selected.whatsapp_invalid_reason}`
                          : `Número: "${phone || '—'}" no parece un teléfono E.164.`}
                        <div style={{ marginTop: 4, opacity: 0.85 }}>
                          No se permite el envío para no malgastar la plantilla aprobada.
                        </div>
                      </div>
                    )
                  }
                  return null
                })()}

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {(() => {
                    const phone = selected.outreach_whatsapp || selected.phone
                    const canSend = !selected.whatsapp_invalid && isPhoneLooksValid(phone)
                    return (
                      <button
                        disabled={pending || !canSend}
                        title={canSend ? 'Enviar la plantilla aprobada (cold open)' : 'Número no válido: botón deshabilitado'}
                        onClick={doOutreach}
                        style={{
                          fontSize: 13, fontWeight: 700, background: canSend ? C.accent : C.faint, color: '#fff',
                          padding: '8px 16px', borderRadius: 10, border: 'none',
                          cursor: (pending || !canSend) ? 'not-allowed' : 'pointer',
                          opacity: (pending || !canSend) ? 0.5 : 1,
                        }}
                      >
                        Enviar plantilla de captación
                      </button>
                    )
                  })()}
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
