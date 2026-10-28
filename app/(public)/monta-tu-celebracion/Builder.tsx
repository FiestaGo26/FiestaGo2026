'use client'

// "Monta tu celebración" (simulaciones 14-15: con el local y todos los
// servicios a la vista y el total, la reserva pasó del 30,9 % al 55,9 %).
// 1) qué celebras, dónde, cuántos y cuántas horas; 2) el local; 3) un
// proveedor por servicio, con opciones económicas, medias y premium;
// 4) total al momento y "Pedir las propuestas" a todos de una vez.

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { CATEGORIES } from '@/lib/constants'
import { formatEuro } from '@/lib/pricing'

type EventKey = 'boda' | 'comunion' | 'infantil' | 'fiesta' | 'despedida' | 'empresa'
const EVENTS: Record<EventKey, { label: string; guests: number; hours: number; needs: string[] }> = {
  boda:      { label: 'Boda',                        guests: 100, hours: 8, needs: ['espacios', 'catering', 'foto', 'musica', 'flores', 'pastel', 'belleza'] },
  comunion:  { label: 'Comunión',                    guests: 50,  hours: 5, needs: ['espacios', 'catering', 'pastel', 'foto', 'animacion', 'belleza'] },
  infantil:  { label: 'Cumpleaños infantil',         guests: 20,  hours: 3, needs: ['espacios', 'animacion', 'pastel'] },
  fiesta:    { label: 'Cumpleaños o fiesta sorpresa', guests: 40, hours: 5, needs: ['espacios', 'catering', 'musica', 'pastel', 'foto'] },
  despedida: { label: 'Despedida de soltero/a',      guests: 15,  hours: 5, needs: ['espacios', 'animacion', 'musica', 'belleza'] },
  empresa:   { label: 'Fiesta de empresa',           guests: 40,  hours: 4, needs: ['espacios', 'catering', 'musica', 'foto'] },
}
const TIER: Record<string, string> = { economica: 'Económica', media: 'Media', premium: 'Premium' }

type Option = {
  provider_id: string; slug: string | null; name: string; city: string | null; rating: number | null; reviews: number
  service_id: string; service_name: string; price: number; per_person: number | null; tier: string | null
  venue_type: string | null; venue_features: Record<string, any> | null; venue_summary: string | null
}

const label = (id: string) => (CATEGORIES as readonly any[]).find(c => c.id === id)?.label || id

