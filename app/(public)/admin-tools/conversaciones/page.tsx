'use client'

import { useEffect, useState, useRef } from 'react'

type ConvProvider = {
  id: string
  name: string
  city: string
  category: string
  phone: string | null
  email: string | null
  website: string | null
  instagram: string | null
}

type Msg = { role: 'us' | 'them'; content: string; at: string; generated_by_ai?: boolean }

type Conversation = {
  id: string
  provider_id: string
  channel: 'whatsapp' | 'instagram' | 'email' | 'other'
  status: 'active' | 'won' | 'lost' | 'paused'
  messages: Msg[]
  created_at: string
  updated_at: string
  last_message_at: string | null
  providers: ConvProvider
  messageCount: number
  lastMessage: { role: 'us' | 'them'; content: string; at: string } | null
}

function adminHeaders(pass: string) {
  return { 'Content-Type': 'application/json', 'x-admin-password': pass }
}

const CHANNEL_ICON: Record<string, string> = {
  whatsapp:  '💬',
  instagram: '📸',
  email:     '📧',
  other:     '💌',
}

const STATUS_LABEL: Record<string, { l: string; bg: string; color: string }> = {
  active: { l: 'En curso',  bg: '#10B98120', color: '#10B981' },
  won:    { l: '✓ Cerrado', bg: '#06B6D420', color: '#06B6D4' },
  lost:   { l: '✕ Perdido', bg: '#EF444420', color: '#EF4444' },
  paused: { l: 'Pausada',   bg: '#9CA3AF20', color: '#9CA3AF' },
}

