'use client'

import { useEffect, useState, useTransition } from 'react'
import toast from 'react-hot-toast'

// ─── Pestaña Contenido · vídeos diarios generados con HeyGen ─────────────────
// Lista cronológica de vídeos creados por el cron diario. Cada fila muestra:
//   - el pilar y topic (qué contó)
//   - el guion (lo que dijo el avatar)
//   - el caption listo para pegar en IG/TikTok
//   - hashtags
//   - link de descarga del .mp4 cuando está listo
//   - botón para marcar como publicado
//
// Botón "Generar ahora" para forzar uno extra (útil si fallas un día).

function adminHeaders() {
  const pass = typeof window !== 'undefined' ? localStorage.getItem('fg_admin_pass') || '' : ''
  return { 'Content-Type': 'application/json', 'x-admin-password': pass }
}

type Video = {
  id:               string
  created_at:       string
  scheduled_for:    string
  pillar:           string
  topic:            string
  script:           string
  caption:          string | null
  hashtags:         string[] | null
  cta_url:          string | null
  heygen_status:    'pending' | 'processing' | 'completed' | 'failed'
  video_url:        string | null
  thumbnail_url:    string | null
  duration_seconds: number | null
  published_at:     string | null
  published_channels: string[] | null
  error:            string | null
}

const C = {
  card:   '#111827',
  bg:     '#0D1117',
  border: '#1F2937',
  text:   '#F0F4FF',
  muted:  '#9CA3AF',
  faint:  '#4B5563',
  accent: '#F43F5E',
  green:  '#10B981',
  amber:  '#F59E0B',
  cyan:   '#06B6D4',
}

const PILLAR_LABEL: Record<string, string> = {
  lunes_tip:           'Tip de planificación',
  martes_categoria:    'Categoría destacada',
  miercoles_garantia:  'Garantía de Éxito',
  jueves_real_wedding: 'Real wedding',
  viernes_dato:        'Dato/estadística',
  sabado_sello:        'Sello (captación)',
  domingo_calculadora: 'Calculadora',
}

