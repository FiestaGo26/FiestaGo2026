'use client'

import { useEffect, useState, useTransition } from 'react'
import toast from 'react-hot-toast'

// ─── Pestaña Google Business ───────────────────────────────────────────
// El proveedor escribe un tema breve ("nuevo paquete bodas verano",
// "abrimos los domingos") y la IA le genera un post listo para
// pegar en su Perfil de Empresa de Google Maps.
//
// Por qué copia-y-pega y no auto-publish: la Business Profile API
// requiere aprobación de Google (programa Trusted Tester) que
// tarda 2-8 semanas. Mientras tanto, el copia-pega + deeplink a
// business.google.com/posts cubre el 100% del valor con 0 fricción.
//
// Roadmap: cuando Google nos apruebe la API, este mismo botón
// pasará a publicar directamente sin que el proveedor cambie nada.

type Post = {
  id:            string
  topic:         string | null
  body:          string
  cta_label:     string | null
  cta_url:       string | null
  status:        'draft' | 'copied' | 'published'
  published_at:  string | null
  created_at:    string
}

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  draft:     { label: 'Borrador',  color: '#9CA3AF' },
  copied:    { label: 'Copiado',   color: '#F59E0B' },
  published: { label: 'Publicado', color: '#10B981' },
}

const TOPIC_IDEAS = [
  'Promoción de temporada',
  'Nuevo servicio o paquete',
  'Disponibilidad para este mes',
  'Testimonio de un cliente reciente',
  'Detrás de las cámaras de un evento',
  'Tip útil para parejas/familias',
]

