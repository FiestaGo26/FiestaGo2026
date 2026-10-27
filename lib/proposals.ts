// ───────────────────────────────────────────────────────────────────────
// Propuesta escrita (6.ª simulación, embudo completo).
//
// Nadie pagaba la señal con una cotización genérica: querían un precio
// cerrado para SUS invitados y SU fecha, qué incluye, la señal en euros y
// las condiciones por escrito, y poder enseñárselo a su pareja o familia.
//
// El proveedor responde a una petición (bloqueo 48 h o presupuesto) desde
// su panel con precio total + qué incluye + señal. El cliente lo ve en
// /propuesta/<token> y reserva desde ahí con ese precio exacto.
//
// También aquí el seguimiento durante el bloqueo de 48 h: un único
// mensaje de ayuda (no de presión, el recordatorio "¿reservas?" alejaba
// al 42 %) y un aviso al proveedor si aún no ha respondido.
// ───────────────────────────────────────────────────────────────────────

import type { SupabaseClient } from '@supabase/supabase-js'
import { randomBytes } from 'crypto'
import { calcCommission, CANCELLATION_POLICIES, type CancellationPolicy } from '@/lib/constants'
import { computePaymentSchedule } from '@/lib/booking-payments'
import { cleanDeposit, precioCliente, priceFor, pricingUnit, type GuestPricing } from '@/lib/pricing'
import { sendEmail } from '@/lib/resend'

const APP_URL = () => (process.env.NEXT_PUBLIC_APP_URL || 'https://fiestago.es').replace(/\/$/, '')

export const newProposalToken = () => randomBytes(12).toString('hex')

export type ProposalQuestion = {
  q: string; asked_at: string; a: string | null; answered_at: string | null
  /** Quién contesta: FiestaGo (garantía, pagos, cancelaciones) o el proveedor */
  by?: 'fiestago' | 'proveedor'
}

/** Lo que el proveedor confirma en su propuesta además del precio. */
export type QuoteDetails = {
  fecha_confirmada?: boolean
  no_incluye?: string
  plan_b?: string
  /** Lo que necesita del local o del cliente (corriente, cocina, espacio…) */
  requisitos?: string
  /** Extras opcionales con el precio que cobra el proveedor (el cliente los ve con IVA y Garantía) */
  extras?: Array<{ id: string; label: string; price: number }>
}

export type ProposalExtra = { id: string; label: string; price: number; provider_price: number }

/** El cliente ve UN solo precio en toda la web (el desglose, solo en la factura): el del servicio, con IVA y Garantía de
 *  Éxito incluidos. Los textos libres del proveedor no llevan cifras: los
 *  extras (invitado u hora de más, carpa…) van como extras con su precio
 *  final. Si escribe alguna cifra, se quita para que nunca haya dos. */
export function stripPrices(text: string) {
  return text
    .replace(/(?:€\s*)\d[\d.,]*/g, '(importe aparte: pregúntalo en la propuesta)')
    .replace(/\d[\d.,]*\s*(?:€|euros?\b|eur\b)(?:\s*\/\s*\w+)?/gi, '(importe aparte: pregúntalo en la propuesta)')
}

/** Compensación de la Garantía si el proveedor no se presenta, según el importe. */
export function noShowCompensation(total: number) {
  return total <= 500 ? 300 : total <= 2000 ? 500 : total <= 5000 ? 1000 : total <= 15000 ? 2000 : 3000
}

/** Quita importes de un mensaje del proveedor (se ve el precio de la propuesta). */
export function maskPrices(text: string) {
  return text
    .replace(/(?:€\s*)\d[\d.,]*/g, '[ver precio de la propuesta]')
    .replace(/\d[\d.,]*\s*(?:€|euros?\b|eur\b)/gi, '[ver precio de la propuesta]')
}
export const proposalUrl = (token: string) => `${APP_URL()}/propuesta/${token}`

export type Proposal = {
  token: string
  hold_id: string
  status: string
  kind: string
  expires_at: string | null
  created_at: string
  replied_at: string | null
  client_name: string
  client_email: string
  event_date: string | null
  event_type: string | null
  guests: number | null
  includes: string
  reply: string | null
  hours: number | null
  details: QuoteDetails
  photos: string[]
  per_person: number | null
  /** Extras que el cliente puede añadir al reservar (precio final de cada uno) */
  extras: ProposalExtra[]
  /** Si sois más invitados u horas: precio final por cada uno de más */
  unit_extra: { label: string; price: number } | null
  questions: ProposalQuestion[]
  provider: {
    id: string; name: string; slug: string | null; category: string; city: string | null
    photo_url: string | null; years_active: number | null; verified: boolean | null
    rating: number | null; total_reviews: number | null
    google_rating: number | null; google_rating_count: number | null
  }
  service: { id: string; name: string; cancellation_policy: CancellationPolicy | null } | null
  base: number            // precio del proveedor (sin Garantía)
  total: number           // lo que paga el cliente (Garantía incluida)
  deposit_pct: number
  first_payment: number
  second_payment: number
  second_payment_due: string | null
  cancellation: { label: string; rules: string[] } | null
}

