'use client'

import { useEffect, useState, useTransition } from 'react'
import toast from 'react-hot-toast'

// ─── Pestaña Plantillas WhatsApp ───────────────────────────────────────
// El proveedor mantiene una biblioteca de respuestas rápidas para
// contestar a SUS clientes en 2 clics. La primera vez que abre la
// pestaña se siembran 9 plantillas universales agrupadas por momento
// de conversación (consulta / presupuesto / confirmación / seguimiento
// / rechazo / agradecimiento).
//
// Placeholders soportados: {{nombre}} {{fecha}} {{ciudad}} {{invitados}}
//                          {{precio}} {{enlace}}
// Al pulsar "Usar" → modal rellena placeholders + ofrece copiar o
// abrir wa.me con el texto y un teléfono. La IA opcional ayuda a
// crear plantillas nuevas a partir de una descripción libre.

type Tpl = {
  id:         string
  label:      string
  body:       string
  category:   string | null
  use_count:  number
}

const CATS: Array<{ id: string; label: string; icon: string }> = [
  { id:'consulta',       label:'Consulta inicial',      icon:'💬' },
  { id:'presupuesto',    label:'Presupuesto',           icon:'📄' },
  { id:'confirmacion',   label:'Confirmación reserva',  icon:'✅' },
  { id:'seguimiento',    label:'Seguimiento',           icon:'📞' },
  { id:'rechazo',        label:'Rechazo amable',        icon:'😔' },
  { id:'agradecimiento', label:'Agradecimiento',        icon:'🌟' },
]

const PLACEHOLDERS = ['nombre', 'fecha', 'ciudad', 'invitados', 'precio', 'enlace']

export default function QuickRepliesTab({ providerId }: { providerId: string }) {
  const [tpls,     setTpls]     = useState<Tpl[]>([])
  const [loading,  setLoading]  = useState(true)
  const [editing,  setEditing]  = useState<Tpl | null>(null)
  const [usingTpl, setUsingTpl] = useState<Tpl | null>(null)
  const [aiOpen,   setAiOpen]   = useState(false)
  const [pending, startTransition] = useTransition()

  async function load() {
    setLoading(true)
    try {
      const r = await fetch(`/api/proveedor/quick-replies?providerId=${providerId}`, {
        credentials: 'include',
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Error')
      setTpls(d.templates || [])
      if (d.seeded) toast.success('Hemos creado 9 plantillas para empezar ✨')
    } catch (e: any) {
      toast.error(e?.message || 'Error')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [providerId])

  async function save(t: { id?: string; label: string; body: string; category: string | null }) {
    try {
      const r = await fetch('/api/proveedor/quick-replies', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerId, ...t }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Error')
      toast.success('Guardado')
      setEditing(null)
      await load()
    } catch (e: any) {
      toast.error(e?.message || 'Error')
    }
  }

  async function remove(id: string) {
    if (!confirm('¿Eliminar esta plantilla?')) return
    try {
      const r = await fetch(`/api/proveedor/quick-replies?providerId=${providerId}&id=${id}`, {
        method: 'DELETE', credentials: 'include',
      })
      if (!r.ok) throw new Error('Error')
      toast.success('Eliminada')
      await load()
    } catch (e: any) {
      toast.error(e?.message || 'Error')
    }
  }

  function markUsed(id: string) {
    fetch('/api/proveedor/quick-replies', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ providerId, id }),
    }).catch(() => {})
  }

  const byCategory = CATS.map(c => ({
    ...c,
    items: tpls.filter(t => (t.category || 'otros') === c.id),
  }))
  const huerfanas = tpls.filter(t => !CATS.find(c => c.id === t.category))

  return (
    <div>
      <div style={{ marginBottom: 14, display: 'flex', justifyContent: 'space-between',
        alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, marginBottom: 6 }}>
            💬 Plantillas WhatsApp
          </h2>
          <div style={{ fontSize: 13, color: '#6B7280' }}>
            Responde a tus clientes en 2 clics. Edita las que vienen por defecto o crea las tuyas.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setAiOpen(true)} style={btnSecondary}>
            ✨ Crear con IA
          </button>
          <button onClick={() => setEditing({ id: '', label: '', body: '', category: 'consulta', use_count: 0 })}
            style={btnPrimary}>
            + Nueva plantilla
          </button>
        </div>
      </div>

      {loading && <div style={{ color: '#9CA3AF', fontSize: 13 }}>Cargando…</div>}

      {!loading && byCategory.map(group => (
        group.items.length === 0 ? null : (
          <div key={group.id} style={{ marginBottom: 18 }}>
            <h3 style={{ fontSize: 11, fontWeight: 700, color: '#6B7280',
              textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
              {group.icon} {group.label} <span style={{ color: '#9CA3AF', fontWeight: 400 }}>· {group.items.length}</span>
            </h3>
            <div style={{ display: 'grid', gap: 8 }}>
              {group.items.map(t => (
                <TplCard key={t.id} t={t}
                  onUse={() => setUsingTpl(t)}
                  onEdit={() => setEditing(t)}
                  onDelete={() => remove(t.id)}/>
              ))}
            </div>
          </div>
        )
      ))}

      {huerfanas.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <h3 style={{ fontSize: 11, fontWeight: 700, color: '#6B7280',
            textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
            📁 Otros · {huerfanas.length}
          </h3>
          <div style={{ display: 'grid', gap: 8 }}>
            {huerfanas.map(t => (
              <TplCard key={t.id} t={t}
                onUse={() => setUsingTpl(t)}
                onEdit={() => setEditing(t)}
                onDelete={() => remove(t.id)}/>
            ))}
          </div>
        </div>
      )}

      {editing && (
        <EditorModal tpl={editing} onClose={() => setEditing(null)} onSave={save} />
      )}
      {usingTpl && (
        <UseModal tpl={usingTpl}
          onClose={() => setUsingTpl(null)}
          onUsed={() => markUsed(usingTpl.id)}/>
      )}
      {aiOpen && (
        <AiModal providerId={providerId}
          onClose={() => setAiOpen(false)}
          onGenerated={(draft) => { setAiOpen(false); setEditing({ id: '', use_count: 0, ...draft }) }}/>
      )}
    </div>
  )
}

function TplCard({ t, onUse, onEdit, onDelete }: {
  t: Tpl; onUse: () => void; onEdit: () => void; onDelete: () => void
}) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: 12,
      display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'center',
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4, color: '#1F2937' }}>
          {t.label}
          {t.use_count > 0 && (
            <span style={{ marginLeft: 8, fontSize: 10, color: '#9CA3AF', fontWeight: 400 }}>
              usada {t.use_count}×
            </span>
          )}
        </div>
        <div style={{
          fontSize: 12, color: '#6B7280', whiteSpace: 'pre-wrap',
          overflow: 'hidden', display: '-webkit-box',
          WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
        }}>
          {t.body}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={onUse} style={{
          padding: '7px 14px', borderRadius: 7, border: 'none',
          background: '#25D366', color: '#fff', fontSize: 11, fontWeight: 700,
          cursor: 'pointer', whiteSpace: 'nowrap',
        }}>
          💬 Usar
        </button>
        <button onClick={onEdit} style={btnGhost}>✏️</button>
        <button onClick={onDelete} style={btnGhost}>🗑</button>
      </div>
    </div>
  )
}

