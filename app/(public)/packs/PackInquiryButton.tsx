'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import { formatEuro } from '@/lib/pricing'

// ─── Botón + modal de solicitud sobre un pack ──────────────────────────
// Como el pack no tiene proveedor asignado (es un combo que el admin
// orquesta a mano), la "reserva" aquí es un LEAD: dispara el flujo
// POST /api/bookings con pack_id pero sin provider_id. El admin recibe
// email y ve la solicitud en /admin → Reservas para asignar proveedores
// y cerrar con el cliente.

export default function PackInquiryButton({
  packId, packName, packPrice,
}: {
  packId:    string
  packName:  string
  packPrice: number
}) {
  const [open,    setOpen]    = useState(false)
  const [sending, setSending] = useState(false)
  const [done,    setDone]    = useState(false)

  const [name,    setName]    = useState('')
  const [email,   setEmail]   = useState('')
  const [phone,   setPhone]   = useState('')
  const [date,    setDate]    = useState('')
  const [city,    setCity]    = useState('')
  const [guests,  setGuests]  = useState('')
  const [message, setMessage] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name || !email || !date) {
      toast.error('Nombre, email y fecha son obligatorios')
      return
    }
    setSending(true)
    try {
      const r = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          booking_type: 'pack',
          pack_id:      packId,
          client_name:  name,
          client_email: email,
          client_phone: phone || null,
          event_date:   date,
          city:         city || null,
          guests:       guests ? Number(guests) : null,
          message,
          total_amount: packPrice,
        }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Error')
      setDone(true)
    } catch (err: any) {
      toast.error(err?.message || 'Error al enviar')
    } finally {
      setSending(false)
    }
  }

  function reset() {
    setOpen(false)
    setTimeout(() => {
      setDone(false)
      setName(''); setEmail(''); setPhone(''); setDate('')
      setCity(''); setGuests(''); setMessage('')
    }, 200)
  }

  return (
    <>
      <button onClick={() => setOpen(true)}
        className="w-full bg-coral text-white font-bold py-3 rounded-xl text-sm hover:bg-coral-dark transition-colors shadow-coral">
        Solicitar reserva →
      </button>

      {open && (
        <div onClick={reset} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: '#fff', borderRadius: 16, maxWidth: 520, width: '100%',
            maxHeight: '92vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
          }}>

            {done ? (
              <div style={{ padding: 36, textAlign: 'center' }}>
                <div style={{ fontSize: 48, marginBottom: 14 }}>✅</div>
                <h3 style={{ fontFamily: 'Georgia, serif', fontSize: 26, margin: 0, marginBottom: 12, color: '#1A1612' }}>
                  ¡Solicitud recibida!
                </h3>
                <p style={{ fontSize: 14, lineHeight: 1.6, color: '#5C534A', margin: 0, marginBottom: 22 }}>
                  Nuestro equipo te contactará en <strong>menos de 24h</strong> para confirmar disponibilidad
                  del <strong>{packName}</strong> y resolver cualquier duda. Te llegará confirmación a <strong>{email}</strong>.
                </p>
                <button onClick={reset} style={{
                  padding: '11px 28px', borderRadius: 10, border: 'none',
                  background: '#C0392B', color: '#fff', fontSize: 13, fontWeight: 700,
                  cursor: 'pointer',
                }}>
                  Cerrar
                </button>
              </div>
            ) : (
              <form onSubmit={submit}>
                <div style={{
                  background: 'linear-gradient(135deg, #C0392B 0%, #E8553E 100%)',
                  color: '#fff', padding: '22px 26px', borderRadius: '16px 16px 0 0',
                }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.15em',
                    textTransform: 'uppercase', opacity: 0.9, marginBottom: 4 }}>
                    Solicitar reserva
                  </div>
                  <div style={{ fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 500, lineHeight: 1.2 }}>
                    {packName}
                  </div>
                  <div style={{ fontSize: 13, opacity: 0.92, marginTop: 4 }}>
                    Desde <strong>{formatEuro(packPrice)}</strong> · Garantía de Éxito incluida
                  </div>
                </div>

                <div style={{ padding: '22px 26px' }}>
                  <p style={{ fontSize: 12, color: '#5C534A', marginTop: 0, marginBottom: 16 }}>
                    Rellena el formulario y te contactamos en <strong>menos de 24h</strong> para confirmar.
                    Sin compromiso, sin pago hasta que cerremos los detalles.
                  </p>

                  <Field label="Tu nombre *" value={name} onChange={setName} placeholder="Lucía García" />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <Field label="Email *" value={email} onChange={setEmail} placeholder="tu@email.com" type="email" />
                    <Field label="Teléfono" value={phone} onChange={setPhone} placeholder="+34 612 345 678" />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <Field label="Fecha del evento *" value={date} onChange={setDate} type="date" />
                    <Field label="Nº de invitados" value={guests} onChange={setGuests} placeholder="20" type="number" />
                  </div>
                  <Field label="Ciudad" value={city} onChange={setCity} placeholder="Madrid" />

                  <div style={{ marginBottom: 14 }}>
                    <label style={lbl}>Cuéntanos más (opcional)</label>
                    <textarea value={message} onChange={e => setMessage(e.target.value)}
                      rows={3} placeholder="Algún detalle especial, alergias, temática preferida…"
                      style={{ ...inputSty, fontFamily: 'inherit', resize: 'vertical', minHeight: 70 }}/>
                  </div>

                  <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
                    <button type="button" onClick={reset} style={btnSecondary}>Cancelar</button>
                    <button type="submit" disabled={sending} style={{
                      ...btnPrimary, opacity: sending ? 0.6 : 1, cursor: sending ? 'not-allowed' : 'pointer',
                    }}>
                      {sending ? 'Enviando…' : 'Enviar solicitud →'}
                    </button>
                  </div>

                  <p style={{ fontSize: 10, color: '#9CA3AF', textAlign: 'center',
                    marginTop: 14, marginBottom: 0, lineHeight: 1.5 }}>
                    🔒 Tu información solo se usa para contactarte sobre esta reserva.
                    Sin spam, sin newsletters automáticos.
                  </p>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  )
}

function Field({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void
  placeholder?: string; type?: string
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={lbl}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} style={inputSty}/>
    </div>
  )
}

const lbl = { fontSize: 10, fontWeight: 700, color: '#6B7280',
  textTransform: 'uppercase' as const, letterSpacing: '0.06em',
  display: 'block', marginBottom: 4 }
const inputSty = { width: '100%', padding: '9px 11px',
  border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 13,
  outline: 'none', background: '#F9FAFB', boxSizing: 'border-box' as const }
const btnPrimary = { padding: '10px 20px', borderRadius: 10, border: 'none',
  background: '#C0392B', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }
const btnSecondary = { padding: '10px 18px', borderRadius: 10, border: '1px solid #D1D5DB',
  background: '#fff', color: '#1F2937', fontSize: 13, fontWeight: 600, cursor: 'pointer' }
