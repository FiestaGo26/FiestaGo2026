'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { getPhoto, CATEGORIES, calcCommission } from '@/lib/constants'
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
  specialties: string[]
}

export default function ProviderDetailPage() {
  const params   = useParams()
  const id       = params?.id as string
  const [provider, setProvider] = useState<Provider | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [sending,  setSending]  = useState(false)
  const [booked,   setBooked]   = useState(false)
  const [form, setForm] = useState({
    client_name: '', client_email: '', client_phone: '',
    event_date: '', event_type: 'otro', guests: '', message: '',
  })

  useEffect(() => {
    if (!id) return
    fetch(`/api/providers?limit=1`)
      .then(r => r.json())
      .then(data => {
        // Find by id from all providers
        const found = data.providers?.find((p: Provider) => p.id === id)
        setProvider(found || null)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [id])

  async function handleBook(e: React.FormEvent) {
    e.preventDefault()
    if (!provider) return
    setSending(true)
    try {
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
          total_amount: provider.price_base || 0,
          city:         provider.city,
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setBooked(true)
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

  const cat        = CATEGORIES.find(c => c.id === provider.category)
  const commission = calcCommission(provider.price_base || 0, provider.total_bookings || 0)

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
                src={getPhoto(provider.category, provider.photo_idx || 0, 900, 600)}
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
          <div className="sticky top-24">
            <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-card">

              {/* Price */}
              <div className="mb-5">
                {provider.price_base ? (
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
                  <span className="font-semibold">{(provider.price_base || 0).toLocaleString()}€</span>
                </div>
                <div className="flex justify-between mb-1">
                  <span className="text-ink/50">Comisión FiestaGo</span>
                  <span className={commission.isFree ? 'text-sage font-bold' : 'text-ink/60'}>
                    {commission.isFree ? '¡GRATIS!' : `-${commission.amount.toLocaleString()}€`}
                  </span>
                </div>
                <div className="flex justify-between border-t border-stone-200 pt-1.5 mt-1.5">
                  <span className="text-ink/50">Tú pagas</span>
                  <span className="font-bold text-ink">{(provider.price_base || 0).toLocaleString()}€</span>
                </div>
              </div>

              {booked ? (
                <div className="text-center py-6">
                  <div className="text-4xl mb-3">🎉</div>
                  <div className="font-bold text-ink mb-2">¡Solicitud enviada!</div>
                  <div className="text-sm text-ink/55">
                    {provider.name} recibirá tu solicitud y te contactará pronto.
                  </div>
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
