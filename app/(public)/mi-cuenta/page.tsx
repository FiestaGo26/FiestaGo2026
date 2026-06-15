'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { formatEuro } from '@/lib/pricing'
import toast from 'react-hot-toast'

type Booking = {
  id: string
  created_at: string
  booking_type: string
  event_date: string
  event_type: string
  client_name: string
  client_email: string
  client_phone: string | null
  guests: number | null
  message: string | null
  total_amount: number
  status: string
  city: string | null
  provider_id: string | null
  pack_id: string | null
  review_rating: number | null
  review_text: string | null
  reviewed_at: string | null
  providers?: { name: string; category: string; city: string; photo_idx: number; slug: string | null } | null
  packs?: { name: string; emoji: string | null; color: string | null } | null
}

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const DAYS   = ['L','M','X','J','V','S','D']

function getDaysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate() }
function getFirstDay(y: number, m: number) { const d = new Date(y, m, 1).getDay(); return d === 0 ? 6 : d - 1 }

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  pending:   { label: 'Pendiente',  color: 'bg-amber-100 text-amber-800 border-amber-200' },
  confirmed: { label: 'Confirmada', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  cancelled: { label: 'Cancelada',  color: 'bg-rose-100 text-rose-800 border-rose-200' },
  completed: { label: 'Realizada',  color: 'bg-blue-100 text-blue-800 border-blue-200' },
}

