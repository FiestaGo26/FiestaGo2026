'use client'

import { useEffect, useState, useTransition } from 'react'
import toast from 'react-hot-toast'
import { formatEuro } from '@/lib/pricing'
import QuotePrefsCard from './QuotePrefsCard'

// ─── Pestaña Presupuestos IA · panel del proveedor ──────────────────────
// El proveedor:
//   1. Pega/escribe el brief del cliente (texto libre).
//   2. Añade datos del evento (fecha, ciudad, invitados, contacto cliente).
//   3. Pulsa "Generar" → IA redacta el presupuesto en ~10s.
//   4. Recibe el link público listo para compartir + botones de copia
//      al portapapeles y abrir WhatsApp con el mensaje pre-rellenado.
//   5. Lista cronológica de presupuestos anteriores con estado
//      (draft / shared / viewed / accepted / rejected).

type Quote = {
  id:                   string
  public_id:            string
  client_name:          string | null
  event_date:           string | null
  event_city:           string | null
  guest_count:          number | null
  total_amount:         number | null
  status:               'draft' | 'shared' | 'viewed' | 'accepted' | 'rejected'
  shared_at:            string | null
  viewed_by_client_at:  string | null
  accepted_at:          string | null
  rejected_at:          string | null
  created_at:           string
}

const STATUS_LABEL: Record<string, string> = {
  draft:    'Borrador',
  shared:   'Compartido',
  viewed:   'Visto',
  accepted: 'Aceptado',
  rejected: 'Rechazado',
}
const STATUS_COLOR: Record<string, string> = {
  draft:    '#9CA3AF',
  shared:   '#06B6D4',
  viewed:   '#F59E0B',
  accepted: '#10B981',
  rejected: '#EF4444',
}

