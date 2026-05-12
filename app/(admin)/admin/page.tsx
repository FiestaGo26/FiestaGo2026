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
  approved: { label:'Aprobado',  bg:'#D1FAE5', color:'#065F46' },
  pending:  { label:'Pendiente', bg:'#FEF3C7', color:'#92400E' },
  rejected: { label:'Rechazado', bg:'#FEE2E2', color:'#991B1B' },
  suspended:{ label:'Suspendido',bg:'#F3F4F6', color:'#4B5563' },
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
  const [agentCfg,  setAgentCfg]  = useState({ category:'foto', city:'Madrid', count:5, tone:'profesional y cercano', sources:['web'] })
  const [agentRunning, setAgentRunning] = useState(false)
  const [agentLogs,    setAgentLogs]    = useState<string[]>([])
  const [agentResults, setAgentResults] = useState<any[]>([])
  const [sendingEmail, setSendingEmail] = useState(false)
  const [sendStatus,  setSendStatus]   = useState<{ok:boolean,msg:string}|null>(null)
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
  // Reservas
  const [bookings,       setBookings]       = useState<any[]>([])
  const [bookingFilter,  setBookingFilter]  = useState<'pending'|'confirmed'|'cancelled'|'all'>('pending')
  const [bookingStats,   setBookingStats]   = useState<Record<string, number>>({})
  const [bookingLoading, setBookingLoading] = useState(false)
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
    if (filterStatus) params.set('status', filterStatus)
    if (filterCat)    params.set('category', filterCat)
    if (search)       params.set('search', search)
    const res  = await fetch(`/api/admin/providers?${params}`, { headers: adminHeaders() })
    const data = await res.json()
    setProviders(data.providers || [])
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
    else if (data && data.flow === 'approval')   toast.success(`Aprobado${data.welcomeEmail ? ' · email bienvenida enviado' : ''}${data.imageGenerated ? ' · imagen generada' : ''}`)
    else if (updates.status === 'rejected')      toast.success(`Rechazado${data?.rejectionEmail ? ' · email enviado' : ''}`)
    return data
  }

  async function deleteProvider(id: string) {
    if (!confirm('¿Eliminar este proveedor?')) return
    await fetch(`/api/admin/providers?id=${id}`, { method:'DELETE', headers: adminHeaders() })
    setProviders(prev => prev.filter(p => p.id !== id))
  }

  async function bulkApprove() {
    const candidatos = providers.filter(p =>
      p.status === 'pending' && !p.outreach_sent && p.outreach_email && p.email
    )
    if (!candidatos.length) {
      setBulkResult({ ok: false, msg: 'No hay candidatos con email pendientes de contactar.' })
      return
    }
    if (!confirm(`Vas a enviar el email outreach a ${candidatos.length} proveedores. Esto consume tu cuota de Resend. ¿Continuar?`)) return
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
    setAgentLogs([`🤖 Iniciando agente — ${agentCfg.category} en ${agentCfg.city}...`])
    setAgentResults([])
    try {
      const res  = await fetch('/api/admin/agent', {
        method:'POST', headers: adminHeaders(),
        body: JSON.stringify(agentCfg),
      })
      const data = await res.json()
      if (data.logs)      setAgentLogs(data.logs)
      if (data.providers) setAgentResults(data.providers)
      if (data.error)     setAgentLogs(l => [...l, `❌ Error: ${data.error}`])
    } catch(e: any) {
      setAgentLogs(l => [...l, `❌ Error de red: ${e.message}`])
    }
    setAgentRunning(false)
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
    { id:'providers',    icon:'🏪', label:'Proveedores', badge: stats.pending },
    { id:'bookings',     icon:'📋', label:'Reservas', badge: bookingStats.pending || 0 },
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
          {section === 'providers' && (
            <div>
              <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap' }}>
                <input placeholder="🔍 Buscar por nombre o email..." value={search}
                  onChange={e=>setSearch(e.target.value)}
                  style={{ flex:1, minWidth:200, background:'#111827', border:'1px solid #1F2937',
                    borderRadius:8, padding:'8px 12px', fontSize:13, color:'#F0F4FF', outline:'none' }}/>
                {[['filterStatus','Estado',[['','Todos'],['approved','Aprobados'],['pending','Pendientes'],['rejected','Rechazados']]],
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
                  const st  = STATUS_MAP[p.status] || STATUS_MAP.pending
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
                    {[3,5,8].map(n=>(
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
                            <video src={p.media_url} autoPlay muted loop playsInline
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

      {/* EDIT MODAL */}
      {editProv && (
        <div style={{ position:'fixed', inset:0, zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.85)', backdropFilter:'blur(6px)' }}
            onClick={()=>{ setEditProv(null); setSendStatus(null); }}/>
          <div style={{ position:'relative', background:'#111827', borderRadius:20, width:'100%', maxWidth:680,
            maxHeight:'92vh', overflowY:'auto', margin:'0 20px', border:'1px solid #1F2937',
            boxShadow:'0 40px 100px rgba(0,0,0,0.8)', padding:24 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
              <div style={{ fontSize:15, fontWeight:700, color:'#F0F4FF' }}>✏️ Editar: {editProv.name}</div>
              {editProv.contactable === false && (
                <span style={{ fontSize:10, fontWeight:700, padding:'3px 9px', borderRadius:10,
                  background:'#EF444422', color:'#EF4444' }}>⚠ sin canales</span>
              )}
              {editProv.contactable && (
                <span style={{ fontSize:10, fontWeight:700, padding:'3px 9px', borderRadius:10,
                  background:'#10B98122', color:'#10B981' }}>✓ contactable</span>
              )}
            </div>

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

            {/* Estado */}
            <div style={{ marginTop:14 }}>
              <label style={{ fontSize:10, fontWeight:700, color:'#4B5563', display:'block',
                marginBottom:4, textTransform:'uppercase', letterSpacing:'0.07em' }}>Estado</label>
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

            {/* DM draft + acción */}
            {(editProv.outreach_dm || editProv.instagram || editProv.tiktok) && (
              <div style={{ marginTop:14, padding:14, background:'#0D1117', border:'1px solid #1F2937', borderRadius:10 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#E1306C', textTransform:'uppercase', letterSpacing:'0.07em' }}>📸 DM Instagram</div>
                  <div style={{ display:'flex', gap:6 }}>
                    <button
                      onClick={()=>{
                        navigator.clipboard.writeText(editProv.outreach_dm||'')
                        alert('Mensaje copiado al portapapeles — pégalo en el DM')
                      }}
                      style={{ padding:'4px 10px', borderRadius:7, border:'1px solid #1F2937',
                        background:'transparent', color:'#9CA3AF', fontSize:11, cursor:'pointer' }}>
                      📋 Copiar
                    </button>
                    <button
                      disabled={!editProv.instagram}
                      onClick={()=>{
                        const handle = (editProv.instagram||'').replace(/^@/,'')
                        if (!handle) return
                        navigator.clipboard.writeText(editProv.outreach_dm||'').catch(()=>{})
                        window.open(`https://instagram.com/${handle}/`, '_blank')
                        updateProvider(editProv.id, { outreach_sent: true })
                      }}
                      style={{ padding:'4px 12px', borderRadius:7, border:'none',
                        background: editProv.instagram ? '#E1306C' : '#1F2937',
                        color: editProv.instagram ? '#fff' : '#4B5563',
                        fontSize:11, fontWeight:700, cursor: editProv.instagram ? 'pointer' : 'not-allowed' }}>
                      📸 Abrir IG + copiar
                    </button>
                  </div>
                </div>
                <textarea
                  value={editProv.outreach_dm||''}
                  onChange={e=>setEditProv(p=>p?{...p,outreach_dm:e.target.value}:null)}
                  rows={6}
                  style={{ width:'100%', background:'#080B12', border:'1px solid #1F2937', borderRadius:8,
                    padding:'9px 11px', fontSize:11.5, lineHeight:1.55, color:'#F0F4FF', outline:'none',
                    boxSizing:'border-box', fontFamily:'IBM Plex Mono, monospace', resize:'vertical' }}/>
                {editProv.instagram && (
                  <div style={{ fontSize:11, color:'#9CA3AF', marginTop:6 }}>
                    Al pulsar “Abrir IG + copiar” copia el mensaje y abre instagram.com/{(editProv.instagram||'').replace(/^@/,'')}
                  </div>
                )}
              </div>
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
