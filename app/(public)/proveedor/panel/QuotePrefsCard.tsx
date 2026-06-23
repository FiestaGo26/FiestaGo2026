'use client'

import { useEffect, useState, useTransition } from 'react'
import toast from 'react-hot-toast'

// ─── Tarjeta colapsable de "Mis preferencias IA" ───────────────────────
// El proveedor enseña a la IA cómo construir SUS presupuestos:
//   · % de señal (anticipo)
//   · Validez del presupuesto en días
//   · Lo que SIEMPRE incluye (auto-añade a cada presupuesto)
//   · Lo que NUNCA incluye (lo cobra aparte para evitar malentendidos)
//   · Condiciones legales/operativas verbatim que siempre van
//   · Estilo (cercano / profesional / muy_formal)
//   · Notas libres de pricing ("siempre cobro desplazamiento si...")
//
// La IA usa esto como GROUND TRUTH cada vez que genera, junto con los
// servicios reales del proveedor (tabla provider_services) y sus
// últimos 3 presupuestos generados. Resultado: presupuestos cada vez
// más afinados a su forma real de cobrar.

type Prefs = {
  deposit_pct:        number
  validity_days:      number
  default_includes:   string[]
  default_excludes:   string[]
  default_conditions: string[]
  language_style:     'cercano' | 'profesional' | 'muy_formal'
  pricing_notes:      string | null
}

const STYLE_OPTS = [
  { id: 'cercano',     label: '😊 Cercano',   hint: 'Tú, frases naturales, "te incluimos"' },
  { id: 'profesional', label: '👔 Profesional', hint: 'Usted, frases pulidas, ligeramente formal' },
  { id: 'muy_formal',  label: '🏛️ Muy formal', hint: 'Usted, terminología técnica, tipo empresa grande' },
]

