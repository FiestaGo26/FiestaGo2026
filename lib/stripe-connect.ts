// ───────────────────────────────────────────────────────────────────────
// Cobros por FiestaGo con Stripe Connect (piloto WoW, 31-10-2026).
//
// · Cada proveedor tiene una cuenta sencilla de Stripe (Express), que abre
//   en 5 minutos desde su panel (DNI y cuenta bancaria).
// · El cliente paga desde el acuerdo (lib/agreements.ts) con un enlace de
//   Stripe Checkout. El dinero va al saldo del proveedor en Stripe, que lo
//   tiene en "pagos manuales": se queda ahí hasta que el proveedor pulsa
//   "Cobrar". Stripe solo permite retenerlo 90 días en España: avisamos
//   antes de que se cumplan.
// · FiestaGo no cobra nada al proveedor en el piloto: la comisión de la
//   plataforma solo cubre lo que cobra Stripe por el pago con tarjeta
//   (STRIPE_FEE_PCT + STRIPE_FEE_FIXED) y, si el cliente elige la Garantía
//   de Éxito FiestaGo, el 8 % de la Garantía.
//
// Sin STRIPE_SECRET_KEY no hace nada (configured() = false).
// ───────────────────────────────────────────────────────────────────────

import Stripe from 'stripe'
import type { SupabaseClient } from '@supabase/supabase-js'
import { FEE_RATE } from '@/lib/pricing'

const APP_URL = () => (process.env.NEXT_PUBLIC_APP_URL || 'https://fiestago.es').replace(/\/$/, '')
export const HOLD_DAYS = 90

let _stripe: Stripe | null = null
export const configured = () => !!process.env.STRIPE_SECRET_KEY
export function stripe() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error('Los cobros por FiestaGo todavía no están activados')
  return (_stripe ||= new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' }))
}

const cents = (eur: number) => Math.round(eur * 100)

/** Lo que cobra Stripe por un pago con tarjeta europea (estimado). */
export function stripeFee(amount: number) {
  const pct = Number(process.env.STRIPE_FEE_PCT ?? 1.5) / 100
  const fixed = Number(process.env.STRIPE_FEE_FIXED ?? 0.25)
  return Math.round((amount * pct + fixed) * 100) / 100
}

/** Crea (si no existe) la cuenta Stripe del proveedor y devuelve el enlace para completar el alta. */
export async function onboardingLink(supabase: SupabaseClient, providerId: string) {
  const { data: p } = await supabase.from('providers').select('id, name, email, stripe_account_id').eq('id', providerId).maybeSingle()
  if (!p) throw new Error('Proveedor no encontrado')
  let account = p.stripe_account_id as string | null
  if (!account) {
    const acct = await stripe().accounts.create({
      type: 'express', country: 'ES', email: p.email || undefined,
      capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
      business_profile: { name: p.name, mcc: '7299', url: `${APP_URL()}/proveedores/${p.id}` },
      settings: { payouts: { schedule: { interval: 'manual' } } },   // el dinero se queda hasta que pulse "Cobrar"
      metadata: { provider_id: p.id },
    })
    account = acct.id
    await supabase.from('providers').update({ stripe_account_id: account }).eq('id', p.id)
  }
  const link = await stripe().accountLinks.create({
    account, type: 'account_onboarding',
    refresh_url: `${APP_URL()}/proveedor/panel?tab=acuerdos&stripe=retry`,
    return_url: `${APP_URL()}/proveedor/panel?tab=acuerdos&stripe=ok`,
  })
  return link.url
}

/** Estado de la cuenta del proveedor, su saldo y hasta cuándo puede dejarlo en Stripe. */
export async function accountStatus(supabase: SupabaseClient, providerId: string) {
  const { data: p } = await supabase.from('providers').select('stripe_account_id').eq('id', providerId).maybeSingle()
  if (!p?.stripe_account_id) return { configured: configured(), account: false as const }
  const acct = await stripe().accounts.retrieve(p.stripe_account_id)
  await supabase.from('providers').update({ stripe_charges_enabled: !!acct.charges_enabled, stripe_payouts_enabled: !!acct.payouts_enabled }).eq('id', providerId)
  let available = 0, pending = 0, lastPayoutAt: string | null = null
  if (acct.charges_enabled) {
    const bal = await stripe().balance.retrieve({ stripeAccount: acct.id })
    available = bal.available.filter(b => b.currency === 'eur').reduce((n, b) => n + b.amount, 0) / 100
    pending = bal.pending.filter(b => b.currency === 'eur').reduce((n, b) => n + b.amount, 0) / 100
    const po = await stripe().payouts.list({ limit: 1 }, { stripeAccount: acct.id })
    lastPayoutAt = po.data[0] ? new Date(po.data[0].created * 1000).toISOString() : null
  }
  // Primer pago todavía sin cobrar: desde ahí cuentan los 90 días
  let q = supabase.from('agreement_payments').select('paid_at').eq('provider_id', providerId).eq('status', 'pagado').order('paid_at', { ascending: true }).limit(1)
  if (lastPayoutAt) q = q.gt('paid_at', lastPayoutAt)
  const { data: oldest } = await q
  const deadline = oldest?.[0]?.paid_at && (available + pending) > 0
    ? new Date(new Date(oldest[0].paid_at).getTime() + HOLD_DAYS * 86400_000).toISOString() : null
  return {
    configured: true, account: true as const,
    ready: !!acct.charges_enabled, payouts_ready: !!acct.payouts_enabled, details_submitted: !!acct.details_submitted,
    available, pending, deadline,
  }
}

