'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams, useSearchParams } from 'next/navigation'
import { getPhoto, CATEGORIES, calcCommission, CANCELLATION_POLICIES } from '@/lib/constants'
import { precioCliente, formatEuro, textoGarantiaIncluida } from '@/lib/pricing'
import { createClient } from '@/lib/supabase'
import toast from 'react-hot-toast'
import FavoriteButton from '../../_components/FavoriteButton'

type Provider = {
  id: string
  name: string
  category: string
  city: string
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
  cancellation_policy: 'flexible' | 'moderate' | 'strict' | null
  addons?: Array<{ id: string; label: string; description?: string | null; price: number }>
  media?: Array<{
    id: string
    url: string
    thumbnail_url: string | null
    media_type: 'image' | 'video'
    sort_order: number
    is_primary: boolean
  }>
}

function ServiceGallery({ service, fallback, isSelected }: {
  service: Service
  fallback: string
  isSelected: boolean
}) {
  const media = service.media && service.media.length > 0
    ? service.media
    : (service.media_url
        ? [{ id: 'fallback', url: service.media_url, thumbnail_url: null, media_type: service.media_type as 'image' | 'video', sort_order: 0, is_primary: true }]
        : [])
  const [idx, setIdx] = useState(0)
  const current = media[idx]
  const total = media.length

  return (
    <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-stone-100 mb-3 group/gal">
      {current ? (
        current.media_type === 'video' ? (
          <video src={current.url} muted loop autoPlay playsInline className="w-full h-full object-cover" />
        ) : (
          <img src={current.url} alt={service.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        )
      ) : (
        <img src={fallback} alt={service.name} className="w-full h-full object-cover" />
      )}

      {isSelected && (
        <div className="absolute top-2 right-2 bg-ink text-white text-[10px] font-semibold tracking-widest uppercase px-3 py-1 rounded-full">
          ✓ Elegido
        </div>
      )}

      {total > 1 && (
        <>
          {/* Flechas */}
          <button onClick={e => { e.stopPropagation(); e.preventDefault(); setIdx((idx - 1 + total) % total) }}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 text-ink shadow flex items-center justify-center opacity-0 group-hover/gal:opacity-100 transition-opacity hover:bg-white"
            aria-label="Anterior">‹</button>
          <button onClick={e => { e.stopPropagation(); e.preventDefault(); setIdx((idx + 1) % total) }}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 text-ink shadow flex items-center justify-center opacity-0 group-hover/gal:opacity-100 transition-opacity hover:bg-white"
            aria-label="Siguiente">›</button>
          {/* Indicador */}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
            {media.map((_, i) => (
              <span key={i} className={`w-1.5 h-1.5 rounded-full transition-all ${i === idx ? 'bg-white w-4' : 'bg-white/60'}`} />
            ))}
          </div>
          <div className="absolute bottom-2 right-2 bg-ink/70 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">
            {idx + 1}/{total}
          </div>
        </>
      )}
    </div>
  )
}

export default function ProviderDetailPage() {
  const params       = useParams()
  const searchParams = useSearchParams()
  const id           = params?.id as string
  const preSvcId     = searchParams?.get('svc') || null

  const supabase = createClient()
  const [provider, setProvider] = useState<Provider | null>(null)
  const [services, setServices] = useState<Service[]>([])
  const [reviews,  setReviews]  = useState<Array<{id:string;author:string;rating:number;text:string;event_type:string|null;date:string;reply:string|null;reply_date:string|null}>>([])
  const [showAllReviews, setShowAllReviews] = useState(false)
  const [loading,  setLoading]  = useState(true)
  const [sending,  setSending]  = useState(false)
  const [booked,   setBooked]   = useState(false)
  const [selectedSvc, setSelectedSvc] = useState<Service | null>(null)
  const [selectedAddons, setSelectedAddons] = useState<Set<string>>(new Set())
  const [couponInput,    setCouponInput]    = useState('')
  const [couponApplied,  setCouponApplied]  = useState<{ code: string; percent: number; amount: number } | null>(null)
  const [couponChecking, setCouponChecking] = useState(false)
  const [couponError,    setCouponError]    = useState<string | null>(null)
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

  // Helper para tracking de eventos
  function trackEvent(provider_id: string, event_type: string, service_id?: string) {
    if (typeof window === 'undefined') return
    let session_id = localStorage.getItem('fg_session')
    if (!session_id) {
      session_id = Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
      localStorage.setItem('fg_session', session_id)
    }
    fetch('/api/analytics/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider_id, event_type, service_id, session_id }),
    }).catch(() => {})
  }

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
        // TRACK: profile_view
        if (p?.id) trackEvent(p.id, 'profile_view')
        // Cargar reseñas
        if (p?.id) {
          fetch(`/api/providers/reviews?provider_id=${p.id}`)
            .then(r => r.json())
            .then(d => setReviews(d.reviews || []))
            .catch(() => {})
        }
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
    setSelectedAddons(new Set())
    setForm(f => ({
      ...f,
      message: `Hola, me gustaría reservar el servicio "${svc.name}"${svc.price != null ? ` (${svc.price.toLocaleString()}€)` : ''}.${f.message ? `\n\n${f.message}` : ''}`,
    }))
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setTimeout(() => document.getElementById('booking-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
    }
    // TRACK: service_view + booking_started (al elegir un servicio se considera intención de reserva)
    if (provider?.id) {
      trackEvent(provider.id, 'service_view', svc.id)
      trackEvent(provider.id, 'booking_started', svc.id)
    }
    toast.success(`Servicio seleccionado: ${svc.name}`)
  }

  async function handleBook(e: React.FormEvent) {
    e.preventDefault()
    if (!provider) return
    setSending(true)
    try {
      const chosenAddons = (selectedSvc?.addons || []).filter(a => selectedAddons.has(a.id))
      const addonsTotal  = chosenAddons.reduce((s, a) => s + (Number(a.price) || 0), 0)
      const totalAmount  = (selectedSvc?.price ?? provider.price_base ?? 0) + addonsTotal
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
          selected_addons: chosenAddons,
          coupon_code:  couponApplied?.code || null,
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
      // TRACK: booking_completed
      if (provider?.id) trackEvent(provider.id, 'booking_completed', selectedSvc?.id)
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
  const basePrice      = selectedSvc?.price ?? provider.price_base ?? 0
  const chosenAddons   = (selectedSvc?.addons || []).filter(a => selectedAddons.has(a.id))
  const addonsTotal    = chosenAddons.reduce((s, a) => s + (Number(a.price) || 0), 0)
  const subtotal       = basePrice + addonsTotal
  const couponDiscount = couponApplied ? Math.round((subtotal * couponApplied.percent / 100) * 100) / 100 : 0
  const effectivePrice = Math.max(0, Math.round((subtotal - couponDiscount) * 100) / 100)
  const commission     = calcCommission(effectivePrice, provider.total_bookings || 0)

  async function applyCoupon() {
    const code = couponInput.trim().toUpperCase()
    if (!code) return
    setCouponChecking(true); setCouponError(null)
    try {
      const res = await fetch(`/api/coupons/validate?code=${encodeURIComponent(code)}&provider_id=${provider!.id}&total=${subtotal}`)
      const data = await res.json()
      if (!data.valid) {
        setCouponError(data.error || 'Cupón no válido')
        setCouponApplied(null)
      } else {
        setCouponApplied({ code: data.code, percent: data.percent_off, amount: data.amount_off })
        setCouponError(null)
      }
    } catch { setCouponError('Error al validar el cupón'); setCouponApplied(null) }
    setCouponChecking(false)
  }

  return (
    <main className="bg-white">
      {/* Schema.org JSON-LD para rich results en Google */}
      <script type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'LocalBusiness',
          name: provider.name,
          description: provider.description || `${provider.name} en ${provider.city}`,
          image: provider.photo_url || undefined,
          address: { '@type': 'PostalAddress', addressLocality: provider.city, addressCountry: 'ES' },
          url: `https://fiestago.es/proveedores/${(provider as any).slug || provider.id}`,
          priceRange: provider.price_base ? `€${provider.price_base}` : undefined,
          ...(provider.rating > 0 && provider.total_reviews > 0 ? {
            aggregateRating: {
              '@type': 'AggregateRating',
              ratingValue: Number(provider.rating).toFixed(1),
              reviewCount: provider.total_reviews,
            },
          } : {}),
        }) }}/>
      <div className="max-w-7xl mx-auto px-6 py-8">

        {/* Back */}
        <Link href="/servicios" className="inline-flex items-center gap-2 text-sm text-ink/55 hover:text-ink mb-4 transition-colors">
          ← Volver al catálogo
        </Link>

        {/* TITLE BLOCK (Airbnb-style — texto, sin card) */}
        <div className="mb-6">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <h1 className="font-serif text-3xl md:text-4xl text-ink leading-tight tracking-tight">{provider.name}</h1>
            <FavoriteButton providerId={provider.id} variant="inline"/>
          </div>
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
                        <ServiceGallery
                          service={svc}
                          fallback={getPhoto(provider.category, 0, 600, 450)}
                          isSelected={isSelected}
                        />
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

            {/* Reseñas */}
            {reviews.length > 0 && (
              <section className="pb-2">
                <div className="flex items-baseline justify-between mb-5">
                  <h2 className="font-serif text-2xl text-ink">
                    <span className="text-coral">★</span>{' '}
                    {provider.rating > 0 ? Number(provider.rating).toFixed(1) : '—'}
                    <span className="text-ink/55 text-lg font-normal"> · {reviews.length} reseña{reviews.length !== 1 ? 's' : ''}</span>
                  </h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                  {(showAllReviews ? reviews : reviews.slice(0, 4)).map(r => {
                    const dateF = r.date
                      ? new Date(r.date).toLocaleDateString('es-ES', { month:'long', year:'numeric' })
                      : ''
                    return (
                      <div key={r.id} className="flex flex-col gap-2">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-coral/10 text-coral flex items-center justify-center font-bold text-sm">
                            {r.author.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-ink truncate">{r.author}</div>
                            <div className="text-[11px] text-ink/45 capitalize">{dateF}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 text-coral text-sm">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <span key={i} className={i < r.rating ? '' : 'text-ink/15'}>★</span>
                          ))}
                          {r.event_type && (
                            <span className="ml-2 text-[11px] text-ink/45">· {r.event_type}</span>
                          )}
                        </div>
                        {r.text && (
                          <p className="text-sm text-ink/75 leading-relaxed">
                            {r.text}
                          </p>
                        )}
                        {r.reply && (
                          <div className="mt-2 ml-4 border-l-2 border-coral/30 pl-3 py-1">
                            <div className="text-[10px] uppercase tracking-widest text-coral font-bold mb-1">
                              ↳ Respuesta de {provider.name}
                            </div>
                            <p className="text-sm text-ink/70 leading-relaxed">{r.reply}</p>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
                {reviews.length > 4 && (
                  <div className="mt-6">
                    <button onClick={() => setShowAllReviews(s => !s)}
                      className="text-sm font-semibold text-ink border border-ink/15 px-5 py-2.5 rounded-xl hover:bg-ink hover:text-white transition-colors">
                      {showAllReviews ? 'Mostrar menos' : `Mostrar las ${reviews.length} reseñas`}
                    </button>
                  </div>
                )}
              </section>
            )}

            {/* Aviso: el contacto se hace vía FiestaGo, no exponemos datos del proveedor */}
            <section className="pb-2">
              <div className="bg-cream border border-stone-200 rounded-2xl p-4 flex items-start gap-3 text-sm">
                <span className="text-xl leading-none mt-0.5">🔒</span>
                <div className="text-ink/70 leading-relaxed">
                  <div className="font-semibold text-ink mb-0.5">Reserva a través de FiestaGo</div>
                  Por seguridad, los datos de contacto del proveedor solo se comparten una vez confirmada la reserva.
                </div>
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

              {/* Price (cliente ve base + 8% Garantía de Éxito) */}
              <div className="mb-5">
                {selectedSvc ? (
                  selectedSvc.price != null ? (
                    <>
                      <span className="font-serif text-3xl text-ink" title={textoGarantiaIncluida(selectedSvc.price)}>
                        {formatEuro(precioCliente(selectedSvc.price))}
                      </span>
                      <span className="text-sm text-ink/50"> {selectedSvc.price_unit}</span>
                      <div className="text-xs text-ink/55 mt-1">{textoGarantiaIncluida(selectedSvc.price)}</div>
                    </>
                  ) : (
                    <span className="text-lg text-ink/50">A consultar</span>
                  )
                ) : provider.price_base ? (
                  <>
                    <span className="text-sm text-ink/45">desde </span>
                    <span className="font-serif text-3xl text-ink" title={textoGarantiaIncluida(provider.price_base)}>
                      {formatEuro(precioCliente(provider.price_base))}
                    </span>
                    <span className="text-sm text-ink/50"> {provider.price_unit}</span>
                    <div className="text-xs text-ink/55 mt-1">{textoGarantiaIncluida(provider.price_base)}</div>
                  </>
                ) : (
                  <span className="text-lg text-ink/50">Precio a consultar</span>
                )}
              </div>

              {/* Extras opcionales del servicio */}
              {selectedSvc && (selectedSvc.addons || []).length > 0 && (
                <div className="mb-5">
                  <div className="text-[10px] font-bold text-ink/45 uppercase tracking-widest mb-2">Añade extras opcionales</div>
                  <div className="space-y-2">
                    {(selectedSvc.addons || []).map(a => {
                      const checked = selectedAddons.has(a.id)
                      return (
                        <label key={a.id}
                          className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${checked ? 'bg-coral/5 border-coral/40' : 'bg-white border-stone-200 hover:border-stone-300'}`}>
                          <input type="checkbox" checked={checked}
                            onChange={() => setSelectedAddons(prev => {
                              const next = new Set(prev)
                              if (checked) next.delete(a.id); else next.add(a.id)
                              return next
                            })}
                            className="mt-0.5 accent-coral"/>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline justify-between gap-2">
                              <div className="font-medium text-ink text-sm truncate">{a.label}</div>
                              <div className="text-sm font-bold text-coral whitespace-nowrap">+{Number(a.price).toLocaleString()}€</div>
                            </div>
                            {a.description && <div className="text-[11px] text-ink/55 mt-0.5">{a.description}</div>}
                          </div>
                        </label>
                      )
                    })}
                  </div>
                  {addonsTotal > 0 && (
                    <div className="mt-3 flex justify-between text-sm text-ink/70 px-2">
                      <span>Base + {chosenAddons.length} extra{chosenAddons.length!==1?'s':''}</span>
                      <span className="font-bold text-coral">{effectivePrice.toLocaleString()}€</span>
                    </div>
                  )}
                </div>
              )}

              {/* Cupón de descuento */}
              {selectedSvc && subtotal > 0 && (
                <div className="mb-5">
                  <div className="text-[10px] font-bold text-ink/45 uppercase tracking-widest mb-2">¿Tienes un código?</div>
                  {!couponApplied ? (
                    <div className="flex gap-2">
                      <input value={couponInput}
                        onChange={e => setCouponInput(e.target.value.toUpperCase())}
                        placeholder="EJ. AMIGO20"
                        maxLength={32}
                        className="flex-1 border border-stone-200 rounded-xl px-3 py-2 text-sm font-mono uppercase outline-none focus:border-coral"/>
                      <button onClick={applyCoupon} disabled={couponChecking || !couponInput.trim()}
                        className="bg-ink text-white text-xs font-bold px-4 py-2 rounded-xl hover:bg-ink/85 transition-colors disabled:opacity-50">
                        {couponChecking ? '…' : 'Aplicar'}
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
                      <div className="text-xs">
                        <span className="font-mono font-bold text-emerald-700">{couponApplied.code}</span>
                        <span className="text-emerald-600"> · −{couponApplied.percent}% (−{couponDiscount.toLocaleString()}€)</span>
                      </div>
                      <button onClick={() => { setCouponApplied(null); setCouponInput('') }}
                        className="text-xs text-emerald-700 hover:text-emerald-900 underline">
                        Quitar
                      </button>
                    </div>
                  )}
                  {couponError && <p className="text-xs text-red-600 mt-1.5">{couponError}</p>}
                </div>
              )}

              {/* Política de cancelación del servicio seleccionado */}
              {selectedSvc?.cancellation_policy && CANCELLATION_POLICIES[selectedSvc.cancellation_policy] && (
                <details className="mb-5 bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 text-xs group">
                  <summary className="cursor-pointer flex items-center gap-2 list-none">
                    <span>{CANCELLATION_POLICIES[selectedSvc.cancellation_policy].icon}</span>
                    <span className="font-semibold text-ink">
                      Cancelación {CANCELLATION_POLICIES[selectedSvc.cancellation_policy].label.toLowerCase()}
                    </span>
                    <span className="text-ink/45 truncate flex-1">
                      · {CANCELLATION_POLICIES[selectedSvc.cancellation_policy].short}
                    </span>
                    <span className="text-ink/40 text-[10px] group-open:rotate-180 transition-transform">▾</span>
                  </summary>
                  <ul className="mt-3 ml-6 space-y-1 list-disc text-ink/65">
                    {CANCELLATION_POLICIES[selectedSvc.cancellation_policy].rules.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </details>
              )}

              {/* Desglose del precio (cliente paga base + 8% Garantía de Éxito) */}
              <div className="rounded-xl p-3.5 mb-5 text-xs bg-cream-dark border border-stone-200">
                <div className="font-bold mb-2 text-ink/60">💳 Desglose</div>
                <div className="flex justify-between mb-1">
                  <span className="text-ink/50">Precio del proveedor</span>
                  <span className="font-semibold">{formatEuro(effectivePrice)}</span>
                </div>
                <div className="flex justify-between mb-1">
                  <span className="text-ink/50" title="Si la reserva falla, FiestaGo te devuelve el dinero (110% si no encontramos sustituto)">
                    Garantía de Éxito (8%) 🛡
                  </span>
                  <span className="text-ink/65">+{formatEuro(commission.amount)}</span>
                </div>
                <div className="flex justify-between border-t border-stone-200 pt-1.5 mt-1.5">
                  <span className="text-ink font-semibold">Total a pagar</span>
                  <span className="font-bold text-coral text-base">{formatEuro(commission.clientPays)}</span>
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