function EditorModal({ tpl, onClose, onSave }: {
  tpl: Tpl
  onClose: () => void
  onSave: (t: { id?: string; label: string; body: string; category: string | null }) => void
}) {
  const [label,    setLabel]    = useState(tpl.label)
  const [body,     setBody]     = useState(tpl.body)
  const [category, setCategory] = useState(tpl.category || 'consulta')

  return (
    <Modal title={tpl.id ? 'Editar plantilla' : 'Nueva plantilla'} onClose={onClose}>
      <Field label="Etiqueta corta (visible en la lista)" value={label} onChange={setLabel}
        placeholder="Confirmar disponibilidad" />
      <div style={{ marginBottom: 12 }}>
        <label style={lbl}>Categoría</label>
        <select value={category} onChange={e => setCategory(e.target.value)} style={inputSty}>
          {CATS.map(c => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
        </select>
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={lbl}>Mensaje · placeholders: {PLACEHOLDERS.map(p => `{{${p}}}`).join(' ')}</label>
        <textarea value={body} onChange={e => setBody(e.target.value)}
          rows={9}
          style={{ ...inputSty, fontFamily: 'inherit', resize: 'vertical', minHeight: 140 }}/>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button onClick={onClose} style={btnSecondary}>Cancelar</button>
        <button onClick={() => onSave({ id: tpl.id || undefined, label, body, category })}
          disabled={!label || !body} style={btnPrimary}>
          Guardar
        </button>
      </div>
    </Modal>
  )
}

function UseModal({ tpl, onClose, onUsed }: { tpl: Tpl; onClose: () => void; onUsed: () => void }) {
  const used = PLACEHOLDERS.filter(p => tpl.body.includes(`{{${p}}}`))
  const [values, setValues] = useState<Record<string, string>>(
    () => Object.fromEntries(used.map(p => [p, '']))
  )
  const [phone, setPhone] = useState('')

  const filled = used.reduce((acc, p) => acc.replaceAll(`{{${p}}}`, values[p] || `{{${p}}}`), tpl.body)
  const cleanPhone = phone.replace(/[^\d]/g, '')

  function copy() {
    navigator.clipboard.writeText(filled).then(
      () => { toast.success('Copiado'); onUsed() },
      () => toast.error('No pude copiar')
    )
  }
  function openWa() {
    const url = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(filled)}`
      : `https://wa.me/?text=${encodeURIComponent(filled)}`
    window.open(url, '_blank')
    onUsed()
  }

  return (
    <Modal title={`💬 ${tpl.label}`} onClose={onClose}>
      {used.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <label style={lbl}>Rellena los datos</label>
          <div style={{ display: 'grid', gap: 6 }}>
            {used.map(p => (
              <input key={p} value={values[p]}
                onChange={e => setValues({ ...values, [p]: e.target.value })}
                placeholder={p}
                style={inputSty}/>
            ))}
          </div>
        </div>
      )}
      <div style={{ marginBottom: 12 }}>
        <label style={lbl}>Vista previa</label>
        <div style={{
          background: '#DCF8C6', padding: 12, borderRadius: 10, fontSize: 13,
          whiteSpace: 'pre-wrap', color: '#1F2937', maxHeight: 280, overflow: 'auto',
        }}>{filled}</div>
      </div>
      <Field label="Teléfono del cliente (opcional, abre WhatsApp con ese contacto)"
        value={phone} onChange={setPhone} placeholder="+34 612 345 678" />
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button onClick={copy} style={btnSecondary}>📋 Copiar</button>
        <button onClick={openWa} style={{
          padding: '8px 16px', borderRadius: 8, border: 'none',
          background: '#25D366', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
        }}>
          💬 Abrir WhatsApp
        </button>
      </div>
    </Modal>
  )
}

