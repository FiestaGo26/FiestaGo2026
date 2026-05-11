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

  function selectService(svc: Service) {
    setSelectedSvc(svc)
    setForm(f => ({
      ...f,
      message: `Hola, me gustaría reservar el servicio "${svc.name}"${svc.price != null ? ` (${svc.price.toLocaleString()}€)` : ''}.${f.message ? `\n\n${f.message}` : ''}`,
    }))
    // Scroll al formulario en mobile
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
      const data = await res.json()
      if (data.error) throw new Error(data.error)
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
    <div className="min-h-screen bg-cream flex items-center justify-center">
      <div className="text-ink/40">Cargando...</div>
    </div>
  )

  if (!provider) return (
    <div className="min-h-screen bg-cream flex items-center justify-center">
      <div className="text-center">
        <div className="text-5xl mb-4">😔</div>
        <h2 className="font-serif text-2xl font-bold text-ink mb-3">Proveedor no encontrado</h2>
        <Link href="/proveedores" className="text-coral font-semibold hover:underline">
          ← Ver todos los proveedores
        </Link>
      </div>
    </div>
  )

  const cat = CATEGORIES.find(c => c.id === provider.category)
  const effectivePrice = selectedSvc?.price ?? provider.price_base ?? 0
  const commission     = calcCommission(effectivePrice, provider.total_bookings || 0)

  return (
    <div className="min-h-screen bg-cream">
      <div className="max-w-6xl mx-auto px-6 py-10">

        {/* Back */}
        <Link href="/proveedores" className="inline-flex items-center gap-2 text-sm text-ink/50 hover:text-coral mb-6 transition-colors">
          ← Volver a proveedores
        </Link>

        <div className="grid lg:grid-cols-[1fr_380px] gap-8 items-start">

          {/* ── LEFT ── */}
          <div>
            {/* Hero photo */}
            <div className="relative h-72 rounded-2xl overflow-hidden mb-5 bg-stone-200">
              <img
                src={provider.photo_url || getPhoto(provider.category, provider.photo_idx || 0, 900, 600)}
                alt={provider.name}
                className="w-full h-full object-cover"
                onError={e => { (e.target as HTMLImageElement).src = `https://picsum.photos/seed/${provider.id}/900/600` }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"/>
              <div className="absolute bottom-5 left-5">
                {provider.tag && (
                  <span className="text-xs font-bold px-3 py-1 rounded-full bg-white/90 text-ink mb-2 inline-block">
                    {provider.tag}
                  </span>
                )}
                {provider.verified && (
                  <span className="text-xs font-bold px-3 py-1 rounded-full bg-white/90 text-ink mb-2 ml-2 inline-block">
                    🛡️ Verificado
                  </span>
                )}
              </div>
            </div>

            {/* Gallery */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              {[1, 2, 3].map(offset => (
                <div key={offset} className="h-24 rounded-xl overflow-hidden bg-stone-200">
                  <img
                    src={getPhoto(provider.category, (provider.photo_idx || 0) + offset, 400, 300)}
                    alt=""
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                  />
                </div>
              ))}
            </div>

            {/* Info */}
            <div className="bg-white border border-stone-200 rounded-2xl p-6 mb-5">
              <div className="text-xs font-bold uppercase tracking-wide mb-2"
                style={{ color: cat?.color || '#E8553E' }}>
                {cat?.icon} {cat?.label}
              </div>
              <h1 className="font-serif text-3xl font-black text-ink mb-2">{provider.name}</h1>
              <div className="flex items-center gap-4 mb-4 text-sm text-ink/50">
                <span>📍 {provider.city}</span>
                {provider.rating > 0 && (
                  <span className="flex items-center gap-1">
                    <span className="text-gold">★</span>
                    <span className="font-semibold text-ink">{provider.rating}</span>
                    {provider.total_reviews > 0 && <span>({provider.total_reviews} reseñas)</span>}
                  </span>
                )}
                {provider.total_bookings > 0 && (
                  <span>✅ {provider.total_bookings} reservas</span>
                )}
              </div>
              {provider.description && (
                <p className="text-ink/60 leading-relaxed">{provider.description}</p>
              )}
            </div>

            {/* Specialties */}
            {provider.specialties?.length > 0 && (
              <div className="bg-white border border-stone-200 rounded-2xl p-6 mb-5">
                <h3 className="font-semibold text-ink mb-4">Especialidades</h3>
                <div className="flex flex-wrap gap-2">
                  {provider.specialties.map((s, i) => (
                    <span key={i} className="text-sm px-3 py-1.5 rounded-xl bg-cream-dark text-ink/70 border border-stone-200">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Servicios disponibles */}
            {services.length > 0 && (
              <div className="bg-white border border-stone-200 rounded-2xl p-6 mb-5">
                <div className="flex items-baseline justify-between mb-4">
                  <h3 className="font-semibold text-ink">Servicios disponibles</h3>
                  <span className="text-xs text-ink/40">{services.length} {services.length === 1 ? 'opción' : 'opciones'}</span>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  {services.map(svc => {
                    const isSelected = selectedSvc?.id === svc.id
                    return (
                      <div key={svc.id}
                        className={`border rounded-2xl overflow-hidden flex flex-col transition-all ${
                          isSelected ? 'border-coral ring-2 ring-coral/30 shadow-lg' : 'border-stone-200 hover:border-coral/50 hover:shadow-md'
                        }`}>
                        {svc.media_url && svc.media_type === 'image' && (
                          <div className="aspect-video bg-stone-100 overflow-hidden">
                            <img src={svc.media_url} alt={svc.name} className="w-full h-full object-cover" />
                          </div>
                        )}
                        {svc.media_url && svc.media_type === 'video' && (
                          <div className="aspect-video bg-black overflow-hidden">
                            <video src={svc.media_url} controls className="w-full h-full object-cover" />
                          </div>
                        )}
                        <div className="p-4 flex flex-col flex-1">
                          <div className="flex items-start justify-between gap-2 mb-1.5">
                            <h4 className="font-semibold text-ink leading-tight">{svc.name}</h4>
                            {isSelected && <span className="text-[10px] font-bold text-coral whitespace-nowrap">✓ ELEGIDO</span>}
                          </div>
                          <div className="flex flex-wrap gap-1.5 mb-2">
                            {svc.duration && (
                              <span className="text-[11px] text-ink/55 bg-stone-100 px-2 py-0.5 rounded-full">⏱ {svc.duration}</span>
                            )}
                            {svc.max_guests != null && (
                              <span className="text-[11px] text-ink/55 bg-stone-100 px-2 py-0.5 rounded-full">👥 hasta {svc.max_guests}</span>
                            )}
                          </div>
                          {svc.description && (
                            <p className="text-xs text-ink/55 leading-relaxed mb-3 line-clamp-3">{svc.description}</p>
                          )}
                          <div className="flex items-end justify-between mt-auto pt-2 border-t border-stone-100">
                            <div>
                              {svc.price != null ? (
                                <>
                                  <span className="font-serif text-xl font-bold text-coral">{svc.price.toLocaleString()}€</span>
                                  <span className="text-[10px] text-ink/40 block">{svc.price_unit}</span>
                                </>
                              ) : (
                                <span className="text-sm text-ink/40">A consultar</span>
                              )}
                            </div>
                            <button onClick={() => selectService(svc)}
                              className={`text-xs font-bold px-3 py-2 rounded-xl transition-all ${
                                isSelected
                                  ? 'bg-coral text-white'
                                  : 'border border-stone-200 text-ink/60 hover:border-coral hover:text-coral'
                              }`}>
                              {isSelected ? '✓ Reservar' : 'Reservar →'}
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Contact */}
            <div className="bg-white border border-stone-200 rounded-2xl p-6">
              <h3 className="font-semibold text-ink mb-4">Contacto</h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  ['📧', provider.email, provider.email ? `mailto:${provider.email}` : null],
                  ['📞', provider.phone, provider.phone ? `tel:${provider.phone}` : null],
                  ['🌐', provider.website, provider.website],
                  ['📸', provider.instagram, provider.instagram ? `https://instagram.com/${provider.instagram.replace('@','')}` : null],
                ].map(([icon, val, href]) => val ? (
                  <a key={icon as string} href={href as string} target="_blank" rel="noreferrer"
                    className="flex items-center gap-2 text-sm text-ink/60 hover:text-coral transition-colors">
                    <span>{icon}</span>
                    <span className="truncate">{val}</span>
                  </a>
                ) : null)}
              </div>
            </div>
          </div>

          {/* ── RIGHT — BOOKING FORM ── */}
          <div className="sticky top-24" id="booking-form">
            <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-card">

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
                      <span className="font-serif text-3xl font-black" style={{ color: cat?.color }}>
                        {selectedSvc.price.toLocaleString()}€
                      </span>
                      <span className="text-sm text-ink/40"> {selectedSvc.price_unit}</span>
                    </>
                  ) : (
                    <span className="text-lg text-ink/50">A consultar</span>
                  )
                ) : provider.price_base ? (
                  <>
                    <span className="text-xs text-ink/40">desde </span>
                    <span className="font-serif text-3xl font-black" style={{ color: cat?.color }}>
                      {provider.price_base.toLocaleString()}€
                    </span>
                    <span className="text-sm text-ink/40"> {provider.price_unit}</span>
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
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-ink/50 uppercase tracking-widest mb-1">Fecha *</label>
                      <input required type="date" value={form.event_date}
                        onChange={e => setForm(f => ({ ...f, event_date: e.target.value }))}
                        className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm text-ink outline-none focus:border-coral transition-colors"/>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-ink/50 uppercase tracking-widest mb-1">Invitados</label>
                      <input type="number" value={form.guests} placeholder="ej. 80"
                        onChange={e => setForm(f => ({ ...f, guests: e.target.value }))}
                        className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm text-ink outline-none focus:border-coral transition-colors"/>
                    </div>
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
                    className="w-full py-3 rounded-xl font-bold text-sm text-white transition-colors disabled:opacity-50"
                    style={{ background: cat?.color || '#E8553E' }}>
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
    </div>
  )
}