export default function MiCuentaPage() {
  const router   = useRouter()
  const supabase = createClient()

  const [user,      setUser]      = useState<any>(null)
  const [bookings,  setBookings]  = useState<Booking[]>([])
  const [loading,   setLoading]   = useState(true)
  const [tab,       setTab]       = useState<'overview' | 'calendar' | 'bookings' | 'profile'>('overview')
  const [calMonth,  setCalMonth]  = useState(() => new Date().getMonth())
  const [calYear,   setCalYear]   = useState(() => new Date().getFullYear())

  const loadData = useCallback(async (email: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/bookings?email=${encodeURIComponent(email)}`)
      const data = await res.json()
      setBookings(data.bookings || [])
    } catch {
      setBookings([])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/login'); return }
      setUser(user)
      loadData(user.email!)
    })
  }, [router, supabase, loadData])

  async function handleLogout() {
    await supabase.auth.signOut()
    toast.success('Sesión cerrada')
    router.push('/')
  }

  if (loading) return (
    <div className="min-h-screen bg-cream flex items-center justify-center">
      <div className="text-ink/40">Cargando tu cuenta...</div>
    </div>
  )

  // Stats
  const now           = new Date()
  const upcoming      = bookings.filter(b => new Date(b.event_date) >= now && b.status !== 'cancelled')
  const past          = bookings.filter(b => new Date(b.event_date) <  now || b.status === 'completed')
  const totalSpent    = bookings.filter(b => b.status !== 'cancelled').reduce((sum, b) => sum + (b.total_amount || 0), 0)
  const meta          = user?.user_metadata || {}
  const displayName   = meta.full_name || user?.email?.split('@')[0] || 'Socio'

  // Calendar
  const bookingsByDate = bookings.reduce((acc: Record<string, Booking[]>, b) => {
    const d = b.event_date.slice(0, 10)
    if (!acc[d]) acc[d] = []
    acc[d].push(b)
    return acc
  }, {})
  const daysInMonth   = getDaysInMonth(calYear, calMonth)
  const firstDay      = getFirstDay(calYear, calMonth)
  const calendarCells = Array(firstDay).fill(null).concat(Array.from({ length: daysInMonth }, (_, i) => i + 1))

  return (
    <div className="min-h-screen bg-cream py-10 px-6">
      <div className="max-w-5xl mx-auto">

        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 mb-6">
          <div>
            <div className="text-xs font-bold tracking-widest uppercase text-coral mb-2">✨ Cuenta de socio</div>
            <h1 className="font-serif text-3xl md:text-4xl font-black text-ink">Hola, {displayName}</h1>
            <p className="text-ink/55 text-sm mt-1">{user?.email}</p>
          </div>
          <button onClick={handleLogout}
            className="text-xs font-semibold text-ink/55 border border-stone-200 rounded-xl px-4 py-2 hover:border-coral hover:text-coral transition-colors self-start md:self-auto">
            Cerrar sesión
          </button>
        </div>

        {/* TABS */}
        <div className="flex flex-wrap gap-2 mb-6 border-b border-stone-200">
          {([
            ['overview',  '📊 Resumen'],
            ['calendar',  '📅 Calendario'],
            ['bookings',  '📋 Mis reservas'],
            ['profile',   '👤 Perfil'],
          ] as const).map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)}
              className={`text-sm font-semibold px-4 py-3 transition-all border-b-2 ${
                tab === id ? 'border-coral text-coral' : 'border-transparent text-ink/55 hover:text-ink'
              }`}>
              {label}
            </button>
          ))}
        </div>

        {/* OVERVIEW */}
        {tab === 'overview' && (
          <div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
              <Stat label="Próximas"   value={upcoming.length} accent="text-coral" />
              <Stat label="Realizadas" value={past.length}     accent="text-blue-600" />
              <Stat label="Total"      value={bookings.length} accent="text-ink"     />
              <Stat label="Gastado"    value={`${totalSpent.toLocaleString()}€`} accent="text-emerald-700" small />
            </div>

            {/* Próximas reservas */}
            <h2 className="font-serif text-2xl font-bold text-ink mb-3">Próximas celebraciones</h2>
            {upcoming.length === 0 ? (
              <EmptyState
                emoji="🎉"
                title="Aún no tienes reservas futuras"
                hint="Explora el catálogo y reserva tu próxima fiesta."
                cta={{ label: 'Ver servicios', href: '/servicios' }}
              />
            ) : (
              <div className="space-y-3 mb-8">
                {upcoming.slice(0, 5).map(b => <BookingCard key={b.id} booking={b} onReviewed={u => setBookings(prev => prev.map(x => x.id === u.id ? { ...x, ...u } : x))} />)}
              </div>
            )}

            {/* Beneficios socio */}
            <div className="bg-gradient-to-br from-coral/10 via-amber-50 to-rose-50 border border-coral/20 rounded-2xl p-6">
              <div className="text-xs font-bold tracking-widest uppercase text-coral mb-2">✨ Beneficios de socio</div>
              <h3 className="font-serif text-xl font-bold text-ink mb-3">Eres parte del club</h3>
              <ul className="text-sm text-ink/75 space-y-1.5">
                <li>🎁 1ª transacción sin comisión (0%)</li>
                <li>💸 Descuentos exclusivos cada mes (próximamente)</li>
                <li>📅 Tu calendario de celebraciones en un solo sitio</li>
                <li>💌 Novedades de proveedores que sigues</li>
              </ul>
            </div>
          </div>
        )}

        {/* CALENDAR */}
        {tab === 'calendar' && (
          <div className="bg-white border border-stone-200 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-serif text-2xl font-bold text-ink">{MONTHS[calMonth]} {calYear}</h2>
              <div className="flex gap-2">
                <button onClick={() => {
                  const newM = calMonth === 0 ? 11 : calMonth - 1
                  const newY = calMonth === 0 ? calYear - 1 : calYear
                  setCalMonth(newM); setCalYear(newY)
                }} className="border border-stone-200 rounded-xl px-3 py-1.5 text-sm text-ink/65 hover:border-coral">←</button>
                <button onClick={() => { setCalMonth(new Date().getMonth()); setCalYear(new Date().getFullYear()) }}
                  className="border border-stone-200 rounded-xl px-3 py-1.5 text-sm text-ink/65 hover:border-coral">Hoy</button>
                <button onClick={() => {
                  const newM = calMonth === 11 ? 0 : calMonth + 1
                  const newY = calMonth === 11 ? calYear + 1 : calYear
                  setCalMonth(newM); setCalYear(newY)
                }} className="border border-stone-200 rounded-xl px-3 py-1.5 text-sm text-ink/65 hover:border-coral">→</button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1.5">
              {DAYS.map(d => (
                <div key={d} className="text-center text-[10px] font-bold tracking-widest uppercase text-ink/40 py-1.5">{d}</div>
              ))}
              {calendarCells.map((day, idx) => {
                if (day === null) return <div key={`empty-${idx}`} />
                const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                const dayBookings = bookingsByDate[dateStr] || []
                const isToday     = dateStr === new Date().toISOString().slice(0, 10)
                const hasBookings = dayBookings.length > 0
                return (
                  <div key={dateStr}
                    className={`aspect-square border rounded-xl p-1.5 text-xs flex flex-col items-center justify-start transition-all ${
                      hasBookings
                        ? 'bg-coral/10 border-coral cursor-pointer hover:bg-coral/15'
                        : 'border-stone-200 bg-white'
                    } ${isToday ? 'ring-2 ring-coral/50' : ''}`}>
                    <div className={`font-bold ${isToday ? 'text-coral' : hasBookings ? 'text-coral' : 'text-ink/65'}`}>
                      {day}
                    </div>
                    {hasBookings && (
                      <div className="text-[9px] text-coral mt-0.5 truncate w-full text-center">
                        {dayBookings.length === 1 ? '1 evento' : `${dayBookings.length} eventos`}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="text-xs text-ink/40 mt-4 flex items-center gap-3">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-coral/15 border border-coral inline-block"/> Día con celebración</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded ring-2 ring-coral/50 inline-block"/> Hoy</span>
            </div>
          </div>
        )}

        {/* BOOKINGS */}
        {tab === 'bookings' && (
          <div>
            <h2 className="font-serif text-2xl font-bold text-ink mb-4">Todas tus reservas</h2>
            {bookings.length === 0 ? (
              <EmptyState
                emoji="📋"
                title="No tienes reservas todavía"
                hint="Empieza explorando el catálogo de servicios."
                cta={{ label: 'Ver servicios', href: '/servicios' }}
              />
            ) : (
              <div className="space-y-3">
                {bookings.map(b => <BookingCard key={b.id} booking={b} onReviewed={u => setBookings(prev => prev.map(x => x.id === u.id ? { ...x, ...u } : x))} />)}
              </div>
            )}
          </div>
        )}

        {/* PROFILE */}
        {tab === 'profile' && (
          <ProfileTab user={user} />
        )}
      </div>
    </div>
  )
}

function Stat({ label, value, accent, small }: { label: string; value: any; accent: string; small?: boolean }) {
  return (
    <div className="bg-white border border-stone-200 rounded-2xl p-4 shadow-sm">
      <div className="text-[10px] font-bold tracking-widest uppercase text-ink/45 mb-1">{label}</div>
      <div className={`font-serif font-black ${accent} ${small ? 'text-xl' : 'text-3xl'}`}>{value}</div>
    </div>
  )
}

function EmptyState({ emoji, title, hint, cta }: { emoji: string; title: string; hint: string; cta?: { label: string; href: string } }) {
  return (
    <div className="bg-white border border-stone-200 rounded-2xl p-10 text-center">
      <div className="text-5xl mb-3">{emoji}</div>
      <div className="font-serif text-xl font-bold text-ink mb-2">{title}</div>
      <p className="text-ink/55 text-sm mb-5">{hint}</p>
      {cta && (
        <Link href={cta.href}
          className="inline-block bg-coral text-white font-bold text-sm px-5 py-2.5 rounded-xl hover:bg-coral-dark transition-colors">
          {cta.label} →
        </Link>
      )}
    </div>
  )
}

function BookingCard({ booking, onReviewed }: { booking: Booking; onReviewed?: (b: Partial<Booking> & { id: string }) => void }) {
  const status = STATUS_LABEL[booking.status] || STATUS_LABEL.pending
  const date   = new Date(booking.event_date)
  const dateF  = `${String(date.getDate()).padStart(2,'0')}/${String(date.getMonth()+1).padStart(2,'0')}/${date.getFullYear()}`
  const title  = booking.providers?.name || booking.packs?.name || 'Reserva'

  const today = new Date(); today.setHours(0, 0, 0, 0)
  const eventPassed   = date <= today
  const canChat       = !!booking.provider_id
    && ['confirmed', 'completed'].includes(booking.status)
  const canReview     = !!booking.provider_id && eventPassed
    && ['confirmed', 'completed'].includes(booking.status)
    && booking.review_rating == null
  const hasReview     = booking.review_rating != null
  // Puede reportar incidencia en cualquier reserva no cancelada que tenga
  // proveedor. Después la gestionamos en /admin contra la Garantía.
  const canReportIncident = !!booking.provider_id
    && booking.status !== 'cancelled'

  const [showChat,     setShowChat]     = useState(false)
  const [showIncident, setShowIncident] = useState(false)
  const [showForm,   setShowForm]   = useState(false)
  const [hover,      setHover]      = useState(0)
  const [rating,     setRating]     = useState(0)
  const [text,       setText]       = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function submitReview() {
    if (!rating) { toast.error('Elige una puntuación'); return }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/bookings/${booking.id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_email: booking.client_email,
          rating,
          text: text.trim() || null,
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || `Error ${res.status}`)
      toast.success('¡Gracias por tu reseña! ★')
      onReviewed?.({ id: booking.id, review_rating: rating, review_text: text.trim() || null, reviewed_at: new Date().toISOString() })
      setShowForm(false)
    } catch (err: any) {
      toast.error(err.message || 'No se pudo enviar la reseña')
    }
    setSubmitting(false)
  }

  return (
    <div className="bg-white border border-stone-200 rounded-2xl p-4 flex items-start gap-4 hover:shadow-md transition-shadow">
      <div className="w-12 h-12 rounded-xl bg-coral/15 flex items-center justify-center text-2xl shrink-0">
        {booking.packs?.emoji || (booking.booking_type === 'pack' ? '🎉' : '✨')}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2 mb-1">
          <h3 className="font-semibold text-ink truncate">{title}</h3>
          <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${status.color} whitespace-nowrap`}>
            {status.label}
          </span>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-ink/55 mb-2">
          <span>📅 {dateF}</span>
          {booking.city && <span>📍 {booking.city}</span>}
          {booking.guests && <span>👥 {booking.guests} invitados</span>}
        </div>
        {booking.message && (
          <p className="text-xs text-ink/60 italic line-clamp-2">"{booking.message}"</p>
        )}
        <div className="flex justify-between items-center mt-2 pt-2 border-t border-stone-100">
          <span className="text-xs text-ink/45 uppercase tracking-widest font-bold">Total</span>
          <span className="font-serif text-lg font-bold text-coral">{formatEuro(booking.total_amount)}</span>
        </div>

        {/* Reseña ya dejada */}
        {hasReview && (
          <div className="mt-3 pt-3 border-t border-stone-100">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] uppercase tracking-widest text-ink/45 font-bold">Tu reseña</span>
              <span className="text-coral text-sm">
                {Array.from({ length: 5 }).map((_, i) => (
                  <span key={i} className={i < (booking.review_rating || 0) ? '' : 'text-ink/15'}>★</span>
                ))}
              </span>
            </div>
            {booking.review_text && (
              <p className="text-xs text-ink/65 italic">"{booking.review_text}"</p>
            )}
          </div>
        )}

        {/* CTAs */}
        <div className="flex flex-wrap gap-3 mt-3">
          {canChat && (
            <button onClick={() => setShowChat(true)}
              className="text-xs font-bold text-coral hover:text-coral-dark transition-colors flex items-center gap-1">
              💬 Chat con {booking.providers?.name || 'el proveedor'}
            </button>
          )}
          {canReview && !showForm && (
            <button onClick={() => setShowForm(true)}
              className="text-xs font-bold text-coral hover:text-coral-dark transition-colors flex items-center gap-1">
              ★ Dejar reseña
            </button>
          )}
          {canReportIncident && (
            <button onClick={() => setShowIncident(true)}
              className="text-xs font-bold text-red-500 hover:text-red-700 transition-colors flex items-center gap-1">
              🚨 Reportar problema
            </button>
          )}
        </div>

        {/* Formulario de reseña */}
        {canReview && showForm && (
          <div className="mt-3 pt-3 border-t border-stone-100">
            <div className="text-[10px] uppercase tracking-widest text-ink/45 font-bold mb-2">¿Cómo fue tu experiencia?</div>
            <div className="flex items-center gap-1 mb-3" onMouseLeave={() => setHover(0)}>
              {[1,2,3,4,5].map(n => (
                <button key={n} type="button"
                  onMouseEnter={() => setHover(n)}
                  onClick={() => setRating(n)}
                  className="text-2xl leading-none transition-transform hover:scale-110"
                  style={{ color: n <= (hover || rating) ? '#E8553E' : '#E5E1D8' }}>
                  ★
                </button>
              ))}
              {rating > 0 && <span className="text-xs text-ink/55 ml-2">{rating}/5</span>}
            </div>
            <textarea value={text} onChange={e => setText(e.target.value)}
              rows={3} maxLength={1000}
              placeholder="Cuenta cómo fue (opcional, máx 1000 caracteres)"
              className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm text-ink outline-none focus:border-coral transition-colors resize-none"/>
            <div className="flex gap-2 mt-2">
              <button onClick={submitReview} disabled={submitting || !rating}
                className="bg-coral text-white font-bold text-xs px-4 py-2 rounded-xl hover:bg-coral-dark transition-colors disabled:opacity-50">
                {submitting ? 'Enviando...' : 'Publicar reseña'}
              </button>
              <button onClick={() => { setShowForm(false); setRating(0); setText('') }}
                className="text-xs text-ink/55 hover:text-ink px-3 transition-colors">
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
      {showChat && <ChatModal booking={booking} onClose={() => setShowChat(false)} />}
      {showIncident && <IncidentModal booking={booking} onClose={() => setShowIncident(false)} />}
    </div>
  )
}

function ChatModal({ booking, onClose }: { booking: Booking; onClose: () => void }) {
  const supabase = createClient()
  const [messages, setMessages]   = useState<any[]>([])
  const [loading,  setLoading]    = useState(true)
  const [input,    setInput]      = useState('')
  const [sending,  setSending]    = useState(false)

  useEffect(() => {
    let alive = true
    async function load() {
      const res  = await fetch(`/api/messages?booking_id=${booking.id}&role=client&token=${encodeURIComponent(booking.client_email)}`)
      const data = await res.json()
      if (!alive) return
      setMessages(data.messages || [])
      setLoading(false)
    }
    load()
    // Suscripción Realtime para recibir respuestas del proveedor en vivo
    const ch = supabase.channel(`chat-${booking.id}`)
      .on('postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'messages', filter: `booking_id=eq.${booking.id}` },
          (payload: any) => {
            setMessages(prev => prev.some(m => m.id === payload.new.id) ? prev : [...prev, payload.new])
          })
      .subscribe()
    return () => { alive = false; supabase.removeChannel(ch) }
  }, [booking.id, booking.client_email, supabase])

  async function send() {
    const text = input.trim()
    if (!text) return
    setSending(true)
    try {
      const res  = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          booking_id: booking.id,
          role: 'client',
          token: booking.client_email,
          body: text,
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || `Error ${res.status}`)
      setMessages(prev => [...prev, data.message])
      setInput('')
    } catch (err: any) {
      toast.error(err.message || 'No se pudo enviar')
    }
    setSending(false)
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose}/>
      <div className="relative w-full sm:max-w-lg bg-white sm:rounded-2xl shadow-2xl flex flex-col" style={{ height:'min(640px, 85vh)' }}>
        <div className="px-5 py-3 border-b border-stone-200 flex items-center justify-between gap-2">
          <div>
            <div className="text-sm font-semibold text-ink">{booking.providers?.name || 'Proveedor'}</div>
            <div className="text-[11px] text-ink/50">Evento {new Date(booking.event_date).toLocaleDateString('es-ES')}</div>
          </div>
          <button onClick={onClose}
            className="text-2xl text-ink/40 hover:text-ink leading-none px-2">×</button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4 bg-stone-50/50 space-y-2">
          {loading ? (
            <div className="text-center text-ink/40 text-sm py-10">Cargando...</div>
          ) : messages.length === 0 ? (
            <div className="text-center text-ink/40 text-sm py-10">
              Sé el primero en escribir. El proveedor recibirá tu mensaje en su panel.
            </div>
          ) : messages.map(m => {
            const mine = m.sender_role === 'client'
            const time = new Date(m.created_at).toLocaleTimeString('es-ES', { hour:'2-digit', minute:'2-digit' })
            return (
              <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm leading-snug ${mine ? 'bg-coral text-white' : 'bg-white border border-stone-200 text-ink'}`}>
                  <div className="whitespace-pre-wrap">{m.body}</div>
                  <div className={`text-[10px] mt-1 ${mine ? 'text-white/70' : 'text-ink/40'} text-right`}>{time}</div>
                </div>
              </div>
            )
          })}
        </div>
        <div className="border-t border-stone-200 p-3 flex gap-2">
          <input value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            placeholder="Escribe un mensaje..."
            maxLength={2000}
            className="flex-1 border border-stone-200 rounded-xl px-4 py-2 text-sm text-ink outline-none focus:border-coral transition-colors"/>
          <button onClick={send} disabled={sending || !input.trim()}
            className="bg-coral text-white font-bold text-sm px-5 py-2 rounded-xl hover:bg-coral-dark transition-colors disabled:opacity-50">
            {sending ? '...' : 'Enviar'}
          </button>
        </div>
      </div>
    </div>
  )
}

function IncidentModal({ booking, onClose }: { booking: Booking; onClose: () => void }) {
  const [type,        setType]        = useState<string>('quality')
  const [description, setDescription] = useState('')
  const [sending,     setSending]     = useState(false)
  const [done,        setDone]        = useState(false)
  const [error,       setError]       = useState<string | null>(null)

  const TYPES = [
    { id:'cancelled_by_provider', label:'El proveedor canceló la reserva' },
    { id:'no_show',               label:'El proveedor no se presentó' },
    { id:'quality',               label:'El servicio no fue lo prometido' },
    { id:'wrong_service',         label:'Recibí algo distinto a lo reservado' },
    { id:'payment',               label:'Problema con el pago o el cobro' },
    { id:'other',                 label:'Otro problema' },
  ]

  async function submit() {
    setError(null)
    if (description.trim().length < 20) {
      setError('Cuéntanos al menos 20 caracteres para entender qué pasó.')
      return
    }
    setSending(true)
    try {
      const res = await fetch('/api/incidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          booking_id:  booking.id,
          type,
          description: description.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || `Error ${res.status}`)
      setDone(true)
    } catch (err: any) {
      setError(err.message || 'No se pudo enviar la incidencia')
    }
    setSending(false)
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose}/>
      <div className="relative w-full sm:max-w-lg bg-white sm:rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-ink flex items-center gap-2">🚨 Reportar problema</div>
            <div className="text-[11px] text-ink/50">Reserva con {booking.providers?.name || 'el proveedor'} · {new Date(booking.event_date).toLocaleDateString('es-ES')}</div>
          </div>
          <button onClick={onClose} className="text-2xl text-ink/40 hover:text-ink leading-none px-2">×</button>
        </div>

        {done ? (
          <div className="p-8 text-center">
            <div className="text-5xl mb-3">📩</div>
            <h3 className="font-serif text-xl font-black text-ink mb-2">Incidencia recibida</h3>
            <p className="text-sm text-ink/65 leading-relaxed mb-5">
              Nuestro equipo la revisará en menos de 24h ({''}4h si la fecha del evento está cerca). Te avisaremos por email en cuanto tengamos una respuesta o necesitemos más información.
            </p>
            <button onClick={onClose}
              className="bg-ink text-white text-sm font-bold px-6 py-2.5 rounded-xl hover:bg-ink/85 transition-colors">
              Cerrar
            </button>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 leading-relaxed">
              ⚠ Antes de reportar, intenta contactar al proveedor por el <strong>chat de FiestaGo</strong> si la situación se puede resolver hablando. Las incidencias formales activan la Garantía de Éxito y suspenden el pago al proveedor mientras investigamos.
            </div>

            <div>
              <label className="block text-xs font-bold text-ink/50 uppercase tracking-widest mb-2">Tipo de problema</label>
              <select value={type} onChange={e => setType(e.target.value)}
                className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm text-ink outline-none focus:border-coral">
                {TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-ink/50 uppercase tracking-widest mb-2">
                Cuéntanos qué pasó
              </label>
              <textarea value={description} onChange={e => setDescription(e.target.value)}
                rows={6} maxLength={5000}
                placeholder="Sé concreto: qué se prometió, qué ocurrió, qué te dijo el proveedor, en qué momento. Si tienes capturas o emails, guárdalos para enviárnoslos si te los pedimos."
                className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm text-ink outline-none focus:border-coral resize-none leading-relaxed"/>
              <div className="text-[10px] text-ink/40 text-right mt-1">{description.length}/5000 · mín 20</div>
            </div>

            {error && <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</div>}

            <div className="flex gap-2 pt-2">
              <button onClick={submit} disabled={sending || description.trim().length < 20}
                className="flex-1 bg-coral text-white font-bold py-3 rounded-xl text-sm hover:bg-coral-dark transition-colors disabled:opacity-50">
                {sending ? 'Enviando...' : 'Enviar incidencia'}
              </button>
              <button onClick={onClose}
                className="px-5 border border-stone-200 rounded-xl text-sm text-ink/60 hover:bg-stone-50">
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function ProfileTab({ user }: { user: any }) {
  const supabase = createClient()
  const meta = user?.user_metadata || {}
  const [name,      setName]      = useState(meta.full_name || '')
  const [phone,     setPhone]     = useState(meta.phone     || '')
  const [city,      setCity]      = useState(meta.city      || '')
  const [marketing, setMarketing] = useState(meta.accepts_marketing !== false)
  const [saving,    setSaving]    = useState(false)

  async function save() {
    setSaving(true)
    try {
      const { error } = await supabase.auth.updateUser({
        data: { full_name: name, phone, city, accepts_marketing: marketing, account_type: 'customer' }
      })
      if (error) throw error
      toast.success('Perfil actualizado ✓')
    } catch (err: any) {
      toast.error(err.message)
    }
    setSaving(false)
  }

  return (
    <div className="bg-white border border-stone-200 rounded-2xl p-6 max-w-xl">
      <h2 className="font-serif text-2xl font-bold text-ink mb-1">Tu perfil</h2>
      <p className="text-ink/55 text-sm mb-6">Estos datos los usaremos al pre-rellenar tus reservas.</p>

      <div className="space-y-3">
        <div>
          <label className="block text-xs font-bold text-ink/50 uppercase tracking-widest mb-1">Nombre</label>
          <input value={name} onChange={e => setName(e.target.value)}
            className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm text-ink outline-none focus:border-coral"/>
        </div>
        <div>
          <label className="block text-xs font-bold text-ink/50 uppercase tracking-widest mb-1">Email</label>
          <input value={user?.email || ''} disabled
            className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm text-ink/55 bg-stone-50"/>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-ink/50 uppercase tracking-widest mb-1">Teléfono</label>
            <input value={phone} onChange={e => setPhone(e.target.value)}
              className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm text-ink outline-none focus:border-coral"/>
          </div>
          <div>
            <label className="block text-xs font-bold text-ink/50 uppercase tracking-widest mb-1">Ciudad</label>
            <input value={city} onChange={e => setCity(e.target.value)}
              className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm text-ink outline-none focus:border-coral"/>
          </div>
        </div>
        <label className="flex items-start gap-2 text-xs text-ink/65 pt-2 cursor-pointer">
          <input type="checkbox" checked={marketing} onChange={e => setMarketing(e.target.checked)}
            className="mt-0.5 accent-coral"/>
          <span>Quiero recibir descuentos, novedades de proveedores y promociones por email.</span>
        </label>

        <button onClick={save} disabled={saving}
          className="bg-coral text-white font-bold py-2.5 px-6 rounded-xl text-sm hover:bg-coral-dark transition-colors disabled:opacity-50 mt-2">
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </div>
    </div>
  )
}