function AiModal({ providerId, onClose, onGenerated }: {
  providerId: string
  onClose: () => void
  onGenerated: (t: { label: string; body: string; category: string | null }) => void
}) {
  const [prompt, setPrompt]  = useState('')
  const [pending, startTransition] = useTransition()

  function go() {
    if (prompt.trim().length < 5) { toast.error('Describe más la situación'); return }
    startTransition(async () => {
      try {
        const r = await fetch('/api/proveedor/quick-replies/generate', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ providerId, prompt }),
        })
        const d = await r.json()
        if (!r.ok) throw new Error(d.error || 'Error')
        onGenerated({ label: d.label, body: d.body, category: d.category })
      } catch (e: any) {
        toast.error(e?.message || 'Error')
      }
    })
  }

  return (
    <Modal title="✨ Crear plantilla con IA" onClose={onClose}>
      <p style={{ fontSize: 12, color: '#6B7280', marginBottom: 12, marginTop: 0 }}>
        Describe en una frase cuándo usarías esta respuesta. La IA te genera el texto
        listo para editar y guardar.
      </p>
      <textarea value={prompt} onChange={e => setPrompt(e.target.value)}
        rows={4}
        placeholder="Ej: cuando alguien me pide descuento por ser pareja amiga"
        style={{ ...inputSty, fontFamily: 'inherit', resize: 'vertical', minHeight: 80 }}/>
      <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button onClick={onClose} style={btnSecondary}>Cancelar</button>
        <button onClick={go} disabled={pending} style={btnPrimary}>
          {pending ? '⏳ Generando…' : '✨ Generar'}
        </button>
      </div>
    </Modal>
  )
}

function Modal({ title, children, onClose }: { title: string; children: any; onClose: () => void }) {
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 100,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#fff', borderRadius: 14, padding: 22, maxWidth: 560, width: '100%',
        maxHeight: '90vh', overflow: 'auto',
      }}>
        <h3 style={{ margin: 0, marginBottom: 16, fontSize: 17, fontWeight: 700 }}>{title}</h3>
        {children}
      </div>
    </div>
  )
}

function Field({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={lbl}>{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} style={inputSty}/>
    </div>
  )
}

const lbl = { fontSize: 10, fontWeight: 700, color: '#6B7280',
  textTransform: 'uppercase' as const, letterSpacing: '0.06em',
  display: 'block', marginBottom: 4 }
const inputSty = { width: '100%', padding: '8px 10px',
  border: '1px solid #D1D5DB', borderRadius: 7, fontSize: 13,
  outline: 'none', background: '#F9FAFB', boxSizing: 'border-box' as const }
const btnPrimary = { padding: '8px 16px', borderRadius: 8, border: 'none',
  background: '#C0392B', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }
const btnSecondary = { padding: '8px 16px', borderRadius: 8, border: '1px solid #D1D5DB',
  background: '#fff', color: '#1F2937', fontSize: 13, fontWeight: 600, cursor: 'pointer' }
const btnGhost = { padding: '7px 9px', borderRadius: 7, border: '1px solid #E5E7EB',
  background: '#fff', color: '#6B7280', fontSize: 12, cursor: 'pointer' }