/** Carga la propuesta por token (null si no existe o no tiene precio). */
export async function loadProposal(supabase: SupabaseClient, token: string): Promise<Proposal | null> {
  if (!/^[a-f0-9]{24}$/.test(token || '')) return null
  const { data: h } = await supabase.from('date_holds')
    .select('id, kind, status, created_at, expires_at, replied_at, client_name, client_email, event_date, event_type, guests, hours, quote_details, provider_reply, quote_total, quote_includes, quote_deposit_pct, proposal_token, provider_id, service_id, questions')
    .eq('proposal_token', token).maybeSingle()
  if (!h || !(Number(h.quote_total) > 0)) return null

  const [{ data: p }, { data: s }, { data: media }] = await Promise.all([
    supabase.from('providers')
      .select('id, name, slug, category, city, photo_url, years_active, verified, rating, total_reviews, google_rating, google_rating_count')
      .eq('id', h.provider_id).maybeSingle(),
    h.service_id
      ? supabase.from('provider_services').select('id, name, cancellation_policy, pricing_unit, included_guests, extra_guest_price, included_hours, extra_hour_price').eq('id', h.service_id).maybeSingle()
      : Promise.resolve({ data: null } as any),
    // Fotos de sus trabajos (8.ª simulación: pedían ver eventos parecidos)
    h.service_id
      ? supabase.from('service_media').select('url, thumbnail_url, media_type').eq('service_id', h.service_id)
          .order('is_primary', { ascending: false }).order('sort_order', { ascending: true }).limit(6)
      : Promise.resolve({ data: [] } as any),
  ])
  if (!p) return null
  const photos = ((media || []) as any[]).filter(m => m.media_type !== 'video').map(m => m.thumbnail_url || m.url).filter(Boolean)
  if (!photos.length && p.photo_url) photos.push(p.photo_url)

  const base = Math.round(Number(h.quote_total) * 100) / 100
  const commission = calcCommission(base)
  const depositPct = cleanDeposit(h.quote_deposit_pct)
  const schedule = computePaymentSchedule(base, commission.amount, depositPct, h.event_date || new Date().toISOString().slice(0, 10))
  const pol = s?.cancellation_policy ? CANCELLATION_POLICIES[s.cancellation_policy as CancellationPolicy] : null

  return {
    token, hold_id: h.id, status: h.status, kind: h.kind,
    expires_at: h.expires_at, created_at: h.created_at, replied_at: h.replied_at,
    client_name: h.client_name, client_email: h.client_email,
    event_date: h.event_date, event_type: h.event_type, guests: h.guests,
    includes: stripPrices(h.quote_includes || ''), reply: h.provider_reply ? stripPrices(h.provider_reply) : null,
    questions: (Array.isArray(h.questions) ? h.questions : []).map((q: ProposalQuestion) =>
      q.a && q.by !== 'fiestago' ? { ...q, a: stripPrices(q.a) } : q),
    hours: h.hours ?? null,
    details: Object.fromEntries(Object.entries((h.quote_details || {}) as QuoteDetails)
      .map(([k, v]) => [k, typeof v === 'string' ? stripPrices(v) : v])) as QuoteDetails,
    photos,
    per_person: Number(h.guests) > 0 ? Math.round((commission.clientPays / Number(h.guests)) * 100) / 100 : null,
    extras: (((h.quote_details || {}) as QuoteDetails).extras || [])
      .filter(e => e && e.label && Number(e.price) > 0)
      .map(e => ({ id: String(e.id), label: e.label, price: precioCliente(Number(e.price)), provider_price: Number(e.price) })),
    unit_extra: s && pricingUnit(s) === 'guests' ? { label: 'invitado de más', price: precioCliente(Number(s.extra_guest_price)) }
      : s && pricingUnit(s) === 'hours' ? { label: 'hora de más', price: precioCliente(Number(s.extra_hour_price)) } : null,
    provider: p as Proposal['provider'],
    service: s || null,
    base, total: commission.clientPays, deposit_pct: depositPct,
    first_payment: schedule.firstPaymentAmount,
    second_payment: schedule.secondPaymentAmount,
    second_payment_due: schedule.secondPaymentDueDate,
    cancellation: pol ? { label: pol.label, rules: pol.rules } : null,
  }
}

