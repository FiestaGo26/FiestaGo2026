'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams, useSearchParams } from 'next/navigation'
import { getPhoto, CATEGORIES, calcCommission } from '@/lib/constants'
import { createClient } from '@/lib/supabase'
import toast from 'react-hot-toast'

type Provider = {
  id: string
  name: string
  category: string
  city: string
  email: string | null
  phone: string | null
  website: string | null
  instagram: string | null
  description: string | null
  price_base: number | null
  price_unit: string
  tag: string | null
  rating: number
  total_reviews: number
  total_bookings: number
  featured: boolean
  verified: boolean
  photo_idx: number
  photo_url: string | null
  specialties: string[]
}

type Service = {
  id: string
  name: string
  description: string | null
  price: number | null
  price_unit: string
  duration: string | null
  max_guests: number | null
  media_type: 'image' | 'video' | 'none'
  media_url: string | null
  thumbnail_url: string | null
  status: string
}

export default function ProviderDetailPage() {
  const params       = useParams()
  const searchParams = useSearchParams()
  const id           = params?.id as string
  const preSvcId     = searchParams?.get('svc') || null

  const supabase = createClient()
  const [provider, setProvider] = useState<Provider | null>(null)
  const [services, setServices] = useState<Service[]>([])
  const [loading,  setLoading]  = useState(true)
  const [sending,  setSending]  = useState(false)
  const [booked,   setBooked]   = useState(false)
  const [selectedSvc, setSelectedSvc] = useState<Service | null>(null)
  const [isLogged, setIsLogged] = useState(false)
  const [showSocioCTA, setShowSocioCTA] = useState(false)
  const [signupPwd, setSignupPwd] = useState('')
  const [creatingAccount, setCreatingAccount] = useState(false)
  const [blockedDates, setBlockedDates] = useState<string[]>([])  // YYYY-MM-DD para el servicio seleccionado
  const [calMonth, setCalMonth] = useState<number>(new Date().getMonth())
  const [calYear,  setCalYear]  = useState<number>(new Date().getFullYear())
  const [form, setForm] = useState({
    client_name: '', client_email: '', client_phone: '',
    event_date: '', event_type: 'otro', guests: '', message: '',
  })

  // Pre-rellenar form si el usuario está logueado
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setIsLogged(true)
        const meta = (user.user_metadata || {}) as any
        setForm(f => ({
          ...f,
          client_name:  meta.full_name || f.client_name,
          client_email: user.email || f.client_email,
          client_phone: meta.phone || f.client_phone,
        }))
      }
    })
  }, [supabase])

  useEffect(() => {
    if (!id) return
    // Lookup directo: primero por id, fallback por slug si no es UUID
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    const url = isUUID ? `/api/providers?id=${id}` : `/api/providers?slug=${encodeURIComponent(id)}`
    fetch(url)
      .then(r => r.json())
      .then(data => {
        const p = data.provider || null
        setProvider(p)
        setLoading(false)
        // Cargar servicios sólo si el proveedor existe
        if (p?.id) {
          fetch(`/api/proveedor/services?provider_id=${p.id}`)
            .then(r => r.json())
            .then(d => {
              const active = (d.services || []).filter((s: Service) => s.status === 'active')
              setServices(active)
              // Pre-seleccionar si vino con ?svc=ID en la URL
              if (preSvcId) {
                const found = active.find((s: Service) => s.id === preSvcId)
                if (found) {
                  setSelectedSvc(found)
                  setForm(f => ({
                    ...f,
                    message: `Hola, me gustaría reservar el servicio "${found.name}"${found.price != null ? ` (${found.price.toLocaleString()}€)` : ''}.${f.message ? `\n\n${f.message}` : ''}`,
                  }))
                }
              }
            })
            .catch(() => {})
        }
      })
      .catch(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, preSvcId])

  async function handleQuickSignup() {
    if (!signupPwd || signupPwd.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres')
      return
    }
    setCreatingAccount(true)
    try {
      const { error } = await supabase.auth.signUp({
        email: form.client_email,
        password: signupPwd,
        options: {
          data: {
            full_name: form.client_name,
            phone: form.client_phone,
            accepts_marketing: true,
            account_type: 'customer',
          },
        },
      })
      if (error) {
        if (/already registered/i.test(error.message)) {
          toast.error('Ya existe una cuenta con este email. Prueba a iniciar sesión.')
        } else {
          throw error
        }
      } else {
        toast.success('¡Cuenta de socio creada! Ya puedes ver tu calendario.')
        setShowSocioCTA(false)
      }
    } catch (err: any) {
      toast.error(err.message)
    }
    setCreatingAccount(false)
  }

  // Cargar fechas bloqueadas SIEMPRE que cambie el servicio seleccionado
  // (sea por click manual o por ?svc=ID en la URL)
  useEffect(() => {
    if (!selectedSvc) { setBlockedDates([]); return }
    fetch(`/api/services/availability?service_id=${selectedSvc.id}&months=6`)
      .then(r => r.json())
      .then(d => setBlockedDates(d.blocked_dates || []))
      .catch(() => setBlockedDates([]))
  }, [selectedSvc])

  function selectService(svc: Service) {
    setSelectedSvc(svc)
    setForm(f => ({
      ...f,
      message: `Hola, me gustaría reservar el servicio "${svc.name}"${svc.price != null ? ` (${svc.price.toLocaleString()}€)` : ''}.${f.message ? `\n\n${f.message}` : ''}`,
    }))
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setTimeout(() => document.getElementById('booking-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
    }
    toast.success(`Servicio seleccionado: ${svc.name}`)
  }

  async function handleBook(e: React.FormEvent) {
    e.preventDefault()
    if (!provider) return
    setSending(true)
    try {
      const totalAmount = selectedSvc?.price ?? provider.price_base ?? 0
      // El servicio elegido se identifica en el mensaje (lo añade selectService) +
      // total_amount ya refleja el precio del servicio.
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          booking_type: 'provider',
          provider_id:  provider.id,
          service_id:   selectedSvc?.id || null,
          client_name:  form.client_name,
          client_email: form.client_email,
          client_phone: form.client_phone || null,
          event_date:   form.event_date,
          event_type:   form.event_type,
          guests:       parseInt(form.guests) || null,
          message:      form.message || null,
          total_amount: totalAmount,
          city:         provider.city,
        }),
      })
      const text = await res.text()
      let data: any = {}
      try { data = text ? JSON.parse(text) : {} } catch { /* no es JSON */ }
      if (!res.ok || data.error) {
        throw new Error(data.error || `Error ${res.status} del servidor`)
      }
      setBooked(true)
      // Si no está logueado, ofrecer crear cuenta socio para ver el calendario
      if (!isLogged) setShowSocioCTA(true)
      toast.success('¡Reserva enviada! El proveedor te contactará pronto.')
    } catch (err: any) {
      toast.error(err.message || 'Error al enviar la reserva')
    }
    setSending(false)
  }

  if (loading) return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-ink/40">Cargando...</div>
    </div>
  )

  if (!provider) return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-center">
        <div className="text-5xl mb-4">😔</div>
        <h2 className="font-serif text-2xl font-bold text-ink mb-3">Proveedor no encontrado</h2>
        <Link href="/servicios" className="text-coral font-semibold hover:underline">
          ← Ver todos los servicios
        </Link>
      </div>
    </div>
  )

  const cat = CATEGORIES.find(c => c.id === provider.category)
  const effectivePrice = selectedSvc?.price ?? provider.price_base ?? 0
  const commission     = calcCommission(effectivePrice, provider.total_bookings || 0)

  return (
    <main className="bg-white">
      <div className="max-w-7xl mx-auto px-6 py-8">

        {/* Back */}
        <Link href="/servicios" className="inline-flex items-center gap-2 text-sm text-ink/55 hover:text-ink mb-4 transition-colors">
          ← Volver al catálogo
        </Link>

        {/* TITLE BLOCK (Airbnb-style — texto, sin card) */}
        <div className="mb-6">
          <h1 className="font-serif text-3xl md:text-4xl text-ink leading-tight tracking-tight">{provider.name}</h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-sm text-ink/65">
            {provider.rating > 0 && (
              <span className="flex items-center gap-1">
                <span className="text-coral">★</span>
                <span className="font-medium text-ink">{Number(provider.rating).toFixed(1)}</span>
                {provider.total_reviews > 0 && <span className="text-ink/55">({provider.total_reviews} reseñas)</span>}
              </span>
            )}
            {provider.rating > 0 && <span className="text-ink/30">·</span>}
            <span className="underline underline-offset-2">{provider.city}</span>
            {provider.verified && <><span className="text-ink/30">·</span><span>🛡️ Verificado</span></>}
            {cat && <><span className="text-ink/30">·</span><span>{cat.icon} {cat.label}</span></>}
          </div>
        </div>

        {/* GALLERY (Airbnb-style: 1 grande + 4 thumbnails en grid 2x2) */}
        <div className="grid grid-cols-1 md:grid-cols-4 md:grid-rows-2 gap-2 rounded-3xl overflow-hidden mb-10 md:aspect-[2/1]">
          <div className="relative md:col-span-2 md:row-span-2 aspect-[4/3] md:aspect-auto bg-stone-100">
            <img src={provider.photo_url || getPhoto(provider.category, provider.photo_idx || 0, 900, 600)}
              alt={provider.name}
              className="w-full h-full object-cover hover:opacity-95 transition-opacity"
              onError={e => { (e.target as HTMLImageElement).src = `https://picsum.photos/seed/${provider.id}/900/600` }}/>
            <div className="absolute top-4 left-4 flex gap-2">
              {provider.tag && (
                <span className="text-[10px] font-semibold tracking-widest uppercase px-3 py-1.5 rounded-full bg-white/95 text-ink">
                  {provider.tag}
                </span>
              )}
            </div>
          </div>
          {[1, 2, 3, 4].map(offset => (
            <div key={offset} className="hidden md:block bg-stone-100 overflow-hidden">
              <img src={getPhoto(provider.category, (provider.photo_idx || 0) + offset, 500, 400)} alt=""
                className="w-full h-full object-cover hover:opacity-95 transition-opacity"/>
            </div>
          ))}
        </div>

        {/* MAIN GRID */}
        <div className="grid lg:grid-cols-[1fr_400px] gap-12 items-start">

          {/* ── LEFT ── */}
          <div>
            {/* About */}
            {provider.description && (
              <section className="pb-8 border-b border-stone-200/70 mb-8">
                <h2 className="font-serif text-2xl text-ink mb-3">Sobre {provider.name.split(' ')[0]}</h2>
                <p className="text-ink/70 leading-relaxed text-[15px]">{provider.description}</p>
              </section>
            )}

            {/* Specialties */}
            {provider.specialties?.length > 0 && (
              <section className="pb-8 border-b border-stone-200/70 mb-8">
                <h2 className="font-serif text-2xl text-ink mb-4">Especialidades</h2>
                <div className="flex flex-wrap gap-2">
                  {provider.specialties.map((s, i) => (
                    <span key={i} className="text-sm px-4 py-2 rounded-full border border-stone-200 text-ink/70">
                      {s}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {/* Servicios disponibles */}
            {services.length > 0 && (
              <section className="pb-8 border-b border-stone-200/70 mb-8">
                <div className="flex items-baseline justify-between mb-5">
                  <h2 className="font-serif text-2xl text-ink">Servicios disponibles</h2>
                  <span className="text-xs text-ink/45">{services.length} {services.length === 1 ? 'opción' : 'opciones'}</span>
                </div>
                <div className="grid sm:grid-cols-2 gap-5">
                  {services.map(svc => {
                    const isSelected = selectedSvc?.id === svc.id
                    return (
                      <button key={svc.id} onClick={() => selectService(svc)}
                        className={`text-left group block rounded-2xl transition-all overflow-hidden ${
                          isSelected ? 'ring-2 ring-ink' : ''
                        }`}>
                        <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-stone-100 mb-3">
                          {svc.media_url && svc.media_type === 'video' ? (
                            <video src={svc.media_url} muted loop autoPlay playsInline
                              className="w-full h-full object-cover" />
                          ) : (
                            <img src={svc.media_url || getPhoto(provider.category, 0, 600, 450)} alt={svc.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                          )}
                          {isSelected && (
                            <div className="absolute top-2 right-2 bg-ink text-white text-[10px] font-semibold tracking-widest uppercase px-3 py-1 rounded-full">
                              ✓ Elegido
                            </div>
                          )}
                        </div>
                        <div className="px-1">
                          <h3 className="font-medium text-ink text-[15px] mb-1 line-clamp-1">{svc.name}</h3>
                          <div className="flex gap-2 mb-1 text-[11px] text-ink/55">
                            {svc.duration && <span>⏱ {svc.duration}</span>}
                            {svc.max_guests != null && <span>· 👥 hasta {svc.max_guests}</span>}
                          </div>
                          {svc.description && (
                            <p className="text-xs text-ink/55 line-clamp-2 mb-2 leading-relaxed">{svc.description}</p>
                          )}
                          <div className="text-sm text-ink">
                            {svc.price != null ? (
                              <>
                                <span className="font-semibold">{svc.price.toLocaleString()}€</span>
                                <span className="text-ink/50"> {svc.price_unit}</span>
                              </>
                            ) : (
                              <span className="text-ink/45">A consultar</span>
                            )}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </section>
            )}

            {/* Contact */}
            <section className="pb-2">
              <h2 className="font-serif text-2xl text-ink mb-4">Contacto</h2>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                {[
                  ['📧 Email',     provider.email,     provider.email ? `mailto:${provider.email}` : null],
                  ['📞 Teléfono',  provider.phone,     provider.phone ? `tel:${provider.phone}` : null],
                  ['🌐 Web',       provider.website,   provider.website],
                  ['📸 Instagram', provider.instagram, provider.instagram ? `https://instagram.com/${provider.instagram.replace('@','')}` : null],
                ].map(([icon, val, href]) => val ? (
                  <a key={icon as string} href={href as string} target="_blank" rel="noreferrer"
                    className="flex flex-col gap-0.5 text-ink/65 hover:text-ink transition-colors py-2 border-b border-stone-100">
                    <span className="text-[10px] uppercase tracking-widest text-ink/45 font-medium">{icon}</span>
                    <span className="truncate">{val}</span>
                  </a>
                ) : null)}
              </div>
            </section>
          </div>

          {/* ── RIGHT — BOOKING FORM ── */}
          <div className="lg:sticky lg:top-24" id="booking-form">
            <div className="bg-white border border-stone-200 rounded-3xl p-6 shadow-[0_8px_24px_rgba(0,0,0,0.08)]">

              {/* Servicio seleccionado banner */}
              {selectedSvc && (
                <div className="mb-4 -mx-6 -mt-6 px-6 py-3 bg-coral/10 border-b border-coral/20 flex items-center justify-between gap-2">
                  <div className="text-xs">
                    <div className="text-ink/50 uppercase tracking-widest font-bold mb-0.5">Reservando</div>
                    <div className="font-semibold text-ink truncate">{selectedSvc.name}</div>
                  </div>
                  <button onClick={() => setSelectedSvc(null)}
                    className="text-[10px] text-ink/50 hover:text-coral underline whitespace-nowrap">
                    Cambiar
                  </button>
                </div>
              )}

              {/* Price */}
              <div className="mb-5">
                {selectedSvc ? (
                  selectedSvc.price != null ? (
                    <>
                      <span className="font-serif text-3xl text-ink">
                        {selectedSvc.price.toLocaleString()}€
                      </span>
                      <span className="text-sm text-ink/50"> {selectedSvc.price_unit}</span>
                    </>
                  ) : (
                    <span className="text-lg text-ink/50">A consultar</span>
                  )
                ) : provider.price_base ? (
                  <>
                    <span className="text-sm text-ink/45">desde </span>
                    <span className="font-serif text-3xl text-ink">
                      {provider.price_base.toLocaleString()}€
                    </span>
                    <span className="text-sm text-ink/50"> {provider.price_unit}</span>
                  </>
                ) : (
                  <span className="text-lg text-ink/50">Precio a consultar</span>
                )}
              </div>

              {/* Commission info */}
              <div className={`rounded-xl p-3.5 mb-5 text-xs ${commission.isFree
                ? 'bg-sage/10 border border-sage/20'
                : 'bg-cream-dark border border-stone-200'}`}>
                <div className={`font-bold mb-2 ${commission.isFree ? 'text-sage' : 'text-ink/60'}`}>
                  {commission.isFree ? '🎁 ¡1ª transacción GRATIS!' : '💳 Desglose'}
                </div>
                <div className="flex justify-between mb-1">
                  <span className="text-ink/50">Precio del servicio</span>
                  <span className="font-semibold">{effectivePrice.toLocaleString()}€</span>
                </div>
                <div className="flex justify-between mb-1">
                  <span className="text-ink/50">Comisión FiestaGo</span>
                  <span className={commission.isFree ? 'text-sage font-bold' : 'text-ink/60'}>
                    {commission.isFree ? '¡GRATIS!' : `-${commission.amount.toLocaleString()}€`}
                  </span>
                </div>
                <div className="flex justify-between border-t border-stone-200 pt-1.5 mt-1.5">
                  <span className="text-ink/50">Tú pagas</span>
                  <span className="font-bold text-ink">{effectivePrice.toLocaleString()}€</span>
                </div>
              </div>

              {booked ? (
                <div className="py-2">
                  <div className="text-center mb-5">
                    <div className="text-4xl mb-3">🎉</div>
                    <div className="font-bold text-ink mb-2">¡Solicitud enviada!</div>
                    <div className="text-sm text-ink/55">
                      {provider.name} recibirá tu solicitud y te contactará pronto.
                    </div>
                  </div>

                  {/* CTA socio si no está logueado */}
                  {showSocioCTA && (
                    <div className="bg-gradient-to-br from-coral/10 via-amber-50 to-rose-50 border border-coral/20 rounded-xl p-4 mb-3">
                      <div className="text-xs font-bold tracking-widest uppercase text-coral mb-2">✨ Hazte socio gratis</div>
                      <h4 className="font-serif text-lg font-bold text-ink mb-1">Ve tu reserva en tu calendario</h4>
                      <p className="text-xs text-ink/60 mb-3">
                        Crea una contraseña y tendrás tu calendario, descuentos y novedades en <Link href="/mi-cuenta" className="text-coral underline">tu cuenta</Link>.
                      </p>
                      <div className="flex gap-2">
                        <input type="password" placeholder="Contraseña (mín. 6)" value={signupPwd}
                          onChange={e => setSignupPwd(e.target.value)}
                          minLength={6}
                          className="flex-1 border border-stone-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-coral"/>
                        <button type="button" onClick={handleQuickSignup} disabled={creatingAccount}
                          className="bg-coral text-white font-bold text-xs px-4 py-2 rounded-xl hover:bg-coral-dark disabled:opacity-50">
                          {creatingAccount ? '...' : 'Crear cuenta'}
                        </button>
                      </div>
                      <button type="button" onClick={() => setShowSocioCTA(false)}
                        className="text-[10px] text-ink/40 hover:text-ink mt-2">
                        Continuar como invitado
                      </button>
                    </div>
                  )}

                  {isLogged && (
                    <Link href="/mi-cuenta"
                      className="block w-full bg-coral text-white font-bold py-2.5 rounded-xl text-sm text-center hover:bg-coral-dark transition-colors">
                      Ver mi calendario →
                    </Link>
                  )}
                </div>
              ) : (
                <form onSubmit={handleBook} className="flex flex-col gap-3">
                  <div>
                    <label className="block text-xs font-bold text-ink/50 uppercase tracking-widest mb-1">Tu nombre *</label>
                    <input required value={form.client_name}
                      onChange={e => setForm(f => ({ ...f, client_name: e.target.value }))}
                      placeholder="Tu nombre completo"
                      className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm text-ink outline-none focus:border-coral transition-colors"/>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-ink/50 uppercase tracking-widest mb-1">Email *</label>
                    <input required type="email" value={form.client_email}
                      onChange={e => setForm(f => ({ ...f, client_email: e.target.value }))}
                      placeholder="tu@email.com"
                      className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm text-ink outline-none focus:border-coral transition-colors"/>
                  </div>
                  {/* Calendario visual (días bloqueados grises) */}
                  <div>
                    <label className="block text-xs font-bold text-ink/50 uppercase tracking-widest mb-2">Fecha *</label>
                    <div className="border border-stone-200 rounded-xl p-3">
                      <div className="flex justify-between items-center mb-2">
                        <button type="button" onClick={() => {
                          const m = calMonth === 0 ? 11 : calMonth - 1
                          const y = calMonth === 0 ? calYear - 1 : calYear
                          setCalMonth(m); setCalYear(y)
                        }} className="text-sm text-ink/55 hover:text-coral px-2 py-1">←</button>
                        <span className="text-xs font-bold text-ink">
                          {['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'][calMonth]} {calYear}
                        </span>
                        <button type="button" onClick={() => {
                          const m = calMonth === 11 ? 0 : calMonth + 1
                          const y = calMonth === 11 ? calYear + 1 : calYear
                          setCalMonth(m); setCalYear(y)
                        }} className="text-sm text-ink/55 hover:text-coral px-2 py-1">→</button>
                      </div>
                      <div className="grid grid-cols-7 gap-1">
                        {['L','M','X','J','V','S','D'].map(d => (
                          <div key={d} className="text-center text-[9px] font-bold tracking-wider uppercase text-ink/35 py-1">{d}</div>
                        ))}
                        {(() => {
                          const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate()
                          const firstDay = (() => { const d = new Date(calYear, calMonth, 1).getDay(); return d === 0 ? 6 : d - 1 })()
                          const today = new Date()
                          today.setHours(0,0,0,0)
                          const cells: any[] = Array(firstDay).fill(null)
                          for (let i = 1; i <= daysInMonth; i++) cells.push(i)
                          return cells.map((day, idx) => {
                            if (day === null) return <div key={`e-${idx}`} />
                            const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                            const isPast    = new Date(dateStr) < today
                            const isBlocked = blockedDates.includes(dateStr)
                            const isSelected= form.event_date === dateStr
                            const disabled  = isPast || isBlocked
                            return (
                              <button key={dateStr} type="button" disabled={disabled}
                                onClick={() => setForm(f => ({ ...f, event_date: dateStr }))}
                                title={isBlocked ? 'No disponible' : isPast ? 'Fecha pasada' : ''}
                                className={`aspect-square rounded-lg text-xs transition-all ${
                                  isSelected
                                    ? 'bg-coral text-white font-bold shadow-sm'
                                    : isBlocked
                                    ? 'bg-red-100 text-red-400 line-through cursor-not-allowed border border-red-200'
                                    : isPast
                                    ? 'text-ink/20 cursor-not-allowed bg-stone-50'
                                    : 'text-ink hover:bg-coral/10 hover:text-coral border border-transparent hover:border-coral/30'
                                }`}>
                                {day}
                              </button>
                            )
                          })
                        })()}
                      </div>
                      <div className="flex gap-3 text-[10px] text-ink/55 mt-3 flex-wrap items-center">
                        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-coral rounded inline-block"/> Elegida</span>
                        {selectedSvc && blockedDates.length > 0 && (
                          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-red-100 border border-red-200 rounded inline-block"/> No disponible</span>
                        )}
                        {!selectedSvc && (
                          <span className="text-[10px] text-ink/40 italic">Elige un servicio arriba para ver disponibilidad</span>
                        )}
                      </div>
                    </div>
                    {/* Hidden input para validación HTML */}
                    <input type="hidden" required value={form.event_date} readOnly/>
                    {!form.event_date && (
                      <div className="text-[10px] text-ink/45 mt-1.5">Selecciona un día en el calendario</div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-ink/50 uppercase tracking-widest mb-1">Invitados</label>
                    <input type="number" value={form.guests} placeholder="ej. 80"
                      onChange={e => setForm(f => ({ ...f, guests: e.target.value }))}
                      className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm text-ink outline-none focus:border-coral transition-colors"/>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-ink/50 uppercase tracking-widest mb-1">Tipo de evento</label>
                    <select value={form.event_type}
                      onChange={e => setForm(f => ({ ...f, event_type: e.target.value }))}
                      className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm text-ink outline-none focus:border-coral transition-colors">
                      {[['boda','💍 Boda'],['cumpleanos','🎂 Cumpleaños'],['bautizo','👶 Bautizo'],
                        ['comunion','⛪ Comunión'],['fiesta_privada','🥂 Fiesta privada'],
                        ['evento_corporativo','💼 Evento corporativo'],['otro','🎉 Otro']
                      ].map(([v,l])=><option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-ink/50 uppercase tracking-widest mb-1">Mensaje</label>
                    <textarea value={form.message} rows={3} placeholder="Cuéntanos sobre tu evento..."
                      onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                      className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm text-ink outline-none focus:border-coral transition-colors resize-none"/>
                  </div>
                  <button type="submit" disabled={sending}
                    className="w-full py-3.5 rounded-xl font-semibold text-sm text-white bg-coral hover:bg-coral-dark transition-colors disabled:opacity-50">
                    {sending ? 'Enviando...' : commission.isFree ? '🎁 Solicitar sin comisión' : 'Enviar solicitud de reserva'}
                  </button>
                  <p className="text-center text-xs text-ink/40">
                    Sin compromiso · Respuesta en menos de 24h
                  </p>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
