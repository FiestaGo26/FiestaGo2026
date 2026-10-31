import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requireProviderAuth } from '@/lib/auth'
import { sendEmail } from '@/lib/resend'
import { formatEuro } from '@/lib/pricing'
import { agreementUrl, newAgreementToken } from '@/lib/agreements'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const txt = (x: unknown, max = 3000) => (typeof x === 'string' ? x.trim().slice(0, max) : '') || null

// GET /api/proveedor/agreements?provider_id=… → sus acuerdos con clientes
export async function GET(req: NextRequest) {
  const providerId = new URL(req.url).searchParams.get('provider_id')
  const auth = await requireProviderAuth(req, providerId)
  if (!auth.ok) return auth.response
  const { data } = await createAdminClient().from('service_agreements')
    .select('id, token, status, created_at, client_name, client_email, event_date, service_title, price_total, guarantee_offered, guarantee_chosen, accepted_at')
    .eq('provider_id', providerId!).order('created_at', { ascending: false }).limit(100)
  return NextResponse.json({ agreements: (data || []).map((a: any) => ({ ...a, url: agreementUrl(a.token) })) })
}

// POST /api/proveedor/agreements — crea el acuerdo y se lo envía al cliente por email
// body { provider_id, client_name, client_email, client_phone?, event_type?, event_date?, event_place?, guests?, hours?,
//        service_title, includes, not_includes?, price_total, deposit_amount?, payment_terms?, cancellation_terms?, other_terms?, guarantee_offered? }
//   o { provider_id, cancel_id } para anularlo (solo si no está aceptado)
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}))
  const auth = await requireProviderAuth(req, b.provider_id)
  if (!auth.ok) return auth.response
  const supabase = createAdminClient()

  if (b.cancel_id) {
    const { data, error } = await supabase.from('service_agreements')
      .update({ status: 'cancelado', cancelled_at: new Date().toISOString() })
      .eq('id', b.cancel_id).eq('provider_id', b.provider_id).eq('status', 'enviado').select('id')
    if (error || !data?.length) return NextResponse.json({ error: 'No se puede anular (¿ya está aceptado?)' }, { status: 400 })
    return NextResponse.json({ ok: true })
  }

  const email = String(b.client_email || '').trim()
  const price = Math.round((Number(b.price_total) || 0) * 100) / 100
  if (!txt(b.client_name, 120) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: 'Pon el nombre y un email válido del cliente' }, { status: 400 })
  if (!txt(b.service_title, 200) || !txt(b.includes)) return NextResponse.json({ error: 'Pon el servicio y qué incluye' }, { status: 400 })
  if (!(price > 0) || price > 500000) return NextResponse.json({ error: 'Pon el precio total (IVA incluido)' }, { status: 400 })
  const deposit = Number(b.deposit_amount) > 0 ? Math.min(Math.round(Number(b.deposit_amount) * 100) / 100, price) : null
  const date = typeof b.event_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.event_date) ? b.event_date : null

  const token = newAgreementToken()
  const { error } = await supabase.from('service_agreements').insert({
    provider_id: b.provider_id, token,
    client_name: txt(b.client_name, 120), client_email: email, client_phone: txt(b.client_phone, 40),
    event_type: txt(b.event_type, 60), event_date: date, event_place: txt(b.event_place, 200),
    guests: parseInt(b.guests) || null, hours: Number(b.hours) > 0 ? Number(b.hours) : null,
    service_title: txt(b.service_title, 200), includes: txt(b.includes), not_includes: txt(b.not_includes),
    price_total: price, deposit_amount: deposit,
    payment_terms: txt(b.payment_terms), cancellation_terms: txt(b.cancellation_terms), other_terms: txt(b.other_terms),
    guarantee_offered: b.guarantee_offered === true,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: prov } = await supabase.from('providers').select('name').eq('id', b.provider_id).maybeSingle()
  const name = prov?.name || 'Tu proveedor'
  await sendEmail({
    to: email,
    subject: `${name} te envía el acuerdo de tu servicio · FiestaGo`,
    text: `Hola ${txt(b.client_name, 120)},\n\n${name} te envía por escrito el acuerdo de «${txt(b.service_title, 200)}»: qué incluye, el precio (${formatEuro(price)}, IVA incluido), cómo se paga y las condiciones.\n\nRevísalo y, si está todo bien, acéptalo desde aquí: ${agreementUrl(token)}\n\nAsí queda registrado lo que habéis acordado, para tranquilidad de los dos.\n\nFiestaGo`,
  }).catch(() => {})
  return NextResponse.json({ ok: true, url: agreementUrl(token) })
}