export default function ConversacionesPage() {
  const [pass,       setPass]       = useState('')
  const [conv,       setConv]       = useState<Conversation[]>([])
  const [selected,   setSelected]   = useState<Conversation | null>(null)
  const [statusF,    setStatusF]    = useState<'active' | 'won' | 'lost' | 'paused'>('active')
  const [loading,    setLoading]    = useState(false)
  const [incoming,   setIncoming]   = useState('')
  const [draft,      setDraft]      = useState('')
  const [generating, setGenerating] = useState(false)
  const [saving,     setSaving]     = useState(false)
  const chatRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const p = typeof window !== 'undefined' ? localStorage.getItem('fg_admin_pass') || '' : ''
    if (p) setPass(p)
  }, [])

  async function fetchConvs() {
    if (!pass) return
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/conversations?status=${statusF}`, { headers: adminHeaders(pass) })
      const data = await res.json()
      setConv(data.conversations || [])
    } finally { setLoading(false) }
  }

  useEffect(() => { if (pass) fetchConvs() }, [pass, statusF])

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
  }, [selected?.messages?.length])

  async function generateReply() {
    if (!selected || !incoming.trim()) return
    setGenerating(true)
    try {
      const res = await fetch('/api/admin/conversations/reply', {
        method: 'POST',
        headers: adminHeaders(pass),
        body: JSON.stringify({ conversation_id: selected.id, incoming }),
      })
      const data = await res.json()
      if (!res.ok) { alert('Error: ' + (data.error || 'desconocido')); return }
      setDraft(data.draft || '')
      // Refrescar historial localmente
      setSelected({ ...selected, messages: data.history })
      // Limpiar el incoming ya que se guardó en historial
      setIncoming('')
    } finally { setGenerating(false) }
  }

  async function saveAsSent() {
    if (!selected || !draft.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/admin/conversations', {
        method: 'PATCH',
        headers: adminHeaders(pass),
        body: JSON.stringify({
          id: selected.id,
          addMessage: { role: 'us', content: draft, generated_by_ai: true },
        }),
      })
      if (!res.ok) { alert('Error guardando: ' + (await res.json()).error); return }
      // Optimistic update
      const newMsg: Msg = { role: 'us', content: draft, at: new Date().toISOString(), generated_by_ai: true }
      setSelected({ ...selected, messages: [...selected.messages, newMsg] })
      setDraft('')
      fetchConvs()
    } finally { setSaving(false) }
  }

  async function markStatus(status: 'won' | 'lost' | 'paused' | 'active') {
    if (!selected) return
    await fetch('/api/admin/conversations', {
      method: 'PATCH',
      headers: adminHeaders(pass),
      body: JSON.stringify({ id: selected.id, status }),
    })
    setSelected({ ...selected, status })
    fetchConvs()
  }

  function copyDraft() {
    navigator.clipboard.writeText(draft).then(() => alert('Copiado al portapapeles ✓'))
  }

  // Para abrir WhatsApp con el draft listo
  function waLink(provider: ConvProvider, text: string): string {
    const phone = (provider.phone || '').replace(/\D/g, '')
    const normalized = phone.startsWith('34') ? phone
                     : phone.length === 9     ? '34' + phone
                     : phone
    return `https://wa.me/${normalized}?text=${encodeURIComponent(text)}`
  }

  if (!pass) {
    return (
      <div style={{ minHeight:'100vh', background:'#080B12', color:'#F0F4FF',
        display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
        <div style={{ background:'#111827', padding:24, borderRadius:14, border:'1px solid #1F2937', maxWidth:380, width:'100%' }}>
          <h2 style={{ marginTop:0, fontSize:18 }}>🔐 Acceso admin</h2>
          <input type="password" placeholder="ADMIN_PASSWORD"
            onChange={e => {
              const v = e.target.value
              if (v) { localStorage.setItem('fg_admin_pass', v); setPass(v) }
            }}
            style={{ width:'100%', padding:12, background:'#0D1117', border:'1px solid #1F2937',
              borderRadius:8, color:'#F0F4FF', fontSize:14, fontFamily:'monospace' }}/>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight:'100vh', background:'#080B12', color:'#F0F4FF', display:'grid',
      gridTemplateColumns:'320px 1fr', gap:0 }}>
      {/* ── SIDEBAR ────────────────────────────────────────────────── */}
      <div style={{ borderRight:'1px solid #1F2937', background:'#0D1117', overflowY:'auto', maxHeight:'100vh' }}>
        <div style={{ padding:'16px 14px', borderBottom:'1px solid #1F2937', position:'sticky', top:0, background:'#0D1117', zIndex:1 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
            <div style={{ fontFamily:'monospace', fontSize:10, fontWeight:700, color:'#06B6D4',
              letterSpacing:'0.07em', textTransform:'uppercase' }}>▸ Conversaciones</div>
            <button onClick={fetchConvs}
              style={{ background:'transparent', border:'1px solid #1F2937', borderRadius:6, padding:'3px 7px',
                color:'#9CA3AF', fontSize:10, cursor:'pointer' }}>🔄</button>
          </div>
          <div style={{ display:'flex', gap:4 }}>
            {(['active','won','lost','paused'] as const).map(s => (
              <button key={s} onClick={() => setStatusF(s)}
                style={{ flex:1, padding:'5px', borderRadius:6, fontSize:9, fontWeight:700,
                  border:`1px solid ${statusF===s?'#06B6D4':'#1F2937'}`,
                  background:statusF===s?'#06B6D418':'transparent',
                  color:statusF===s?'#06B6D4':'#9CA3AF', cursor:'pointer' }}>
                {STATUS_LABEL[s].l}
              </button>
            ))}
          </div>
        </div>
        {loading ? (
          <div style={{ padding:20, color:'#374151', fontSize:12 }}>Cargando…</div>
        ) : conv.length === 0 ? (
          <div style={{ padding:'30px 14px', color:'#4B5563', fontSize:11, lineHeight:1.5 }}>
            No hay conversaciones {STATUS_LABEL[statusF].l.toLowerCase()}.
            <br/><br/>
            Crea una desde el botón 💬 de un proveedor en <a href="/admin" style={{ color:'#06B6D4' }}>/admin</a>.
          </div>
        ) : conv.map(c => {
          const isSel = selected?.id === c.id
          const last = c.lastMessage
          return (
            <div key={c.id} onClick={() => setSelected(c)}
              style={{ padding:'12px 14px', borderBottom:'1px solid #1F2937', cursor:'pointer',
                background: isSel ? '#06B6D418' : 'transparent' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:3 }}>
                <div style={{ fontSize:12, fontWeight:600, color:'#F0F4FF', overflow:'hidden',
                  textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:200 }}>
                  {CHANNEL_ICON[c.channel] || '💌'} {c.providers?.name || '?'}
                </div>
                <div style={{ fontSize:9, color:'#4B5563' }}>{c.messageCount}</div>
              </div>
              <div style={{ fontSize:10, color: last?.role === 'them' ? '#10B981' : '#9CA3AF',
                overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {last ? (last.role === 'them' ? '← ' : '→ ') + last.content : 'sin mensajes'}
              </div>
            </div>
          )
        })}
      </div>

      {/* ── PANEL DE CHAT ──────────────────────────────────────────── */}
      <div style={{ display:'flex', flexDirection:'column', maxHeight:'100vh' }}>
        {!selected ? (
          <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', color:'#374151', fontSize:13 }}>
            Selecciona una conversación a la izquierda
          </div>
        ) : (
          <>
            {/* Header proveedor */}
            <div style={{ padding:'14px 20px', borderBottom:'1px solid #1F2937', background:'#0D1117',
              display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <div style={{ fontSize:14, fontWeight:700, color:'#F0F4FF' }}>
                  {CHANNEL_ICON[selected.channel]} {selected.providers?.name}
                </div>
                <div style={{ fontSize:11, color:'#9CA3AF', marginTop:2 }}>
                  📍 {selected.providers?.city}
                  {selected.providers?.phone && ` · 📞 ${selected.providers.phone}`}
                </div>
              </div>
              <div style={{ display:'flex', gap:5 }}>
                <span style={{ fontSize:10, fontWeight:700, padding:'4px 10px', borderRadius:10,
                  background: STATUS_LABEL[selected.status].bg, color: STATUS_LABEL[selected.status].color }}>
                  {STATUS_LABEL[selected.status].l}
                </span>
                <button onClick={() => markStatus('won')} title="Marcar cerrado/ganado"
                  style={{ padding:'4px 8px', borderRadius:6, border:'1px solid #06B6D4',
                    background:'transparent', color:'#06B6D4', fontSize:10, cursor:'pointer' }}>✓ Cerrado</button>
                <button onClick={() => markStatus('lost')} title="Marcar perdido"
                  style={{ padding:'4px 8px', borderRadius:6, border:'1px solid #EF4444',
                    background:'transparent', color:'#EF4444', fontSize:10, cursor:'pointer' }}>✕ Perdido</button>
              </div>
            </div>

            {/* Historial */}
            <div ref={chatRef} style={{ flex:1, overflowY:'auto', padding:20, background:'#080B12' }}>
              {(selected.messages || []).map((m, i) => (
                <div key={i} style={{
                  display:'flex',
                  justifyContent: m.role === 'us' ? 'flex-end' : 'flex-start',
                  marginBottom:10,
                }}>
                  <div style={{
                    maxWidth:'70%',
                    background: m.role === 'us' ? '#06B6D420' : '#111827',
                    border:    `1px solid ${m.role === 'us' ? '#06B6D4' : '#1F2937'}`,
                    padding:   '10px 14px',
                    borderRadius: 12,
                    fontSize:  13,
                    color:     '#F0F4FF',
                    whiteSpace:'pre-wrap',
                  }}>
                    <div style={{ fontSize:9, fontWeight:700, color: m.role === 'us' ? '#06B6D4' : '#9CA3AF',
                      marginBottom:4, textTransform:'uppercase', letterSpacing:'0.05em' }}>
                      {m.role === 'us' ? `Tú${m.generated_by_ai ? ' · IA' : ''}` : selected.providers?.name?.split(' ')[0]}
                      <span style={{ marginLeft:6, color:'#4B5563' }}>{new Date(m.at).toLocaleString('es-ES', { dateStyle:'short', timeStyle:'short' })}</span>
                    </div>
                    {m.content}
                  </div>
                </div>
              ))}
              {selected.messages.length === 0 && (
                <div style={{ color:'#4B5563', fontSize:12, textAlign:'center', padding:30 }}>
                  No hay mensajes todavía. Pega abajo lo que te escribió el proveedor para empezar.
                </div>
              )}
            </div>

            {/* Composer */}
            <div style={{ padding:16, borderTop:'1px solid #1F2937', background:'#0D1117' }}>
              {!draft ? (
                <div>
                  <div style={{ fontSize:10, fontWeight:700, color:'#10B981', marginBottom:6,
                    letterSpacing:'0.07em', textTransform:'uppercase' }}>
                    📥 Pega aquí lo que te escribió {selected.providers?.name?.split(' ')[0]}
                  </div>
                  <textarea value={incoming} onChange={e => setIncoming(e.target.value)}
                    placeholder="Ej: Hola, gracias por escribir. ¿Cuánto cobra FiestaGo?"
                    style={{ width:'100%', minHeight:80, padding:12, background:'#080B12',
                      border:'1px solid #1F2937', borderRadius:8, color:'#F0F4FF', fontSize:13,
                      fontFamily:'inherit', resize:'vertical', outline:'none' }}/>
                  <button onClick={generateReply} disabled={!incoming.trim() || generating}
                    style={{ marginTop:8, padding:'10px 16px', borderRadius:8,
                      background: generating ? 'transparent' : '#10B981',
                      border: generating ? '1px solid #10B98144' : 'none',
                      color: generating ? '#10B981' : '#000',
                      fontSize:12, fontWeight:700, cursor: generating ? 'wait' : 'pointer',
                      fontFamily:'monospace' }}>
                    {generating ? '⏳ GENERANDO...' : '✨ GENERAR RESPUESTA CON IA'}
                  </button>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize:10, fontWeight:700, color:'#06B6D4', marginBottom:6,
                    letterSpacing:'0.07em', textTransform:'uppercase' }}>
                    ✨ Borrador de respuesta (editable)
                  </div>
                  <textarea value={draft} onChange={e => setDraft(e.target.value)}
                    style={{ width:'100%', minHeight:120, padding:12, background:'#080B12',
                      border:'1px solid #06B6D4', borderRadius:8, color:'#F0F4FF', fontSize:13,
                      fontFamily:'inherit', resize:'vertical', outline:'none' }}/>
                  <div style={{ marginTop:8, display:'flex', gap:6, flexWrap:'wrap' }}>
                    <button onClick={copyDraft}
                      style={{ padding:'10px 14px', borderRadius:8, border:'1px solid #06B6D4',
                        background:'transparent', color:'#06B6D4', fontSize:12, fontWeight:700, cursor:'pointer' }}>
                      📋 Copiar al portapapeles
                    </button>
                    {selected.providers?.phone && selected.channel === 'whatsapp' && (
                      <a href={waLink(selected.providers, draft)} target="_blank" rel="noreferrer"
                        style={{ padding:'10px 14px', borderRadius:8, border:'1px solid #25D366',
                          background:'transparent', color:'#25D366', fontSize:12, fontWeight:700,
                          cursor:'pointer', textDecoration:'none' }}>
                        💬 Abrir WhatsApp con esto
                      </a>
                    )}
                    <button onClick={saveAsSent} disabled={saving}
                      style={{ padding:'10px 14px', borderRadius:8, border:'none',
                        background: saving ? 'transparent' : '#10B981',
                        color: saving ? '#10B981' : '#000', fontSize:12, fontWeight:700,
                        cursor: saving ? 'wait' : 'pointer' }}>
                      {saving ? '⏳' : '✓ Ya lo envié — guardar en historial'}
                    </button>
                    <button onClick={() => { setDraft(''); setIncoming('') }}
                      style={{ padding:'10px 14px', borderRadius:8, border:'1px solid #4B5563',
                        background:'transparent', color:'#9CA3AF', fontSize:12, cursor:'pointer' }}>
                      ✕ Descartar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
