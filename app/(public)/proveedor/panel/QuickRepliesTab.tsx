'use client'

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { formatEuro } from '@/lib/pricing'

// Fecha larga en español para labels del selector y placeholder {{fecha}}.
function fmtDate(iso: string | null): string {
  if (!iso) return 'sin fecha'
  const d = new Date(iso + 'T00:00:00')
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: '2-digit' })
}

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

// Contacto = reserva confirmada o presupuesto generado (los que la IA
// puede usar para prellenar placeholders). Los merge-eamos de bookings +
// quotes y los ordenamos por fecha DESC para que lo más reciente asome
// arriba del selector.
type Contact = {
  key:          string
  source:       'booking' | 'quote'
  label:        string   // "Ana García · reserva · 15 jun 26"
  name:         string
  phone:        string
  event_date:   string | null
  event_city:   string | null
  guest_count:  number | null
  amount:       number | null
  publicUrl:    string | null   // solo quotes: link al presupuesto
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
  const [contacts, setContacts] = useState<Contact[]>([])

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

  // Reservas + presupuestos → contactos para prellenar el modal. Los
  // filtramos a los que tienen algún dato útil (nombre + evento) y los
  // ordenamos por fecha DESC. Silencioso si algún endpoint falla.
  async function loadContacts() {
    try {
      const [bkRes, qtRes] = await Promise.all([
        fetch(`/api/proveedor/bookings?id=${providerId}`, { credentials: 'include' }),
        fetch(`/api/proveedor/quotes/list?providerId=${providerId}`, { credentials: 'include' }),
      ])
      const bkData = bkRes.ok ? await bkRes.json() : { bookings: [] }
      const qtData = qtRes.ok ? await qtRes.json() : { quotes: [] }

      const fromBookings: Contact[] = (bkData.bookings || [])
        .filter((b: any) => !b._masked && b.client_name)
        .map((b: any) => ({
          key:         `b:${b.id}`,
          source:      'booking' as const,
          label:       `${b.client_name} · reserva · ${fmtDate(b.event_date)}`,
          name:        b.client_name || '',
          phone:       b.client_phone || '',
          event_date:  b.event_date || null,
          event_city:  b.event_city || null,
          guest_count: b.guest_count || null,
          amount:      b.total_amount || null,
          publicUrl:   null,
        }))

      const fromQuotes: Contact[] = (qtData.quotes || [])
        .filter((q: any) => q.client_name)
        .map((q: any) => ({
          key:         `q:${q.id}`,
          source:      'quote' as const,
          label:       `${q.client_name} · presupuesto · ${fmtDate(q.event_date)}`,
          name:        q.client_name || '',
          phone:       q.client_phone || '',
          event_date:  q.event_date || null,
          event_city:  q.event_city || null,
          guest_count: q.guest_count || null,
          amount:      q.total_amount || null,
          publicUrl:   `${window.location.origin}/q/${q.public_id}`,
        }))

      const merged = [...fromBookings, ...fromQuotes].sort((a, b) => {
        const da = a.event_date || ''
        const db = b.event_date || ''
        return db.localeCompare(da)
      })
      setContacts(merged)
    } catch {
      // Los contactos son opcionales, no interrumpimos si fallan.
    }
  }

  useEffect(() => { load(); loadContacts() }, [providerId])

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
        <UseModal tpl={usingTpl} contacts={contacts}
          onClose={() => setUsingTpl(null)}
          onUsed={() => markUsed(usingTpl.id)}/>
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

function UseModal({ tpl, contacts, onClose, onUsed }: {
  tpl: Tpl; contacts: Contact[]; onClose: () => void; onUsed: () => void
}) {
  const used = PLACEHOLDERS.filter(p => tpl.body.includes(`{{${p}}}`))
  const [values, setValues] = useState<Record<string, string>>(
    () => Object.fromEntries(used.map(p => [p, '']))
  )
  const [phone, setPhone] = useState('')

  const filled = used.reduce((acc, p) => acc.replaceAll(`{{${p}}}`, values[p] || `{{${p}}}`), tpl.body)

  // Normalización: WhatsApp exige internacional sin '+'. Un móvil español
  // de 9 dígitos empezando por 6/7 → le prependemos '34'. Los demás los
  // dejamos como los teclee el proveedor (asumimos que ya llevan código).
  let cleanPhone = phone.replace(/[^\d]/g, '')
  if (cleanPhone.length === 9 && /^[67]/.test(cleanPhone)) cleanPhone = '34' + cleanPhone

  // Prellenar todos los campos del modal desde una reserva o presupuesto
  // previo que el proveedor tenga en FiestaGo. Solo escribe los
  // placeholders que la plantilla usa (los demás no molestan).
  function prefillFromContact(key: string) {
    const c = contacts.find(x => x.key === key)
    if (!c) return
    const next = { ...values }
    if (used.includes('nombre')    && c.name)          next.nombre    = c.name.split(' ')[0]
    if (used.includes('fecha')     && c.event_date)    next.fecha     = fmtDate(c.event_date)
    if (used.includes('ciudad')    && c.event_city)    next.ciudad    = c.event_city
    if (used.includes('invitados') && c.guest_count)   next.invitados = String(c.guest_count)
    if (used.includes('precio')    && c.amount)        next.precio    = formatEuro(c.amount)
    if (used.includes('enlace')    && c.publicUrl)     next.enlace    = c.publicUrl
    setValues(next)
    if (c.phone) setPhone(c.phone)
  }

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
      {contacts.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <label style={lbl}>Prellenar desde reserva o presupuesto (opcional)</label>
          <select onChange={e => prefillFromContact(e.target.value)}
            defaultValue=""
            style={inputSty}>
            <option value="">— Escribir a mano —</option>
            {contacts.slice(0, 50).map(c => (
              <option key={c.key} value={c.key}>{c.label}</option>
            ))}
          </select>
        </div>
      )}
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