export default function QuotesTab({ providerId, onGoTab }: {
  providerId: string
  onGoTab?: (tab: string) => void
}) {
  const [quotes, setQuotes]   = useState<Quote[]>([])
  const [loading, setLoading] = useState(true)
  const [pending, startTransition] = useTransition()

  // Form fields
  const [brief,       setBrief]       = useState('')
  const [clientName,  setClientName]  = useState('')
  const [clientPhone, setClientPhone] = useState('')
  const [eventDate,   setEventDate]   = useState('')
  const [eventCity,   setEventCity]   = useState('')
  const [guestCount,  setGuestCount]  = useState<string>('')

  async function load() {
    setLoading(true)
    try {
      const res  = await fetch(`/api/proveedor/quotes/list?providerId=${providerId}`, {
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error')
      setQuotes(data.quotes || [])
    } catch (e: any) {
      toast.error(e?.message || 'Error al cargar')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [providerId])

  function generate() {
    if (brief.trim().length < 20) {
      toast.error('El brief debe tener al menos 20 caracteres')
      return
    }
    startTransition(async () => {
      try {
        const res = await fetch('/api/proveedor/quotes/generate', {
          method:  'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            providerId,
            brief,
            client_name:  clientName  || null,
            client_phone: clientPhone || null,
            event_date:   eventDate   || null,
            event_city:   eventCity   || null,
            guest_count:  guestCount  ? Number(guestCount) : null,
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Error generando')
        toast.success('Presupuesto generado ✨')
        // Limpia el form
        setBrief(''); setClientName(''); setClientPhone('')
        setEventDate(''); setEventCity(''); setGuestCount('')
        await load()
        // Abre el preview en otra pestaña
        window.open(`/q/${data.public_id}`, '_blank')
      } catch (e: any) {
        toast.error(e?.message || 'Error')
      }
    })
  }

  function copyLink(publicId: string) {
    const url = `${window.location.origin}/q/${publicId}`
    navigator.clipboard.writeText(url).then(
      () => toast.success('Link copiado'),
      () => toast.error('No pude copiar')
    )
  }

  function shareWhatsApp(q: Quote) {
    const url = `${window.location.origin}/q/${q.public_id}`
    const name = q.client_name?.split(' ')[0] || 'hola'
    const text = `¡Hola ${name}! Te paso el presupuesto que me pediste. Lo tienes aquí: ${url}\n\nCualquier duda, me escribes 🙂`
    const phone = (q as any).client_phone || ''
    const cleanPhone = phone.replace(/[^\d]/g, '')
    const waUrl = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`
    // Marcar como shared
    fetch('/api/proveedor/quotes/mark-shared', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ providerId, id: q.id }),
    }).catch(() => {})
    window.open(waUrl, '_blank')
    load()
  }

  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, marginBottom: 6 }}>
          🧾 Presupuestos con IA
        </h2>
        <div style={{ fontSize: 13, color: '#6B7280' }}>
          Pega el brief del cliente y la IA te redacta un presupuesto profesional en 10 segundos.
          Luego lo compartes por WhatsApp con un link.
        </div>
      </div>

      {/* Preferencias de la IA — la IA usa esto + tus servicios + tus
          últimos presupuestos como ground truth en cada generación. */}
      <QuotePrefsCard providerId={providerId} onGoTab={onGoTab} />

      {/* Formulario */}
      <div style={{
        background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12,
        padding: 18, marginBottom: 22,
      }}>
        <label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280',
          textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>
          Brief del cliente *
        </label>
        <textarea value={brief} onChange={e => setBrief(e.target.value)}
          placeholder="Pega aquí el mensaje del cliente. Por ejemplo: 'Hola, busco fotógrafo para nuestra boda el 14 de junio en una finca de Valencia. Seremos 80 personas, ceremonia a las 18h y banquete después. ¿Cuánto costaría un reportaje completo con álbum?'"
          rows={6}
          style={{
            width: '100%', padding: '10px 12px', border: '1px solid #D1D5DB', borderRadius: 8,
            fontSize: 13, fontFamily: 'inherit', resize: 'vertical', minHeight: 100,
            outline: 'none', background: '#F9FAFB',
          }}/>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 10, marginTop: 12 }}>
          <Field label="Nombre cliente" value={clientName}
            onChange={setClientName} placeholder="Lucía García"/>
          <Field label="Teléfono cliente" value={clientPhone}
            onChange={setClientPhone} placeholder="+34 612 345 678"/>
          <Field label="Fecha evento" value={eventDate}
            onChange={setEventDate} placeholder="2026-09-14" type="date"/>
          <Field label="Ciudad" value={eventCity}
            onChange={setEventCity} placeholder="Valencia"/>
          <Field label="Nº invitados" value={guestCount}
            onChange={setGuestCount} placeholder="80" type="number"/>
        </div>

        <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={generate} disabled={pending}
            style={{
              padding: '10px 22px', borderRadius: 8, border: 'none',
              background: pending ? '#9CA3AF' : '#C0392B',
              color: '#fff', fontSize: 13, fontWeight: 700,
              cursor: pending ? 'not-allowed' : 'pointer',
            }}>
            {pending ? '⏳ Generando (10-15s)...' : '✨ Generar presupuesto'}
          </button>
        </div>
      </div>

      {/* Lista */}
      <h3 style={{ fontSize: 14, fontWeight: 700, color: '#6B7280',
        textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
        Tus presupuestos
      </h3>
      {loading && <div style={{ color: '#9CA3AF', fontSize: 13 }}>Cargando…</div>}
      {!loading && quotes.length === 0 && (
        <div style={{
          background: '#F9FAFB', border: '1px dashed #D1D5DB', borderRadius: 12,
          padding: 24, textAlign: 'center', color: '#6B7280', fontSize: 13,
        }}>
          Aún no has generado ningún presupuesto. Pega un brief arriba y prueba 🚀
        </div>
      )}

      <div style={{ display: 'grid', gap: 10 }}>
        {quotes.map(q => (
          <div key={q.id} style={{
            background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12,
            padding: 14, display: 'grid', gridTemplateColumns: '1fr auto', gap: 14,
            alignItems: 'center',
          }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
                marginBottom: 6 }}>
                <span style={{ fontWeight: 700, fontSize: 14, color: '#1F2937' }}>
                  {q.client_name || 'Cliente sin nombre'}
                </span>
                <span style={{
                  fontSize: 10, fontWeight: 800,
                  color: STATUS_COLOR[q.status] || '#9CA3AF',
                  background: (STATUS_COLOR[q.status] || '#9CA3AF') + '22',
                  padding: '2px 8px', borderRadius: 5, textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}>
                  {STATUS_LABEL[q.status] || q.status}
                </span>
                {q.event_date && (
                  <span style={{ fontSize: 12, color: '#6B7280' }}>
                    {q.event_date}{q.event_city ? ` · ${q.event_city}` : ''}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#1F2937' }}>
                {formatEuro(q.total_amount || 0)}
                {q.guest_count && (
                  <span style={{ fontSize: 12, color: '#6B7280', fontWeight: 400, marginLeft: 8 }}>
                    · {q.guest_count} invitados
                  </span>
                )}
              </div>
              <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>
                Generado {new Date(q.created_at).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}
                {q.viewed_by_client_at && ' · 👁 Visto por el cliente'}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <a href={`/q/${q.public_id}`} target="_blank" rel="noreferrer"
                style={{
                  padding: '7px 12px', borderRadius: 7, border: '1px solid #D1D5DB',
                  background: '#fff', color: '#1F2937', fontSize: 11, fontWeight: 600,
                  textDecoration: 'none', whiteSpace: 'nowrap',
                }}>
                👁 Ver
              </a>
              <button onClick={() => copyLink(q.public_id)} style={{
                padding: '7px 12px', borderRadius: 7, border: '1px solid #D1D5DB',
                background: '#fff', color: '#1F2937', fontSize: 11, fontWeight: 600,
                cursor: 'pointer', whiteSpace: 'nowrap',
              }}>
                🔗 Copiar link
              </button>
              <button onClick={() => shareWhatsApp(q)} style={{
                padding: '7px 12px', borderRadius: 7, border: 'none',
                background: '#25D366', color: '#fff', fontSize: 11, fontWeight: 700,
                cursor: 'pointer', whiteSpace: 'nowrap',
              }}>
                💬 WhatsApp
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Field({ label, value, onChange, placeholder, type = 'text' }: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
}) {
  return (
    <div>
      <label style={{ fontSize: 10, fontWeight: 700, color: '#6B7280',
        textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>
        {label}
      </label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%', padding: '8px 10px', border: '1px solid #D1D5DB', borderRadius: 7,
          fontSize: 13, outline: 'none', background: '#F9FAFB',
        }}/>
    </div>
  )
}
