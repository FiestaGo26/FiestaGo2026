'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase'
import type { Provider, Notification } from '@/lib/supabase'
import { CATEGORIES, getPhoto } from '@/lib/constants'

const ADMIN_PASS = typeof window !== 'undefined'
  ? localStorage.getItem('fg_admin_pass') || '' : ''

/* ─── HELPERS ────────────────────────────────────────────────────────────── */
function adminHeaders() {
  const pass = localStorage.getItem('fg_admin_pass') || ''
  return { 'Content-Type': 'application/json', 'x-admin-password': pass }
}

function ago(ts: string) {
  const d = Math.floor((Date.now() - new Date(ts).getTime()) / 1000)
  if (d < 60)   return 'hace unos segundos'
  if (d < 3600) return `hace ${Math.floor(d/60)}m`
  if (d < 86400) return `hace ${Math.floor(d/3600)}h`
  return `hace ${Math.floor(d/86400)}d`
}

const STATUS_MAP = {
  approved: { label:'✅ Aprobado',  bg:'#D1FAE5', color:'#065F46' },
  pending:  { label:'⏳ Pendiente', bg:'#FEF3C7', color:'#92400E' },
  rejected: { label:'❌ Rechazado', bg:'#FEE2E2', color:'#991B1B' },
  suspended:{ label:'Suspendido',bg:'#F3F4F6', color:'#4B5563' },
}

// Devuelve el "estado real" del proveedor según su lifecycle
function getProviderState(p: any) {
  if (p.status === 'approved')  return { label:'✅ En marketplace',     bg:'#D1FAE5', color:'#065F46' }
  if (p.status === 'rejected')  return { label:'❌ Rechazado',           bg:'#FEE2E2', color:'#991B1B' }
  if (p.status === 'pending') {
    // PRIORIDAD MÁXIMA: el proveedor se ha registrado por sí mismo, hay que aprobarlo.
    if (p.self_registered)      return { label:'✍️ Registrado · APROBAR', bg:'#FEE2E2', color:'#991B1B' }
    if (!p.outreach_sent)       return { label:'🆕 Sin contactar',      bg:'#E5E7EB', color:'#374151' }
    if (p.tag === 'Contactado por DM') return { label:'💬 Contactado DM',  bg:'#FCE7F3', color:'#9D174D' }
    if (p.tag === 'Contactado por email' || p.tag === 'Contactado') return { label:'📧 Contactado email', bg:'#DBEAFE', color:'#1E40AF' }
    return { label:'⏳ Pendiente', bg:'#FEF3C7', color:'#92400E' }
  }
  return { label: p.status, bg:'#F3F4F6', color:'#4B5563' }
}

/* ─── LOGIN ──────────────────────────────────────────────────────────────── */
function LoginScreen({ onLogin }: { onLogin: (pass: string) => void }) {
  const [pass, setPass] = useState('')
  const [err,  setErr]  = useState('')
  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!pass) return
    localStorage.setItem('fg_admin_pass', pass)
    onLogin(pass)
  }
  return (
    <div className="min-h-screen bg-[#080B12] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">🎉</div>
          <div className="font-mono text-[#06B6D4] text-sm tracking-widest uppercase mb-1">FiestaGo Admin</div>
          <div className="text-white/40 text-xs">Panel de administración</div>
        </div>
        <form onSubmit={submit} className="bg-[#111827] border border-[#1F2937] rounded-2xl p-7">
          <label className="block text-xs font-bold text-[#4B5563] uppercase tracking-widest mb-2">Contraseña de acceso</label>
          <input type="password" value={pass} onChange={e=>setPass(e.target.value)}
            placeholder="••••••••••••"
            className="w-full bg-[#080B12] border border-[#1F2937] rounded-xl px-4 py-3 text-white text-sm font-mono outline-none focus:border-[#06B6D4] mb-4"/>
          {err && <div className="text-red-400 text-xs mb-3">{err}</div>}
          <button type="submit"
            className="w-full bg-[#06B6D4] text-black font-bold py-3 rounded-xl text-sm hover:bg-[#0891B2] transition-colors">
            Acceder al panel
          </button>
        </form>
        <div className="text-center mt-4 text-[#1F2937] text-xs">
          La contraseña se configura en ADMIN_PASSWORD de tu .env
        </div>
      </div>
    </div>
  )
}

