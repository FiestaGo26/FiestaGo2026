import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { stripe } from '@/lib/stripe-connect'
import { sendEmail } from '@/lib/resend'
import { formatEuro } from '@/lib/pricing'
import { agreementUrl } from '@/lib/agreements'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Webhook de Stripe (lib/stripe-connect.ts). Configurar en Stripe → Desarrolladores → Webhooks con
// la URL https://fiestago.es/api/webhooks/stripe, los eventos checkout.session.completed y
// account.updated ("escuchar eventos de cuentas conectadas" activado para account.updated),
// y guardar su clave de firma en Netlify como STRIPE_WEBHOOK_SECRET.
export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) return NextResponse.json({ error: 'Webhook sin configurar' }, { status: 500 })
  let event
  try {
    event = stripe().webhooks.constructEvent(await req.text(), req.headers.get('stripe-signature') || '', secret)
  } catch (err: any) {
    return NextResponse.json({ error: `Firma no válida: ${err.message}` }, { status: 400 })
  }
  const supabase = createAdminClient()

  if (event.type === 'checkout.session.completed') {
    const s: any = event.data.object
    const id = s.metadata?.agreement_payment_id
    if (id && s.payment_status === 'paid') {
      const { data: pay } = await supabase.from('agreement_payments')
        .update({ status: 'pagado', paid_at: new Date().toISOString(), payment_intent_id: s.payment_intent || null })
        .eq('id', id).neq('status', 'pagado').select('amount, kind, agreement_id').maybeSingle()
      if (pay) {
        const { data: a } = await supabase.from('service_agreements')
          .select('token, client_name, client_email, service_title, providers(name, email)').eq('id', pay.agreement_id).maybeSingle()
        const prov: any = a && (Array.isArray(a.providers) ? a.providers[0] : a.providers)
        if (a) {
          const what = `${pay.kind === 'senal' ? 'la señal' : pay.kind === 'resto' ? 'el resto' : 'el pago'} de «${a.service_title}» (${formatEuro(Number(pay.amount))})`
          await Promise.all([
            sendEmail({ to: a.client_email, subject: `Pago recibido · ${prov?.name || 'FiestaGo'}`, text: `Hola ${a.client_name},\n\nHemos recibido ${what}. Lo tienes registrado en tu acuerdo: ${agreementUrl(a.token)}\n\nFiestaGo` }).catch(() => {}),
            prov?.email ? sendEmail({ to: prov.email, subject: `${a.client_name} te ha pagado · FiestaGo`, text: `Hola ${prov.name},\n\n${a.client_name} ha pagado ${what}. El dinero queda en tu cuenta de cobros hasta que pulses «Cobrar» en tu panel (Acuerdos con clientes). Tienes hasta 90 días.\n\nFiestaGo` }).catch(() => {}) : Promise.resolve(),
          ])
        }
      }
    }
  }
  if (event.type === 'checkout.session.expired') {
    const id = (event.data.object as any).metadata?.agreement_payment_id
    if (id) await supabase.from('agreement_payments').update({ status: 'fallido' }).eq('id', id).eq('status', 'pendiente')
  }
  if (event.type === 'account.updated') {
    const acct: any = event.data.object
    await supabase.from('providers').update({ stripe_charges_enabled: !!acct.charges_enabled, stripe_payouts_enabled: !!acct.payouts_enabled }).eq('stripe_account_id', acct.id)
  }
  return NextResponse.json({ received: true })
}