/** Precio sugerido al proveedor para una petición (su tarifa según invitados). */
export function suggestedBase(svc: GuestPricing | null, guests: number | null, hours?: number | null) {
  if (!svc || svc.price == null) return null
  return priceFor(svc, { guests, hours })
}

// ─── Seguimiento durante el bloqueo de 48 h ──────────────────────────

const H = 3600_000

/**
 * Una vez por petición, a partir de las 20 h:
 *  · al cliente, un mensaje de ayuda (propuesta escrita si la hay, o
 *    "¿te llamamos?"), nunca un "¿reservas ya?";
 *  · al proveedor que aún no ha respondido, un aviso para que mande la
 *    propuesta (sin ella casi nadie reserva).
 */
export async function holdFollowups(supabase: SupabaseClient) {
  const { data: holds } = await supabase.from('date_holds')
    .select('id, kind, client_name, client_email, client_phone, preferred_time, event_date, proposal_token, quote_total, replied_at, expires_at, provider_id, questions, providers(name, email, slug)')
    .in('kind', ['hold', 'quote']).eq('status', 'active').is('followup_sent_at', null)
    .lt('created_at', new Date(Date.now() - 20 * H).toISOString())
    .gt('created_at', new Date(Date.now() - 7 * 24 * H).toISOString())
    .limit(50)

  let sent = 0
  for (const h of holds || []) {
    const prov: any = Array.isArray(h.providers) ? h.providers[0] : h.providers
    const name = prov?.name || 'el proveedor'
    const hasProposal = !!h.proposal_token && Number(h.quote_total) > 0
    const qs: ProposalQuestion[] = Array.isArray(h.questions) ? h.questions : []
    const pending = qs.filter(q => !q.a)
    const until = h.expires_at
      ? new Date(h.expires_at).toLocaleString('es-ES', { timeZone: 'Europe/Madrid', weekday: 'long', hour: '2-digit', minute: '2-digit' })
      : null

    // 8.ª simulación: el email de seguimiento alejaba al 93 % y la llamada
    // acercaba al 78 %. Con teléfono, llama una persona de FiestaGo; sin él,
    // un email corto que ofrece la llamada.
    if (h.client_phone) {
      await sendEmail({
        to: process.env.ADMIN_EMAIL || 'contacto@fiestago.es',
        subject: `📞 Llama a ${h.client_name} · ${name}`,
        text: `Seguimiento a las ~20 h de su petición. Llámale (sin presión: resolver dudas, no "¿reservas?").\n\nTeléfono: ${h.client_phone}${h.preferred_time ? ` (${h.preferred_time})` : ''}\nProveedor: ${name}\nFecha: ${h.event_date || 'por concretar'}\n${hasProposal ? `Propuesta: ${proposalUrl(h.proposal_token!)}` : 'El proveedor aún no ha mandado propuesta: empújale.'}\n${pending.length ? `Preguntas sin contestar: ${pending.map(q => `"${q.q}"`).join(' · ')}` : ''}${until && h.kind === 'hold' ? `\nBloqueo hasta: ${until}` : ''}`,
      }).catch(() => {})
    } else {
      await sendEmail({
        to: h.client_email,
        subject: `¿Te llamamos para lo de ${name}?`,
        text: `Hola ${h.client_name},\n\n¿Te queda alguna duda sobre ${name}? Contesta a este email con tu teléfono y una hora, y te llama una persona de FiestaGo para resolverlo. Sin compromiso.${hasProposal ? `\n\nTu propuesta, por si quieres enseñársela a alguien: ${proposalUrl(h.proposal_token!)}` : ''}\n\nFiestaGo`,
      }).catch(() => {})
    }

    if (!h.replied_at && prov?.email) {
      await sendEmail({
        to: prov.email,
        subject: `⏳ Un cliente espera tu propuesta · FiestaGo`,
        text: `Hola,\n\nUn cliente${h.event_date ? ` con evento el ${h.event_date}` : ''} lleva casi un día esperando tu propuesta. Según nuestras pruebas con clientes, casi nadie reserva sin un precio cerrado para su caso por escrito.\n\nMándasela desde tu panel ("Peticiones de clientes"): precio total para sus invitados, qué incluye y la señal. Tarda un minuto.\n\n${APP_URL()}/proveedor/panel\n\nFiestaGo`,
      }).catch(() => {})
    }

    await supabase.from('date_holds').update({ followup_sent_at: new Date().toISOString() }).eq('id', h.id)
    sent++
  }
  return sent
}