/** El proveedor pulsa "Cobrar": pasa a su banco todo el saldo disponible. */
export async function payoutNow(supabase: SupabaseClient, providerId: string) {
  const { data: p } = await supabase.from('providers').select('stripe_account_id').eq('id', providerId).maybeSingle()
  if (!p?.stripe_account_id) throw new Error('Primero abre tu cuenta de cobros')
  const bal = await stripe().balance.retrieve({ stripeAccount: p.stripe_account_id })
  const amount = bal.available.filter(b => b.currency === 'eur').reduce((n, b) => n + b.amount, 0)
  if (amount <= 0) throw new Error('No tienes saldo disponible todavía (los pagos tardan unos días en estar disponibles)')
  const po = await stripe().payouts.create({ amount, currency: 'eur' }, { stripeAccount: p.stripe_account_id })
  return { amount: amount / 100, arrival: new Date(po.arrival_date * 1000).toISOString() }
}

export type PaymentKind = 'senal' | 'resto' | 'total'

/** Enlace de pago (Stripe Checkout) para un acuerdo aceptado. */
export async function checkoutForAgreement(supabase: SupabaseClient, token: string, kind: PaymentKind) {
  const { data: a } = await supabase.from('service_agreements')
    .select('id, token, status, provider_id, client_email, service_title, price_total, deposit_amount, guarantee_chosen, providers(name, stripe_account_id, stripe_charges_enabled)')
    .eq('token', token).maybeSingle()
  if (!a) throw new Error('Acuerdo no encontrado')
  if (a.status !== 'aceptado') throw new Error('Primero hay que aceptar el acuerdo')
  const prov: any = Array.isArray(a.providers) ? a.providers[0] : a.providers
  if (!prov?.stripe_account_id || !prov.stripe_charges_enabled) throw new Error('Este proveedor todavía no cobra por FiestaGo')

  const guarantee = a.guarantee_chosen === true
  const total = guarantee ? Math.round(Number(a.price_total) * (1 + FEE_RATE) * 100) / 100 : Number(a.price_total)
  const { data: paidRows } = await supabase.from('agreement_payments').select('amount').eq('agreement_id', a.id).eq('status', 'pagado')
  const paid = (paidRows || []).reduce((n: number, r: any) => n + Number(r.amount), 0)
  const deposit = a.deposit_amount ? Number(a.deposit_amount) * (guarantee ? 1 + FEE_RATE : 1) : 0
  const amount = Math.round((kind === 'senal' ? deposit : total - paid) * 100) / 100
  if (!(amount > 0.5)) throw new Error(kind === 'senal' ? 'Este acuerdo no tiene señal' : 'No queda nada por pagar')
  if (kind === 'senal' && paid > 0) throw new Error('La señal ya está pagada')

  // Comisión de la plataforma: lo que cobra Stripe + la parte de Garantía (solo si la eligió)
  const guaranteePart = guarantee ? amount - amount / (1 + FEE_RATE) : 0
  const fee = Math.min(amount, Math.round((stripeFee(amount) + guaranteePart) * 100) / 100)

  const { data: row, error } = await supabase.from('agreement_payments')
    .insert({ agreement_id: a.id, provider_id: a.provider_id, kind, amount, application_fee: fee }).select('id').single()
  if (error) throw new Error(error.message)

  const label = kind === 'senal' ? 'Señal' : kind === 'resto' ? 'Resto' : 'Pago'
  const session = await stripe().checkout.sessions.create({
    mode: 'payment', customer_email: a.client_email, locale: 'es',
    line_items: [{ quantity: 1, price_data: { currency: 'eur', unit_amount: cents(amount), product_data: { name: `${label} · ${a.service_title} · ${prov.name}` } } }],
    payment_intent_data: {
      on_behalf_of: prov.stripe_account_id,
      transfer_data: { destination: prov.stripe_account_id },
      application_fee_amount: cents(fee),
      metadata: { agreement_payment_id: row.id, agreement_id: a.id },
    },
    metadata: { agreement_payment_id: row.id, agreement_id: a.id },
    success_url: `${APP_URL()}/acuerdo/${a.token}?pago=ok`,
    cancel_url: `${APP_URL()}/acuerdo/${a.token}`,
  })
  await supabase.from('agreement_payments').update({ checkout_session_id: session.id }).eq('id', row.id)
  return session.url!
}
