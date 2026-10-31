// ───────────────────────────────────────────────────────────────────────
// Acuerdos de servicio (piloto WoW, 31-10-2026): el proveedor manda a su
// cliente un documento con lo que incluye el servicio, el precio, cómo se
// paga y las condiciones. Arriba aparece FiestaGo y nada más: los
// compromisos son entre el cliente y el proveedor. El cliente lo acepta
// con su nombre y queda registrado (fecha y huella), lo que da seguridad
// a los dos. Durante el piloto FiestaGo no cobra nada salvo que el
// cliente elija la Garantía de Éxito FiestaGo (si el proveedor la ofrece).
// ───────────────────────────────────────────────────────────────────────

import { randomBytes, createHash } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { precioCliente } from '@/lib/pricing'

const APP_URL = () => (process.env.NEXT_PUBLIC_APP_URL || 'https://fiestago.es').replace(/\/$/, '')
export const newAgreementToken = () => randomBytes(12).toString('hex')
export const agreementUrl = (token: string) => `${APP_URL()}/acuerdo/${token}`

export type Agreement = {
  id: string; token: string; status: 'enviado' | 'aceptado' | 'cancelado'; created_at: string
  client_name: string; client_email: string; client_phone: string | null
  event_type: string | null; event_date: string | null; event_place: string | null; guests: number | null; hours: number | null
  service_title: string; includes: string; not_includes: string | null
  price_total: number; deposit_amount: number | null
  payment_terms: string | null; cancellation_terms: string | null; other_terms: string | null
  guarantee_offered: boolean; guarantee_chosen: boolean | null
  accepted_at: string | null; accepted_name: string | null; accepted_fingerprint: string | null
  provider: { id: string; name: string; city: string | null; email: string | null; legal_name: string | null; tax_id: string | null }
}

/** Precio con la Garantía de Éxito FiestaGo, si el cliente la elige. */
export const withGuarantee = (price: number) => precioCliente(price)

export async function loadAgreement(supabase: SupabaseClient, token: string): Promise<Agreement | null> {
  if (!/^[a-f0-9]{24}$/.test(token || '')) return null
  const { data } = await supabase.from('service_agreements')
    .select('*, providers(id, name, city, email, tax_name, tax_id)').eq('token', token).maybeSingle()
  if (!data) return null
  const p: any = Array.isArray(data.providers) ? data.providers[0] : data.providers
  const { providers, ...a } = data as any
  return {
    ...a, price_total: Number(a.price_total), deposit_amount: a.deposit_amount != null ? Number(a.deposit_amount) : null,
    provider: { id: p?.id, name: p?.name || 'Proveedor', city: p?.city || null, email: p?.email || null, legal_name: p?.tax_name || null, tax_id: p?.tax_id || null },
  }
}

/** Huella de la aceptación: resumen de lo aceptado + cuándo + desde dónde (sin guardar la IP). */
export function acceptanceFingerprint(a: Pick<Agreement, 'token' | 'price_total' | 'includes' | 'service_title'>, name: string, ip: string, ua: string) {
  return createHash('sha256').update([a.token, a.service_title, a.includes, a.price_total, name, ip, ua, new Date().toISOString()].join('|')).digest('hex').slice(0, 32)
}