/* ─── MAIN ADMIN ─────────────────────────────────────────────────────────── */
export default function AdminPage() {
  const [authed,    setAuthed]    = useState(false)
  const [section,   setSection]   = useState('dashboard')
  const [providers, setProviders] = useState<Provider[]>([])
  const [notifs,    setNotifs]    = useState<Notification[]>([])
  const [unread,    setUnread]    = useState(0)
  const [loading,   setLoading]   = useState(false)
  const [editProv,  setEditProv]  = useState<Provider | null>(null)
  const [filterStatus, setFilterStatus] = useState('')
  const [filterCat,    setFilterCat]    = useState('')
  const [search,       setSearch]       = useState('')
  // Agent state
  const [agentCfg,  setAgentCfg]  = useState({ category:'foto', city:'Madrid', count:2, tone:'profesional y cercano', sources:['web'] })
  const [agentRunning, setAgentRunning] = useState(false)
  const [agentLogs,    setAgentLogs]    = useState<string[]>([])
  const [agentResults, setAgentResults] = useState<any[]>([])
  const [sendingEmail, setSendingEmail] = useState(false)
  const [sendStatus,  setSendStatus]   = useState<{ok:boolean,msg:string}|null>(null)
  const [extractingEmails, setExtractingEmails] = useState(false)
  const [runningFollowups, setRunningFollowups] = useState(false)
  // Waitlist
  const [waitlistEntries, setWaitlistEntries] = useState<any[]>([])
  const [waitlistStats,   setWaitlistStats]   = useState<any>({ total:0, active:0, last7d:0, byCity:{}, byEventType:{} })
  // Marketing / social_posts
  const [socialPosts,    setSocialPosts]    = useState<any[]>([])
  const [socialFilter,   setSocialFilter]   = useState<'pending'|'approved'|'published'|'all'>('pending')
  const [socialStats,    setSocialStats]    = useState<Record<string, number>>({})
  const [socialLoading,  setSocialLoading]  = useState(false)
  const [editingPost,    setEditingPost]    = useState<any | null>(null)
  // Generación a medida
  const [customPrompt,   setCustomPrompt]   = useState('')
  const [customLoading,  setCustomLoading]  = useState(false)
  const [customMsg,      setCustomMsg]      = useState<{ok:boolean,msg:string}|null>(null)
  // Bulk approve
  const [bulkLoading,    setBulkLoading]    = useState(false)
  const [bulkResult,     setBulkResult]     = useState<{ok:boolean,msg:string}|null>(null)
  // Regenerar drafts
  const [regenLoading,   setRegenLoading]   = useState(false)
  // Reservas
  const [bookings,       setBookings]       = useState<any[]>([])
  const [bookingFilter,  setBookingFilter]  = useState<'pending'|'confirmed'|'cancelled'|'all'>('pending')
  const [bookingStats,   setBookingStats]   = useState<Record<string, number>>({})
  const [bookingLoading, setBookingLoading] = useState(false)

  const [customers,         setCustomers]         = useState<any[]>([])
  const [customersStats,    setCustomersStats]    = useState<{total:number,marketing:number,confirmed:number}>({total:0,marketing:0,confirmed:0})
  const [customersLoading,  setCustomersLoading]  = useState(false)
  const [customersSearch,   setCustomersSearch]   = useState('')

  const [metrics,           setMetrics]           = useState<any | null>(null)
  const [metricsLoading,    setMetricsLoading]    = useState(false)

  const [incidents,         setIncidents]         = useState<any[]>([])
  const [incidentsStats,    setIncidentsStats]    = useState<{open:number,investigating:number,resolved:number,rejected:number}>({open:0,investigating:0,resolved:0,rejected:0})
  const [incidentsFilter,   setIncidentsFilter]   = useState<'open'|'investigating'|'resolved'|'rejected'|'all'>('open')
  const [incidentsLoading,  setIncidentsLoading]  = useState(false)
  const [openIncident,      setOpenIncident]      = useState<any | null>(null)
  const logRef = useRef<HTMLDivElement>(null)

  const supabase = createClient()

  // ── AUTH ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const pass = localStorage.getItem('fg_admin_pass')
    if (pass) setAuthed(true)
  }, [])

  // ── REALTIME — new providers & notifications ─────────────────────────────
  useEffect(() => {
    if (!authed) return

    const channel = supabase
      .channel('admin_realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' },
        payload => {
          const n = payload.new as Notification
          setNotifs(prev => [n, ...prev])
          setUnread(u => u + 1)
          // Browser notification
          if (Notification.permission === 'granted') {
            new Notification('FiestaGo Admin', { body: n.title, icon: '/favicon.ico' })
          }
        })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'providers' },
        payload => {
          setProviders(prev => [payload.new as Provider, ...prev])
        })
      .subscribe()

    // Request browser notification permission
    if (Notification.permission === 'default') {
      Notification.requestPermission()
    }

    return () => { supabase.removeChannel(channel) }
  }, [authed])

  // ── FETCH DATA ───────────────────────────────────────────────────────────
  const fetchProviders = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    // Los sub-estados de pending (nuevo, contactado_email, contactado_dm) se filtran
    // cliente-side. Solo mandamos al API los status reales de DB.
    const realStatus = ['approved','rejected','pending'].includes(filterStatus) ? filterStatus
                      : (['nuevo','contactado_email','contactado_dm'].includes(filterStatus) ? 'pending' : '')
    if (realStatus)   params.set('status', realStatus)
    if (filterCat)    params.set('category', filterCat)
    if (search)       params.set('search', search)
    const res  = await fetch(`/api/admin/providers?${params}`, { headers: adminHeaders() })
    const data = await res.json()
    let list = data.providers || []
    // Sub-filtros cliente:
    if (filterStatus === 'registrados') {
      list = list.filter((p: any) => p.self_registered && p.status === 'pending')
    } else if (filterStatus === 'nuevo') {
      list = list.filter((p: any) => !p.outreach_sent && !p.self_registered)
    } else if (filterStatus === 'contactado_email') {
      list = list.filter((p: any) => p.outreach_sent && (p.tag === 'Contactado por email' || p.tag === 'Contactado') && !p.self_registered)
    } else if (filterStatus === 'contactado_dm') {
      list = list.filter((p: any) => p.outreach_sent && p.tag === 'Contactado por DM' && !p.self_registered)
    }
    // Ordenar: los auto-registrados pendientes SIEMPRE arriba
    list.sort((a: any, b: any) => {
      const aReg = a.self_registered && a.status === 'pending' ? 1 : 0
      const bReg = b.self_registered && b.status === 'pending' ? 1 : 0
      if (aReg !== bReg) return bReg - aReg
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
    setProviders(list)
    setLoading(false)
  }, [filterStatus, filterCat, search])

  const fetchNotifs = useCallback(async () => {
    const res  = await fetch('/api/admin/notifications?limit=50', { headers: adminHeaders() })
    const data = await res.json()
    setNotifs(data.notifications || [])
    setUnread(data.unreadCount || 0)
  }, [])

  useEffect(() => {
    if (!authed) return
    fetchProviders()
    fetchNotifs()
  }, [authed, fetchProviders, fetchNotifs])

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [agentLogs])

  // ── ACTIONS ──────────────────────────────────────────────────────────────
  async function updateProvider(id: string, updates: Partial<Provider>) {
    const res = await fetch('/api/admin/providers', {
      method:'PATCH', headers: adminHeaders(),
      body: JSON.stringify({ id, ...updates }),
    })
    const data = await res.json().catch(() => ({}))
    // Usar la fila completa del servidor para que campos como contactable y photo_url se sincronicen
    const fresh = (data && data.provider) ? data.provider as Provider : { ...{}, ...updates }
    setProviders(prev => prev.map(p => p.id === id ? { ...p, ...fresh } : p))
    // Si abierto en modal, actualizarlo también
    setEditProv(prev => prev && prev.id === id ? { ...prev, ...fresh } : prev)
    // Toast de feedback (si hay flujos especiales)
    if (data && data.flow === 'outreach_sent')   toast.success('Email de captación enviado · proveedor sigue pendiente')
    else if (data && data.flow === 'mark_for_dm') toast.success('Marcado como contactado · envíale el DM desde IG · sigue pendiente')
    else if (data && data.flow === 'outreach_failed') toast.error(`No se pudo enviar outreach: ${data.outreachError || 'sin email/IG'}`)
    else if (data && data.flow === 'approval')   toast.success(`Aprobado${data.welcomeEmail ? ' · email bienvenida enviado' : ''}${data.imageGenerated ? ' · imagen generada' : ''}`)
    else if (updates.status === 'rejected')      toast.success(`Rechazado${data?.rejectionEmail ? ' · email enviado' : ''}`)
    return data
  }

  async function deleteProvider(id: string) {
    if (!confirm('¿Eliminar este proveedor?')) return
    await fetch(`/api/admin/providers?id=${id}`, { method:'DELETE', headers: adminHeaders() })
    setProviders(prev => prev.filter(p => p.id !== id))
  }

  async function regenerateDrafts() {
    if (!confirm('Regenerar todos los drafts de email y DM con el mensaje nuevo (sello + referidos + lanzamiento 10-jun). Solo afecta a pendientes sin contactar. ¿Continuar?')) return
    setRegenLoading(true)
    try {
      const res = await fetch('/api/admin/providers/regenerate-drafts', {
        method: 'POST',
        headers: adminHeaders(),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error')
      toast.success(`✓ Regenerados: ${data.emailDraftsRegenerated} emails · ${data.dmDraftsRegenerated} DMs · ${data.updated}/${data.total} filas`)
      fetchProviders()
    } catch (err: any) {
      toast.error(err.message || 'Error regenerando drafts')
    }
    setRegenLoading(false)
  }

  async function bulkApprove() {
    const candidatos = providers.filter(p =>
      p.status === 'pending' && !p.outreach_sent && p.outreach_email && p.email
    )
    if (!candidatos.length) {
      setBulkResult({ ok: false, msg: 'No hay candidatos con email pendientes de contactar.' })
      return
    }
    if (!confirm(`Vas a enviar el email outreach a ${candidatos.length} proveedores.\n\n(Cuota Resend: 3.000 emails/mes en plan free — vas a usar ${candidatos.length} de los disponibles).\n\n¿Continuar?`)) return
    setBulkLoading(true)
    setBulkResult({ ok: true, msg: `⏳ Enviando ${candidatos.length} emails (puede tardar 1-3 min)...` })
    try {
      const res = await fetch('/api/admin/providers/bulk-approve', {
        method: 'POST',
        headers: adminHeaders(),
        body: JSON.stringify({ onlyWithEmail: true }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error inesperado')
      setBulkResult({
        ok: data.failed === 0,
        msg: `✓ ${data.ok} enviados · ${data.failed} fallaron (de ${data.total} totales)${data.errors?.length ? ` · Primer error: ${data.errors[0].error}` : ''}`,
      })
      fetchProviders()  // refresca el listado
    } catch (err: any) {
      setBulkResult({ ok: false, msg: '❌ ' + (err.message || 'Error') })
    }
    setBulkLoading(false)
  }

  async function markNotifsRead() {
    await fetch('/api/admin/notifications', {
      method:'PATCH', headers: adminHeaders(),
      body: JSON.stringify({ all: true }),
    })
    setNotifs(prev => prev.map(n => ({ ...n, read: true })))
    setUnread(0)
  }

  async function runAgent() {
    setAgentRunning(true)
    const totalTarget = agentCfg.count
    // Backend máx 3 por request (timeout 30s). Para más, lotes.
    const BATCH_MAX  = 3
    // Pausa entre lotes para no exceder el rate limit de Anthropic
    // (30k tokens input/min en tier gratuito; cada lote ~10-15k).
    const DELAY_MS   = 30_000
    const batches    = Math.ceil(totalTarget / BATCH_MAX)
    const estSeconds = batches * 20 + Math.max(0, batches - 1) * (DELAY_MS / 1000)

    setAgentLogs([
      `🤖 Iniciando agente — ${agentCfg.category} en ${agentCfg.city}...`,
      batches === 1
        ? `⏱ Esto tarda 10-25 segundos (búsqueda web + análisis). Por favor espera.`
        : `⏱ Búsqueda en ${batches} lotes (${totalTarget} proveedores). Pausas de 30s entre lotes para no saturar API. Tiempo total estimado: ~${Math.round(estSeconds)}s.`,
    ])
    setAgentResults([])

    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
    const isRateLimitMsg = (msg: string) => /rate.?limit|exceed.*tokens|429/i.test(msg || '')

    let accumulated: any[] = []
    let consecutiveZero = 0

    for (let i = 0; i < batches; i++) {
      const remaining = totalTarget - accumulated.length
      if (remaining <= 0) break
      const batchSize = Math.min(BATCH_MAX, remaining)

      if (batches > 1) {
        setAgentLogs(l => [...l, `── Lote ${i+1}/${batches} · ${batchSize} proveedor${batchSize===1?'':'es'} ──`])
      }

      // Función interna para llamar al endpoint con un retry en caso
      // de rate limit (esperamos 65s y volvemos a intentar una vez).
      const callBatch = async (attempt: number): Promise<any> => {
        const res = await fetch('/api/admin/agent', {
          method: 'POST', headers: adminHeaders(),
          body: JSON.stringify({ ...agentCfg, count: batchSize }),
        })
        const raw = await res.text()
        let data: any = {}
        try { data = JSON.parse(raw) } catch {
          const lookHtml = /^\s*<(\!doctype|html|head|body)/i.test(raw)
          return { _fatal: lookHtml
            ? `❌ Netlify cortó la función por timeout (>30s) en el lote ${i+1}.`
            : `❌ Respuesta no-JSON: ${raw.slice(0, 120)}…` }
        }
        if (data.error && isRateLimitMsg(data.error) && attempt === 0) {
          setAgentLogs(l => [...l, `⏸ Rate limit alcanzado. Esperando 65s y reintentando...`])
          await sleep(65_000)
          return callBatch(1)
        }
        return data
      }

      try {
        const data = await callBatch(0)
        if (data._fatal) { setAgentLogs(l => [...l, data._fatal]); break }

        if (data.logs) setAgentLogs(l => [...l, ...data.logs])
        if (data.error && !(data.logs || []).some((x: string) => x.includes(data.error))) {
          setAgentLogs(l => [...l, `❌ Error: ${data.error}`])
        }
        const got: any[] = data.providers || []
        accumulated = [...accumulated, ...got]
        setAgentResults(accumulated)
        if (got.length === 0) {
          consecutiveZero++
          if (consecutiveZero >= 2) {
            setAgentLogs(l => [...l, `⏹ Dos lotes seguidos sin resultados. Paramos para no quemar API.`])
            break
          }
        } else {
          consecutiveZero = 0
        }
      } catch (e: any) {
        setAgentLogs(l => [...l, `❌ Error de red en lote ${i+1}: ${e.message}`])
        break
      }

      // Pausa entre lotes (no después del último)
      const stillHaveBatches = (i + 1) < batches && accumulated.length < totalTarget
      if (stillHaveBatches) {
        setAgentLogs(l => [...l, `⏸ Esperando 30s antes del siguiente lote (rate limit Anthropic)...`])
        await sleep(DELAY_MS)
      }
    }

    if (batches > 1) {
      setAgentLogs(l => [...l, `✅ Búsqueda completa: ${accumulated.length}/${totalTarget} proveedores`])
    }
    setAgentRunning(false)
  }

  // Scrapea webs de proveedores con tag "Investigar web" y extrae email.
  // Si lo encuentra, dispara outreach automático.
  async function extractEmailsBatch() {
    setExtractingEmails(true)
    setAgentLogs(l => [...l, `🔍 Extrayendo emails desde webs (hasta 8 proveedores)...`])
    try {
      const res = await fetch('/api/admin/agent/extract-email', {
        method: 'POST',
        headers: adminHeaders(),
        body: JSON.stringify({ batch: true }),
      })
      const data = await res.json()
      if (!res.ok) {
        setAgentLogs(l => [...l, `❌ ${data.error || 'error'}`])
      } else {
        setAgentLogs(l => [...l,
          `📦 Procesados: ${data.processed}`,
          `✉️  Emails extraídos: ${data.extracted}`,
          `📨 Outreach enviado: ${data.emailsSent}`,
          ...(data.results || []).map((r: any) =>
            `   ${r.status === 'extraido-y-contactado' ? '✅' : r.status === 'extraido' ? '🟡' : '·'} ${r.name}${r.email ? ' — ' + r.email : ''} (${r.status})`),
        ])
      }
    } catch (err: any) {
      setAgentLogs(l => [...l, `❌ ${err.message}`])
    } finally {
      setExtractingEmails(false)
    }
  }

  // Dispara follow-ups: email automático por Resend (2º + 3º toque),
  // DM solo queda en la cola con tag para enviar a mano desde IG.
  async function runFollowups() {
    setRunningFollowups(true)
    setAgentLogs(l => [...l, `📬 Procesando follow-ups (1º toque hace ≥7 días sin respuesta)...`])
    try {
      const res = await fetch('/api/admin/agent/followup', {
        method: 'POST',
        headers: adminHeaders(),
        body: JSON.stringify({ days_initial: 7, days_between: 7, limit: 50 }),
      })
      const data = await res.json()
      if (!res.ok) {
        setAgentLogs(l => [...l, `❌ ${data.error || 'error'}`])
      } else {
        setAgentLogs(l => [...l,
          `📦 Candidatos: ${data.candidates}`,
          `✉️  Emails enviados: ${data.emailsSent}`,
          `📱 DMs en cola (manda desde IG): ${data.dmsQueued}`,
          ...(data.logs || []),
        ])
      }
    } catch (err: any) {
      setAgentLogs(l => [...l, `❌ ${err.message}`])
    } finally {
      setRunningFollowups(false)
    }
  }

  // ── SOCIAL POSTS ──────────────────────────────────────────────────────────
  const fetchSocialPosts = useCallback(async () => {
    setSocialLoading(true)
    const params = new URLSearchParams()
    if (socialFilter !== 'all') params.set('status', socialFilter)
    const res = await fetch(`/api/admin/social-posts?${params}`, { headers: adminHeaders() })
    const data = await res.json()
    setSocialPosts(data.posts || [])
    setSocialStats(data.stats || {})
    setSocialLoading(false)
  }, [socialFilter])

  useEffect(() => {
    if (!authed) return
    if (section !== 'marketing') return
    fetchSocialPosts()
  }, [authed, section, fetchSocialPosts])

  // ── BOOKINGS ─────────────────────────────────────────────────────────────
  const fetchBookings = useCallback(async () => {
    setBookingLoading(true)
    const params = new URLSearchParams()
    if (bookingFilter !== 'all') params.set('status', bookingFilter)
    const res = await fetch(`/api/admin/bookings?${params}`, { headers: adminHeaders() })
    const data = await res.json()
    setBookings(data.bookings || [])
    setBookingStats(data.stats || {})
    setBookingLoading(false)
  }, [bookingFilter])

  useEffect(() => {
    if (!authed) return
    if (section !== 'bookings' && section !== 'dashboard') return
    fetchBookings()
  }, [authed, section, fetchBookings])

  // ── CUSTOMERS / SOCIOS ───────────────────────────────────────────────────
  const fetchCustomers = useCallback(async () => {
    setCustomersLoading(true)
    const params = new URLSearchParams()
    if (customersSearch.trim()) params.set('q', customersSearch.trim())
    const res = await fetch(`/api/admin/customers?${params}`, { headers: adminHeaders() })
    const data = await res.json()
    setCustomers(data.customers || [])
    setCustomersStats(data.stats || { total:0, marketing:0, confirmed:0 })
    setCustomersLoading(false)
  }, [customersSearch])

  useEffect(() => {
    if (!authed) return
    if (section !== 'customers') return
    fetchCustomers()
  }, [authed, section, fetchCustomers])

  // ── MÉTRICAS ─────────────────────────────────────────────────────────────
  const fetchMetrics = useCallback(async () => {
    setMetricsLoading(true)
    try {
      const res = await fetch('/api/admin/metrics', { headers: adminHeaders() })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error')
      setMetrics(data)
    } catch { setMetrics(null) }
    setMetricsLoading(false)
  }, [])

  useEffect(() => {
    if (!authed) return
    if (section === 'metrics') fetchMetrics()
  }, [authed, section, fetchMetrics])

  // ── WAITLIST ──────────────────────────────────────────────────────────────
  const fetchWaitlist = useCallback(async () => {
    try {
      const res  = await fetch('/api/admin/waitlist', { headers: adminHeaders() })
      const data = await res.json()
      setWaitlistEntries(data.entries || [])
      setWaitlistStats(data.stats || { total:0, active:0, last7d:0, byCity:{}, byEventType:{} })
    } catch {}
  }, [])
  useEffect(() => {
    if (!authed) return
    fetchWaitlist()  // se carga siempre — alimenta el badge del menú
  }, [authed, fetchWaitlist])

  // ── INCIDENCIAS ───────────────────────────────────────────────────────────
  const fetchIncidents = useCallback(async () => {
    setIncidentsLoading(true)
    const params = new URLSearchParams()
    if (incidentsFilter !== 'all') params.set('status', incidentsFilter)
    const res = await fetch(`/api/incidents?${params}`, { headers: adminHeaders() })
    const data = await res.json()
    setIncidents(data.incidents || [])
    setIncidentsStats(data.stats || { open:0, investigating:0, resolved:0, rejected:0 })
    setIncidentsLoading(false)
  }, [incidentsFilter])

  useEffect(() => {
    if (!authed) return
    if (section === 'incidents' || section === 'dashboard') fetchIncidents()
  }, [authed, section, fetchIncidents])

  async function updateIncident(id: string, updates: any) {
    const res = await fetch(`/api/incidents/${id}`, {
      method: 'PATCH',
      headers: { ...adminHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    const data = await res.json()
    if (!res.ok || data.error) {
      toast.error(data.error || 'Error al actualizar')
      return
    }
    setIncidents(prev => prev.map(i => i.id === id ? { ...i, ...data.incident } : i))
    setOpenIncident((prev: any) => prev && prev.id === id ? { ...prev, ...data.incident } : prev)
    toast.success('Incidencia actualizada ✓')
  }

  function exportCustomersCSV() {
    if (!customers.length) return
    const head = ['email','nombre','telefono','ciudad','marketing','email_confirmado','creado','ultimo_acceso']
    const rows = customers.map(c => [
      c.email || '',
      c.name || '',
      c.phone || '',
      c.city || '',
      c.accepts_marketing ? 'si' : 'no',
      c.email_confirmed ? 'si' : 'no',
      c.created_at || '',
      c.last_sign_in_at || '',
    ])
    const csv = [head, ...rows].map(r =>
      r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')
    ).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url
    a.download = `fiestago-socios-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function updateBookingStatus(id: string, status: string) {
    await fetch('/api/admin/bookings', {
      method: 'PATCH',
      headers: adminHeaders(),
      body: JSON.stringify({ id, status }),
    })
    setBookings(b => b.map(x => x.id === id ? { ...x, status } : x))
    toast.success(status === 'confirmed' ? 'Reserva confirmada' : 'Reserva cancelada')
  }

  async function generateCustomPost() {
    const prompt = customPrompt.trim()
    if (!prompt) { setCustomMsg({ ok:false, msg:'Escribe primero qué quieres que genere' }); return }
    setCustomLoading(true)
    setCustomMsg({ ok:true, msg:'Generando… (Claude planifica + fal.ai imagina la imagen, ~15-25s)' })
    try {
      const res = await fetch('/api/admin/marketing/custom', {
        method: 'POST',
        headers: adminHeaders(),
        body: JSON.stringify({ prompt }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error inesperado')
      setCustomMsg({ ok:true, msg:`✓ Post generado y añadido a la cola de aprobación.` })
      setCustomPrompt('')
      // Refresh la lista para que aparezca el nuevo
      fetchSocialPosts()
    } catch (err: any) {
      setCustomMsg({ ok:false, msg:'❌ ' + (err.message || 'Error') })
    }
    setCustomLoading(false)
  }

  async function updateSocialPost(id: string, updates: any) {
    const res = await fetch('/api/admin/social-posts', {
      method:'PATCH', headers: adminHeaders(),
      body: JSON.stringify({ id, ...updates }),
    })
    if (res.ok) {
      setSocialPosts(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p))
    }
  }

  async function deleteSocialPost(id: string) {
    if (!confirm('¿Eliminar este post? También se borra el archivo del Storage.')) return
    await fetch(`/api/admin/social-posts?id=${id}`, { method:'DELETE', headers: adminHeaders() })
    setSocialPosts(prev => prev.filter(p => p.id !== id))
  }

  function copyToClipboardAndOpen(text: string, url: string, postId: string) {
    navigator.clipboard.writeText(text).catch(() => {})
    window.open(url, '_blank')
    updateSocialPost(postId, { status:'published', published_at: new Date().toISOString() })
  }

  // ── ENVIAR OUTREACH EMAIL ────────────────────────────────────────────────
  async function sendOutreachEmail() {
    if (!editProv) return
    setSendingEmail(true)
    setSendStatus(null)
    try {
      // Si el usuario edito el draft en el textarea, guardamos antes para que
      // el servidor lea el ultimo cuerpo desde Supabase.
      await fetch('/api/admin/providers', {
        method:'PATCH', headers: adminHeaders(),
        body: JSON.stringify({ id: editProv.id, outreach_email: editProv.outreach_email, email: editProv.email }),
      })
      const res  = await fetch('/api/admin/send-outreach', {
        method:'POST', headers: adminHeaders(),
        body: JSON.stringify({ id: editProv.id }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setSendStatus({ ok:false, msg: data.error || `Error HTTP ${res.status}` })
      } else {
        setSendStatus({ ok:true, msg: `Enviado a ${data.to}` })
        setProviders(prev => prev.map(p => p.id === editProv.id ? { ...p, outreach_sent: true } : p))
        setEditProv(p => p ? { ...p, outreach_sent: true } : null)
      }
    } catch (e: any) {
      setSendStatus({ ok:false, msg: e.message || 'Error de red' })
    }
    setSendingEmail(false)
  }

  // ── STATS ────────────────────────────────────────────────────────────────
  const stats = {
    total:    providers.length,
    approved: providers.filter(p => p.status === 'approved').length,
    pending:  providers.filter(p => p.status === 'pending').length,
    featured: providers.filter(p => p.featured).length,
  }

  if (!authed) return <LoginScreen onLogin={() => setAuthed(true)} />

  // ── NAV ───────────────────────────────────────────────────────────────────
  const NAV = [
    { id:'dashboard',    icon:'📊', label:'Dashboard' },
    { id:'metrics',      icon:'📈', label:'Métricas' },
    { id:'providers',    icon:'🏪', label:'Proveedores', badge: stats.pending },
    { id:'bookings',     icon:'📋', label:'Reservas', badge: bookingStats.pending || 0 },
    { id:'incidents',    icon:'🚨', label:'Incidencias', badge: incidentsStats.open || 0 },
    { id:'customers',    icon:'👥', label:'Socios' },
    { id:'waitlist',     icon:'🎉', label:'Waitlist',     badge: waitlistStats.last7d || 0 },
    { id:'notifications',icon:'🔔', label:'Notificaciones', badge: unread },
    { id:'agent',        icon:'🤖', label:'Agente IA' },
    { id:'marketing',    icon:'📣', label:'Marketing', badge: socialStats.pending || 0 },
    { id:'settings',     icon:'⚙️', label:'Ajustes' },
  ]

  return (
    <div className="flex min-h-screen" style={{ background:'#080B12', color:'#F0F4FF', fontFamily:'DM Sans,sans-serif' }}>
      {/* SIDEBAR */}
      <aside style={{ width:220, background:'#0D1117', borderRight:'1px solid #1F2937',
        display:'flex', flexDirection:'column', position:'fixed', top:0, left:0, bottom:0, zIndex:100 }}>
        <div style={{ padding:'20px 18px 14px', borderBottom:'1px solid #1F2937' }}>
          <div style={{ fontFamily:'IBM Plex Mono,monospace', fontSize:15, fontWeight:700, color:'#F0F4FF' }}>🎉 FiestaGo</div>
          <div style={{ fontSize:10, fontWeight:700, color:'#F43F5E', letterSpacing:'0.1em', textTransform:'uppercase', marginTop:2 }}>Admin Panel</div>
        </div>
        <nav style={{ padding:'12px 10px', flex:1 }}>
          {NAV.map(item => (
            <button key={item.id} onClick={() => { setSection(item.id); if(item.id==='notifications') markNotifsRead(); }}
              style={{ width:'100%', display:'flex', alignItems:'center', gap:9, padding:'8px 11px',
                borderRadius:10, border:'none', cursor:'pointer', textAlign:'left', marginBottom:3,
                background: section===item.id ? '#F43F5E22' : 'transparent',
                color: section===item.id ? '#F43F5E' : '#9CA3AF',
                fontFamily:'DM Sans,sans-serif', fontSize:13, fontWeight: section===item.id ? 700 : 400 }}>
              <span style={{ fontSize:16 }}>{item.icon}</span>
              <span style={{ flex:1 }}>{item.label}</span>
              {(item.badge || 0) > 0 && (
                <span style={{ background: item.id==='notifications'?'#10B981':'#F59E0B',
                  color:'#000', fontSize:10, fontWeight:800, padding:'1px 6px', borderRadius:10 }}>
                  {item.badge}
                </span>
              )}
            </button>
          ))}
        </nav>
        <div style={{ padding:'12px 16px', borderTop:'1px solid #1F2937' }}>
          <div style={{ fontSize:11, color:'#374151' }}>Sesión activa</div>
          <div style={{ fontSize:12, fontWeight:700, color:'#F0F4FF', marginTop:2 }}>
            {process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'admin@fiegago.es'}
          </div>
          <button onClick={() => { localStorage.removeItem('fg_admin_pass'); setAuthed(false); }}
            style={{ marginTop:8, fontSize:11, color:'#F43F5E', background:'transparent', border:'none', cursor:'pointer', padding:0 }}>
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <main style={{ marginLeft:220, flex:1 }}>
        {/* Topbar */}
        <div style={{ background:'#0D1117', borderBottom:'1px solid #1F2937', padding:'0 24px',
          height:56, display:'flex', alignItems:'center', justifyContent:'space-between',
          position:'sticky', top:0, zIndex:50 }}>
          <div style={{ fontSize:15, fontWeight:700, color:'#F0F4FF' }}>
            {NAV.find(n=>n.id===section)?.label}
          </div>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            {unread > 0 && (
              <div style={{ fontSize:12, color:'#10B981', background:'#10B98111', border:'1px solid #10B98133',
                padding:'3px 11px', borderRadius:20 }}>
                🔔 {unread} nueva{unread!==1?'s':''}
              </div>
            )}
            <a href="/" target="_blank"
              style={{ fontSize:12, padding:'5px 12px', borderRadius:8, border:'1px solid #1F2937',
                background:'transparent', color:'#9CA3AF', cursor:'pointer', textDecoration:'none' }}>
              Ver marketplace ↗
            </a>
          </div>
        </div>

        <div style={{ padding:24 }}>

          {/* ══ DASHBOARD ══ */}
          {section === 'dashboard' && (
            <div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:24 }}>
                {[
                  { label:'Total proveedores', value:stats.total,    icon:'🏪', color:'#3B82F6' },
                  { label:'Aprobados',          value:stats.approved, icon:'✅', color:'#10B981' },
                  { label:'Pendientes',          value:stats.pending,  icon:'⏳', color:'#F59E0B', alert:stats.pending>0 },
                  { label:'Destacados',          value:stats.featured, icon:'⭐', color:'#8B5CF6' },
                ].map(s => (
                  <div key={s.label} style={{ background:'#111827', border:`1px solid ${s.alert?s.color+'55':'#1F2937'}`,
                    borderRadius:14, padding:'18px 16px',
                    boxShadow: s.alert ? `0 0 16px ${s.color}22` : 'none' }}>
                    <div style={{ fontSize:22, marginBottom:8 }}>{s.icon}</div>
                    <div style={{ fontFamily:'IBM Plex Mono,monospace', fontSize:28, fontWeight:500, color:s.color, marginBottom:4 }}>{s.value}</div>
                    <div style={{ fontSize:11, color:'#4B5563' }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Pending quick actions */}
              {stats.pending > 0 && (
                <div style={{ background:'#F59E0B11', border:'1px solid #F59E0B44', borderRadius:14, padding:'16px 18px', marginBottom:20 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                    <div style={{ fontSize:13, fontWeight:700, color:'#F59E0B' }}>⏳ {stats.pending} proveedor{stats.pending!==1?'es':''} pendiente{stats.pending!==1?'s':''}</div>
                    <button onClick={()=>setSection('providers')}
                      style={{ fontSize:11, padding:'4px 11px', borderRadius:7, border:'1px solid #F59E0B',
                        background:'transparent', color:'#F59E0B', cursor:'pointer' }}>
                      Ver todos →
                    </button>
                  </div>
                  {providers.filter(p=>p.status==='pending').slice(0,3).map(p => {
                    const cat = CATEGORIES.find(c=>c.id===p.category)
                    return (
                      <div key={p.id} style={{ display:'flex', alignItems:'center', gap:11, background:'#111827',
                        borderRadius:9, padding:'9px 12px', marginBottom:6 }}>
                        <img src={p.photo_url || getPhoto(p.category, p.photo_idx)} alt=""
                          style={{ width:38, height:38, borderRadius:8, objectFit:'cover', flexShrink:0 }}/>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:13, fontWeight:700, color:'#F0F4FF' }}>{p.name}</div>
                          <div style={{ fontSize:11, color:'#4B5563' }}>{cat?.icon} {cat?.label} · {p.city} · {ago(p.created_at)}</div>
                        </div>
                        <div style={{ display:'flex', gap:5 }}>
                          <button onClick={()=>updateProvider(p.id,{status:'approved'})}
                            style={{ padding:'5px 10px', borderRadius:7, border:'none', background:'#10B98122', color:'#10B981', fontSize:11, fontWeight:700, cursor:'pointer' }}>✓</button>
                          <button onClick={()=>updateProvider(p.id,{status:'rejected'})}
                            style={{ padding:'5px 10px', borderRadius:7, border:'none', background:'#EF444422', color:'#EF4444', fontSize:11, fontWeight:700, cursor:'pointer' }}>✕</button>
                          <button onClick={()=>setEditProv(p)}
                            style={{ padding:'5px 10px', borderRadius:7, border:'1px solid #1F2937', background:'transparent', color:'#9CA3AF', fontSize:11, cursor:'pointer' }}>Editar</button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Category breakdown */}
              <div style={{ background:'#111827', border:'1px solid #1F2937', borderRadius:14, padding:18 }}>
                <div style={{ fontSize:13, fontWeight:700, color:'#F0F4FF', marginBottom:14 }}>Proveedores por categoría</div>
                {CATEGORIES.map(cat => {
                  const count = providers.filter(p=>p.category===cat.id&&p.status==='approved').length
                  const max   = Math.max(1,...CATEGORIES.map(c=>providers.filter(p=>p.category===c.id&&p.status==='approved').length))
                  return (
                    <div key={cat.id} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:7 }}>
                      <span style={{ fontSize:14, width:20 }}>{cat.icon}</span>
                      <div style={{ flex:1, height:6, background:'#1F2937', borderRadius:3, overflow:'hidden' }}>
                        <div style={{ height:'100%', width:`${(count/max)*100}%`, background:cat.color, borderRadius:3, transition:'width 0.5s' }}/>
                      </div>
                      <span style={{ fontSize:11, fontWeight:700, color:cat.color, minWidth:20, textAlign:'right' }}>{count}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ══ PROVIDERS TABLE ══ */}
          {/* ══ MÉTRICAS ══ */}
          {section === 'metrics' && (
            <MetricsPanel metrics={metrics} loading={metricsLoading} onRefresh={fetchMetrics} />
          )}

          {section === 'providers' && (
            <div>
              {/* PANEL DE STATS DEL LIFECYCLE */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(6, 1fr)', gap:10, marginBottom:16 }}>
                {(() => {
                  const all = providers
                  const counts = {
                    registrados: all.filter((p:any) => p.status==='pending' && p.self_registered).length,
                    nuevo:     all.filter((p:any) => p.status==='pending' && !p.outreach_sent && !p.self_registered).length,
                    email:     all.filter((p:any) => p.status==='pending' && p.outreach_sent && (p.tag==='Contactado por email' || p.tag==='Contactado') && !p.self_registered).length,
                    dm:        all.filter((p:any) => p.status==='pending' && p.outreach_sent && p.tag==='Contactado por DM' && !p.self_registered).length,
                    approved:  all.filter((p:any) => p.status==='approved').length,
                    rejected:  all.filter((p:any) => p.status==='rejected').length,
                  }
                  const tiles = [
                    { key:'registrados', label:'✍️ Registrados · APROBAR', value:counts.registrados, color:'#EF4444', filter:'registrados', highlight: counts.registrados > 0 },
                    { key:'nuevo',     label:'🆕 Sin contactar',     value:counts.nuevo,    color:'#9CA3AF', filter:'nuevo' },
                    { key:'email',     label:'📧 Contactado email',  value:counts.email,    color:'#3B82F6', filter:'contactado_email' },
                    { key:'dm',        label:'💬 Contactado DM',     value:counts.dm,       color:'#EC4899', filter:'contactado_dm' },
                    { key:'approved',  label:'✅ En marketplace',     value:counts.approved, color:'#10B981', filter:'approved' },
                    { key:'rejected',  label:'❌ Rechazados',         value:counts.rejected, color:'#EF4444', filter:'rejected' },
                  ]
                  return tiles.map(t => (
                    <button key={t.key} onClick={() => setFilterStatus(t.filter)}
                      style={{
                        background: t.highlight ? 'rgba(239,68,68,0.10)' : '#111827',
                        border:`1px solid ${filterStatus===t.filter ? t.color : (t.highlight ? '#EF4444' : '#1F2937')}`,
                        borderRadius:12, padding:'12px 14px', textAlign:'left', cursor:'pointer',
                        transition:'all 0.15s',
                        boxShadow: t.highlight ? '0 0 0 1px rgba(239,68,68,0.25)' : 'none',
                      }}>
                      <div style={{ fontSize:10, color: t.highlight ? '#FCA5A5' : '#9CA3AF', marginBottom:4, fontWeight:600 }}>{t.label}</div>
                      <div style={{ fontSize:24, fontWeight:700, color:t.color }}>{t.value}</div>
                    </button>
                  ))
                })()}
              </div>

              <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap' }}>
                <input placeholder="🔍 Buscar por nombre o email..." value={search}
                  onChange={e=>setSearch(e.target.value)}
                  style={{ flex:1, minWidth:200, background:'#111827', border:'1px solid #1F2937',
                    borderRadius:8, padding:'8px 12px', fontSize:13, color:'#F0F4FF', outline:'none' }}/>
                {[['filterStatus','Estado',[
                    ['','Todos'],
                    ['registrados','✍️ Registrados · APROBAR'],
                    ['nuevo','🆕 Sin contactar'],
                    ['contactado_email','📧 Contactado email'],
                    ['contactado_dm','💬 Contactado DM'],
                    ['pending','⏳ Todos pendientes'],
                    ['approved','✅ Aprobados'],
                    ['rejected','❌ Rechazados']]],
                  ['filterCat','Categoría',[['','Todas'],...CATEGORIES.map(c=>[c.id,`${c.icon} ${c.label}`])]],
                ].map(([field,ph,opts]: any) => (
                  <select key={field}
                    value={field==='filterStatus'?filterStatus:filterCat}
                    onChange={e=>field==='filterStatus'?setFilterStatus(e.target.value):setFilterCat(e.target.value)}
                    style={{ background:'#111827', border:'1px solid #1F2937', borderRadius:8,
                      padding:'8px 11px', fontSize:12, color:'#F0F4FF', outline:'none' }}>
                    {opts.map(([v,l]: any) => <option key={v} value={v} style={{ background:'#0D1117' }}>{l}</option>)}
                  </select>
                ))}
                <button onClick={regenerateDrafts} disabled={regenLoading}
                  style={{ padding:'8px 16px', borderRadius:8, border:'1px solid #8B5CF6',
                    background: regenLoading ? '#374151' : 'transparent', color:'#8B5CF6',
                    fontSize:12, fontWeight:700, cursor: regenLoading ? 'wait' : 'pointer' }}>
                  {regenLoading ? '⏳ Regenerando...' : '🔄 Regenerar drafts'}
                </button>
                <button onClick={bulkApprove} disabled={bulkLoading}
                  style={{ padding:'8px 16px', borderRadius:8, border:'1px solid #F43F5E',
                    background: bulkLoading ? '#374151' : '#F43F5E', color:'#fff',
                    fontSize:12, fontWeight:700, cursor: bulkLoading ? 'wait' : 'pointer' }}>
                  {bulkLoading ? '⏳ Enviando...' : '🚀 Aprobar todos pending con email'}
                </button>
                <button onClick={fetchProviders}
                  style={{ padding:'8px 16px', borderRadius:8, border:'1px solid #1F2937',
                    background:'transparent', color:'#9CA3AF', fontSize:12, cursor:'pointer' }}>
                  🔄 Actualizar
                </button>
              </div>

              {bulkResult && (
                <div style={{ marginBottom: 14, padding:'10px 14px', borderRadius:10,
                  background: bulkResult.ok ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
                  border: `1px solid ${bulkResult.ok ? '#10B981' : '#EF4444'}`,
                  color: bulkResult.ok ? '#10B981' : '#EF4444',
                  fontSize:12 }}>
                  {bulkResult.msg}
                </div>
              )}

              <div style={{ background:'#111827', border:'1px solid #1F2937', borderRadius:14, overflow:'hidden' }}>
                {/* Table header */}
                <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr 1fr auto',
                  padding:'9px 14px', borderBottom:'1px solid #1F2937',
                  fontSize:10, fontWeight:700, color:'#374151', letterSpacing:'0.07em', textTransform:'uppercase' }}>
                  {['Proveedor','Ciudad','Categoría','Precio','Estado','Acciones'].map(h=><div key={h}>{h}</div>)}
                </div>

                {loading ? (
                  <div style={{ padding:'40px', textAlign:'center', color:'#374151' }}>Cargando...</div>
                ) : providers.length === 0 ? (
                  <div style={{ padding:'40px', textAlign:'center', color:'#374151' }}>No hay proveedores con estos filtros.</div>
                ) : providers.map((p, i) => {
                  const cat = CATEGORIES.find(c=>c.id===p.category)
                  const st  = getProviderState(p)
                  return (
                    <div key={p.id}
                      style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr 1fr auto',
                        padding:'10px 14px', borderBottom: i<providers.length-1?'1px solid #1F2937':'none',
                        alignItems:'center', transition:'background 0.1s' }}
                      onMouseEnter={e=>(e.currentTarget.style.background='#0D1117')}
                      onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
                      <div style={{ display:'flex', alignItems:'center', gap:9 }}>
                        <img src={p.photo_url || getPhoto(p.category, p.photo_idx)} alt=""
                          style={{ width:34, height:34, borderRadius:7, objectFit:'cover', flexShrink:0 }}/>
                        <div style={{ minWidth:0 }}>
                          <div style={{ fontSize:12, fontWeight:600, color:'#F0F4FF', display:'flex', alignItems:'center', gap:5 }}>
                            <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name}</span>
                            {p.featured&&<span>⭐</span>}
                            {p.outreach_sent&&<span title="Outreach enviado" style={{ fontSize:9 }}>✉️</span>}
                            {p.contactable===false&&<span title="Sin canales de contacto" style={{ color:'#EF4444', fontSize:10 }}>⚠</span>}
                          </div>
                          <div style={{ fontSize:10, color:'#374151', display:'flex', alignItems:'center', gap:6 }}>
                            {p.email      &&<span title={p.email}     style={{ color:'#06B6D4' }}>✉️</span>}
                            {p.phone      &&<span title={p.phone}     style={{ color:'#10B981' }}>📞</span>}
                            {p.website    &&<span title={p.website}   style={{ color:'#9CA3AF' }}>🌐</span>}
                            {p.instagram  &&<span title={p.instagram} style={{ color:'#E1306C' }}>📸</span>}
                            {p.tiktok     &&<span title={p.tiktok}    style={{ color:'#F0F4FF' }}>🎵</span>}
                            {!p.email && !p.phone && !p.website && !p.instagram && !p.tiktok && '—'}
                          </div>
                        </div>
                      </div>
                      <div style={{ fontSize:11, color:'#9CA3AF' }}>📍 {p.city}</div>
                      <div style={{ fontSize:11, color:cat?.color }}>{cat?.icon} {cat?.label?.split(' ')[0]}</div>
                      <div style={{ fontFamily:'IBM Plex Mono,monospace', fontSize:12, color:'#F0F4FF' }}>
                        {p.price_base?.toLocaleString()}€
                      </div>
                      <div>
                        <span style={{ fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:10,
                          background:st.bg, color:st.color }}>{st.label}</span>
                      </div>
                      <div style={{ display:'flex', gap:4 }}>
                        <button onClick={()=>setEditProv(p)}
                          style={{ padding:'4px 9px', borderRadius:6, border:'1px solid #1F2937',
                            background:'transparent', color:'#9CA3AF', fontSize:10, cursor:'pointer' }}>
                          ✏️
                        </button>
                        <a href={`/proveedor/panel?as=${p.id}`} target="_blank" rel="noreferrer"
                          title="Abrir panel del proveedor"
                          style={{ padding:'4px 9px', borderRadius:6, border:'1px solid #1F2937',
                            background:'transparent', color:'#9CA3AF', fontSize:10, cursor:'pointer', textDecoration:'none' }}>
                          🔑
                        </a>
                        {p.status==='pending'&&<>
                          <button onClick={()=>updateProvider(p.id,{status:'approved'})}
                            style={{ padding:'4px 7px', borderRadius:6, border:'none', background:'#10B98120', color:'#10B981', fontSize:10, cursor:'pointer' }}>✓</button>
                          <button onClick={()=>updateProvider(p.id,{status:'rejected'})}
                            style={{ padding:'4px 7px', borderRadius:6, border:'none', background:'#EF444420', color:'#EF4444', fontSize:10, cursor:'pointer' }}>✕</button>
                        </>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ══ WAITLIST ══ */}
          {section === 'waitlist' && (
            <div>
              <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', marginBottom:18, flexWrap:'wrap', gap:10 }}>
                <div>
                  <h1 style={{ fontFamily:'Fraunces,serif', fontSize:28, fontWeight:600 }}>🎉 Waitlist pre-lanzamiento</h1>
                  <div style={{ fontSize:13, color:'#9CA3AF', marginTop:4 }}>
                    Clientes interesados en el lanzamiento del 10 de junio.
                  </div>
                </div>
                <a href="/api/admin/waitlist?format=csv" download
                  style={{ background:'#06B6D4', color:'#000', fontSize:12, fontWeight:700, padding:'10px 16px', borderRadius:10, textDecoration:'none' }}>
                  ⬇ EXPORTAR CSV
                </a>
              </div>

              {/* Stats */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:12, marginBottom:18 }}>
                {[
                  { label:'Total inscritos',      value: waitlistStats.total, color:'#10B981' },
                  { label:'Activos (no baja)',     value: waitlistStats.active, color:'#06B6D4' },
                  { label:'Últimos 7 días',        value: waitlistStats.last7d, color:'#F59E0B' },
                  { label:'Ciudades distintas',    value: Object.keys(waitlistStats.byCity || {}).length, color:'#8B5CF6' },
                ].map(t => (
                  <div key={t.label} style={{ background:'#111827', border:'1px solid #1F2937', borderRadius:12, padding:'14px 16px' }}>
                    <div style={{ fontSize:11, color:'#6B7280', textTransform:'uppercase', letterSpacing:'0.07em', fontWeight:600 }}>{t.label}</div>
                    <div style={{ fontFamily:'Fraunces,serif', fontSize:28, fontWeight:700, color: t.color, marginTop:4 }}>{t.value}</div>
                  </div>
                ))}
              </div>

              {/* Desglose por tipo de evento */}
              {Object.keys(waitlistStats.byEventType || {}).length > 0 && (
                <div style={{ background:'#111827', border:'1px solid #1F2937', borderRadius:12, padding:'14px 16px', marginBottom:18 }}>
                  <div style={{ fontSize:11, color:'#6B7280', textTransform:'uppercase', letterSpacing:'0.07em', fontWeight:600, marginBottom:8 }}>Por tipo de evento</div>
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                    {Object.entries(waitlistStats.byEventType).map(([type, n]) => (
                      <span key={type} style={{ background:'#1F2937', border:'1px solid #374151', borderRadius:8, padding:'5px 12px', fontSize:12 }}>
                        {type}: <strong style={{ color:'#06B6D4' }}>{n as number}</strong>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Lista */}
              <div style={{ background:'#111827', border:'1px solid #1F2937', borderRadius:12, overflow:'hidden' }}>
                <div style={{ padding:'12px 16px', borderBottom:'1px solid #1F2937', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', color:'#9CA3AF', display:'grid', gridTemplateColumns:'2fr 1.5fr 1fr 1fr 1fr 0.7fr', gap:10 }}>
                  <div>Email</div><div>Nombre</div><div>Ciudad</div><div>Evento</div><div>Fuente</div><div>Hace</div>
                </div>
                {waitlistEntries.length === 0 ? (
                  <div style={{ padding:'40px 16px', textAlign:'center', color:'#4B5563', fontSize:13 }}>
                    Nadie se ha apuntado aún. Comparte el link de la home y verás aterrizar a los primeros.
                  </div>
                ) : (
                  waitlistEntries.map((e: any) => (
                    <div key={e.id} style={{ padding:'10px 16px', borderBottom:'1px solid #1F2937', fontSize:13, display:'grid', gridTemplateColumns:'2fr 1.5fr 1fr 1fr 1fr 0.7fr', gap:10, alignItems:'center' }}>
                      <div style={{ color:'#06B6D4', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{e.email}</div>
                      <div style={{ color:'#F0F4FF' }}>{e.name || '—'}</div>
                      <div style={{ color:'#9CA3AF' }}>{e.city || '—'}</div>
                      <div style={{ color:'#9CA3AF' }}>{e.event_type || '—'}</div>
                      <div style={{ color:'#6B7280', fontSize:11 }}>{e.source || '—'}</div>
                      <div style={{ color:'#6B7280', fontSize:11 }}>{ago(e.created_at)}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ══ NOTIFICATIONS ══ */}
          {section === 'notifications' && (
            <div>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
                <div style={{ fontSize:13, color:'#9CA3AF' }}>{notifs.length} notificación{notifs.length!==1?'es':''}</div>
                {unread>0&&<button onClick={markNotifsRead}
                  style={{ fontSize:12, color:'#9CA3AF', background:'transparent', border:'none', cursor:'pointer' }}>
                  Marcar todo como leído
                </button>}
              </div>
              {notifs.length===0 ? (
                <div style={{ background:'#111827', border:'1px solid #1F2937', borderRadius:14,
                  padding:'52px 20px', textAlign:'center', color:'#374151' }}>
                  <div style={{ fontSize:36, marginBottom:10 }}>🔔</div>
                  <p>No hay notificaciones aún. Las recibirás en tiempo real cuando llegue un nuevo proveedor o reserva.</p>
                </div>
              ) : notifs.map((n,i) => (
                <div key={n.id} style={{ background: n.read?'#111827':'#10B98108',
                  border:`1px solid ${n.read?'#1F2937':'#10B98133'}`,
                  borderRadius:12, padding:'14px 16px', marginBottom:8,
                  display:'flex', gap:12, alignItems:'center' }}>
                  <div style={{ width:40, height:40, borderRadius:10,
                    background: n.type==='new_provider'?'#10B98120':n.type==='new_booking'?'#3B82F620':'#F59E0B20',
                    display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0 }}>
                    {n.type==='new_provider'?'🆕':n.type==='new_booking'?'📋':'💰'}
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:700, color:'#F0F4FF', marginBottom:2 }}>{n.title}</div>
                    <div style={{ fontSize:12, color:'#9CA3AF' }}>{n.message}</div>
                    <div style={{ fontSize:10, color:'#374151', marginTop:3 }}>{ago(n.created_at)}</div>
                  </div>
                  {!n.read&&<div style={{ width:8, height:8, borderRadius:'50%', background:'#10B981', flexShrink:0 }}/>}
                </div>
              ))}
            </div>
          )}

          {/* ══ AGENT ══ */}
          {section === 'agent' && (
            <>
              <ApifyPanel />
            <div style={{ display:'grid', gridTemplateColumns:'280px 1fr', gap:20 }}>
              {/* Config */}
              <div style={{ background:'#111827', border:'1px solid #1F2937', borderRadius:14, padding:16 }}>
                <div style={{ fontFamily:'IBM Plex Mono,monospace', fontSize:9, fontWeight:700, color:'#06B6D4',
                  letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:14 }}>▸ Configurar agente</div>

                {[['Categoría','category','select',CATEGORIES.map(c=>({v:c.id,l:`${c.icon} ${c.label}`}))],
                  ['Ciudad','city','select',[{v:'Madrid',l:'Madrid'},{v:'Barcelona',l:'Barcelona'},{v:'Valencia',l:'Valencia'},{v:'Sevilla',l:'Sevilla'},{v:'Bilbao',l:'Bilbao'},{v:'Málaga',l:'Málaga'}]],
                ].map(([lbl,field,type,opts]:any) => (
                  <div key={field} style={{ marginBottom:12 }}>
                    <label style={{ fontSize:10, fontWeight:700, color:'#4B5563', display:'block',
                      marginBottom:5, textTransform:'uppercase', letterSpacing:'0.07em' }}>{lbl}</label>
                    <select value={(agentCfg as any)[field]}
                      onChange={e=>setAgentCfg(c=>({...c,[field]:e.target.value}))}
                      disabled={agentRunning}
                      style={{ width:'100%', background:'#0D1117', border:'1px solid #1F2937', borderRadius:8,
                        padding:'8px 10px', fontSize:12, color:'#F0F4FF', outline:'none' }}>
                      {opts.map((o:any)=><option key={o.v} value={o.v} style={{background:'#111827'}}>{o.l}</option>)}
                    </select>
                  </div>
                ))}

                <div style={{ marginBottom:12 }}>
                  <label style={{ fontSize:10, fontWeight:700, color:'#4B5563', display:'block',
                    marginBottom:5, textTransform:'uppercase', letterSpacing:'0.07em' }}>Nº de proveedores</label>
                  <div style={{ display:'flex', gap:5 }}>
                    {[2,3,5,10].map(n=>(
                      <button key={n} onClick={()=>setAgentCfg(c=>({...c,count:n}))} disabled={agentRunning}
                        style={{ flex:1, padding:'7px', borderRadius:7, fontSize:13, fontWeight:700,
                          border:`1px solid ${agentCfg.count===n?'#06B6D4':'#1F2937'}`,
                          background:agentCfg.count===n?'#06B6D418':'transparent',
                          color:agentCfg.count===n?'#06B6D4':'#9CA3AF', cursor:'pointer' }}>{n}</button>
                    ))}
                  </div>
                </div>

                <button onClick={runAgent} disabled={agentRunning}
                  style={{ width:'100%', padding:'11px', borderRadius:10,
                    background:agentRunning?'transparent':'#06B6D4',
                    border:agentRunning?'1px solid #06B6D444':'none',
                    color:agentRunning?'#06B6D4':'#000', fontSize:12, fontWeight:700,
                    cursor:agentRunning?'not-allowed':'pointer',
                    fontFamily:'IBM Plex Mono,monospace', marginTop:8 }}>
                  {agentRunning?'⏳ BUSCANDO...':'▶ EJECUTAR AGENTE'}
                </button>

                <button onClick={extractEmailsBatch} disabled={extractingEmails || agentRunning || runningFollowups}
                  title="Procesa proveedores con tag 'Investigar web' o 'Nuevo' que aún no tienen email: scrapea su web y dispara outreach automático si lo encuentra."
                  style={{ width:'100%', padding:'10px', borderRadius:10,
                    background:'transparent',
                    border:`1px solid ${extractingEmails?'#8B5CF644':'#8B5CF6'}`,
                    color:'#8B5CF6', fontSize:11, fontWeight:700,
                    cursor:(extractingEmails||agentRunning||runningFollowups)?'not-allowed':'pointer',
                    fontFamily:'IBM Plex Mono,monospace', marginTop:8 }}>
                  {extractingEmails?'⏳ EXTRAYENDO...':'🔍 EXTRAER EMAILS DE WEBS'}
                </button>

                <button onClick={runFollowups} disabled={runningFollowups || agentRunning || extractingEmails}
                  title="Dispara los follow-ups pendientes: 2º y 3er toque para proveedores que no respondieron. Email se envía solo, DM se queda con tag para mandar a mano desde IG."
                  style={{ width:'100%', padding:'10px', borderRadius:10,
                    background:'transparent',
                    border:`1px solid ${runningFollowups?'#F59E0B44':'#F59E0B'}`,
                    color:'#F59E0B', fontSize:11, fontWeight:700,
                    cursor:(runningFollowups||agentRunning||extractingEmails)?'not-allowed':'pointer',
                    fontFamily:'IBM Plex Mono,monospace', marginTop:8 }}>
                  {runningFollowups?'⏳ ENVIANDO...':'📬 LANZAR FOLLOW-UPS'}
                </button>

                {agentResults.length>0&&(
                  <div style={{ marginTop:14, fontSize:11, color:'#9CA3AF' }}>
                    <div>✅ Score A: {agentResults.filter(p=>p.score==='A').length}</div>
                    <div>📋 Añadidos: {agentResults.filter(p=>p.recommendation==='AÑADIR').length}</div>
                    <div>✉️ Emails: {agentResults.filter(p=>p.emailDraft).length}</div>
                  </div>
                )}
              </div>

              {/* Terminal */}
              <div>
                <div ref={logRef}
                  style={{ background:'#0D1117', border:'1px solid #1F2937', borderRadius:12,
                    padding:'14px 16px', height:400, overflowY:'auto',
                    fontFamily:'IBM Plex Mono,monospace', fontSize:11, lineHeight:1.9 }}>
                  {agentLogs.length===0&&!agentRunning&&(
                    <div style={{ height:'100%', display:'flex', alignItems:'center', justifyContent:'center',
                      flexDirection:'column', color:'#374151', textAlign:'center', gap:10 }}>
                      <div style={{ fontSize:32 }}>🤖</div>
                      <div>Configura y ejecuta el agente para buscar proveedores reales.</div>
                    </div>
                  )}
                  {agentLogs.map((log,i) => (
                    <div key={i} style={{ color: log.startsWith('❌')?'#EF4444':log.startsWith('✅')||log.startsWith('🎉')?'#10B981':log.startsWith('⏳')||log.startsWith('📊')?'#8B5CF6':'#9CA3AF' }}>
                      {log}
                    </div>
                  ))}
                  {agentRunning&&(
                    <div style={{ color:'#06B6D4', animation:'pulse 1s infinite' }}>● procesando...</div>
                  )}
                </div>

                {agentResults.length>0&&(
                  <div style={{ marginTop:12 }}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#4B5563', textTransform:'uppercase',
                      letterSpacing:'0.07em', marginBottom:8 }}>Proveedores encontrados</div>
                    {agentResults.map((p,i)=>(
                      <div key={i} style={{ background:'#111827', border:`1px solid ${'ABCD'.indexOf(p.score)===0?'#10B98133':'#1F2937'}`,
                        borderRadius:10, padding:'10px 13px', display:'flex', gap:10,
                        alignItems:'center', marginBottom:6 }}>
                        <div style={{ width:28, height:28, borderRadius:'50%',
                          background:p.score==='A'?'#10B98122':p.score==='B'?'#06B6D422':'#F59E0B22',
                          border:`1.5px solid ${p.score==='A'?'#10B981':p.score==='B'?'#06B6D4':'#F59E0B'}`,
                          display:'flex', alignItems:'center', justifyContent:'center',
                          fontFamily:'IBM Plex Mono,monospace', fontSize:11, fontWeight:700,
                          color:p.score==='A'?'#10B981':p.score==='B'?'#06B6D4':'#F59E0B' }}>
                          {p.score}
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:12, fontWeight:600, color:'#F0F4FF' }}>{p.name}</div>
                          <div style={{ fontSize:10, color:'#9CA3AF' }}>{p.city} · {p.avgPrice}€ · {p.recommendation}</div>
                        </div>
                        {p.savedToDb&&<span style={{ fontSize:9, color:'#10B981' }}>✓ guardado</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            </>
          )}

          {/* ══ SETTINGS ══ */}
          {/* ══ MARKETING ══ */}
          {section === 'bookings' && (
            <div>
              <h1 style={{ fontSize:24, fontWeight:700, marginBottom:18, color:'#F9FAFB' }}>📋 Reservas</h1>

              {/* Filter chips */}
              <div style={{ display:'flex', gap:8, marginBottom:18, alignItems:'center', flexWrap:'wrap' }}>
                {(['pending','confirmed','cancelled','all'] as const).map(f => (
                  <button key={f} onClick={() => setBookingFilter(f)}
                    style={{ padding:'6px 14px', borderRadius:20, border:'1px solid #1F2937',
                      background: bookingFilter === f ? '#F43F5E' : 'transparent',
                      color: bookingFilter === f ? '#fff' : '#9CA3AF',
                      fontSize:11, fontWeight:600, cursor:'pointer', textTransform:'capitalize' }}>
                    {f === 'all' ? 'Todas' : f === 'pending' ? 'Pendientes' : f === 'confirmed' ? 'Confirmadas' : 'Canceladas'}
                    {bookingStats[f] != null && f !== 'all' && (
                      <span style={{ marginLeft:6, opacity:0.7 }}>({bookingStats[f]})</span>
                    )}
                  </button>
                ))}
                <button onClick={fetchBookings}
                  style={{ marginLeft:'auto', padding:'6px 12px', borderRadius:8, border:'1px solid #1F2937',
                    background:'transparent', color:'#9CA3AF', fontSize:11, cursor:'pointer' }}>
                  🔄 Actualizar
                </button>
              </div>

              {bookingLoading ? (
                <div style={{ padding:60, textAlign:'center', color:'#374151' }}>Cargando...</div>
              ) : bookings.length === 0 ? (
                <div style={{ background:'#111827', border:'1px solid #1F2937', borderRadius:14,
                  padding:'48px 20px', textAlign:'center', color:'#374151' }}>
                  <div style={{ fontSize:36, marginBottom:10 }}>📋</div>
                  <p>No hay reservas en este estado.</p>
                </div>
              ) : (
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(380px, 1fr))', gap:14 }}>
                  {bookings.map(b => {
                    const statusColor = b.status === 'pending'   ? '#F59E0B'
                                      : b.status === 'confirmed' ? '#10B981'
                                      : b.status === 'cancelled' ? '#EF4444' : '#6B7280'
                    const dateF = new Date(b.event_date).toLocaleDateString('es-ES', { day:'2-digit', month:'2-digit', year:'numeric' })
                    return (
                      <div key={b.id} style={{ background:'#111827', border:'1px solid #1F2937', borderRadius:14, padding:18 }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10, gap:8 }}>
                          <div style={{ minWidth:0, flex:1 }}>
                            <div style={{ fontSize:11, color:'#6B7280', marginBottom:3, textTransform:'uppercase', letterSpacing:'0.08em' }}>
                              {b.providers?.name || b.packs?.name || 'Sin proveedor'}
                            </div>
                            <div style={{ fontSize:15, fontWeight:700, color:'#F9FAFB' }}>
                              {b.client_name}
                            </div>
                            <div style={{ fontSize:11, color:'#9CA3AF', marginTop:2 }}>
                              {b.client_email}{b.client_phone ? ` · ${b.client_phone}` : ''}
                            </div>
                          </div>
                          <span style={{ padding:'3px 10px', borderRadius:20, fontSize:9, fontWeight:700,
                            background:`${statusColor}22`, color:statusColor, textTransform:'uppercase', letterSpacing:'0.1em', whiteSpace:'nowrap' }}>
                            {b.status}
                          </span>
                        </div>
                        <div style={{ display:'grid', gridTemplateColumns:'auto 1fr', gap:'4px 12px', fontSize:12, color:'#D1D5DB', margin:'10px 0' }}>
                          <span style={{ color:'#6B7280' }}>📅 Fecha</span><span style={{ fontWeight:600, color:'#F43F5E' }}>{dateF}</span>
                          <span style={{ color:'#6B7280' }}>🎉 Evento</span><span>{b.event_type || 'otro'}</span>
                          {b.city &&    (<><span style={{ color:'#6B7280' }}>📍 Ciudad</span><span>{b.city}</span></>)}
                          {b.guests &&  (<><span style={{ color:'#6B7280' }}>👥 Invitados</span><span>{b.guests}</span></>)}
                          <span style={{ color:'#6B7280' }}>💸 Importe</span><span style={{ fontWeight:600 }}>{(b.total_amount || 0).toLocaleString()}€</span>
                        </div>
                        {b.message && (
                          <div style={{ background:'#0D1117', borderLeft:'2px solid #F43F5E', padding:'8px 12px', margin:'10px 0', fontSize:12, color:'#9CA3AF', fontStyle:'italic', borderRadius:'0 6px 6px 0' }}>
                            "{b.message}"
                          </div>
                        )}
                        {b.status === 'pending' && (
                          <div style={{ display:'flex', gap:8, marginTop:12 }}>
                            <button onClick={() => updateBookingStatus(b.id, 'confirmed')}
                              style={{ flex:1, background:'#10B981', color:'#fff', border:'none', padding:'8px 12px', borderRadius:8, fontSize:11, fontWeight:600, cursor:'pointer' }}>
                              ✓ Confirmar
                            </button>
                            <button onClick={() => updateBookingStatus(b.id, 'cancelled')}
                              style={{ flex:1, background:'transparent', color:'#EF4444', border:'1px solid #EF4444', padding:'8px 12px', borderRadius:8, fontSize:11, fontWeight:600, cursor:'pointer' }}>
                              Cancelar
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* ══ SOCIOS ══ */}
          {/* ══ INCIDENCIAS ══ */}
          {section === 'incidents' && (
            <div>
              <h1 style={{ fontSize:24, fontWeight:700, marginBottom:14, color:'#F9FAFB' }}>🚨 Incidencias</h1>

              {/* Stat de cargos pendientes a proveedor */}
              {(() => {
                const pendingCharges = incidents.filter(i =>
                  i.status === 'resolved' &&
                  i.provider_charge && i.provider_charge > 0 &&
                  !i.provider_charge_paid
                )
                const total = pendingCharges.reduce((s, i) => s + Number(i.provider_charge), 0)
                if (pendingCharges.length === 0) return null
                return (
                  <div style={{ display:'flex', alignItems:'center', gap:14, padding:'12px 16px', marginBottom:14,
                    background:'#F59E0B11', border:'1px solid #F59E0B44', borderRadius:12 }}>
                    <div style={{ fontSize:22 }}>💰</div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13, fontWeight:700, color:'#F59E0B' }}>
                        {total.toLocaleString('es-ES')}€ en cargos pendientes de cobrar a proveedores
                      </div>
                      <div style={{ fontSize:11, color:'#9CA3AF' }}>
                        {pendingCharges.length} incidencia{pendingCharges.length !== 1 ? 's' : ''} resuelta{pendingCharges.length !== 1 ? 's' : ''} sin cargo aplicado todavía
                      </div>
                    </div>
                  </div>
                )
              })()}

              <p style={{ fontSize:12, color:'#9CA3AF', marginBottom:18, maxWidth:640, lineHeight:1.6 }}>
                Reclamaciones abiertas por clientes contra la Garantía de Éxito. SLA en
                <span style={{ color:'#10B981' }}> verde</span> si la deadline es {'>'}24h, en
                <span style={{ color:'#F59E0B' }}> ámbar</span> si {'<'}24h, en
                <span style={{ color:'#EF4444' }}> rojo</span> si ya se ha vencido.
              </p>

              {/* Filtros */}
              <div style={{ display:'flex', gap:8, marginBottom:18, alignItems:'center', flexWrap:'wrap' }}>
                {(['open','investigating','resolved','rejected','all'] as const).map(f => (
                  <button key={f} onClick={() => setIncidentsFilter(f)}
                    style={{ padding:'6px 14px', borderRadius:20, border:'1px solid #1F2937',
                      background: incidentsFilter === f ? '#F43F5E' : 'transparent',
                      color: incidentsFilter === f ? '#fff' : '#9CA3AF',
                      fontSize:11, fontWeight:600, cursor:'pointer', textTransform:'capitalize' }}>
                    {f === 'all' ? 'Todas'
                      : f === 'open' ? 'Abiertas'
                      : f === 'investigating' ? 'En revisión'
                      : f === 'resolved' ? 'Resueltas'
                      : 'Rechazadas'}
                    {incidentsStats[f as 'open'] != null && f !== 'all' && (
                      <span style={{ marginLeft:6, opacity:0.7 }}>({incidentsStats[f as 'open']})</span>
                    )}
                  </button>
                ))}
                <button onClick={fetchIncidents}
                  style={{ marginLeft:'auto', padding:'6px 12px', borderRadius:8, border:'1px solid #1F2937',
                    background:'transparent', color:'#9CA3AF', fontSize:11, cursor:'pointer' }}>
                  🔄 Actualizar
                </button>
              </div>

              {incidentsLoading ? (
                <div style={{ padding:60, textAlign:'center', color:'#374151' }}>Cargando...</div>
              ) : incidents.length === 0 ? (
                <div style={{ background:'#111827', border:'1px solid #1F2937', borderRadius:14,
                  padding:'48px 20px', textAlign:'center', color:'#374151' }}>
                  <div style={{ fontSize:36, marginBottom:10 }}>✨</div>
                  <p>Sin incidencias {incidentsFilter !== 'all' ? `en estado "${incidentsFilter}"` : ''}.</p>
                </div>
              ) : (
                <div style={{ display:'grid', gap:10 }}>
                  {incidents.map(inc => {
                    const slaMs = inc.sla_target_at ? new Date(inc.sla_target_at).getTime() - Date.now() : 0
                    const slaHours = Math.round(slaMs / (1000 * 60 * 60))
                    const slaColor = slaMs < 0 ? '#EF4444' : slaHours < 24 ? '#F59E0B' : '#10B981'
                    const slaLabel = slaMs < 0
                      ? `⚠ Vencido hace ${Math.abs(slaHours)}h`
                      : slaHours < 24
                        ? `⏰ Vence en ${slaHours}h`
                        : `✓ ${slaHours}h margen`

                    const typeLabel: Record<string,string> = {
                      cancelled_by_provider: 'Proveedor canceló',
                      no_show:               'No-show',
                      quality:               'Calidad',
                      wrong_service:         'Servicio incorrecto',
                      payment:               'Pago',
                      other:                 'Otro',
                    }
                    const statusColor = inc.status === 'open' ? '#F59E0B'
                                      : inc.status === 'investigating' ? '#3B82F6'
                                      : inc.status === 'resolved' ? '#10B981'
                                      : '#6B7280'

                    return (
                      <button key={inc.id} onClick={() => setOpenIncident(inc)}
                        style={{ background:'#111827', border:'1px solid #1F2937', borderRadius:14,
                          padding:14, cursor:'pointer', textAlign:'left', color:'#F9FAFB' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12, marginBottom:6 }}>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:4, flexWrap:'wrap' }}>
                              <span style={{ fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:10,
                                background:`${statusColor}22`, color:statusColor, textTransform:'uppercase', letterSpacing:'0.08em' }}>
                                {inc.status}
                              </span>
                              <span style={{ fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:10,
                                background:'#1F2937', color:'#9CA3AF', textTransform:'uppercase', letterSpacing:'0.06em' }}>
                                {typeLabel[inc.type] || inc.type}
                              </span>
                              <span style={{ fontSize:10, fontWeight:700, color:slaColor }}>
                                {slaLabel}
                              </span>
                            </div>
                            <div style={{ fontSize:13, fontWeight:600, marginBottom:3 }}>
                              {inc.bookings?.client_name || inc.reporter_email}
                              {' '}
                              <span style={{ color:'#6B7280', fontWeight:400 }}>
                                vs {inc.bookings?.providers?.name || 'proveedor'}
                              </span>
                            </div>
                            <div style={{ fontSize:11, color:'#9CA3AF', lineHeight:1.4 }}>
                              {(inc.description || '').slice(0, 180)}{(inc.description || '').length > 180 ? '…' : ''}
                            </div>
                          </div>
                          <span style={{ fontSize:11, color:'#6B7280', whiteSpace:'nowrap' }}>
                            {new Date(inc.created_at).toLocaleDateString('es-ES', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}
                          </span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {section === 'customers' && (
            <div>
              <h1 style={{ fontSize:24, fontWeight:700, marginBottom:18, color:'#F9FAFB' }}>👥 Socios</h1>

              {/* Stats */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14, marginBottom:18 }}>
                {[
                  { label:'Total socios',          value: customersStats.total,     color:'#F43F5E' },
                  { label:'Acepta marketing',      value: customersStats.marketing, color:'#10B981' },
                  { label:'Email confirmado',      value: customersStats.confirmed, color:'#3B82F6' },
                ].map(s => (
                  <div key={s.label} style={{ background:'#111827', border:'1px solid #1F2937', borderRadius:14, padding:16 }}>
                    <div style={{ fontSize:11, color:'#6B7280', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>{s.label}</div>
                    <div style={{ fontSize:26, fontWeight:700, color:s.color }}>{s.value}</div>
                  </div>
                ))}
              </div>

              {/* Search + actions */}
              <div style={{ display:'flex', gap:8, marginBottom:14, alignItems:'center' }}>
                <input
                  value={customersSearch}
                  onChange={e => setCustomersSearch(e.target.value)}
                  placeholder="Buscar por email, nombre o ciudad..."
                  style={{ flex:1, background:'#0D1117', border:'1px solid #1F2937', borderRadius:8,
                    padding:'8px 12px', color:'#F0F4FF', fontSize:12, outline:'none' }}
                />
                <button onClick={fetchCustomers}
                  style={{ padding:'8px 14px', borderRadius:8, border:'1px solid #1F2937',
                    background:'transparent', color:'#9CA3AF', fontSize:11, cursor:'pointer' }}>
                  🔄 Actualizar
                </button>
                <button onClick={exportCustomersCSV} disabled={!customers.length}
                  style={{ padding:'8px 14px', borderRadius:8, border:'1px solid #10B981',
                    background:'#10B98122', color:'#10B981', fontSize:11, fontWeight:600,
                    cursor: customers.length ? 'pointer' : 'not-allowed', opacity: customers.length ? 1 : 0.4 }}>
                  ⬇ Exportar CSV
                </button>
              </div>

              {customersLoading ? (
                <div style={{ padding:60, textAlign:'center', color:'#374151' }}>Cargando...</div>
              ) : customers.length === 0 ? (
                <div style={{ background:'#111827', border:'1px solid #1F2937', borderRadius:14,
                  padding:'48px 20px', textAlign:'center', color:'#374151' }}>
                  <div style={{ fontSize:36, marginBottom:10 }}>👥</div>
                  <p>{customersSearch ? 'No hay socios que coincidan con la búsqueda.' : 'Todavía no hay socios registrados.'}</p>
                </div>
              ) : (
                <div style={{ background:'#111827', border:'1px solid #1F2937', borderRadius:14, overflow:'hidden' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                    <thead>
                      <tr style={{ background:'#0D1117', borderBottom:'1px solid #1F2937' }}>
                        {['Socio','Contacto','Ciudad','Marketing','Estado','Registrado'].map(h => (
                          <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:10, fontWeight:700,
                            color:'#6B7280', textTransform:'uppercase', letterSpacing:'0.08em' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {customers.map(c => {
                        const created = c.created_at ? new Date(c.created_at).toLocaleDateString('es-ES', { day:'2-digit', month:'2-digit', year:'2-digit' }) : '—'
                        const last    = c.last_sign_in_at ? new Date(c.last_sign_in_at).toLocaleDateString('es-ES', { day:'2-digit', month:'2-digit' }) : null
                        return (
                          <tr key={c.id} style={{ borderBottom:'1px solid #1F2937' }}>
                            <td style={{ padding:'12px 14px', color:'#F9FAFB' }}>
                              <div style={{ fontWeight:600 }}>{c.name || <span style={{ color:'#4B5563', fontStyle:'italic' }}>Sin nombre</span>}</div>
                              <div style={{ fontSize:10, color:'#6B7280', marginTop:2, fontFamily:'monospace' }}>{c.id.slice(0,8)}</div>
                            </td>
                            <td style={{ padding:'12px 14px', color:'#D1D5DB' }}>
                              <div>{c.email || '—'}</div>
                              {c.phone && <div style={{ fontSize:10, color:'#6B7280', marginTop:2 }}>{c.phone}</div>}
                            </td>
                            <td style={{ padding:'12px 14px', color:'#9CA3AF' }}>{c.city || '—'}</td>
                            <td style={{ padding:'12px 14px' }}>
                              {c.accepts_marketing ? (
                                <span style={{ padding:'2px 8px', borderRadius:10, fontSize:9, fontWeight:700,
                                  background:'#10B98122', color:'#10B981', textTransform:'uppercase', letterSpacing:'0.08em' }}>Sí</span>
                              ) : (
                                <span style={{ color:'#4B5563' }}>—</span>
                              )}
                            </td>
                            <td style={{ padding:'12px 14px' }}>
                              {c.email_confirmed ? (
                                <span style={{ color:'#10B981', fontSize:11 }}>✓ Confirmado</span>
                              ) : (
                                <span style={{ color:'#F59E0B', fontSize:11 }}>● Pendiente</span>
                              )}
                            </td>
                            <td style={{ padding:'12px 14px', color:'#9CA3AF', fontSize:11 }}>
                              {created}
                              {last && <div style={{ fontSize:10, color:'#4B5563', marginTop:2 }}>último acceso: {last}</div>}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {section === 'marketing' && (
            <div>
              {/* ─── Generación a medida ─── */}
              <div style={{ background:'linear-gradient(135deg, #1F2937 0%, #111827 100%)',
                border:'1px solid #1F2937', borderRadius:14, padding:20, marginBottom:22 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                  <span style={{ fontSize:20 }}>💬</span>
                  <h2 style={{ fontSize:15, fontWeight:700, color:'#F9FAFB', margin:0 }}>Pídeselo al agente</h2>
                </div>
                <p style={{ fontSize:11, color:'#9CA3AF', marginBottom:12, lineHeight:1.5 }}>
                  Describe en lenguaje natural qué quieres publicar. El agente decide el formato, genera la imagen y la caption + hashtags, y lo deja en la cola de aprobación.
                </p>
                <textarea value={customPrompt}
                  onChange={e => setCustomPrompt(e.target.value)}
                  placeholder="Ej: Quiero un post inspiracional sobre una boda al atardecer en Sevilla con detalles en flores blancas. Tono romántico, dirigido a parejas que se casan en verano."
                  rows={3}
                  disabled={customLoading}
                  style={{ width:'100%', background:'#0D1117', border:'1px solid #1F2937',
                    borderRadius:10, padding:'10px 12px', color:'#F9FAFB', fontSize:13,
                    fontFamily:'inherit', resize:'vertical', outline:'none', marginBottom:10 }}/>
                <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
                  <button onClick={generateCustomPost} disabled={customLoading || !customPrompt.trim()}
                    style={{ background: customLoading ? '#374151' : '#F43F5E',
                      color:'#fff', border:'none', padding:'9px 18px', borderRadius:10,
                      fontSize:12, fontWeight:700, cursor: customLoading ? 'wait' : 'pointer',
                      opacity: !customPrompt.trim() ? 0.5 : 1 }}>
                    {customLoading ? '⏳ Generando…' : '✨ Generar post'}
                  </button>
                  {customMsg && (
                    <span style={{ fontSize:11, color: customMsg.ok ? '#10B981' : '#EF4444' }}>
                      {customMsg.msg}
                    </span>
                  )}
                </div>
                <div style={{ fontSize:10, color:'#4B5563', marginTop:10 }}>
                  💡 Por ahora genera imágenes. Para vídeos sigue usando el script <code style={{background:'#0D1117', padding:'1px 5px', borderRadius:3}}>fiegago-marketing-agent.mjs</code>.
                </div>
              </div>

              {/* Filtro chips */}
              <div style={{ display:'flex', gap:8, marginBottom:18, alignItems:'center' }}>
                {(['pending','approved','published','all'] as const).map(f => (
                  <button key={f} onClick={()=>setSocialFilter(f)}
                    style={{ padding:'6px 14px', borderRadius:20, border:'1px solid #1F2937',
                      background: socialFilter===f ? '#F43F5E' : 'transparent',
                      color: socialFilter===f ? '#fff' : '#9CA3AF',
                      fontSize:11, fontWeight:600, cursor:'pointer', textTransform:'capitalize' }}>
                    {f === 'all' ? 'Todos' : f === 'pending' ? 'Pendientes' : f === 'approved' ? 'Aprobados' : 'Publicados'}
                    {socialStats[f] != null && f !== 'all' && (
                      <span style={{ marginLeft:6, opacity:0.7 }}>({socialStats[f]})</span>
                    )}
                  </button>
                ))}
                <button onClick={fetchSocialPosts}
                  style={{ marginLeft:'auto', padding:'6px 12px', borderRadius:8, border:'1px solid #1F2937',
                    background:'transparent', color:'#9CA3AF', fontSize:11, cursor:'pointer' }}>
                  🔄 Actualizar
                </button>
              </div>

              {/* Empty state */}
              {socialLoading ? (
                <div style={{ padding:'60px', textAlign:'center', color:'#374151' }}>Cargando...</div>
              ) : socialPosts.length === 0 ? (
                <div style={{ background:'#111827', border:'1px solid #1F2937', borderRadius:14,
                  padding:'48px 20px', textAlign:'center', color:'#374151' }}>
                  <div style={{ fontSize:36, marginBottom:10 }}>📣</div>
                  <p style={{ marginBottom:14 }}>No hay posts en este estado.</p>
                  <p style={{ fontSize:11 }}>Genera posts ejecutando <code style={{background:'#0D1117', padding:'2px 6px', borderRadius:4}}>node fiegago-marketing-agent.mjs --confirm --n 3</code></p>
                </div>
              ) : (
                /* Grid de posts */
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(320px, 1fr))', gap:14 }}>
                  {socialPosts.map(p => {
                    const statusColor = p.status === 'pending' ? '#F59E0B'
                                      : p.status === 'approved' ? '#10B981'
                                      : p.status === 'published' ? '#06B6D4'
                                      : '#EF4444'
                    return (
                      <div key={p.id} style={{ background:'#111827', border:'1px solid #1F2937',
                        borderRadius:14, overflow:'hidden', display:'flex', flexDirection:'column' }}>

                        {/* Media preview */}
                        <div style={{ position:'relative', background:'#000', aspectRatio:'1/1', overflow:'hidden' }}>
                          {p.media_type === 'video' ? (
                            <video src={p.media_url} autoPlay muted loop playsInline controls
                              style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
                          ) : (
                            <img src={p.media_url} alt=""
                              style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
                          )}
                          <div style={{ position:'absolute', top:8, left:8, padding:'3px 9px',
                            background:'rgba(0,0,0,0.7)', borderRadius:20, fontSize:10,
                            fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase',
                            color: statusColor }}>
                            {p.status}
                          </div>
                          <div style={{ position:'absolute', top:8, right:8, padding:'3px 9px',
                            background:'rgba(0,0,0,0.7)', borderRadius:6, fontSize:10, color:'#9CA3AF' }}>
                            {p.media_type === 'video' ? '🎬 Vídeo' : '📷 Imagen'}
                          </div>
                        </div>

                        {/* Body */}
                        <div style={{ padding:14, display:'flex', flexDirection:'column', gap:10, flex:1 }}>
                          <div style={{ fontSize:10, fontWeight:700, color:'#06B6D4',
                            textTransform:'uppercase', letterSpacing:'0.1em' }}>
                            {p.template_label || p.template_id}
                          </div>
                          {p.hook_overlay && (
                            <div style={{ background:'#F43F5E15', border:'1px solid #F43F5E55',
                              borderRadius:8, padding:'8px 10px', display:'flex', alignItems:'center', gap:8 }}>
                              <div style={{ flex:1, minWidth:0 }}>
                                <div style={{ fontSize:9, color:'#F43F5E', fontWeight:700,
                                  textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:2 }}>
                                  Texto overlay (TikTok/IG)
                                </div>
                                <div style={{ fontSize:13, fontWeight:700, color:'#F0F4FF', lineHeight:1.3 }}>
                                  {p.hook_overlay}
                                </div>
                              </div>
                              <button onClick={()=>{
                                navigator.clipboard.writeText(p.hook_overlay)
                                alert('Texto overlay copiado: ' + p.hook_overlay)
                              }}
                                style={{ flexShrink:0, padding:'7px 9px', borderRadius:6, border:'1px solid #F43F5E66',
                                  background:'transparent', color:'#F43F5E', fontSize:10, fontWeight:700, cursor:'pointer' }}>
                                📋 Copiar
                              </button>
                            </div>
                          )}
                          <div style={{ fontSize:12, lineHeight:1.5, color:'#E5E7EB',
                            display:'-webkit-box', WebkitLineClamp:3, WebkitBoxOrient:'vertical', overflow:'hidden' }}>
                            {p.caption_instagram || ''}
                          </div>
                          {(p.hashtags && p.hashtags.length > 0) && (
                            <div style={{ fontSize:10, color:'#06B6D4', opacity:0.7, lineHeight:1.5 }}>
                              {p.hashtags.slice(0, 6).map((h:string) => '#' + h).join(' ')}
                              {p.hashtags.length > 6 && ` +${p.hashtags.length - 6}`}
                            </div>
                          )}
                        </div>

                        {/* Acciones */}
                        <div style={{ borderTop:'1px solid #1F2937', padding:10, display:'flex', gap:6, flexWrap:'wrap' }}>
                          {p.status === 'pending' && (
                            <>
                              <button onClick={()=>updateSocialPost(p.id, { status:'approved' })}
                                style={{ flex:1, padding:'7px', borderRadius:7, border:'none',
                                  background:'#10B98122', color:'#10B981', fontSize:11, fontWeight:700, cursor:'pointer' }}>
                                ✓ Aprobar
                              </button>
                              <button onClick={()=>updateSocialPost(p.id, { status:'rejected' })}
                                style={{ padding:'7px 12px', borderRadius:7, border:'none',
                                  background:'#EF444422', color:'#EF4444', fontSize:11, cursor:'pointer' }}>
                                ✕
                              </button>
                            </>
                          )}
                          {p.status === 'approved' && (
                            <>
                              <button onClick={()=>copyToClipboardAndOpen(
                                  `${p.caption_instagram}\n\n${(p.hashtags||[]).map((h:string)=>'#'+h).join(' ')}`,
                                  'https://www.instagram.com/', p.id)}
                                style={{ flex:1, padding:'8px', borderRadius:7, border:'none',
                                  background:'#E1306C', color:'#fff', fontSize:11, fontWeight:700, cursor:'pointer' }}>
                                📸 IG (caption copiado)
                              </button>
                              <button onClick={()=>copyToClipboardAndOpen(
                                  `${p.caption_tiktok || p.caption_instagram}\n\n${(p.hashtags||[]).map((h:string)=>'#'+h).join(' ')}`,
                                  'https://www.tiktok.com/upload', p.id)}
                                style={{ flex:1, padding:'8px', borderRadius:7, border:'none',
                                  background:'#000', color:'#fff', fontSize:11, fontWeight:700, cursor:'pointer' }}>
                                🎵 TikTok
                              </button>
                            </>
                          )}
                          {p.status === 'published' && (
                            <span style={{ flex:1, padding:'8px', textAlign:'center', fontSize:11, color:'#06B6D4' }}>
                              ✓ Publicado {p.published_at ? ago(p.published_at) : ''}
                            </span>
                          )}
                          <button onClick={()=>setEditingPost(p)}
                            style={{ padding:'7px 10px', borderRadius:7, border:'1px solid #1F2937',
                              background:'transparent', color:'#9CA3AF', fontSize:11, cursor:'pointer' }}>
                            ✏️
                          </button>
                          <button onClick={()=>deleteSocialPost(p.id)}
                            style={{ padding:'7px 10px', borderRadius:7, border:'1px solid #EF444433',
                              background:'transparent', color:'#EF4444', fontSize:11, cursor:'pointer' }}>
                            🗑️
                          </button>
                        </div>

                        {/* Media URL para descargar */}
                        <a href={p.media_url} target="_blank" rel="noreferrer"
                          style={{ fontSize:10, padding:'6px 10px', textAlign:'center',
                            background:'#0D1117', color:'#06B6D4', textDecoration:'none',
                            borderTop:'1px solid #1F2937' }}>
                          ⬇ Descargar {p.media_type === 'video' ? 'vídeo' : 'imagen'}
                        </a>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Editor de caption */}
              {editingPost && (
                <div style={{ position:'fixed', inset:0, zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.85)', backdropFilter:'blur(6px)' }}
                    onClick={()=>setEditingPost(null)}/>
                  <div style={{ position:'relative', background:'#111827', borderRadius:20, width:'100%', maxWidth:560,
                    maxHeight:'88vh', overflowY:'auto', margin:'0 20px', border:'1px solid #1F2937', padding:24 }}>
                    <div style={{ fontSize:14, fontWeight:700, marginBottom:14 }}>✏️ Editar post</div>

                    <label style={{ fontSize:10, fontWeight:700, color:'#F43F5E', display:'block',
                      marginBottom:5, textTransform:'uppercase', letterSpacing:'0.07em' }}>Texto overlay (max 40 chars)</label>
                    <input value={editingPost.hook_overlay || ''}
                      onChange={e=>setEditingPost({ ...editingPost, hook_overlay: e.target.value.slice(0, 50) })}
                      maxLength={50}
                      style={{ width:'100%', background:'#0D1117', border:'1px solid #F43F5E55', borderRadius:8,
                        padding:'9px 11px', fontSize:14, fontWeight:700, color:'#F0F4FF', outline:'none',
                        boxSizing:'border-box', marginBottom:14 }}/>

                    <label style={{ fontSize:10, fontWeight:700, color:'#4B5563', display:'block',
                      marginBottom:5, textTransform:'uppercase', letterSpacing:'0.07em' }}>Caption Instagram</label>
                    <textarea rows={5} value={editingPost.caption_instagram || ''}
                      onChange={e=>setEditingPost({ ...editingPost, caption_instagram: e.target.value })}
                      style={{ width:'100%', background:'#0D1117', border:'1px solid #1F2937', borderRadius:8,
                        padding:'9px 11px', fontSize:13, color:'#F0F4FF', outline:'none',
                        boxSizing:'border-box', resize:'vertical', marginBottom:12 }}/>

                    <label style={{ fontSize:10, fontWeight:700, color:'#4B5563', display:'block',
                      marginBottom:5, textTransform:'uppercase', letterSpacing:'0.07em' }}>Caption TikTok</label>
                    <textarea rows={3} value={editingPost.caption_tiktok || ''}
                      onChange={e=>setEditingPost({ ...editingPost, caption_tiktok: e.target.value })}
                      style={{ width:'100%', background:'#0D1117', border:'1px solid #1F2937', borderRadius:8,
                        padding:'9px 11px', fontSize:13, color:'#F0F4FF', outline:'none',
                        boxSizing:'border-box', resize:'vertical', marginBottom:12 }}/>

                    <label style={{ fontSize:10, fontWeight:700, color:'#4B5563', display:'block',
                      marginBottom:5, textTransform:'uppercase', letterSpacing:'0.07em' }}>Hashtags (separados por coma)</label>
                    <input value={(editingPost.hashtags || []).join(', ')}
                      onChange={e=>setEditingPost({ ...editingPost, hashtags: e.target.value.split(',').map((h:string)=>h.trim().replace(/^#/,'')).filter(Boolean) })}
                      style={{ width:'100%', background:'#0D1117', border:'1px solid #1F2937', borderRadius:8,
                        padding:'9px 11px', fontSize:13, color:'#F0F4FF', outline:'none',
                        boxSizing:'border-box', marginBottom:18 }}/>

                    <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
                      <button onClick={()=>setEditingPost(null)}
                        style={{ padding:'9px 18px', borderRadius:10, border:'1px solid #1F2937',
                          background:'transparent', color:'#9CA3AF', fontSize:13, cursor:'pointer' }}>
                        Cancelar
                      </button>
                      <button onClick={async()=>{
                        await updateSocialPost(editingPost.id, {
                          hook_overlay:      editingPost.hook_overlay,
                          caption_instagram: editingPost.caption_instagram,
                          caption_tiktok:    editingPost.caption_tiktok,
                          hashtags:          editingPost.hashtags,
                        })
                        setEditingPost(null)
                      }}
                        style={{ padding:'9px 22px', borderRadius:10, border:'none',
                          background:'#F43F5E', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer' }}>
                        Guardar cambios
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {section === 'settings' && (
            <div style={{ maxWidth:560 }}>
              {[
                ['Comisión por defecto','8% por transacción (configurable en constants.ts)'],
                ['Primera transacción','0% — política fija no editable'],
                ['URL del marketplace', process.env.NEXT_PUBLIC_APP_URL||'https://fiegago.vercel.app'],
                ['Base de datos','Supabase — realtime activado'],
                ['Pagos','Stripe — webhook configurado'],
              ].map(([k,v])=>(
                <div key={k} style={{ background:'#111827', border:'1px solid #1F2937', borderRadius:12,
                  padding:'16px 18px', marginBottom:10, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div style={{ fontSize:13, fontWeight:600, color:'#F0F4FF' }}>{k}</div>
                  <div style={{ fontFamily:'IBM Plex Mono,monospace', fontSize:11, color:'#06B6D4' }}>{v}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* INCIDENT MODAL */}
      {openIncident && (
        <IncidentAdminModal
          incident={openIncident}
          onClose={() => setOpenIncident(null)}
          onUpdate={updateIncident}
        />
      )}

      {/* EDIT MODAL */}
      {editProv && (
        <div style={{ position:'fixed', inset:0, zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.85)', backdropFilter:'blur(6px)' }}
            onClick={()=>{ setEditProv(null); setSendStatus(null); }}/>
          <div style={{ position:'relative', background:'#111827', borderRadius:20, width:'100%', maxWidth:680,
            maxHeight:'92vh', overflowY:'auto', margin:'0 20px', border:'1px solid #1F2937',
            boxShadow:'0 40px 100px rgba(0,0,0,0.8)', padding:24 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18, gap:10, flexWrap:'wrap' }}>
              <div style={{ fontSize:15, fontWeight:700, color:'#F0F4FF' }}>✏️ Editar: {editProv.name}</div>
              <a href={`/proveedor/panel?as=${editProv.id}`} target="_blank" rel="noreferrer"
                style={{ fontSize:11, fontWeight:700, padding:'5px 12px', borderRadius:10,
                  background:'#F43F5E', color:'#fff', textDecoration:'none' }}>
                🔑 Abrir panel del proveedor →
              </a>
              {editProv.contactable === false && (
                <span style={{ fontSize:10, fontWeight:700, padding:'3px 9px', borderRadius:10,
                  background:'#EF444422', color:'#EF4444' }}>⚠ sin canales</span>
              )}
              {editProv.contactable && (
                <span style={{ fontSize:10, fontWeight:700, padding:'3px 9px', borderRadius:10,
                  background:'#10B98122', color:'#10B981' }}>✓ contactable</span>
              )}
            </div>

            {/* Verificación */}
            {editProv.verification_status && editProv.verification_status !== 'none' && (
              <div style={{ background:'#0D1117', border:'1px solid #1F2937', borderRadius:12, padding:14, marginTop:16 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                  <span style={{ fontSize:11, fontWeight:700, color:'#F0F4FF', textTransform:'uppercase', letterSpacing:'0.08em' }}>
                    Verificación
                  </span>
                  <span style={{ fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:10,
                    background:
                      editProv.verification_status === 'pending'  ? '#F59E0B22' :
                      editProv.verification_status === 'approved' ? '#10B98122' : '#EF444422',
                    color:
                      editProv.verification_status === 'pending'  ? '#F59E0B' :
                      editProv.verification_status === 'approved' ? '#10B981' : '#EF4444',
                  }}>
                    {editProv.verification_status === 'pending'  ? 'PENDIENTE DE REVISIÓN' :
                     editProv.verification_status === 'approved' ? 'APROBADA' : 'RECHAZADA'}
                  </span>
                  {editProv.verification_doc_type && (
                    <span style={{ fontSize:10, color:'#9CA3AF' }}>· tipo: {String(editProv.verification_doc_type).toUpperCase()}</span>
                  )}
                </div>

                {editProv.verification_status === 'pending' && (
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                    <button onClick={async () => {
                      const res = await fetch(`/api/admin/verification/doc?provider_id=${editProv.id}`, { headers: adminHeaders() })
                      const data = await res.json()
                      if (data.url) window.open(data.url, '_blank')
                      else toast.error(data.error || 'No se pudo abrir el documento')
                    }}
                      style={{ background:'#3B82F6', color:'#fff', border:'none', padding:'6px 14px',
                        borderRadius:8, fontSize:11, fontWeight:700, cursor:'pointer' }}>
                      📄 Ver documento
                    </button>
                    <button onClick={async () => {
                      if (!confirm('¿Aprobar la verificación? Se activará el sello "Verificado" y se borrará el documento.')) return
                      await updateProvider(editProv.id, { verification_status: 'approved' })
                    }}
                      style={{ background:'#10B981', color:'#fff', border:'none', padding:'6px 14px',
                        borderRadius:8, fontSize:11, fontWeight:700, cursor:'pointer' }}>
                      ✓ Aprobar
                    </button>
                    <button onClick={async () => {
                      const reason = prompt('Motivo del rechazo (lo verá el proveedor):')
                      if (reason == null) return
                      await updateProvider(editProv.id, {
                        verification_status: 'rejected',
                        verification_notes:  reason.trim() || null,
                      })
                    }}
                      style={{ background:'#EF4444', color:'#fff', border:'none', padding:'6px 14px',
                        borderRadius:8, fontSize:11, fontWeight:700, cursor:'pointer' }}>
                      ✕ Rechazar
                    </button>
                  </div>
                )}
                {editProv.verification_status === 'rejected' && editProv.verification_notes && (
                  <div style={{ fontSize:11, color:'#9CA3AF', fontStyle:'italic' }}>
                    Motivo: {editProv.verification_notes}
                  </div>
                )}
              </div>
            )}

            {/* Datos básicos */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              {[['Nombre','name','text'],['Ciudad','city','text'],
                ['Email','email','email'],['Teléfono','phone','tel'],
                ['Web','website','text'],['Precio base','price_base','number'],
                ['Instagram (@handle)','instagram','text'],['TikTok (@handle)','tiktok','text'],
              ].map(([lbl,field,type])=>(
                <div key={field}>
                  <label style={{ fontSize:10, fontWeight:700, color:'#4B5563', display:'block',
                    marginBottom:4, textTransform:'uppercase', letterSpacing:'0.07em' }}>{lbl}</label>
                  <input type={type} value={(editProv as any)[field]||''}
                    onChange={e=>setEditProv(p=>p?{...p,[field]:e.target.value}:null)}
                    style={{ width:'100%', background:'#0D1117', border:'1px solid #1F2937', borderRadius:8,
                      padding:'8px 10px', fontSize:13, color:'#F0F4FF', outline:'none', boxSizing:'border-box' }}/>
                </div>
              ))}
            </div>

            {/* Lifecycle badge actual + acciones rápidas */}
            <div style={{ marginTop:14, padding:'14px 16px', borderRadius:12, background:'#0D1117', border:'1px solid #1F2937' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                <label style={{ fontSize:10, fontWeight:700, color:'#9CA3AF',
                  textTransform:'uppercase', letterSpacing:'0.1em' }}>Etapa de contacto</label>
                {(() => {
                  const st = getProviderState(editProv)
                  return (
                    <span style={{ fontSize:11, fontWeight:700, padding:'4px 12px', borderRadius:14,
                      background:st.bg, color:st.color }}>
                      {st.label}
                    </span>
                  )
                })()}
              </div>
              <p style={{ fontSize:11, color:'#6B7280', margin:'0 0 10px', lineHeight:1.5 }}>
                Si has enviado el mensaje manualmente (por IG, WhatsApp, otro email), márcalo aquí.
                El proveedor sigue pendiente hasta que se registre.
              </p>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                {[
                  { label:'🆕 Sin contactar',     outreach_sent:false, tag:null,                  contacted_via:null },
                  { label:'📧 Contactado email',   outreach_sent:true,  tag:'Contactado por email', contacted_via:'email' },
                  { label:'💬 Contactado por DM',  outreach_sent:true,  tag:'Contactado por DM',   contacted_via:'instagram' },
                ].map((opt:any) => {
                  const tagMatches = (!opt.tag && !editProv.tag)
                    || editProv.tag === opt.tag
                    // El tag 'Contactado' (sin sufijo) es legacy y equivale a 'Contactado por email'
                    || (opt.tag === 'Contactado por email' && editProv.tag === 'Contactado')
                  const isActive = editProv.outreach_sent === opt.outreach_sent && tagMatches
                  return (
                    <button key={opt.label}
                      onClick={()=>setEditProv(p=>p?{...p, outreach_sent: opt.outreach_sent, tag: opt.tag, contacted_via: opt.contacted_via }:null)}
                      style={{ padding:'6px 12px', borderRadius:8, fontSize:11, fontWeight:600, cursor:'pointer',
                        border:`1px solid ${isActive ? '#F43F5E' : '#1F2937'}`,
                        background: isActive ? 'rgba(244,63,94,0.12)' : 'transparent',
                        color: isActive ? '#F43F5E' : '#9CA3AF' }}>
                      {opt.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Status final (aprobado / rechazado) */}
            <div style={{ marginTop:14 }}>
              <label style={{ fontSize:10, fontWeight:700, color:'#4B5563', display:'block',
                marginBottom:4, textTransform:'uppercase', letterSpacing:'0.07em' }}>Estado final</label>
              <div style={{ display:'flex', gap:6 }}>
                {(['approved','pending','rejected','suspended'] as const).map(s=>(
                  <button key={s} onClick={()=>setEditProv(p=>p?{...p,status:s}:null)}
                    style={{ padding:'5px 11px', borderRadius:8, fontSize:11, fontWeight:700, cursor:'pointer',
                      border:`1px solid ${editProv.status===s?STATUS_MAP[s].color:'#1F2937'}`,
                      background:editProv.status===s?STATUS_MAP[s].bg+'33':'transparent',
                      color:editProv.status===s?STATUS_MAP[s].color:'#9CA3AF' }}>
                    {STATUS_MAP[s].label}
                  </button>
                ))}
              </div>
            </div>

            {/* Email draft + acción */}
            {(editProv.outreach_email || editProv.email) && (
              <div style={{ marginTop:18, padding:14, background:'#0D1117', border:'1px solid #1F2937', borderRadius:10 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#06B6D4', textTransform:'uppercase', letterSpacing:'0.07em' }}>✉️ Email preparado</div>
                  <div style={{ display:'flex', gap:6 }}>
                    <button
                      onClick={()=>{
                        navigator.clipboard.writeText(editProv.outreach_email||'')
                        alert('Email copiado al portapapeles')
                      }}
                      style={{ padding:'4px 10px', borderRadius:7, border:'1px solid #1F2937',
                        background:'transparent', color:'#9CA3AF', fontSize:11, cursor:'pointer' }}>
                      📋 Copiar
                    </button>
                    <button
                      disabled={!editProv.email || sendingEmail}
                      onClick={sendOutreachEmail}
                      style={{ padding:'4px 12px', borderRadius:7, border:'none',
                        background: editProv.email && !sendingEmail ? '#06B6D4' : '#1F2937',
                        color: editProv.email && !sendingEmail ? '#000' : '#4B5563',
                        fontSize:11, fontWeight:700, cursor: editProv.email && !sendingEmail ? 'pointer' : 'not-allowed' }}>
                      {sendingEmail ? '⏳ Enviando...' : editProv.outreach_sent ? '✓ Reenviar email' : '✉️ Enviar email'}
                    </button>
                  </div>
                </div>
                <textarea
                  value={editProv.outreach_email||''}
                  onChange={e=>setEditProv(p=>p?{...p,outreach_email:e.target.value}:null)}
                  rows={8}
                  style={{ width:'100%', background:'#080B12', border:'1px solid #1F2937', borderRadius:8,
                    padding:'9px 11px', fontSize:11.5, lineHeight:1.55, color:'#F0F4FF', outline:'none',
                    boxSizing:'border-box', fontFamily:'IBM Plex Mono, monospace', resize:'vertical' }}/>
                {sendStatus && (
                  <div style={{ fontSize:11, color: sendStatus.ok ? '#10B981' : '#EF4444', marginTop:6, fontWeight:600 }}>
                    {sendStatus.ok ? '✓ ' : '✗ '}{sendStatus.msg}
                  </div>
                )}
                {!editProv.email && (
                  <div style={{ fontSize:11, color:'#F59E0B', marginTop:6 }}>
                    ⚠ Sin dirección de email — añade una arriba para poder enviarlo.
                  </div>
                )}
              </div>
            )}

            {/* DM draft + acción — workflow robusto con fallback y verificación */}
            {(editProv.outreach_dm || editProv.instagram || editProv.tiktok) && (
              <DMBlock provider={editProv} updateProvider={updateProvider} setEditProv={setEditProv} />
            )}

            {/* Flags */}
            <div style={{ marginTop:14, display:'flex', gap:14, alignItems:'center', flexWrap:'wrap' }}>
              <label style={{ fontSize:12, color:'#9CA3AF', display:'flex', alignItems:'center', gap:7, cursor:'pointer' }}>
                <input type="checkbox" checked={editProv.featured||false}
                  onChange={e=>setEditProv(p=>p?{...p,featured:e.target.checked}:null)}/>
                ⭐ Destacado en homepage
              </label>
              <label style={{ fontSize:12, color:'#9CA3AF', display:'flex', alignItems:'center', gap:7, cursor:'pointer' }}>
                <input type="checkbox" checked={editProv.verified||false}
                  onChange={e=>setEditProv(p=>p?{...p,verified:e.target.checked}:null)}/>
                🛡️ Verificado
              </label>
              <label style={{ fontSize:12, color:'#9CA3AF', display:'flex', alignItems:'center', gap:7, cursor:'pointer' }}>
                <input type="checkbox" checked={editProv.outreach_sent||false}
                  onChange={e=>setEditProv(p=>p?{...p,outreach_sent:e.target.checked}:null)}/>
                ✉️ Outreach enviado
              </label>
            </div>

            {/* Botones inferiores */}
            <div style={{ marginTop:20, display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button onClick={()=>{ setEditProv(null); setSendStatus(null); }}
                style={{ padding:'9px 18px', borderRadius:10, border:'1px solid #1F2937',
                  background:'transparent', color:'#9CA3AF', fontSize:13, cursor:'pointer' }}>
                Cancelar
              </button>
              <button onClick={async()=>{ await updateProvider(editProv.id, editProv); setEditProv(null); }}
                style={{ padding:'9px 22px', borderRadius:10, border:'none',
                  background:'#F43F5E', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer' }}>
                Guardar cambios
              </button>
              <button onClick={()=>deleteProvider(editProv.id)}
                style={{ padding:'9px 14px', borderRadius:10, border:'1px solid #EF4444',
                  background:'transparent', color:'#EF4444', fontSize:12, cursor:'pointer' }}>
                🗑️
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── DM BLOCK ROBUSTO ───────────────────────────────────────────────── */
function DMBlock({ provider, updateProvider, setEditProv }: any) {
  const [copyState, setCopyState] = useState<{ok:boolean, len:number, preview:string} | null>(null)

  // Copia con fallback legacy si la API moderna falla
  async function robustCopy(text: string): Promise<boolean> {
    // Método 1: navigator.clipboard
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {}
    // Método 2: textarea legacy + execCommand
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.left = '-9999px'
      ta.style.top = '0'
      ta.setAttribute('readonly', '')
      document.body.appendChild(ta)
      ta.select()
      ta.setSelectionRange(0, text.length)
      const ok = document.execCommand('copy')
      document.body.removeChild(ta)
      return ok
    } catch { return false }
  }

  async function doCopy() {
    const txt = provider.outreach_dm || ''
    const ok = await robustCopy(txt)
    setCopyState({
      ok,
      len: txt.length,
      preview: txt.slice(0, 80) + (txt.length > 80 ? '...' : ''),
    })
    if (ok) toast.success(`✓ Copiado ${txt.length} chars`)
    else    toast.error('No se pudo copiar — selecciona el texto manualmente y Ctrl+C')
  }

  async function doCopyAndOpen() {
    const handle = (provider.instagram||'').replace(/^@/,'')
    if (!handle) return
    const txt = provider.outreach_dm || ''
    const ok = await robustCopy(txt)
    setCopyState({
      ok,
      len: txt.length,
      preview: txt.slice(0, 80) + (txt.length > 80 ? '...' : ''),
    })
    if (!ok) {
      toast.error('Copia falló — Cópialo manual del textarea antes de abrir IG')
      return
    }
    toast.success(`✓ ${txt.length} chars en portapapeles`)
    setTimeout(() => {
      window.open(`https://instagram.com/${handle}/`, '_blank')
      updateProvider(provider.id, { outreach_sent: true, tag: 'Contactado por DM', contacted_via: 'instagram' })
    }, 250)
  }

  return (
    <div style={{ marginTop:14, padding:14, background:'#0D1117', border:'1px solid #1F2937', borderRadius:10 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
        <div style={{ fontSize:11, fontWeight:700, color:'#E1306C', textTransform:'uppercase', letterSpacing:'0.07em' }}>📸 DM Instagram</div>
        <div style={{ display:'flex', gap:6 }}>
          <button onClick={doCopy}
            style={{ padding:'4px 10px', borderRadius:7, border:'1px solid #1F2937',
              background:'transparent', color:'#9CA3AF', fontSize:11, cursor:'pointer' }}>
            📋 Copiar
          </button>
          <button disabled={!provider.instagram} onClick={doCopyAndOpen}
            style={{ padding:'4px 12px', borderRadius:7, border:'none',
              background: provider.instagram ? '#E1306C' : '#1F2937',
              color: provider.instagram ? '#fff' : '#4B5563',
              fontSize:11, fontWeight:700, cursor: provider.instagram ? 'pointer' : 'not-allowed' }}>
            📸 Abrir IG + copiar
          </button>
        </div>
      </div>

      <textarea
        value={provider.outreach_dm||''}
        onChange={e=>setEditProv((p:any)=>p?{...p,outreach_dm:e.target.value}:null)}
        rows={6}
        style={{ width:'100%', background:'#080B12', border:'1px solid #1F2937', borderRadius:8,
          padding:'9px 11px', fontSize:11.5, lineHeight:1.55, color:'#F0F4FF', outline:'none',
          boxSizing:'border-box', fontFamily:'IBM Plex Mono, monospace', resize:'vertical' }}/>

      {/* Verificación visual de lo que se copió */}
      {copyState && (
        <div style={{ marginTop:10, padding:'10px 12px', borderRadius:8,
          background: copyState.ok ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
          border: `1px solid ${copyState.ok ? '#10B981' : '#EF4444'}` }}>
          <div style={{ fontSize:10, fontWeight:700, color: copyState.ok ? '#10B981' : '#EF4444',
            letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:4 }}>
            {copyState.ok ? `✓ Portapapeles · ${copyState.len} caracteres` : '✗ Copia falló'}
          </div>
          <div style={{ fontSize:11, color:'#9CA3AF', fontFamily:'monospace', whiteSpace:'pre-wrap' }}>
            {copyState.preview}
          </div>
          {copyState.ok && copyState.len < 800 && (
            <div style={{ fontSize:10, color:'#F59E0B', marginTop:6 }}>
              ⚠ Mensaje muy corto ({copyState.len} chars) — el mensaje nuevo tiene ~1800. Quizás aún no se regeneró el draft.
            </div>
          )}
        </div>
      )}

      {provider.instagram && (
        <div style={{ fontSize:11, color:'#9CA3AF', marginTop:8, lineHeight:1.5 }}>
          ① Click <strong style={{color:'#fff'}}>"📋 Copiar"</strong> → revisa que aparezca el cuadro verde abajo con +1800 chars.<br/>
          ② Click <strong style={{color:'#fff'}}>"📸 Abrir IG + copiar"</strong> → te abre instagram.com/{(provider.instagram||'').replace(/^@/,'')} → ahí Ctrl+V en el chat.
        </div>
      )}
    </div>
  )
}

function IncidentAdminModal({ incident, onClose, onUpdate }: {
  incident: any
  onClose: () => void
  onUpdate: (id: string, updates: any) => void | Promise<void>
}) {
  const booking   = incident.bookings || {}
  const clientPaid = Number(booking.total_amount || 0)
  // Estimación del precio neto del proveedor: total / 1.08. Si la reserva
  // viejas o sin commission_rate guardada, fallback al total.
  const ticket = clientPaid > 0 ? Math.round((clientPaid / 1.08) * 100) / 100 : 0

  // Compensación sugerida (tabla de la Garantía). Solo aplica a no-show
  // o cancelación con <7d. El admin la puede ajustar a mano.
  const isNoShowLike = ['no_show', 'cancelled_by_provider'].includes(incident.type)
  const suggestedComp = !isNoShowLike ? 0
                      : ticket <= 500    ? 300
                      : ticket <= 2000   ? 500
                      : ticket <= 5000   ? 1000
                      : ticket <= 15000  ? 2000
                      :                    3000
  const suggestedClient = isNoShowLike ? Math.round((clientPaid + suggestedComp) * 100) / 100 : clientPaid
  const suggestedProviderCharge = suggestedClient  // proveedor paga lo mismo que recibe el cliente

  const [resolution,    setResolution]    = useState(incident.resolution || '')
  const [compensation,  setCompensation]  = useState<string>(
    incident.compensation_amount?.toString() || (isNoShowLike ? suggestedClient.toString() : '')
  )
  const [providerCharge, setProviderCharge] = useState<string>(
    incident.provider_charge?.toString() || (isNoShowLike ? suggestedProviderCharge.toString() : '')
  )
  const [rejectedReason, setRejectedReason] = useState(incident.rejected_reason || '')

  const typeLabel: Record<string,string> = {
    cancelled_by_provider: 'Proveedor canceló la reserva',
    no_show:               'Proveedor no apareció',
    quality:               'Calidad inferior a la prometida',
    wrong_service:         'Servicio distinto al reservado',
    payment:               'Problema con el pago',
    other:                 'Otro',
  }

  const eventDate = booking.event_date
    ? new Date(booking.event_date).toLocaleDateString('es-ES', { day:'2-digit', month:'long', year:'numeric' })
    : '—'

  return (
    <div style={{ position:'fixed', inset:0, zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.85)', backdropFilter:'blur(6px)' }}
        onClick={onClose}/>
      <div style={{ position:'relative', background:'#111827', borderRadius:20, width:'100%', maxWidth:640,
        maxHeight:'92vh', overflowY:'auto', margin:'0 20px', border:'1px solid #1F2937',
        boxShadow:'0 40px 100px rgba(0,0,0,0.8)', padding:24, color:'#F0F4FF' }}>

        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12, marginBottom:18 }}>
          <div>
            <div style={{ fontSize:11, fontWeight:700, color:'#F43F5E', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:4 }}>
              🚨 Incidencia #{incident.id.slice(0,8)}
            </div>
            <div style={{ fontSize:16, fontWeight:700 }}>{typeLabel[incident.type] || incident.type}</div>
            <div style={{ fontSize:12, color:'#9CA3AF', marginTop:2 }}>
              {booking.client_name} ({booking.client_email}) · evento {eventDate}
              {booking.providers?.name && ` · proveedor ${booking.providers.name}`}
            </div>
          </div>
          <button onClick={onClose} style={{ fontSize:24, color:'#6B7280', background:'transparent', border:'none', cursor:'pointer' }}>×</button>
        </div>

        {/* Descripción del cliente */}
        <div style={{ background:'#0D1117', border:'1px solid #1F2937', borderRadius:12, padding:14, marginBottom:18 }}>
          <div style={{ fontSize:10, fontWeight:700, color:'#6B7280', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>
            Lo que cuenta el cliente
          </div>
          <div style={{ fontSize:13, color:'#E5E7EB', lineHeight:1.6, whiteSpace:'pre-wrap' }}>
            {incident.description}
          </div>
        </div>

        {/* Importe de la reserva (para calcular compensación) */}
        {booking.total_amount != null && (
          <div style={{ fontSize:12, color:'#9CA3AF', marginBottom:18 }}>
            Importe pagado por el cliente: <strong style={{ color:'#F9FAFB' }}>{Number(booking.total_amount).toLocaleString()}€</strong>
          </div>
        )}

        {/* Acciones según estado */}
        {incident.status === 'open' && (
          <div style={{ display:'flex', gap:8, marginBottom:18 }}>
            <button onClick={() => onUpdate(incident.id, { status: 'investigating' })}
              style={{ flex:1, background:'#3B82F6', color:'#fff', border:'none', padding:'10px', borderRadius:8, fontSize:12, fontWeight:700, cursor:'pointer' }}>
              ▶ Empezar a investigar
            </button>
          </div>
        )}

        {(incident.status === 'open' || incident.status === 'investigating') && (
          <>
            {/* Resolver */}
            <div style={{ background:'#0D1117', border:'1px solid #10B98144', borderRadius:12, padding:14, marginBottom:14 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#10B981', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }}>
                ✓ Resolver con compensación
              </div>

              {isNoShowLike && (
                <div style={{ background:'#10B98114', border:'1px solid #10B98133', borderRadius:8, padding:'8px 10px', marginBottom:10, fontSize:11, color:'#10B981', lineHeight:1.5 }}>
                  💡 Sugerencia para {incident.type === 'no_show' ? 'no-show' : 'cancelación tardía'}:
                  cliente recibe <strong>{suggestedClient.toLocaleString('es-ES')}€</strong>
                  ({clientPaid.toLocaleString('es-ES')}€ reembolso + {suggestedComp.toLocaleString('es-ES')}€ compensación).
                  Proveedor paga <strong>{suggestedProviderCharge.toLocaleString('es-ES')}€</strong>.
                </div>
              )}

              <textarea value={resolution} onChange={e => setResolution(e.target.value)} rows={2}
                placeholder="Qué hemos hecho: sustituto X, reembolso Y, etc."
                style={{ width:'100%', background:'#111827', border:'1px solid #1F2937', borderRadius:8,
                  padding:'8px 10px', color:'#F9FAFB', fontSize:12, marginBottom:8, fontFamily:'inherit', resize:'none' }}/>

              <div style={{ marginBottom:6 }}>
                <label style={{ fontSize:10, fontWeight:700, color:'#9CA3AF', textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:4 }}>
                  Cliente recibe (€)
                </label>
                <input type="number" value={compensation} onChange={e => setCompensation(e.target.value)}
                  placeholder="0"
                  style={{ width:'100%', background:'#111827', border:'1px solid #1F2937', borderRadius:8,
                    padding:'8px 10px', color:'#F9FAFB', fontSize:12 }}/>
              </div>

              <div style={{ marginBottom:10 }}>
                <label style={{ fontSize:10, fontWeight:700, color:'#9CA3AF', textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:4 }}>
                  Proveedor paga (€) — se descuenta del payout
                </label>
                <input type="number" value={providerCharge} onChange={e => setProviderCharge(e.target.value)}
                  placeholder="0"
                  style={{ width:'100%', background:'#111827', border:'1px solid #1F2937', borderRadius:8,
                    padding:'8px 10px', color:'#F9FAFB', fontSize:12 }}/>
              </div>

              <button onClick={() => onUpdate(incident.id, {
                  status: 'resolved',
                  resolution,
                  compensation_amount: compensation ? parseFloat(compensation) : null,
                  provider_charge:     providerCharge ? parseFloat(providerCharge) : null,
                })}
                disabled={resolution.length < 5}
                style={{ width:'100%', background:'#10B981', color:'#fff', border:'none',
                  padding:'10px', borderRadius:8, fontSize:12, fontWeight:700, cursor: resolution.length < 5 ? 'not-allowed' : 'pointer', opacity: resolution.length < 5 ? 0.5 : 1 }}>
                Marcar como resuelta
              </button>
            </div>

            {/* Rechazar */}
            <div style={{ background:'#0D1117', border:'1px solid #EF444444', borderRadius:12, padding:14, marginBottom:8 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#EF4444', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }}>
                ✕ Rechazar (no procede)
              </div>
              <textarea value={rejectedReason} onChange={e => setRejectedReason(e.target.value)} rows={2}
                placeholder="Por qué no procede según los términos de la Garantía. Lo verá el cliente."
                style={{ width:'100%', background:'#111827', border:'1px solid #1F2937', borderRadius:8,
                  padding:'8px 10px', color:'#F9FAFB', fontSize:12, marginBottom:8, fontFamily:'inherit', resize:'none' }}/>
              <button onClick={() => onUpdate(incident.id, {
                  status: 'rejected',
                  rejected_reason: rejectedReason,
                })}
                disabled={rejectedReason.length < 10}
                style={{ width:'100%', background:'#EF4444', color:'#fff', border:'none',
                  padding:'10px', borderRadius:8, fontSize:12, fontWeight:700, cursor: rejectedReason.length < 10 ? 'not-allowed' : 'pointer', opacity: rejectedReason.length < 10 ? 0.5 : 1 }}>
                Rechazar incidencia
              </button>
            </div>
          </>
        )}

        {incident.status === 'resolved' && (
          <div style={{ background:'#10B98122', border:'1px solid #10B98166', borderRadius:12, padding:14 }}>
            <div style={{ fontSize:11, fontWeight:700, color:'#10B981', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>
              ✓ Resuelta el {new Date(incident.resolved_at).toLocaleDateString('es-ES')}
            </div>
            <div style={{ fontSize:13, color:'#D1D5DB', whiteSpace:'pre-wrap', marginBottom:6 }}>{incident.resolution}</div>
            {incident.compensation_amount != null && (
              <div style={{ fontSize:13, color:'#10B981', fontWeight:700, marginBottom:2 }}>
                Cliente recibe: {Number(incident.compensation_amount).toLocaleString()}€
              </div>
            )}
            {incident.provider_charge != null && (
              <div style={{ marginTop:10, paddingTop:10, borderTop:'1px solid #10B98144' }}>
                <div style={{ fontSize:11, color:'#F59E0B', marginBottom:6 }}>
                  Cargo al proveedor: <strong>{Number(incident.provider_charge).toLocaleString()}€</strong>
                </div>
                {incident.provider_charge_paid ? (
                  <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                    <span style={{ fontSize:11, color:'#10B981', fontWeight:700 }}>
                      ✓ Cobrado el {new Date(incident.provider_charge_paid_at).toLocaleDateString('es-ES')}
                    </span>
                    <button onClick={() => onUpdate(incident.id, { provider_charge_paid: false })}
                      style={{ fontSize:10, color:'#6B7280', background:'transparent', border:'none', cursor:'pointer', textDecoration:'underline' }}>
                      desmarcar
                    </button>
                  </div>
                ) : (
                  <button onClick={() => {
                    if (confirm(`¿Marcar como cobrado ${Number(incident.provider_charge).toLocaleString()}€ al proveedor? Le enviaremos email de confirmación.`)) {
                      onUpdate(incident.id, { provider_charge_paid: true })
                    }
                  }}
                    style={{ background:'#F59E0B', color:'#fff', border:'none', padding:'8px 14px', borderRadius:8,
                      fontSize:11, fontWeight:700, cursor:'pointer' }}>
                    💰 Marcar como cobrado
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {incident.status === 'rejected' && (
          <div style={{ background:'#EF444422', border:'1px solid #EF444466', borderRadius:12, padding:14 }}>
            <div style={{ fontSize:11, fontWeight:700, color:'#EF4444', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>
              ✕ Rechazada el {new Date(incident.resolved_at).toLocaleDateString('es-ES')}
            </div>
            <div style={{ fontSize:13, color:'#D1D5DB', whiteSpace:'pre-wrap' }}>{incident.rejected_reason}</div>
          </div>
        )}
      </div>
    </div>
  )
}

function MetricsPanel({ metrics, loading, onRefresh }: {
  metrics: any
  loading: boolean
  onRefresh: () => void
}) {
  if (loading || !metrics) {
    return <div style={{ padding:60, textAlign:'center', color:'#9CA3AF' }}>Cargando métricas...</div>
  }
  const p = metrics.providers
  const b = metrics.bookings
  const i = metrics.incidents

  const card = (title: string, big: string, small?: string, color: string = '#F0F4FF') => (
    <div style={{ background:'#111827', border:'1px solid #1F2937', borderRadius:14, padding:16 }}>
      <div style={{ fontSize:10, fontWeight:700, color:'#6B7280', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }}>{title}</div>
      <div style={{ fontSize:26, fontWeight:700, color, fontFamily:'IBM Plex Mono,monospace' }}>{big}</div>
      {small && <div style={{ fontSize:11, color:'#9CA3AF', marginTop:4 }}>{small}</div>}
    </div>
  )

  const topCats = Object.entries(p.byCategory || {})
    .sort((a: any, b: any) => b[1] - a[1])
    .slice(0, 6)
  const topCities = Object.entries(p.byCity || {})
    .sort((a: any, b: any) => b[1] - a[1])
    .slice(0, 6)

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
        <h1 style={{ fontSize:24, fontWeight:700, color:'#F9FAFB' }}>📈 Métricas del marketplace</h1>
        <button onClick={onRefresh}
          style={{ padding:'6px 12px', borderRadius:8, border:'1px solid #1F2937',
            background:'transparent', color:'#9CA3AF', fontSize:11, cursor:'pointer' }}>
          🔄 Actualizar
        </button>
      </div>

      {/* ──── FUNNEL CAPTACIÓN ──── */}
      <h2 style={{ fontSize:13, fontWeight:700, color:'#9CA3AF', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:10, marginTop:6 }}>
        Funnel de captación
      </h2>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(5, 1fr)', gap:10, marginBottom:18 }}>
        {card('Total captados', p.total.toString(), 'incluye scrapeados + autoregistros')}
        {card('Contactados',    p.contacted.toString(), `${p.total > 0 ? Math.round((p.contacted / p.total) * 100) : 0}% del total`)}
        {card('Auto-registrados', p.selfReg.toString(), `${p.conversionRate}% conversión`)}
        {card('Aprobados',       p.approved.toString(), `${p.pending} pendientes`)}
        {card('Verificados',     p.verified.toString(), 'con DNI/CIF/RC', '#10B981')}
      </div>

      {/* Canal de contacto */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:24 }}>
        <div style={{ background:'#111827', border:'1px solid #1F2937', borderRadius:14, padding:16 }}>
          <div style={{ fontSize:10, fontWeight:700, color:'#6B7280', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }}>Por canal de contacto</div>
          <div style={{ display:'flex', gap:18 }}>
            <div>
              <div style={{ fontSize:11, color:'#9CA3AF' }}>📧 Email</div>
              <div style={{ fontSize:18, fontWeight:700, color:'#3B82F6' }}>{p.byContactedVia?.email || 0}</div>
            </div>
            <div>
              <div style={{ fontSize:11, color:'#9CA3AF' }}>📸 Instagram</div>
              <div style={{ fontSize:18, fontWeight:700, color:'#E1306C' }}>{p.byContactedVia?.instagram || 0}</div>
            </div>
          </div>
        </div>
        <div style={{ background:'#111827', border:'1px solid #1F2937', borderRadius:14, padding:16 }}>
          <div style={{ fontSize:10, fontWeight:700, color:'#6B7280', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }}>Top categorías</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
            {topCats.map(([cat, n]: any) => (
              <span key={cat} style={{ background:'#1F2937', color:'#D1D5DB', padding:'3px 9px', borderRadius:10, fontSize:11 }}>
                {cat} <span style={{ color:'#F43F5E', fontWeight:700 }}>{n}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ──── MARKETPLACE ──── */}
      <h2 style={{ fontSize:13, fontWeight:700, color:'#9CA3AF', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:10 }}>
        Marketplace
      </h2>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(5, 1fr)', gap:10, marginBottom:18 }}>
        {card('Reservas totales',     b.total.toString(), `${b.confirmedTotal} confirmadas`)}
        {card('GMV',                  `${b.gmv.toLocaleString('es-ES')}€`, 'volumen procesado', '#F43F5E')}
        {card('Ticket medio',         `${b.avgTicket.toLocaleString('es-ES', { maximumFractionDigits: 0 })}€`)}
        {card('Comisión FiestaGo',    `${b.commissions.toLocaleString('es-ES')}€`, undefined, '#10B981')}
        {card('Tasa aceptación',      `${b.acceptanceRate}%`, 'confirmadas / gestionadas')}
      </div>

      {/* ──── GARANTÍA ──── */}
      <h2 style={{ fontSize:13, fontWeight:700, color:'#9CA3AF', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:10 }}>
        Garantía de Éxito
      </h2>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(5, 1fr)', gap:10, marginBottom:18 }}>
        {card('Incidencias',          i.total.toString(), `${i.byStatus?.open || 0} abiertas`)}
        {card('Resueltas',            (i.byStatus?.resolved || 0).toString(), `${i.byStatus?.rejected || 0} rechazadas`)}
        {card('SLA cumplido',         `${i.slaRate}%`, undefined, i.slaRate >= 90 ? '#10B981' : '#F59E0B')}
        {card('Compensado a clientes',`${i.totalCompensated.toLocaleString('es-ES')}€`)}
        {card('Cargos pendientes',    `${i.pendingCharges.toLocaleString('es-ES')}€`, `cobrado: ${i.totalCharged.toLocaleString('es-ES')}€`, '#F59E0B')}
      </div>

      <p style={{ fontSize:11, color:'#4B5563', marginTop:24, textAlign:'center' }}>
        Las cifras se calculan en tiempo real sobre todos los datos. Refresca para ver lo más reciente.
      </p>
    </div>
  )
}

function ApifyPanel() {
  const [hashtag,   setHashtag]   = useState('')
  const [category,  setCategory]  = useState('foto')
  const [city,      setCity]      = useState('Valencia')
  const [limit,     setLimit]     = useState(50)
  const [running,   setRunning]   = useState(false)
  const [runId,     setRunId]     = useState<string | null>(null)
  const [status,    setStatus]    = useState<string | null>(null)
  const [accounts,  setAccounts]  = useState<any[] | null>(null)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<any | null>(null)

  // Hashtags sugeridos por categoría
  const suggestedHashtags: Record<string, string[]> = {
    foto:       ['fotografobodavalencia', 'fotografavalencia', 'bodasvalencia'],
    musica:     ['djbodavalencia', 'djeventosvalencia', 'musicaeventos'],
    catering:   ['cateringvalencia', 'cateringbodavalencia'],
    flores:     ['floristabodavalencia', 'decoracionbodavalencia'],
    pastel:     ['tartabodavalencia', 'pasteleriavalencia'],
    belleza:    ['maquillajenoviavalencia', 'peluqueriavalencia'],
    animacion:  ['animacioninfantilvalencia', 'magosvalencia'],
    espacios:   ['fincabodasvalencia', 'masíavalencia', 'saloneventosvalencia'],
    planner:    ['weddingplannervalencia', 'organizadorabodavalencia'],
    transporte: ['limusinavalencia', 'cocheseventosvalencia'],
    papeleria:  ['invitacionesbodavalencia'],
    joyeria:    ['alianzasvalencia', 'joyeriavalencia'],
  }

  const presets = suggestedHashtags[category] || []

  async function startRun() {
    if (!hashtag.trim()) { toast.error('Pon un hashtag'); return }
    setRunning(true); setRunId(null); setStatus(null); setAccounts(null); setImportResult(null)
    try {
      const res = await fetch('/api/admin/agent/apify', {
        method: 'POST',
        headers: { ...adminHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ hashtag: hashtag.trim(), category, city, limit }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || `Error ${res.status}`)
      setRunId(data.runId)
      setStatus(data.status)
      toast.success(`Apify run iniciado: ${data.runId.slice(0,8)}`)
      // Empezar polling
      pollStatus(data.runId)
    } catch (err: any) {
      toast.error(err.message || 'Error al lanzar Apify')
    }
    setRunning(false)
  }

  async function pollStatus(id: string) {
    // Hasta 5 min de poll cada 10s
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 10_000))
      try {
        const res = await fetch(`/api/admin/agent/apify?runId=${id}`, { headers: adminHeaders() })
        const data = await res.json()
        setStatus(data.status)
        if (data.status === 'SUCCEEDED') {
          setAccounts(data.accounts || [])
          toast.success(`✓ ${data.accountsFound || 0} cuentas encontradas`)
          return
        }
        if (['FAILED','ABORTED','TIMED-OUT'].includes(data.status)) {
          toast.error(`Apify falló: ${data.status}`)
          return
        }
      } catch {}
    }
    toast('Apify tarda más de 5 min — refresca el estado manualmente luego')
  }

  async function importAll() {
    if (!runId) return
    setImporting(true)
    try {
      const res = await fetch('/api/admin/agent/apify', {
        method: 'PATCH',
        headers: { ...adminHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ runId, category, city }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || `Error ${res.status}`)
      setImportResult(data)
      toast.success(`Importados ${data.saved} (${data.skippedDup} duplicados)`)
    } catch (err: any) {
      toast.error(err.message || 'Error al importar')
    }
    setImporting(false)
  }

  return (
    <div style={{ background:'#111827', border:'1px solid #1F2937', borderRadius:14, padding:18, marginBottom:20 }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
        <span style={{ fontSize:18 }}>📸</span>
        <div>
          <div style={{ fontFamily:'IBM Plex Mono,monospace', fontSize:11, fontWeight:700, color:'#E1306C', letterSpacing:'0.08em', textTransform:'uppercase' }}>
            Captación por Instagram (Apify)
          </div>
          <div style={{ fontSize:11, color:'#6B7280', marginTop:2 }}>
            Scrapea hashtags para encontrar cuentas activas no indexadas por Google
          </div>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 90px', gap:8, marginBottom:10 }}>
        <input value={hashtag} onChange={e => setHashtag(e.target.value)}
          placeholder="hashtag (sin #)"
          style={{ padding:'8px 10px', background:'#0D1117', border:'1px solid #1F2937', borderRadius:8, color:'#F9FAFB', fontSize:12 }}/>
        <select value={category} onChange={e => setCategory(e.target.value)}
          style={{ padding:'8px 10px', background:'#0D1117', border:'1px solid #1F2937', borderRadius:8, color:'#F9FAFB', fontSize:12 }}>
          {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
        </select>
        <input value={city} onChange={e => setCity(e.target.value)}
          placeholder="Ciudad"
          style={{ padding:'8px 10px', background:'#0D1117', border:'1px solid #1F2937', borderRadius:8, color:'#F9FAFB', fontSize:12 }}/>
        <input type="number" value={limit} onChange={e => setLimit(parseInt(e.target.value) || 50)}
          min={10} max={200}
          style={{ padding:'8px 10px', background:'#0D1117', border:'1px solid #1F2937', borderRadius:8, color:'#F9FAFB', fontSize:12 }}/>
      </div>

      {presets.length > 0 && (
        <div style={{ display:'flex', gap:6, marginBottom:10, flexWrap:'wrap' }}>
          <span style={{ fontSize:10, color:'#6B7280', alignSelf:'center' }}>Sugerencias:</span>
          {presets.map(h => (
            <button key={h} onClick={() => setHashtag(h)}
              style={{ fontSize:10, padding:'3px 8px', borderRadius:8, border:'1px solid #1F2937',
                background:'transparent', color:'#9CA3AF', cursor:'pointer' }}>
              #{h}
            </button>
          ))}
        </div>
      )}

      <button onClick={startRun} disabled={running || !!status && !['SUCCEEDED','FAILED','ABORTED','TIMED-OUT'].includes(status)}
        style={{ width:'100%', background:'#E1306C', color:'#fff', border:'none', padding:'9px',
          borderRadius:8, fontSize:12, fontWeight:700, cursor:'pointer',
          opacity: (running || (status && !['SUCCEEDED','FAILED','ABORTED','TIMED-OUT'].includes(status))) ? 0.6 : 1 }}>
        {running ? 'Lanzando...'
          : status === 'RUNNING'    ? '⏳ Apify ejecutando (puede tardar 2-5 min)…'
          : status === 'READY'      ? '⏳ En cola…'
          : '🚀 Lanzar scrapeo'}
      </button>

      {status && (
        <div style={{ marginTop:10, fontSize:11, color:'#9CA3AF' }}>
          Run: <code style={{ color:'#F0F4FF' }}>{runId?.slice(0,12)}…</code> · Estado: <strong style={{ color: status === 'SUCCEEDED' ? '#10B981' : status === 'RUNNING' ? '#F59E0B' : '#9CA3AF' }}>{status}</strong>
        </div>
      )}

      {accounts && accounts.length > 0 && !importResult && (
        <div style={{ marginTop:12, padding:10, background:'#0D1117', border:'1px solid #10B98144', borderRadius:8 }}>
          <div style={{ fontSize:11, color:'#10B981', fontWeight:700, marginBottom:6 }}>
            ✓ {accounts.length} cuentas únicas encontradas
          </div>
          <div style={{ fontSize:10, color:'#9CA3AF', marginBottom:8, maxHeight:80, overflowY:'auto' }}>
            {accounts.slice(0, 15).map((a:any) => `@${a.username}`).join(' · ')}
            {accounts.length > 15 && ` … +${accounts.length - 15}`}
          </div>
          <button onClick={importAll} disabled={importing}
            style={{ width:'100%', background:'#10B981', color:'#fff', border:'none', padding:'8px',
              borderRadius:8, fontSize:12, fontWeight:700, cursor:'pointer', opacity: importing ? 0.6 : 1 }}>
            {importing ? 'Importando...' : `Importar las ${accounts.length} a /admin como pending`}
          </button>
        </div>
      )}

      {importResult && (
        <div style={{ marginTop:12, padding:10, background:'#10B98122', border:'1px solid #10B98166', borderRadius:8, fontSize:11, color:'#10B981' }}>
          ✓ {importResult.saved} importados · {importResult.skippedDup} duplicados saltados
        </div>
      )}
    </div>
  )
}
