'use client'

import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'

/**
 * /admin/disputas · expediente de cada disputa de tarjeta.
 *
 * Tres cosas que tienen que poder hacerse aquí en menos de un minuto:
 *   1. Ver cuánto tiempo queda para enviar la evidencia (evidence_due_by).
 *   2. Revisar y corregir lo que se va a enviar, campo por campo.
 *   3. Enviarlo. El envío es irreversible, por eso lleva confirmación.
 *
 * Y una cuarta, preventiva: el listado de reservas ya celebradas que
 * siguen sin confirmación del proveedor. Esas son las vulnerables — hoy
 * no hay disputa, pero si llega, se pierde.
 */

const EUR = (cents: number | null | undefined, currency = 'eur') =>
  new Intl.NumberFormat('es-ES', {
    style: 'currency', currency: (currency || 'eur').toUpperCase(), minimumFractionDigits: 2,
  }).format(Number(cents || 0) / 100)

const dt = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleString('es-ES', { timeZone: 'Europe/Madrid' }) : '—'

const dOnly = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString('es-ES', { timeZone: 'Europe/Madrid' }) : '—'

function countdown(due: string | null | undefined): { label: string; urgent: boolean } {
  if (!due) return { label: 'sin fecha límite', urgent: false }
  const ms = new Date(due).getTime() - Date.now()
  if (ms <= 0) return { label: 'plazo agotado', urgent: true }
  const hours = Math.floor(ms / 3_600_000)
  const days = Math.floor(hours / 24)
  return {
    label: days >= 1 ? `quedan ${days} d ${hours % 24} h` : `quedan ${hours} h`,
    urgent: hours < 72,
  }
}

const STATUS_COLOR: Record<string, string> = {
  needs_response: '#F59E0B',
  warning_needs_response: '#F59E0B',
  under_review: '#06B6D4',
  warning_under_review: '#06B6D4',
  won: '#10B981',
  lost: '#EF4444',
  charge_refunded: '#9CA3AF',
  warning_closed: '#9CA3AF',
}

/** Campos editables del objeto evidence de Stripe (los de texto). */
const TEXT_FIELDS: Array<{ key: string; label: string; rows: number; help?: string }> = [
  { key: 'service_date',             label: 'Fecha del servicio', rows: 1 },
  { key: 'customer_name',            label: 'Nombre del cliente', rows: 1 },
  { key: 'customer_email_address',   label: 'Email del cliente', rows: 1 },
  { key: 'customer_purchase_ip',     label: 'IP desde la que compró', rows: 1,
    help: 'Sale de booking_consents. Si está vacía, la captura de IP falló en esa reserva.' },
  { key: 'billing_address',          label: 'Dirección de facturación', rows: 2 },
  { key: 'product_description',      label: 'Descripción del producto', rows: 3 },
  { key: 'refund_policy_disclosure', label: 'Dónde y cuándo se mostró la política de reembolso', rows: 6,
    help: 'Este campo es el que gana las disputas de "no me avisaron". Incluye timestamp e IP.' },
  { key: 'uncategorized_text',       label: 'Resumen cronológico', rows: 14 },
]

const FILE_FIELDS: Array<{ key: string; label: string }> = [
  { key: 'service_documentation',  label: 'Documentación del servicio (PDF)' },
  { key: 'customer_communication', label: 'Comunicaciones (PDF)' },
  { key: 'refund_policy',          label: 'Política de reembolso (PDF)' },
]

function adminHeaders() {
  const pass = typeof window !== 'undefined' ? localStorage.getItem('fg_admin_pass') || '' : ''
  return { 'Content-Type': 'application/json', 'x-admin-password': pass }
}