export default function ContentVideos() {
  const [videos, setVideos]   = useState<Video[]>([])
  const [mode, setMode]       = useState<string>('providers')
  const [pillarToday, setPillarToday] = useState<{ id: string; label: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [pending, startTransition] = useTransition()

  async function load() {
    setLoading(true)
    try {
      const res  = await fetch('/api/admin/content/list', { headers: adminHeaders(), cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error')
      setVideos(data.videos || [])
      setMode(data.mode || 'providers')
      setPillarToday(data.pillarToday || null)
    } catch (e: any) {
      toast.error(e?.message || 'Error al cargar')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  // Auto-refresh cada 20s si hay algún vídeo en processing/pending.
  // Llama a /poll-now (que polea HeyGen y actualiza BD) y luego recarga
  // la lista. Se detiene cuando todos están completed/failed.
  useEffect(() => {
    const inFlight = videos.some(v => v.heygen_status === 'processing' || v.heygen_status === 'pending')
    if (!inFlight) return
    const id = setInterval(async () => {
      try {
        await fetch('/api/admin/content/poll-now', { method: 'POST', headers: adminHeaders() })
      } catch {}
      await load()
    }, 20_000)
    return () => clearInterval(id)
  }, [videos])

  function generateNow() {
    if (!window.confirm('¿Forzar generación de un vídeo nuevo HOY? (reemplaza el existente)')) return
    startTransition(async () => {
      try {
        const res  = await fetch('/api/admin/content/generate-now', {
          method:  'POST',
          headers: adminHeaders(),
          body:    JSON.stringify({ force: true }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Error')
        toast.success(`Vídeo iniciado · ${data.pillar} · ${data.topic}`)
        await load()
      } catch (e: any) {
        toast.error(e?.message || 'Error')
      }
    })
  }

  function pollNow() {
    startTransition(async () => {
      try {
        const res  = await fetch('/api/admin/content/poll-now', {
          method:  'POST',
          headers: adminHeaders(),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Error')
        toast.success(`Comprobados ${data.checked || 0}`)
        await load()
      } catch (e: any) {
        toast.error(e?.message || 'Error')
      }
    })
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text).then(
      () => toast.success('Copiado'),
      () => toast.error('No pude copiar')
    )
  }

  function markPublished(id: string) {
    startTransition(async () => {
      try {
        const res = await fetch('/api/admin/content/mark-published', {
          method:  'POST',
          headers: adminHeaders(),
          body:    JSON.stringify({ id }),
        })
        if (!res.ok) throw new Error('Error al marcar')
        toast.success('Marcado como publicado')
        await load()
      } catch (e: any) {
        toast.error(e?.message || 'Error')
      }
    })
  }

  return (
    <div>
      <div style={{
        display:'flex', alignItems:'center', justifyContent:'space-between',
        marginBottom:16, gap:12, flexWrap:'wrap'
      }}>
        <div style={{ fontSize:13, color:C.muted, display:'flex', flexDirection:'column', gap:4 }}>
          <div>Vídeos diarios para Reels / TikTok / Shorts. Cron 08:00 Madrid. HeyGen + Claude.</div>
          <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap', fontSize:11 }}>
            <span style={{
              padding:'2px 8px', borderRadius:5,
              background: mode === 'providers' ? `${C.amber}22` : `${C.cyan}22`,
              color:      mode === 'providers' ? C.amber : C.cyan,
              fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em',
            }}>
              Modo: {mode === 'providers' ? '🎯 Captación proveedores' : '💍 Captación clientes'}
            </span>
            {pillarToday && (
              <span style={{ color:C.faint }}>
                · Pilar de hoy: <span style={{ color:C.muted }}>{pillarToday.label}</span>
              </span>
            )}
          </div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={pollNow} disabled={pending}
            style={{
              padding:'8px 12px', borderRadius:8,
              border:`1px solid ${C.border}`, background:'transparent', color:C.muted,
              fontSize:11, fontWeight:700, cursor:pending?'not-allowed':'pointer',
              fontFamily:'IBM Plex Mono, monospace',
            }}>
            🔄 ACTUALIZAR ESTADOS
          </button>
          <button onClick={generateNow} disabled={pending}
            style={{
              padding:'8px 16px', borderRadius:8, border:'none',
              background:pending?C.faint:C.green, color:'#000',
              fontSize:12, fontWeight:700, cursor:pending?'not-allowed':'pointer',
              fontFamily:'IBM Plex Mono, monospace',
            }}>
            {pending ? '⏳' : '✨ GENERAR AHORA'}
          </button>
        </div>
      </div>

      {loading && <div style={{ padding:16, fontSize:13, color:C.faint }}>Cargando…</div>}
      {!loading && videos.length === 0 && (
        <div style={{
          padding:32, background:C.card, border:`1px dashed ${C.border}`, borderRadius:14,
          textAlign:'center', color:C.muted, fontSize:13,
        }}>
          Aún no hay vídeos. El cron diario los irá creando.
          <br/>
          ¿Probamos uno ahora? Pulsa "GENERAR AHORA".
        </div>
      )}

      <div style={{ display:'grid', gap:14 }}>
        {videos.map(v => {
          const statusColor = v.heygen_status === 'completed' ? C.green
                             : v.heygen_status === 'failed' ? C.accent
                             : C.amber
          return (
            <div key={v.id} style={{
              background:C.card, border:`1px solid ${C.border}`, borderRadius:14,
              padding:16, display:'grid', gridTemplateColumns:'140px 1fr', gap:16,
            }}>
              {/* Thumbnail/preview */}
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {v.thumbnail_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={v.thumbnail_url} alt="" style={{
                    width:140, height:248, objectFit:'cover',
                    borderRadius:10, background:C.bg,
                  }}/>
                ) : (
                  <div style={{
                    width:140, height:248, borderRadius:10, background:C.bg,
                    display:'flex', alignItems:'center', justifyContent:'center',
                    color:C.faint, fontSize:32,
                  }}>🎬</div>
                )}
                <div style={{
                  fontSize:10, fontWeight:800, textAlign:'center',
                  color:statusColor, textTransform:'uppercase', letterSpacing:'0.07em',
                }}>
                  {v.heygen_status}
                </div>
              </div>

              <div style={{ display:'flex', flexDirection:'column', gap:10, minWidth:0 }}>
                <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
                  <span style={{
                    background:`${C.cyan}22`, color:C.cyan, padding:'3px 8px',
                    borderRadius:6, fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em',
                  }}>
                    {PILLAR_LABEL[v.pillar] || v.pillar}
                  </span>
                  <span style={{ fontSize:11, color:C.muted }}>
                    {v.scheduled_for}
                  </span>
                  {v.duration_seconds && (
                    <span style={{ fontSize:11, color:C.muted }}>
                      · {Math.round(v.duration_seconds)}s
                    </span>
                  )}
                  {v.published_at && (
                    <span style={{
                      background:`${C.green}22`, color:C.green, padding:'3px 8px',
                      borderRadius:6, fontSize:10, fontWeight:700, textTransform:'uppercase',
                    }}>
                      Publicado
                    </span>
                  )}
                </div>

                <div style={{ fontWeight:700, fontSize:14, color:C.text }}>
                  {v.topic}
                </div>

                <div style={{
                  background:C.bg, border:`1px solid ${C.border}`, borderRadius:8,
                  padding:10, fontSize:12, color:C.muted, lineHeight:1.5,
                }}>
                  <div style={{ fontSize:10, fontWeight:700, color:C.faint, marginBottom:6, textTransform:'uppercase' }}>
                    Guion (lo que dice el avatar)
                  </div>
                  {v.script}
                </div>

                {v.caption && (
                  <div style={{
                    background:C.bg, border:`1px solid ${C.border}`, borderRadius:8,
                    padding:10, fontSize:12, color:C.muted, lineHeight:1.5,
                  }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                      <span style={{ fontSize:10, fontWeight:700, color:C.faint, textTransform:'uppercase' }}>
                        Caption para post
                      </span>
                      <button onClick={() => copy(
                        v.caption + (v.hashtags?.length ? '\n\n' + v.hashtags.map(h=>'#'+h).join(' ') : '')
                      )} style={{
                        background:'transparent', border:'none', color:C.cyan,
                        fontSize:10, fontWeight:700, cursor:'pointer',
                      }}>
                        COPIAR
                      </button>
                    </div>
                    {v.caption}
                    {v.hashtags?.length ? (
                      <div style={{ marginTop:8, fontSize:11, color:C.cyan }}>
                        {v.hashtags.map(h => '#' + h).join(' ')}
                      </div>
                    ) : null}
                  </div>
                )}

                {v.error && (
                  <div style={{
                    background:`${C.accent}11`, border:`1px solid ${C.accent}44`, borderRadius:8,
                    padding:10, fontSize:12, color:C.accent,
                  }}>
                    ⚠ {v.error}
                  </div>
                )}

                <div style={{ display:'flex', gap:8, marginTop:'auto', flexWrap:'wrap' }}>
                  {v.video_url && (
                    <a href={v.video_url} target="_blank" rel="noreferrer"
                      style={{
                        padding:'7px 14px', borderRadius:8, border:'none',
                        background:C.cyan, color:'#000', fontSize:11, fontWeight:700,
                        textDecoration:'none', cursor:'pointer',
                        fontFamily:'IBM Plex Mono, monospace',
                      }}>
                      ⬇ DESCARGAR .MP4
                    </a>
                  )}
                  {v.cta_url && (
                    <a href={v.cta_url} target="_blank" rel="noreferrer"
                      style={{
                        padding:'7px 14px', borderRadius:8,
                        border:`1px solid ${C.border}`, background:'transparent',
                        color:C.muted, fontSize:11, fontWeight:700,
                        textDecoration:'none',
                        fontFamily:'IBM Plex Mono, monospace',
                      }}>
                      🔗 CTA: {new URL(v.cta_url).pathname}
                    </a>
                  )}
                  {v.heygen_status === 'completed' && !v.published_at && (
                    <button onClick={() => markPublished(v.id)} disabled={pending}
                      style={{
                        padding:'7px 14px', borderRadius:8,
                        border:`1px solid ${C.green}`, background:'transparent',
                        color:C.green, fontSize:11, fontWeight:700,
                        cursor:pending?'not-allowed':'pointer',
                        fontFamily:'IBM Plex Mono, monospace',
                      }}>
                      ✓ MARCAR PUBLICADO
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