export default function Builder() {
  const [event, setEvent] = useState<EventKey>('comunion')
  const [zone, setZone] = useState<'valencia' | 'asturias'>('valencia')
  const [date, setDate] = useState('')
  const [guests, setGuests] = useState(EVENTS.comunion.guests)
  const [hours, setHours] = useState(EVENTS.comunion.hours)
  const [options, setOptions] = useState<Record<string, Option[]>>({})
  const [chosen, setChosen] = useState<Record<string, string | null>>({})   // categoría → provider_id (null = no lo necesito)
  const [loading, setLoading] = useState(false)
  const [contact, setContact] = useState({ name: '', email: '', phone: '' })
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  const needs = EVENTS[event].needs
  useEffect(() => { setGuests(EVENTS[event].guests); setHours(EVENTS[event].hours); setChosen({}) }, [event])
  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true)
      fetch(`/api/celebracion?zone=${zone}&guests=${guests}&hours=${hours}&categories=${needs.join(',')}`)
        .then(r => r.json()).then(d => setOptions(d.byCategory || {})).catch(() => setOptions({}))
        .finally(() => setLoading(false))
    }, 300)
    return () => clearTimeout(t)
  }, [zone, guests, hours, event]) // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (cat: string) => (options[cat] || []).find(o => o.provider_id === chosen[cat]) || null
  const venue = pick('espacios')
  const vf = venue?.venue_features || {}
  const foodIncluded = !!venue && ['restaurante', 'hotel', 'local_con_catering'].includes(venue.venue_type || '')
  const noExternal = !!venue && !!venue.venue_type && !vf.catering_externo
  const cateringBlocked = foodIncluded || noExternal
  const active = needs.filter(c => !(c === 'catering' && cateringBlocked))
  const picked = active.map(pick).filter(Boolean) as Option[]
  const total = useMemo(() => picked.reduce((n, o) => n + o.price, 0), [picked])

  async function requestAll() {
    if (!picked.length) { toast.error('Elige al menos un servicio'); return }
    if (!contact.name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) { toast.error('Pon tu nombre y un email válido'); return }
    setSending(true)
    const summary = `Estoy montando mi ${EVENTS[event].label.toLowerCase()} en FiestaGo (${guests} invitados, ${hours} h${venue ? `, en ${venue.name}${venue.venue_summary ? ` · ${venue.venue_summary}` : ''}` : ''}). Servicios: ${picked.map(o => `${label(active.find(c => pick(c) === o) || '')}: ${o.name}`).join(' · ')}.`
    let ok = 0
    for (const o of picked) {
      const res = await fetch('/api/holds', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'quote', provider_id: o.provider_id, service_id: o.service_id, event_date: date || null, client_name: contact.name, client_email: contact.email, client_phone: contact.phone || null, event_type: EVENTS[event].label, guests, hours, message: summary }),
      }).catch(() => null)
      if (res?.ok) ok++
    }
    setSending(false)
    if (ok) { setSent(true); toast.success(`Propuestas pedidas a ${ok} profesional${ok > 1 ? 'es' : ''}`) }
    else toast.error('No se han podido enviar. Inténtalo de nuevo.')
  }

  if (sent) return (
    <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-card">
      <h2 className="font-serif text-2xl font-bold text-ink mb-2">¡Hecho! Te llegan las propuestas por email</h2>
      <p className="text-ink/70 text-sm">Cada profesional te manda su propuesta por escrito: precio cerrado para tu caso, qué incluye y la señal. En cuanto llegue la primera, desde su enlace verás <strong>Tu celebración</strong> con todo junto y el total. Si te surge cualquier duda, responde a cualquier email de FiestaGo y te llamamos.</p>
    </div>
  )

  return (
    <div className="pb-32">
      {/* 1. Qué celebras */}
      <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-card mb-5">
        <div className="flex flex-wrap gap-2 mb-4">
          {(Object.keys(EVENTS) as EventKey[]).map(k => (
            <button key={k} onClick={() => setEvent(k)}
              className={`text-xs font-bold px-3 py-2 rounded-xl ${event === k ? 'bg-coral text-white' : 'bg-cream border border-stone-200 text-ink'}`}>{EVENTS[k].label}</button>
          ))}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-semibold text-ink">
          <label>Dónde
            <select value={zone} onChange={e => setZone(e.target.value as any)} className="mt-1 w-full border border-stone-200 rounded-xl px-2 py-2 text-sm">
              <option value="valencia">Valencia</option><option value="asturias">Asturias</option>
            </select>
          </label>
          <label>Fecha
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="mt-1 w-full border border-stone-200 rounded-xl px-2 py-2 text-sm"/>
          </label>
          <label>Invitados
            <input type="number" min={1} max={2000} value={guests} onChange={e => setGuests(Math.max(1, Number(e.target.value) || 1))} className="mt-1 w-full border border-stone-200 rounded-xl px-2 py-2 text-sm"/>
          </label>
          <label>Horas
            <input type="number" min={1} max={24} value={hours} onChange={e => setHours(Math.max(1, Number(e.target.value) || 1))} className="mt-1 w-full border border-stone-200 rounded-xl px-2 py-2 text-sm"/>
          </label>
        </div>
      </div>

      {/* 2-3. Local y servicios */}
      {needs.map(cat => {
        const list = options[cat] || []
        if (cat === 'catering' && cateringBlocked) return (
          <div key={cat} className="bg-white border border-stone-200 rounded-2xl p-5 mb-4 text-sm text-ink/70">
            <strong className="text-ink">{label(cat)}</strong>: {foodIncluded ? `${venue!.name} ya incluye la comida en su precio.` : `${venue!.name} no admite catering externo: la comida es la del local.`}
          </div>
        )
        return (
          <div key={cat} className="bg-white border border-stone-200 rounded-2xl p-5 mb-4">
            <div className="flex justify-between items-baseline mb-3">
              <h2 className="font-serif text-xl font-bold text-ink">{cat === 'espacios' ? '1. El local' : label(cat)}</h2>
              <button onClick={() => setChosen(c => ({ ...c, [cat]: null }))} className={`text-xs ${chosen[cat] === null ? 'text-coral font-bold' : 'text-ink/50'}`}>
                {cat === 'espacios' ? 'Ya tengo sitio' : 'No lo necesito'}
              </button>
            </div>
            {loading && !list.length && <p className="text-xs text-ink/50">Buscando…</p>}
            {!loading && !list.length && <p className="text-sm text-ink/60">Todavía no hay {label(cat).toLowerCase()} en FiestaGo en esta zona. Estamos sumando profesionales cada semana.</p>}
            <div className="space-y-2">
              {list.map(o => (
                <label key={o.provider_id} className={`flex gap-3 items-start border rounded-xl p-3 cursor-pointer ${chosen[cat] === o.provider_id ? 'border-coral bg-coral/5' : 'border-stone-200'}`}>
                  <input type="radio" name={cat} checked={chosen[cat] === o.provider_id} onChange={() => setChosen(c => ({ ...c, [cat]: o.provider_id }))} className="mt-1 accent-coral"/>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between gap-2">
                      <span className="font-semibold text-ink text-sm">{o.name}</span>
                      <span className="font-bold text-ink text-sm whitespace-nowrap">{formatEuro(o.price)}</span>
                    </div>
                    <div className="text-xs text-ink/60">
                      {o.tier && <span className="font-semibold text-coral">{TIER[o.tier]} · </span>}
                      {o.service_name}{o.per_person ? ` · ≈ ${formatEuro(o.per_person)} por invitado` : ''}{o.rating ? ` · ${String(o.rating).replace('.', ',')} ★ (${o.reviews})` : ''}
                    </div>
                    {o.venue_summary && <div className="text-xs text-ink/70 mt-0.5">{o.venue_summary}</div>}
                    <Link href={`/proveedores/${o.slug || o.provider_id}`} target="_blank" className="text-[11px] underline text-ink/55">Ver ficha, fotos y opiniones</Link>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )
      })}

      {/* 4. Pedir las propuestas */}
      {picked.length > 0 && (
        <div className="bg-white border border-stone-200 rounded-2xl p-5 mb-4">
          <h2 className="font-serif text-xl font-bold text-ink mb-1">Pide las propuestas</h2>
          <p className="text-xs text-ink/60 mb-3">Cada profesional te manda por escrito su propuesta con el precio cerrado para tu caso. Sin compromiso: reservas solo lo que quieras, con una señal del 10-20 %, y tienes 7 días de Reserva sin riesgo.</p>
          <div className="grid sm:grid-cols-3 gap-2">
            <input value={contact.name} onChange={e => setContact(c => ({ ...c, name: e.target.value }))} placeholder="Tu nombre" className="border border-stone-200 rounded-xl px-3 py-2 text-sm"/>
            <input value={contact.email} onChange={e => setContact(c => ({ ...c, email: e.target.value }))} placeholder="Tu email" type="email" className="border border-stone-200 rounded-xl px-3 py-2 text-sm"/>
            <input value={contact.phone} onChange={e => setContact(c => ({ ...c, phone: e.target.value }))} placeholder="Teléfono (opcional)" className="border border-stone-200 rounded-xl px-3 py-2 text-sm"/>
          </div>
          <button onClick={requestAll} disabled={sending} className="mt-3 w-full bg-coral text-white font-bold py-3 rounded-xl disabled:opacity-50">
            {sending ? 'Enviando…' : `Pedir las propuestas a ${picked.length} profesional${picked.length > 1 ? 'es' : ''}`}
          </button>
        </div>
      )}

      {/* Total siempre a la vista */}
      <div className="fixed bottom-0 inset-x-0 bg-white border-t border-stone-200 shadow-lg z-40">
        <div className="max-w-3xl mx-auto px-4 py-3 flex justify-between items-center gap-3">
          <div className="text-xs text-ink/60">{picked.length ? `${picked.length} servicio${picked.length > 1 ? 's' : ''} · IVA y Garantía incluidos` : 'Elige los servicios y verás el total'}</div>
          <div className="text-right">
            <div className="font-serif text-2xl font-black text-coral">{formatEuro(total)}</div>
            {guests > 0 && total > 0 && <div className="text-[11px] text-ink/55">≈ {formatEuro(Math.round((total / guests) * 100) / 100)} por invitado</div>}
          </div>
        </div>
      </div>
    </div>
  )
}