export default function AdminDisputasPage() {
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState(false)
  const [disputes, setDisputes] = useState<any[]>([])
  const [vulnerable, setVulnerable] = useState<any[]>([])
  const [stats, setStats] = useState<any>({ total: 0, open: 0, pending: 0, won: 0, lost: 0, vulnerable: 0 })
  const [selected, setSelected] = useState<string | null>(null)
  const [detail, setDetail] = useState<any>(null)
  const [evidence, setEvidence] = useState<Record<string, any>>({})
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/disputes', { headers: adminHeaders() })
      if (res.status === 401) { setAuthError(true); return }
      const data = await res.json()
      setDisputes(data.disputes || [])
      setVulnerable(data.vulnerable || [])
      setStats(data.stats || {})
    } catch {
      toast.error('No pude cargar las disputas')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Deep link desde el email de alerta: /admin/disputas?dispute=dp_xxx
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('dispute')
    if (id) setSelected(id)
  }, [])

  useEffect(() => {
    if (!selected) { setDetail(null); return }
    ;(async () => {
      const res = await fetch(`/api/admin/disputes?dispute=${encodeURIComponent(selected)}`, { headers: adminHeaders() })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Error cargando el detalle'); return }
      setDetail(data)
      setEvidence({ ...(data.dispute?.evidence_payload || {}) })
    })()
  }, [selected])

  async function recompile() {
    if (!selected) return
    setBusy(true)
    const t = toast.loading('Regenerando PDF y adjuntándolos…')
    try {
      const res = await fetch('/api/admin/disputes', {
        method: 'POST', headers: adminHeaders(),
        body: JSON.stringify({ action: 'recompile', dispute_id: selected }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setEvidence({ ...(data.evidence || {}) })
      toast.success('Evidencia recompilada ✓', { id: t })
      load()
    } catch (e: any) {
      toast.error(e?.message || 'Error recompilando', { id: t })
    } finally { setBusy(false) }
  }

  async function saveDraft() {
    if (!selected) return
    setBusy(true)
    const t = toast.loading('Guardando borrador en Stripe…')
    try {
      const res = await fetch('/api/admin/disputes', {
        method: 'PATCH', headers: adminHeaders(),
        body: JSON.stringify({ dispute_id: selected, evidence }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success('Borrador guardado ✓', { id: t })
      load()
    } catch (e: any) {
      toast.error(e?.message || 'Error guardando', { id: t })
    } finally { setBusy(false) }
  }

  async function submit() {
    if (!selected) return
    const ok = window.confirm(
      'Vas a ENVIAR la evidencia a Stripe. El envío es irreversible: después no se puede corregir ni añadir nada.\n\n¿Seguro que la has revisado entera?'
    )
    if (!ok) return
    setBusy(true)
    const t = toast.loading('Enviando evidencia…')
    try {
      const res = await fetch('/api/admin/disputes', {
        method: 'POST', headers: adminHeaders(),
        body: JSON.stringify({ action: 'submit', dispute_id: selected, evidence }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success('Evidencia enviada ✓', { id: t })
      load()
      setSelected(null)
    } catch (e: any) {
      toast.error(e?.message || 'Error enviando', { id: t })
    } finally { setBusy(false) }
  }

  if (authError) {
    return (
      <Shell>
        <div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF' }}>
          Sesión de admin no válida. Entra primero en <a href="/admin" style={{ color: '#06B6D4' }}>/admin</a>.
        </div>
      </Shell>
    )
  }

  // ── Detalle ───────────────────────────────────────────────────────────
  if (selected && detail) {
    const d = detail.dispute
    const b = detail.bundle
    const cd = countdown(d.evidence_due_by)
    const files = d.evidence_files || {}

    return (
      <Shell>
        <button onClick={() => setSelected(null)} style={linkBtn}>← Volver al listado</button>

        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#9CA3AF' }}>
                Disputa {d.stripe_dispute_id}
              </div>
              <div style={{ fontSize: 30, fontWeight: 800, marginTop: 6 }}>{EUR(d.amount, d.currency)}</div>
              <div style={{ fontSize: 13, color: '#9CA3AF', marginTop: 4 }}>
                Motivo: <strong style={{ color: '#F0F4FF' }}>{d.reason || '—'}</strong> · abierta el {dt(d.opened_at)}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ ...pill, background: (STATUS_COLOR[d.status] || '#6B7280') + '22', color: STATUS_COLOR[d.status] || '#9CA3AF' }}>
                {d.status || '—'}
              </span>
              <div style={{ marginTop: 8, fontSize: 13, color: cd.urgent ? '#EF4444' : '#9CA3AF' }}>
                Límite {dt(d.evidence_due_by)}<br />
                <strong>{cd.label}</strong>
              </div>
            </div>
          </div>
        </div>

        {d.evidence_submitted_at && (
          <div style={{ ...card, borderColor: '#10B98155', background: '#10B98111' }}>
            ✓ Evidencia enviada el {dt(d.evidence_submitted_at)}. Ya no se puede modificar.
          </div>
        )}

        {b?.error && (
          <div style={{ ...card, borderColor: '#EF444455', background: '#EF444411', color: '#FCA5A5' }}>
            No se pudo reunir la evidencia de la reserva: {b.error}
          </div>
        )}

        {b && !b.error && (
          <div style={card}>
            <h2 style={h2}>Expediente de la reserva</h2>
            <Row k="Reserva"  v={b.booking?.id} />
            <Row k="Cliente"  v={`${b.booking?.client_name || '—'} · ${b.booking?.client_email || '—'}`} />
            <Row k="Proveedor" v={b.provider?.name || '—'} />
            <Row k="Fecha del evento" v={dOnly(b.booking?.event_date)} />
            <Row k="Importe de la reserva" v={`${b.booking?.total_amount || 0} €`} />
            <Row
              k="Consentimiento"
              v={b.consent
                ? `${dt(b.consent.accepted_at)} · IP ${b.consent.ip_address || 'NO CAPTURADA'} · versión ${b.termsVersion?.version_label || '—'}`
                : '⚠️ NO HAY REGISTRO DE ACEPTACIÓN'}
              warn={!b.consent || !b.consent.ip_address}
            />
            <Row
              k="Confirmación del proveedor"
              v={b.confirmation
                ? `${dt(b.confirmation.confirmed_at)} · servicio del ${dOnly(b.confirmation.service_date)} · ${b.confirmation.confirmation_method}`
                : '⚠️ SIN CONFIRMAR'}
              warn={!b.confirmation}
            />
            <Row k="Mensajes recogidos" v={`${b.chatCount} del chat · ${b.whatsappCount} de WhatsApp`} />
            <Row k="Facturas" v={(b.invoices || []).map((i: any) => i.full_number).join(', ') || '—'} />
          </div>
        )}

        <div style={card}>
          <h2 style={h2}>Ficheros adjuntos en Stripe</h2>
          {FILE_FIELDS.map(f => (
            <Row key={f.key} k={f.label} v={files[f.key] || '— no adjuntado —'} warn={!files[f.key]} />
          ))}
          {files.errors?.length > 0 && (
            <div style={{ color: '#FCA5A5', fontSize: 12, marginTop: 8 }}>
              Errores de subida: {files.errors.join(' · ')}
            </div>
          )}
          <button onClick={recompile} disabled={busy || !!d.evidence_submitted_at} style={{ ...btn, marginTop: 14 }}>
            🔄 Recompilar y volver a adjuntar los PDF
          </button>
        </div>

        <div style={card}>
          <h2 style={h2}>Evidencia que se va a enviar</h2>
          <p style={{ fontSize: 12.5, color: '#9CA3AF', marginTop: 0, lineHeight: 1.6 }}>
            Esto es lo que Stripe tiene guardado como borrador. Puedes editarlo. Mientras no pulses “Enviar”,
            Stripe lo mandará solo al llegar la fecha límite.
          </p>
          {TEXT_FIELDS.map(f => (
            <div key={f.key} style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.14em', color: '#6B7280', marginBottom: 5 }}>
                {f.label}
              </label>
              {f.rows === 1 ? (
                <input
                  value={evidence[f.key] || ''}
                  onChange={e => setEvidence(v => ({ ...v, [f.key]: e.target.value }))}
                  disabled={!!d.evidence_submitted_at}
                  style={input}
                />
              ) : (
                <textarea
                  value={evidence[f.key] || ''}
                  onChange={e => setEvidence(v => ({ ...v, [f.key]: e.target.value }))}
                  rows={f.rows}
                  disabled={!!d.evidence_submitted_at}
                  style={{ ...input, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', lineHeight: 1.5 }}
                />
              )}
              {f.help && <div style={{ fontSize: 11, color: '#6B7280', marginTop: 4 }}>{f.help}</div>}
            </div>
          ))}

          {!d.evidence_submitted_at && (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 18 }}>
              <button onClick={saveDraft} disabled={busy} style={btn}>💾 Guardar borrador</button>
              <button onClick={submit} disabled={busy} style={{ ...btn, background: '#DC2626', color: '#fff', borderColor: '#DC2626' }}>
                📤 Enviar evidencia a Stripe (irreversible)
              </button>
            </div>
          )}
        </div>
      </Shell>
    )
  }

  // ── Listado ───────────────────────────────────────────────────────────
  return (
    <Shell>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 22 }}>
        <Stat label="Disputas" value={stats.total} />
        <Stat label="Abiertas" value={stats.open} color="#F59E0B" />
        <Stat label="Sin enviar" value={stats.pending} color="#EF4444" />
        <Stat label="Ganadas" value={stats.won} color="#10B981" />
        <Stat label="Perdidas" value={stats.lost} color="#EF4444" />
        <Stat label="Reservas vulnerables" value={stats.vulnerable} color="#F59E0B" />
      </div>

      <div style={card}>
        <h2 style={h2}>Disputas</h2>
        {loading ? <div style={{ color: '#6B7280' }}>Cargando…</div>
        : disputes.length === 0 ? <div style={{ color: '#6B7280', fontSize: 13 }}>Ninguna disputa registrada. Que siga así.</div>
        : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ color: '#6B7280', textAlign: 'left' }}>
                  <th style={th}>Abierta</th><th style={th}>Importe</th><th style={th}>Motivo</th>
                  <th style={th}>Cliente</th><th style={th}>Estado</th><th style={th}>Evidencia</th><th style={th}>Límite</th><th style={th}></th>
                </tr>
              </thead>
              <tbody>
                {disputes.map(d => {
                  const cd = countdown(d.evidence_due_by)
                  return (
                    <tr key={d.id} style={{ borderTop: '1px solid #1F2937' }}>
                      <td style={td}>{dOnly(d.opened_at)}</td>
                      <td style={{ ...td, fontWeight: 700 }}>{EUR(d.amount, d.currency)}</td>
                      <td style={td}>{d.reason || '—'}</td>
                      <td style={td}>{d.bookings?.client_name || <span style={{ color: '#EF4444' }}>sin reserva</span>}</td>
                      <td style={td}>
                        <span style={{ ...pill, background: (STATUS_COLOR[d.status] || '#6B7280') + '22', color: STATUS_COLOR[d.status] || '#9CA3AF' }}>
                          {d.status || '—'}
                        </span>
                      </td>
                      <td style={td}>
                        {d.evidence_submitted_at
                          ? <span style={{ color: '#10B981' }}>enviada</span>
                          : d.evidence_payload
                            ? <span style={{ color: '#F59E0B' }}>borrador</span>
                            : <span style={{ color: '#EF4444' }}>sin compilar</span>}
                      </td>
                      <td style={{ ...td, color: cd.urgent && !d.evidence_submitted_at ? '#EF4444' : '#9CA3AF' }}>
                        {d.evidence_submitted_at ? '—' : cd.label}
                      </td>
                      <td style={td}>
                        <button onClick={() => setSelected(d.stripe_dispute_id)} style={btn}>Abrir</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={card}>
        <h2 style={h2}>Reservas vulnerables</h2>
        <p style={{ fontSize: 12.5, color: '#9CA3AF', marginTop: 0, lineHeight: 1.6 }}>
          Eventos ya celebrados y cobrados en los que el proveedor todavía no ha confirmado que prestó el servicio.
          Si llega una disputa por “servicio no prestado”, en estas no tenemos la prueba principal.
        </p>
        {vulnerable.length === 0 ? (
          <div style={{ color: '#10B981', fontSize: 13 }}>✓ Ninguna. Todas las reservas celebradas tienen confirmación.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ color: '#6B7280', textAlign: 'left' }}>
                  <th style={th}>Evento</th><th style={th}>Cliente</th><th style={th}>Proveedor</th>
                  <th style={th}>Importe</th><th style={th}>Recordatorio enviado</th>
                </tr>
              </thead>
              <tbody>
                {vulnerable.map(v => (
                  <tr key={v.id} style={{ borderTop: '1px solid #1F2937' }}>
                    <td style={td}>{dOnly(v.event_date)}</td>
                    <td style={td}>{v.client_name}</td>
                    <td style={td}>{v.providers?.name || '—'}</td>
                    <td style={td}>{v.total_amount} €</td>
                    <td style={td}>
                      {v.service_confirmation_reminder_sent_at
                        ? dOnly(v.service_confirmation_reminder_sent_at)
                        : <span style={{ color: '#F59E0B' }}>no</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Shell>
  )
}

// ─── UI ───────────────────────────────────────────────────────────────────

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: '#080B12', color: '#F0F4FF', fontFamily: 'DM Sans, sans-serif' }}>
      <div style={{ borderBottom: '1px solid #1F2937', padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 14 }}>
        <a href="/admin" style={{ color: '#9CA3AF', textDecoration: 'none', fontSize: 13 }}>← Panel</a>
        <div style={{ fontWeight: 800, fontSize: 15 }}>⚖️ Disputas de tarjeta</div>
      </div>
      <div style={{ padding: '24px', maxWidth: 1100, margin: '0 auto' }}>{children}</div>
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div style={{ background: '#111827', border: '1px solid #1F2937', borderRadius: 12, padding: '14px 16px' }}>
      <div style={{ fontSize: 26, fontWeight: 800, color: color || '#F0F4FF' }}>{value ?? 0}</div>
      <div style={{ fontSize: 11, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.12em', marginTop: 2 }}>{label}</div>
    </div>
  )
}

function Row({ k, v, warn }: { k: string; v: any; warn?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 12, padding: '7px 0', borderBottom: '1px solid #161D2B', fontSize: 13 }}>
      <div style={{ width: 220, color: '#6B7280', flexShrink: 0 }}>{k}</div>
      <div style={{ color: warn ? '#F59E0B' : '#F0F4FF', wordBreak: 'break-word' }}>{v ?? '—'}</div>
    </div>
  )
}

const card: React.CSSProperties = {
  background: '#111827', border: '1px solid #1F2937', borderRadius: 14, padding: '18px 20px', marginBottom: 18,
}
const h2: React.CSSProperties = { fontSize: 15, fontWeight: 700, margin: '0 0 12px' }
const th: React.CSSProperties = { padding: '8px 10px', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em' }
const td: React.CSSProperties = { padding: '10px', verticalAlign: 'top' }
const pill: React.CSSProperties = { padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }
const btn: React.CSSProperties = {
  background: '#1F2937', color: '#F0F4FF', border: '1px solid #374151', borderRadius: 9,
  padding: '8px 14px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
}
const linkBtn: React.CSSProperties = {
  background: 'transparent', border: 'none', color: '#06B6D4', cursor: 'pointer', padding: 0, marginBottom: 14, fontSize: 13,
}
const input: React.CSSProperties = {
  width: '100%', background: '#080B12', border: '1px solid #1F2937', borderRadius: 9,
  padding: '9px 11px', color: '#F0F4FF', fontSize: 13, outline: 'none',
}
