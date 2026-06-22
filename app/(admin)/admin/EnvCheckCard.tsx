'use client'

import { useEffect, useState } from 'react'

// Tarjeta de diagnóstico de env vars en Netlify. Llama a
// /api/admin/env-check (que devuelve solo si cada var está SET, sin
// el valor) y pinta verde/rojo por categoría. Útil para que el
// usuario sepa qué falta sin curl ni terminal.

type Status = { set: boolean; length: number }
type Group  = Record<string, Status>
type Data   = {
  ok: boolean
  groups: Record<string, Group>
}

const GROUP_LABELS: Record<string, { icon: string; label: string; critical: string[] }> = {
  core: {
    icon: '⚙️', label: 'Core',
    critical: ['ADMIN_PASSWORD', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'CRON_SECRET'],
  },
  heygen: {
    icon: '🎬', label: 'Vídeo diario (HeyGen)',
    critical: ['HEYGEN_API_KEY', 'HEYGEN_AVATAR_ID', 'HEYGEN_VOICE_ID'],
  },
  whatsapp: {
    icon: '💬', label: 'WhatsApp Business',
    critical: ['WHATSAPP_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_APP_SECRET', 'WHATSAPP_VERIFY_TOKEN', 'WHATSAPP_OUTREACH_TEMPLATE'],
  },
  ai: {
    icon: '🤖', label: 'IA (Claude)',
    critical: ['ANTHROPIC_API_KEY'],
  },
  email: {
    icon: '✉️', label: 'Email (Resend)',
    critical: ['RESEND_API_KEY'],
  },
  google: {
    icon: '📅', label: 'Google Calendar',
    critical: [],   // opcional
  },
}

const C = {
  bg:       '#111827',
  border:   '#1F2937',
  ok:       '#10B981',
  warn:     '#F59E0B',
  miss:     '#EF4444',
  optional: '#6B7280',
  text:     '#F0F4FF',
  muted:    '#9CA3AF',
  faint:    '#4B5563',
}

export default function EnvCheckCard() {
  const [data,    setData]    = useState<Data | null>(null)
  const [loading, setLoading] = useState(false)
  const [open,    setOpen]    = useState(false)   // expandido o solo resumen

  async function fetchData() {
    setLoading(true)
    try {
      const pass = localStorage.getItem('fg_admin_pass') || ''
      const r = await fetch('/api/admin/env-check', {
        headers: { 'x-admin-password': pass },
        cache:   'no-store',
      })
      const d = await r.json()
      if (r.ok) setData(d)
    } catch {} finally { setLoading(false) }
  }
  useEffect(() => { fetchData() }, [])

  if (!data) {
    return null   // o spinner — silencioso para no estorbar
  }

  // Cuenta cuántas vars CRÍTICAS faltan por grupo
  const summary = Object.entries(GROUP_LABELS).map(([gid, gmeta]) => {
    const group = data.groups[gid] || {}
    const missing = gmeta.critical.filter(k => !group[k]?.set)
    return { gid, ...gmeta, group, missing }
  })

  const totalMissing = summary.reduce((s, g) => s + g.missing.length, 0)

  return (
    <div style={{
      background: C.bg, border: `1px solid ${totalMissing > 0 ? C.warn : C.border}`,
      borderRadius: 14, padding: 18, marginBottom: 20,
      boxShadow: totalMissing > 0 ? `0 0 18px ${C.warn}22` : 'none',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: totalMissing > 0 ? C.warn : C.ok }}>
            {totalMissing > 0
              ? `⚠️ Te faltan ${totalMissing} variable${totalMissing !== 1 ? 's' : ''} crítica${totalMissing !== 1 ? 's' : ''} en Netlify`
              : '✅ Todas las env vars críticas configuradas'
            }
          </div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>
            Configura en Netlify → Site settings → Environment variables
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={fetchData} disabled={loading} style={{
            fontSize: 11, padding: '5px 11px', borderRadius: 7,
            border: `1px solid ${C.border}`, background: 'transparent', color: C.muted,
            cursor: loading ? 'not-allowed' : 'pointer',
          }}>
            {loading ? '...' : '🔄 Refrescar'}
          </button>
          <button onClick={() => setOpen(o => !o)} style={{
            fontSize: 11, padding: '5px 11px', borderRadius: 7,
            border: `1px solid ${C.border}`, background: 'transparent', color: C.muted,
            cursor: 'pointer',
          }}>
            {open ? '▴ Ocultar detalle' : '▾ Ver detalle'}
          </button>
        </div>
      </div>

      {/* Resumen rápido de los que FALTAN cuando está colapsado */}
      {!open && totalMissing > 0 && (
        <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {summary.flatMap(g => g.missing.map(k => (
            <span key={`${g.gid}-${k}`} style={{
              fontSize: 11, padding: '3px 10px', borderRadius: 6,
              background: `${C.miss}22`, color: C.miss, fontFamily: 'IBM Plex Mono, monospace',
            }}>
              {g.icon} {k}
            </span>
          )))}
        </div>
      )}

      {/* Detalle por grupo */}
      {open && (
        <div style={{ marginTop: 16, display: 'grid', gap: 10 }}>
          {summary.map(g => {
            const allKeys = Object.keys(g.group)
            return (
              <div key={g.gid} style={{
                background: '#0D1117', border: `1px solid ${C.border}`,
                borderRadius: 9, padding: '10px 12px',
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 8 }}>
                  {g.icon} {g.label}
                  {g.missing.length > 0 && (
                    <span style={{ marginLeft: 8, fontSize: 10, color: C.warn }}>
                      · faltan {g.missing.length}
                    </span>
                  )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 4 }}>
                  {allKeys.map(k => {
                    const status   = g.group[k]
                    const critical = g.critical.includes(k)
                    const color    = status.set ? C.ok : (critical ? C.miss : C.optional)
                    const icon     = status.set ? '✓' : (critical ? '✗' : '○')
                    return (
                      <div key={k} style={{
                        fontSize: 11, color: C.muted, fontFamily: 'IBM Plex Mono, monospace',
                        display: 'flex', justifyContent: 'space-between', gap: 6,
                      }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <span style={{ color, marginRight: 6, fontWeight: 700 }}>{icon}</span>
                          {k}
                        </span>
                        <span style={{ color: C.faint, fontSize: 10 }}>
                          {status.set ? `${status.length} chars` : (critical ? 'REQ' : 'opt')}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
