'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
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
    await fetch('/api/admin/providers', {
      method:'PATCH', headers: adminHeaders(),
      body: JSON.stringify({ id, ...updates }),
    })
    setProviders(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p))
  }

  async function deleteProvider(id: string) {
    if (!confirm('¿Eliminar este proveedor?')) return
    await fetch(`/api/admin/providers?id=${id}`, { method:'DELETE', headers: adminHeaders() })
    setProviders(prev => prev.filter(p => p.id !== id))
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
    { id:'notifications',icon:'🔔', label:'Notificaciones', badge: unread },
    { id:'agent',        icon:'🤖', label:'Agente IA' },
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
                        <img src={getPhoto(p.category, p.photo_idx)} alt=""
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
                <button onClick={fetchProviders}
                  style={{ padding:'8px 16px', borderRadius:8, border:'1px solid #1F2937',
                    background:'transparent', color:'#9CA3AF', fontSize:12, cursor:'pointer' }}>
                  🔄 Actualizar
                </button>
              </div>

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
                        <img src={getPhoto(p.category, p.photo_idx)} alt=""
                          style={{ width:34, height:34, borderRadius:7, objectFit:'cover', flexShrink:0 }}/>
                        <div>
                          <div style={{ fontSize:12, fontWeight:600, color:'#F0F4FF' }}>
                            {p.name} {p.featured&&'⭐'}
                          </div>
                          <div style={{ fontSize:10, color:'#374151' }}>{p.email||'—'}</div>
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
            onClick={()=>setEditProv(null)}/>
          <div style={{ position:'relative', background:'#111827', borderRadius:20, width:'100%', maxWidth:540,
            maxHeight:'88vh', overflowY:'auto', margin:'0 20px', border:'1px solid #1F2937',
            boxShadow:'0 40px 100px rgba(0,0,0,0.8)', padding:24 }}>
            <div style={{ fontSize:15, fontWeight:700, color:'#F0F4FF', marginBottom:18 }}>✏️ Editar: {editProv.name}</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              {[['Nombre','name','text'],['Email','email','email'],['Teléfono','phone','tel'],
                ['Precio base','price_base','number'],['Ciudad','city','text'],
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

            <div style={{ marginTop:12 }}>
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

            <div style={{ marginTop:12, display:'flex', gap:7, alignItems:'center' }}>
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
            </div>

            <div style={{ marginTop:20, display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button onClick={()=>setEditProv(null)}
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
