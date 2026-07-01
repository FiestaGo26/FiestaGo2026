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
  tag: string | null
}

// Estado conversacional derivado del proveedor + sus mensajes. Sirve para
// pintar el badge en la lista, filtrar por solapas y destacar el cuadro
// de respuesta cuando hay ventana abierta.
type ConvState =
  | 'sin_contactar'
  | 'enviado_sin_leer'
  | 'leyo_sin_responder'
  | 'viva_24h'      // tiene inbound dentro de la ventana de 24h → puede contestar texto libre
  | 'viva_fuera'    // contestó pero ya pasaron >24h → solo plantilla
  | 'no_interesa'   // pulsó "No me interesa"
  | 'bot_confirmado'
  | 'cap_alcanzado'
  | 'invalido'

function classifyConv(p: InboxProvider, msgs: InboxMessage[]): ConvState {
  if (p.whatsapp_invalid === true) return 'invalido'
  if ((p.tag || '').toLowerCase().includes('autoresponder')) return 'bot_confirmado'
  if ((p.tag || '').toLowerCase().includes('cap respuestas')) return 'cap_alcanzado'

  const inbounds = msgs.filter(m => m.direction === 'inbound')
  const outbounds = msgs.filter(m => m.direction === 'outbound')
  const dijoNo = inbounds.some(m => (m.body || '').trim() === 'No me interesa')
  if (dijoNo) return 'no_interesa'

  if (inbounds.length === 0) {
    if (outbounds.length === 0) return 'sin_contactar'
    const algunLeido = outbounds.some(m => m.status === 'read')
    return algunLeido ? 'leyo_sin_responder' : 'enviado_sin_leer'
  }

  const lastIn = lastInboundTime(msgs)
  if (lastIn != null && Date.now() - lastIn < 24 * 60 * 60 * 1000) return 'viva_24h'
  return 'viva_fuera'
}

// Etiqueta visible + color de cada estado.
const STATE_META: Record<ConvState, { label: string; color: string; bg: string; emoji: string; priority: number }> = {
  viva_24h:          { label: 'VIVA · 24h',       color: '#10B981', bg: '#10B98122', emoji: '🟢', priority: 0 },
  viva_fuera:        { label: 'VIVA · >24h',      color: '#F59E0B', bg: '#F59E0B22', emoji: '💬', priority: 1 },
  leyo_sin_responder:{ label: 'LEÍDO',            color: '#3B82F6', bg: '#3B82F622', emoji: '👁️', priority: 2 },
  enviado_sin_leer:  { label: 'ENVIADO',          color: '#9CA3AF', bg: '#9CA3AF22', emoji: '📨', priority: 3 },
  sin_contactar:     { label: 'SIN CONTACTAR',    color: '#9CA3AF', bg: '#9CA3AF22', emoji: '·',  priority: 4 },
  bot_confirmado:    { label: 'BOT',              color: '#A78BFA', bg: '#A78BFA22', emoji: '🤖', priority: 5 },
  cap_alcanzado:     { label: 'CAP RESPUESTAS',   color: '#A78BFA', bg: '#A78BFA22', emoji: '🚦', priority: 5 },
  no_interesa:       { label: 'NO INTERESA',      color: '#6B7280', bg: '#6B728022', emoji: '🚫', priority: 6 },
  invalido:          { label: 'INVÁLIDO',         color: '#EF4444', bg: '#EF444422', emoji: '⚠️', priority: 7 },
}