export default function QuotePrefsCard({ providerId }: { providerId: string }) {
  const [open,    setOpen]    = useState(false)
  const [loaded,  setLoaded]  = useState(false)
  const [pending, startTransition] = useTransition()

  const [depositPct,   setDepositPct]   = useState(30)
  const [validityDays, setValidityDays] = useState(30)
  const [includes,     setIncludes]     = useState('')
  const [excludes,     setExcludes]     = useState('')
  const [conditions,   setConditions]   = useState('')
  const [style,        setStyle]        = useState<'cercano'|'profesional'|'muy_formal'>('cercano')
  const [notes,        setNotes]        = useState('')

  async function load() {
    try {
      const r = await fetch(`/api/proveedor/quote-prefs?providerId=${providerId}`, {
        credentials: 'include',
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Error')
      const p: Prefs = d.prefs
      setDepositPct(p.deposit_pct || 30)
      setValidityDays(p.validity_days || 30)
      setIncludes((p.default_includes   || []).join('\n'))
      setExcludes((p.default_excludes   || []).join('\n'))
      setConditions((p.default_conditions || []).join('\n'))
      setStyle((p.language_style as any) || 'cercano')
      setNotes(p.pricing_notes || '')
      setLoaded(true)
    } catch (e: any) {
      toast.error(e?.message || 'Error al cargar preferencias')
    }
  }
  useEffect(() => { if (open && !loaded) load() }, [open, loaded])

  function save() {
    startTransition(async () => {
      try {
        const r = await fetch('/api/proveedor/quote-prefs', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            providerId,
            deposit_pct:        depositPct,
            validity_days:      validityDays,
            default_includes:   includes.split('\n').map(s => s.trim()).filter(Boolean),
            default_excludes:   excludes.split('\n').map(s => s.trim()).filter(Boolean),
            default_conditions: conditions.split('\n').map(s => s.trim()).filter(Boolean),
            language_style:     style,
            pricing_notes:      notes,
          }),
        })
        const d = await r.json()
        if (!r.ok) throw new Error(d.error || 'Error')
        toast.success('Preferencias guardadas — la IA las usará en el próximo presupuesto')
      } catch (e: any) {
        toast.error(e?.message || 'Error al guardar')
      }
    })
  }

  return (
    <div style={{
      background: '#F3F0FF', border: '1px solid #C4B5FD', borderRadius: 12,
      marginBottom: 18, overflow: 'hidden',
    }}>
      <button onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', padding: '12px 16px', background: 'transparent',
          border: 'none', cursor: 'pointer', fontSize: 13, color: '#5B21B6',
          fontWeight: 600,
        }}>
        <span>⚙️ Mis preferencias IA · enseña a la IA cómo construir tus presupuestos</span>
        <span style={{ fontSize: 18, transition: 'transform 0.2s', display: 'inline-block',
          transform: open ? 'rotate(45deg)' : 'rotate(0deg)' }}>+</span>
      </button>

      {open && (
        <div style={{ padding: '4px 16px 16px', borderTop: '1px solid #C4B5FD66' }}>
          <p style={{ fontSize: 12, color: '#5B21B6', margin: '8px 0 14px', lineHeight: 1.5 }}>
            La IA usa estas preferencias cada vez que genera un presupuesto, junto con tus servicios
            reales (pestaña Mis servicios) y tus últimos presupuestos. Cuanto más afines esto,
            más afinados serán tus presupuestos.
          </p>

          {/* Cifras */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            <Field label="% de señal (anticipo)" value={String(depositPct)}
              onChange={v => setDepositPct(Math.max(0, Math.min(100, Number(v) || 0)))}
              type="number" suffix="%"/>
            <Field label="Validez del presupuesto" value={String(validityDays)}
              onChange={v => setValidityDays(Math.max(1, Math.min(365, Number(v) || 30)))}
              type="number" suffix="días"/>
          </div>

          {/* Estilo */}
          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>Estilo de redacción</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
              {STYLE_OPTS.map(opt => (
                <button key={opt.id} onClick={() => setStyle(opt.id as any)}
                  type="button"
                  title={opt.hint}
                  style={{
                    padding: '8px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                    border: style === opt.id ? '2px solid #8B5CF6' : '1px solid #D1D5DB',
                    background: style === opt.id ? '#EDE9FE' : '#fff',
                    color: '#1F2937', cursor: 'pointer',
                  }}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Listas */}
          <TextareaField
            label="Lo que SIEMPRE incluyes (uno por línea)"
            value={includes} onChange={setIncludes}
            placeholder={'Cobertura completa del evento\nEdición profesional de las fotos\nEntrega en galería privada online'}/>

          <TextareaField
            label="Lo que NUNCA incluyes (lo cobras aparte — uno por línea)"
            value={excludes} onChange={setExcludes}
            placeholder={'Desplazamiento a más de 50km de Valencia\nMaquillaje y peluquería\nÁlbum impreso (cotizable aparte)'}/>

          <TextareaField
            label="Condiciones que SIEMPRE añades (verbatim — uno por línea)"
            value={conditions} onChange={setConditions}
            placeholder={'Las imágenes se entregan en máx. 30 días tras el evento\nLos derechos de uso comercial se cobran aparte\nCualquier cambio de fecha con menos de 30 días = nueva reserva'}/>

          {/* Notas libres */}
          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>
              Notas de pricing libres — cuéntale a la IA cosas que tiene que aplicar
            </label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              rows={4}
              placeholder={'Ejemplo: si la boda es de más de 100 invitados, añado un segundo fotógrafo (+800€). El precio mínimo de cualquier servicio es 600€. Los desplazamientos fuera de Valencia los cobro a 0.40€/km. Si es fin de semana puente, +15%.'}
              style={{ ...inputSty, fontFamily: 'inherit', resize: 'vertical', minHeight: 100 }}/>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button onClick={() => setOpen(false)} style={btnSecondary}>Cerrar</button>
            <button onClick={save} disabled={pending} style={{
              ...btnPrimary, opacity: pending ? 0.6 : 1, cursor: pending ? 'not-allowed' : 'pointer',
            }}>
              {pending ? 'Guardando…' : '✨ Guardar preferencias'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, value, onChange, type = 'text', suffix }: {
  label: string; value: string; onChange: (v: string) => void
  type?: string; suffix?: string
}) {
  return (
    <div>
      <label style={lbl}>{label}</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <input type={type} value={value} onChange={e => onChange(e.target.value)}
          style={{ ...inputSty, flex: 1 }}/>
        {suffix && <span style={{ fontSize: 12, color: '#6B7280', fontWeight: 600 }}>{suffix}</span>}
      </div>
    </div>
  )
}

function TextareaField({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={lbl}>{label}</label>
      <textarea value={value} onChange={e => onChange(e.target.value)}
        rows={3} placeholder={placeholder}
        style={{ ...inputSty, fontFamily: 'inherit', resize: 'vertical', minHeight: 70 }}/>
    </div>
  )
}

const lbl = { fontSize: 10, fontWeight: 700, color: '#6B7280',
  textTransform: 'uppercase' as const, letterSpacing: '0.06em',
  display: 'block', marginBottom: 4 }
const inputSty = { width: '100%', padding: '8px 10px',
  border: '1px solid #D1D5DB', borderRadius: 7, fontSize: 13,
  outline: 'none', background: '#fff', boxSizing: 'border-box' as const }
const btnPrimary = { padding: '8px 16px', borderRadius: 8, border: 'none',
  background: '#8B5CF6', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }
const btnSecondary = { padding: '8px 16px', borderRadius: 8, border: '1px solid #D1D5DB',
  background: '#fff', color: '#1F2937', fontSize: 13, fontWeight: 600, cursor: 'pointer' }