export default function GmbTab({ providerId }: { providerId: string }) {
  const [posts,    setPosts]    = useState<Post[]>([])
  const [loading,  setLoading]  = useState(true)
  const [topic,    setTopic]    = useState('')
  const [pending, startTransition] = useTransition()

  async function load() {
    setLoading(true)
    try {
      const r = await fetch(`/api/proveedor/gmb?providerId=${providerId}`, {
        credentials: 'include',
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Error')
      setPosts(d.posts || [])
    } catch (e: any) {
      toast.error(e?.message || 'Error')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [providerId])

  function generate() {
    if (topic.trim().length < 5) {
      toast.error('Describe el tema con más detalle')
      return
    }
    startTransition(async () => {
      try {
        const r = await fetch('/api/proveedor/gmb', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ providerId, topic }),
        })
        const d = await r.json()
        if (!r.ok) throw new Error(d.error || 'Error')
        toast.success('Post generado ✨')
        setTopic('')
        await load()
      } catch (e: any) {
        toast.error(e?.message || 'Error')
      }
    })
  }

  async function setStatus(id: string, status: 'copied' | 'published') {
    try {
      await fetch('/api/proveedor/gmb', {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerId, id, status }),
      })
      await load()
    } catch {}
  }

  async function remove(id: string) {
    if (!confirm('¿Eliminar este post?')) return
    await fetch(`/api/proveedor/gmb?providerId=${providerId}&id=${id}`, {
      method: 'DELETE', credentials: 'include',
    })
    await load()
  }

  function copyAndOpen(p: Post) {
    const text = p.body + (p.cta_url ? `\n\n👉 ${p.cta_url}` : '')
    navigator.clipboard.writeText(text).then(
      () => {
        toast.success('Copiado · abriendo Google Business')
        setStatus(p.id, 'copied')
        setTimeout(() => window.open('https://business.google.com/posts', '_blank'), 400)
      },
      () => toast.error('No pude copiar')
    )
  }

  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, marginBottom: 6 }}>
          📍 Google Business Profile
        </h2>
        <div style={{ fontSize: 13, color: '#6B7280' }}>
          Genera posts optimizados para tu ficha de Google Maps con IA.
          Aparecerás más alto en búsquedas locales ("fotógrafo bodas {`<tu ciudad>`}").
        </div>
      </div>

      {/* Generador */}
      <div style={{
        background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12,
        padding: 18, marginBottom: 22,
      }}>
        <label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280',
          textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>
          Sobre qué quieres publicar
        </label>
        <textarea value={topic} onChange={e => setTopic(e.target.value)}
          placeholder="Ej: tengo libre el último fin de semana de agosto y quiero promocionar paquete bodas íntimas (max 40 personas) con 15% de descuento"
          rows={3}
          style={{
            width: '100%', padding: '10px 12px', border: '1px solid #D1D5DB', borderRadius: 8,
            fontSize: 13, fontFamily: 'inherit', resize: 'vertical', minHeight: 70,
            outline: 'none', background: '#F9FAFB', boxSizing: 'border-box',
          }}/>

        <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: '#9CA3AF', alignSelf: 'center' }}>Ideas:</span>
          {TOPIC_IDEAS.map(t => (
            <button key={t} onClick={() => setTopic(t)} style={{
              padding: '4px 10px', borderRadius: 99, border: '1px solid #E5E7EB',
              background: '#F9FAFB', color: '#6B7280', fontSize: 11, cursor: 'pointer',
            }}>{t}</button>
          ))}
        </div>

        <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={generate} disabled={pending}
            style={{
              padding: '10px 22px', borderRadius: 8, border: 'none',
              background: pending ? '#9CA3AF' : '#C0392B',
              color: '#fff', fontSize: 13, fontWeight: 700,
              cursor: pending ? 'not-allowed' : 'pointer',
            }}>
            {pending ? '⏳ Generando…' : '✨ Generar post'}
          </button>
        </div>
      </div>

      <h3 style={{ fontSize: 14, fontWeight: 700, color: '#6B7280',
        textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
        Tus posts
      </h3>
      {loading && <div style={{ color: '#9CA3AF', fontSize: 13 }}>Cargando…</div>}
      {!loading && posts.length === 0 && (
        <div style={{
          background: '#F9FAFB', border: '1px dashed #D1D5DB', borderRadius: 12,
          padding: 24, textAlign: 'center', color: '#6B7280', fontSize: 13,
        }}>
          Aún no has generado ningún post. Prueba describiendo un tema arriba 🚀
        </div>
      )}

      <div style={{ display: 'grid', gap: 12 }}>
        {posts.map(p => {
          const badge = STATUS_BADGE[p.status] || STATUS_BADGE.draft
          return (
            <div key={p.id} style={{
              background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 14,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
                marginBottom: 8 }}>
                <span style={{
                  fontSize: 10, fontWeight: 800, color: badge.color,
                  background: badge.color + '22', padding: '2px 8px', borderRadius: 5,
                  textTransform: 'uppercase', letterSpacing: '0.05em',
                }}>{badge.label}</span>
                {p.topic && (
                  <span style={{ fontSize: 12, color: '#6B7280', fontWeight: 500 }}>
                    {p.topic.slice(0, 80)}
                  </span>
                )}
                <span style={{ fontSize: 11, color: '#9CA3AF', marginLeft: 'auto' }}>
                  {new Date(p.created_at).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}
                </span>
              </div>
              <div style={{
                background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 8,
                padding: 12, fontSize: 13, whiteSpace: 'pre-wrap', color: '#1F2937',
                marginBottom: 12, fontFamily: 'inherit',
              }}>
                {p.body}
                {p.cta_url && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed #E5E7EB' }}>
                    <span style={{
                      display: 'inline-block', padding: '5px 12px', borderRadius: 6,
                      background: '#4285F4', color: '#fff', fontSize: 12, fontWeight: 600,
                    }}>
                      {p.cta_label || 'Más información'} → {p.cta_url}
                    </span>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button onClick={() => copyAndOpen(p)} style={{
                  padding: '8px 14px', borderRadius: 7, border: 'none',
                  background: '#4285F4', color: '#fff', fontSize: 12, fontWeight: 700,
                  cursor: 'pointer',
                }}>
                  📋 Copiar y abrir Google Business
                </button>
                {p.status !== 'published' && (
                  <button onClick={() => setStatus(p.id, 'published')} style={{
                    padding: '8px 14px', borderRadius: 7, border: '1px solid #10B981',
                    background: '#fff', color: '#10B981', fontSize: 12, fontWeight: 700,
                    cursor: 'pointer',
                  }}>
                    ✅ Marcar como publicado
                  </button>
                )}
                <button onClick={() => remove(p.id)} style={{
                  padding: '8px 12px', borderRadius: 7, border: '1px solid #E5E7EB',
                  background: '#fff', color: '#6B7280', fontSize: 12, cursor: 'pointer',
                  marginLeft: 'auto',
                }}>🗑</button>
              </div>
            </div>
          )
        })}
      </div>

      <div style={{
        marginTop: 24, padding: 12, background: '#EFF6FF', border: '1px solid #BFDBFE',
        borderRadius: 10, fontSize: 12, color: '#1E40AF',
      }}>
        💡 <strong>Próximamente:</strong> auto-publicación directa sin copia/pega
        cuando Google nos apruebe la integración con Business Profile API (en revisión).
      </div>
    </div>
  )
}