type FilterTab = 'todos' | 'vivas' | 'pendientes' | 'cerrados'
const FILTER_TABS: { id: FilterTab; label: string; matches: (s: ConvState) => boolean }[] = [
  { id: 'todos',     label: 'Todos',          matches: () => true },
  { id: 'vivas',     label: '🟢 Vivas',       matches: s => s === 'viva_24h' || s === 'viva_fuera' },
  { id: 'pendientes',label: '📨 Pendientes',  matches: s => s === 'enviado_sin_leer' || s === 'leyo_sin_responder' },
  { id: 'cerrados',  label: '🚫 Cerrados',    matches: s => s === 'no_interesa' || s === 'bot_confirmado' || s === 'cap_alcanzado' || s === 'invalido' },
]

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
  const [filterTab, setFilterTab] = useState<FilterTab>('vivas')

  // Layout responsive: en móvil mostramos lista O conversación (no las
  // dos columnas a la vez). Si no hay selectedId → solo lista. Si hay →
  // solo conversación con header "← Volver".
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const update = () => setIsMobile(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

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

  // Estado conversacional por provider (memoizado): se calcula una vez por
  // render para no rehacerlo en cada item de la lista. Usado por:
  // (a) badge en lista, (b) filtro por solapas, (c) orden por prioridad,
  // (d) destaque del cuadro de respuesta.
  const stateByProvider = useMemo(() => {
    const m = new Map<string, ConvState>()
    for (const p of providers) m.set(p.id, classifyConv(p, byProvider.get(p.id) ?? []))
    return m
  }, [providers, byProvider])

  const visibleProviders = useMemo(() => {
    const match = FILTER_TABS.find(t => t.id === filterTab)?.matches ?? (() => true)
    return providers
      .filter(p => match(stateByProvider.get(p.id) || 'sin_contactar'))
      .sort((a, b) => {
        const pa = STATE_META[stateByProvider.get(a.id) || 'sin_contactar'].priority
        const pb = STATE_META[stateByProvider.get(b.id) || 'sin_contactar'].priority
        if (pa !== pb) return pa - pb
        // Dentro del mismo estado, los más recientes primero
        const lastA = byProvider.get(a.id)?.slice(-1)[0]?.created_at || ''
        const lastB = byProvider.get(b.id)?.slice(-1)[0]?.created_at || ''
        return lastB.localeCompare(lastA)
      })
  }, [providers, stateByProvider, byProvider, filterTab])

  // Conteos por tab — los muestro en cada pestaña para que el admin sepa
  // dónde está el trabajo sin tener que cambiar de solapa.
  const counts = useMemo(() => {
    const c: Record<FilterTab, number> = { todos: 0, vivas: 0, pendientes: 0, cerrados: 0 }
    for (const p of providers) {
      const s = stateByProvider.get(p.id) || 'sin_contactar'
      for (const tab of FILTER_TABS) if (tab.matches(s)) c[tab.id]++
    }
    return c
  }, [providers, stateByProvider])

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

  // Manda el PRIMER WhatsApp en bulk a los proveedores que nunca fueron
  // contactados. Lote por defecto 50. Mismo patrón que doFollowupWa:
  // dry-run primero, confirmación con preview, envío real si OK.
  // Tercer toque a los SILENTES (nunca respondieron): plantilla nueva
  // con ángulo de prueba social. Dry-run primero, confirmación, envío.
  function doFollowup2() {
    startTransition(async () => {
      const dry = await fetch('/api/admin/whatsapp/followup2', {
        method: 'POST', headers: adminHeaders(),
        body: JSON.stringify({ dry_run: true, days_since_last: 2, limit: 25 }),
      })
      const dryData = await dry.json().catch(() => ({}))
      if (!dry.ok) {
        toast.error(dryData.error || 'Error al previsualizar')
        return
      }
      const eligibles = dryData.eligibles || 0
      if (eligibles === 0) {
        toast(`Sin candidatos silentes en este momento.`)
        return
      }
      const preview = (dryData.preview || []).slice(0, 5)
        .map((p: any) => `· ${p.name} (${p.city}) → prueba: ${p.prueba_social}`)
        .join('\n')
      const more = eligibles > 5 ? `\n…y ${eligibles - 5} más en este lote` : ''
      if (!window.confirm(
        `Vas a mandar la 3ª plantilla (prueba social) a ${eligibles} proveedor${eligibles > 1 ? 'es' : ''} silente${eligibles > 1 ? 's' : ''} (nunca respondieron al 1er ni al 2º toque).\n\n` +
        `Primeros del lote y qué nombre real usaremos como prueba social:\n${preview}${more}\n\n` +
        `Continuar?`
      )) return

      const send = await fetch('/api/admin/whatsapp/followup2', {
        method: 'POST', headers: adminHeaders(),
        body: JSON.stringify({ days_since_last: 2, limit: 25 }),
      })
      const sendData = await send.json().catch(() => ({}))
      if (!send.ok) {
        toast.error(sendData.error || 'Error al enviar')
        return
      }
      toast.success(`3º toque enviado: ${sendData.sent} · fallidos: ${sendData.failed} · saltados: ${sendData.skipped}`)
      await load()
    })
  }

  function doOutreachBulk() {
    startTransition(async () => {
      const dry = await fetch('/api/admin/whatsapp/outreach-bulk', {
        method: 'POST', headers: adminHeaders(),
        body: JSON.stringify({ dry_run: true, limit: 25 }),
      })
      const dryData = await dry.json().catch(() => ({}))
      if (!dry.ok) {
        toast.error(dryData.error || 'Error al previsualizar')
        return
      }
      const eligible = dryData.eligible || 0
      if (eligible === 0) {
        toast('Sin candidatos — todos los pendientes ya fueron contactados')
        return
      }
      const preview = (dryData.preview || []).slice(0, 5).map((p: any) => `· ${p.name} (${p.city})`).join('\n')
      const more = eligible > 5 ? `\n…y ${eligible - 5} más en este lote` : ''
      if (!window.confirm(
        `Vas a mandar la plantilla del primer toque a ${eligible} proveedor${eligible > 1 ? 'es' : ''} que NUNCA fueron contactados.\n\n` +
        `Primeros del lote:\n${preview}${more}\n\n` +
        `Continuar?`
      )) return

      const send = await fetch('/api/admin/whatsapp/outreach-bulk', {
        method: 'POST', headers: adminHeaders(),
        body: JSON.stringify({ limit: 25 }),
      })
      const sendData = await send.json().catch(() => ({}))
      if (!send.ok) {
        toast.error(sendData.error || 'Error al enviar')
        return
      }
      toast.success(`Primer toque enviado: ${sendData.sent} · fallidos: ${sendData.failed} · saltados: ${sendData.skipped}`)
      await load()
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
          <button onClick={doOutreachBulk} disabled={pending}
            title="Manda en bulk la plantilla del primer toque a 25 proveedores que NUNCA fueron contactados. Primero te muestra a quién va a impactar."
            style={{
              padding: '8px 12px', borderRadius: 8,
              border: `1px solid ${C.green}`,
              background: `${C.green}15`, color: C.green,
              fontSize: 11, fontWeight: 700, cursor: pending ? 'not-allowed' : 'pointer',
              fontFamily: 'IBM Plex Mono, monospace',
            }}>
            📨 PRIMER TOQUE A 25 NUEVOS
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
          <button onClick={doFollowup2} disabled={pending}
            title="Tercer toque: plantilla de prueba social a los SILENTES (recibieron 1er + 2º toque y nunca contestaron). Dry-run primero."
            style={{
              padding: '8px 12px', borderRadius: 8,
              border: `1px solid #A855F7`,
              background: `#A855F715`, color: '#C084FC',
              fontSize: 11, fontWeight: 700, cursor: pending ? 'not-allowed' : 'pointer',
              fontFamily: 'IBM Plex Mono, monospace',
            }}>
            🎯 3º TOQUE PRUEBA SOCIAL
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

      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : '340px 1fr',
        gap: 16,
        alignItems: 'start',
      }}>
        {/* Lista de proveedores · en móvil se oculta cuando hay conversación abierta */}
        <div
          style={{
            background: C.card,
            border: `1px solid ${C.border}`,
            borderRadius: 14,
            overflow: 'hidden',
            maxHeight: isMobile ? 'calc(100vh - 200px)' : '72vh',
            display: isMobile && selectedId ? 'none' : 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Solapas de filtro arriba de la lista */}
          <div style={{
            display: 'flex',
            borderBottom: `1px solid ${C.border}`,
            background: C.bg,
            flexShrink: 0,
          }}>
            {FILTER_TABS.map(tab => {
              const active = filterTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setFilterTab(tab.id)}
                  style={{
                    flex: 1,
                    padding: '10px 6px',
                    fontSize: 11,
                    fontWeight: 700,
                    background: active ? C.card : 'transparent',
                    color: active ? C.text : C.muted,
                    border: 'none',
                    borderBottom: active ? `2px solid ${C.green}` : '2px solid transparent',
                    cursor: 'pointer',
                    fontFamily: 'IBM Plex Mono, monospace',
                  }}
                  title={`${counts[tab.id]} en este filtro`}
                >
                  {tab.label}
                  <span style={{ marginLeft: 4, color: active ? C.green : C.faint, fontWeight: 800 }}>
                    {counts[tab.id]}
                  </span>
                </button>
              )
            })}
          </div>

          <div style={{ overflowY: 'auto', flex: 1 }}>
            {loading && <div style={{ padding: 16, fontSize: 13, color: C.faint }}>Cargando…</div>}
            {!loading && visibleProviders.length === 0 && (
              <div style={{ padding: 16, fontSize: 13, color: C.faint }}>
                No hay proveedores en este filtro.
              </div>
            )}
            {visibleProviders.map((p) => {
              const t = byProvider.get(p.id) ?? []
              const last = t[t.length - 1]
              const isSel = p.id === selectedId
              const state = stateByProvider.get(p.id) || 'sin_contactar'
              const meta = STATE_META[state]
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
                    borderLeft: isSel ? `3px solid ${C.accent}` : `3px solid ${meta.color}`,
                    cursor: 'pointer',
                    display: 'block',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, fontSize: 13, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                      {p.name || 'Sin nombre'}
                    </span>
                    <span style={{
                      fontSize: 9,
                      fontWeight: 800,
                      color: meta.color,
                      background: meta.bg,
                      padding: '2px 6px',
                      borderRadius: 6,
                      letterSpacing: '0.04em',
                      whiteSpace: 'nowrap',
                      fontFamily: 'IBM Plex Mono, monospace',
                    }}>
                      {meta.emoji} {meta.label}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: C.faint, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {[p.category, p.city].filter(Boolean).join(' · ') || '—'}
                  </div>
                  {last?.body && (
                    <div style={{ fontSize: 11, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>
                      {last.direction === 'inbound' ? '↙ ' : '↗ '}{last.body}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Conversación · en móvil ocupa todo, en escritorio columna derecha */}
        <div
          style={{
            background: C.card,
            border: `1px solid ${C.border}`,
            borderRadius: 14,
            display: isMobile && !selectedId ? 'none' : 'flex',
            flexDirection: 'column',
            minHeight: isMobile ? 'calc(100vh - 140px)' : '72vh',
          }}
        >
          {!selected ? (
            <div style={{ flex: 1, display: 'grid', placeItems: 'center', color: C.faint, fontSize: 13 }}>
              Selecciona un proveedor.
            </div>
          ) : (
            <>
              <div style={{ padding: '14px 18px', borderBottom: `1px solid ${C.border}`, display:'flex', alignItems:'center', gap:10 }}>
                {isMobile && (
                  <button onClick={() => setSelectedId(null)}
                    aria-label="Volver a la lista"
                    style={{ background:'transparent', border:`1px solid ${C.border}`, color:C.text,
                      padding:'4px 10px', borderRadius:8, fontSize:14, cursor:'pointer', lineHeight:1, flexShrink:0 }}>
                    ← Lista
                  </button>
                )}
                <div style={{ minWidth:0, flex:1 }}>
                  <div style={{ fontWeight: 700, color: C.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{selected.name || 'Sin nombre'}</div>
                  <div style={{ fontSize: 11, color: C.faint, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {[selected.category, selected.city].filter(Boolean).join(' · ')} ·{' '}
                    {selected.outreach_whatsapp || selected.phone || 'sin número'}
                  </div>
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

                <div style={{
                  borderRadius: 12,
                  padding: 12,
                  background: within24h ? `${C.green}10` : 'transparent',
                  border: within24h ? `1px solid ${C.green}55` : `1px solid transparent`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}>
                  {within24h && (
                    <div style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: C.green,
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                      fontFamily: 'IBM Plex Mono, monospace',
                    }}>
                      🟢 CONVERSACIÓN ABIERTA · responde aquí ahora (ventana 24h)
                    </div>
                  )}
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    rows={4}
                    placeholder={
                      within24h
                        ? 'Escribe tu respuesta personal aquí…'
                        : 'Texto libre solo disponible si el proveedor ha respondido en las últimas 24h.'
                    }
                    style={{
                      width: '100%', fontSize: 13, background: C.bg, color: C.text,
                      border: `1px solid ${within24h ? C.green + '88' : C.border}`,
                      borderRadius: 10, padding: '10px 12px',
                      outline: 'none', resize: 'vertical', fontFamily: 'inherit',
                    }}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontSize: 11, color: within24h ? C.green : C.faint }}>
                      {within24h
                        ? `Última respuesta hace ${humanAgo(lastInboundAt!)}.`
                        : 'Fuera de la ventana de 24h: solo se permite la plantilla.'}
                    </span>
                    <button
                      disabled={pending || !within24h || !draft.trim()}
                      onClick={doSend}
                      style={{
                        fontSize: 13, fontWeight: 700,
                        background: within24h && draft.trim() ? C.green : C.text,
                        color: '#000',
                        padding: '10px 20px', borderRadius: 10, border: 'none',
                        cursor: pending || !within24h || !draft.trim() ? 'not-allowed' : 'pointer',
                        opacity: pending || !within24h || !draft.trim() ? 0.4 : 1,
                      }}
                    >
                      📤 Enviar texto
                    </button>
                  </div>
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

// Formatea una distancia temporal en pasado al estilo "5 min" / "2 h" / "1 d".
// Usado en el badge "Última respuesta hace X" del cuadro de envío.
function humanAgo(ts: number): string {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'segundos'
  if (mins < 60) return `${mins} min`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} h`
  const days = Math.floor(hrs / 24)
  return `${days} d`
}
