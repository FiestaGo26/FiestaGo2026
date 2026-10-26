import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requireProviderAuth } from '@/lib/auth'
import { maskContacts } from '@/lib/date-holds'
import { sendEmail } from '@/lib/resend'
import { cleanDeposit, pricingUnit } from '@/lib/pricing'
import { maskPrices, newProposalToken, proposalUrl, suggestedBase, type ProposalQuestion } from '@/lib/proposals'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Peticiones de clientes (presupuestos y fechas bloqueadas 48 h) para el
// panel del proveedor. Nunca devuelve email ni teléfono del cliente: el
// proveedor responde aquí y FiestaGo se lo envía al cliente. Así la venta
// no se cierra fuera de la plataforma (los datos se ven al pagar la señal).

// GET /api/proveedor/requests?provider_id=...
export async function GET(req: NextRequest) {
  const providerId = new URL(req.url).searchParams.get('provider_id')
  const auth = await requireProviderAuth(req, providerId)
  if (!auth.ok) return auth.response

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('date_holds')
    .select('id, created_at, kind, status, service_id, event_date, expires_at, client_name, event_type, guests, message, hours, provider_reply, replied_at, quote_total, quote_includes, quote_deposit_pct, proposal_token, questions')
    .eq('provider_id', providerId!)
    .in('kind', ['hold', 'quote'])
    .gte('created_at', new Date(Date.now() - 90 * 86400_000).toISOString())
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Precio sugerido: su tarifa para los invitados de esa petición
  const svcIds = Array.from(new Set((data || []).map((r: any) => r.service_id).filter(Boolean)))
  const { data: svcs } = svcIds.length
    ? await supabase.from('provider_services').select('id, name, price, pricing_unit, included_guests, extra_guest_price, included_hours, extra_hour_price, deposit_pct').in('id', svcIds)
    : { data: [] as any[] }
  const byId = new Map((svcs || []).map((s: any) => [s.id, s]))

  const requests = (data || []).map((r: any) => {
    const svc: any = r.service_id ? byId.get(r.service_id) : null
    return {
      ...r,
      client_name: String(r.client_name || '').trim().split(/\s+/)[0] || 'Cliente',
      message: r.message ? maskContacts(r.message) : null,
      service_name: svc?.name || null,
      suggested_total: suggestedBase(svc, r.guests, r.hours),
      pricing_unit: svc ? pricingUnit(svc) : null,
      suggested_deposit_pct: cleanDeposit(svc?.deposit_pct),
      proposal_url: r.proposal_token && r.quote_total ? proposalUrl(r.proposal_token) : null,
    }
  })
  return NextResponse.json({ requests })
}

// POST /api/proveedor/requests — body: { provider_id, id, reply, total, includes, deposit_pct }
//   o, para contestar una pregunta del cliente: { provider_id, id, question_index, answer }
// Con total → propuesta escrita (precio cerrado para ese cliente) que el
// cliente ve en /propuesta/<token> y desde la que reserva.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const auth = await requireProviderAuth(req, body.provider_id)
  if (!auth.ok) return auth.response

  if (body.question_index != null) return answerQuestion(body)

  const reply = String(body.reply || '').trim().slice(0, 3000)
  const total = Math.round((Number(body.total) || 0) * 100) / 100
  const includes = String(body.includes || '').trim().slice(0, 3000)
  if (!body.id) return NextResponse.json({ error: 'Petición no válida' }, { status: 400 })
  if (total > 0 && includes.length < 5) return NextResponse.json({ error: 'Explica qué incluye el precio' }, { status: 400 })
  if (!(total > 0) && reply.length < 5) return NextResponse.json({ error: 'Escribe tu respuesta o pon un precio' }, { status: 400 })

  const supabase = createAdminClient()
  const { data: hold } = await supabase
    .from('date_holds')
    .select('id, provider_id, client_name, client_email, kind, event_date, guests, proposal_token, providers(name, slug)')
    .eq('id', body.id).maybeSingle()
  if (!hold || hold.provider_id !== body.provider_id) {
    return NextResponse.json({ error: 'Petición no encontrada' }, { status: 404 })
  }

  const safeReply = reply ? maskPrices(maskContacts(reply)) : null
  const token = total > 0 ? (hold.proposal_token || newProposalToken()) : null
  await supabase.from('date_holds')
    .update({
      provider_reply: safeReply, replied_at: new Date().toISOString(),
      ...(token ? {
        quote_total: total, quote_includes: maskContacts(includes),
        quote_deposit_pct: cleanDeposit(body.deposit_pct), proposal_token: token,
      } : {}),
    })
    .eq('id', hold.id)

  const prov: any = Array.isArray(hold.providers) ? hold.providers[0] : hold.providers
  const fichaUrl = `${(process.env.NEXT_PUBLIC_APP_URL || 'https://fiestago.es').replace(/\/$/, '')}/proveedores/${prov?.slug || hold.provider_id}`
  const name = prov?.name || 'Tu proveedor'
  await sendEmail({
    to: hold.client_email,
    subject: token ? `${name} te ha enviado su propuesta · FiestaGo` : `${name} te ha respondido · FiestaGo`,
    text: token
      ? `Hola ${hold.client_name},\n\n${name} te ha enviado su propuesta por escrito${hold.guests ? ` para ${hold.guests} invitados` : ''}: precio total, qué incluye, la señal en euros y las condiciones.\n\n${safeReply ? `"${safeReply}"\n\n` : ''}Mírala (y compártela con quien lo decide contigo): ${proposalUrl(token)}\n\nDesde ahí puedes reservar con la señal. Tu pago queda retenido en Stripe hasta que termina tu evento y todos los servicios llevan la Garantía de Éxito (solo cubre lo que se reserva y paga dentro de FiestaGo).\n\n¿Dudas? Responde a este email y te llamamos si quieres.\n\nFiestaGo`
      : `Hola ${hold.client_name},\n\n${name} te responde:\n\n"${safeReply}"\n\nSi te encaja, bloquea tu fecha 48 h gratis o reserva con una señal desde su ficha: ${fichaUrl}\nTodos los servicios llevan la Garantía de Éxito incluida y tu pago queda retenido en Stripe hasta que termina tu evento (la garantía solo cubre lo que se reserva y paga dentro de FiestaGo).\n\n¿Dudas? Responde a este email o escríbenos por WhatsApp.\n\nFiestaGo`,
  }).catch(() => {})

  return NextResponse.json({ ok: true, proposal_url: token ? proposalUrl(token) : null })
}

async function answerQuestion(body: any) {
  const answer = String(body.answer || '').trim().slice(0, 2000)
  if (answer.length < 2) return NextResponse.json({ error: 'Escribe tu respuesta' }, { status: 400 })
  const supabase = createAdminClient()
  const { data: hold } = await supabase.from('date_holds')
    .select('id, provider_id, client_name, client_email, proposal_token, questions, providers(name)')
    .eq('id', body.id).maybeSingle()
  if (!hold || hold.provider_id !== body.provider_id) return NextResponse.json({ error: 'Petición no encontrada' }, { status: 404 })
  const qs: ProposalQuestion[] = Array.isArray(hold.questions) ? hold.questions : []
  const i = Number(body.question_index)
  if (!qs[i]) return NextResponse.json({ error: 'Pregunta no encontrada' }, { status: 404 })

  qs[i] = { ...qs[i], a: maskPrices(maskContacts(answer)), answered_at: new Date().toISOString() }
  await supabase.from('date_holds').update({ questions: qs }).eq('id', hold.id)

  const prov: any = Array.isArray(hold.providers) ? hold.providers[0] : hold.providers
  await sendEmail({
    to: hold.client_email,
    subject: `${prov?.name || 'Tu proveedor'} ha contestado tu pregunta · FiestaGo`,
    text: `Hola ${hold.client_name},\n\nPreguntaste: "${qs[i].q}"\n\n${prov?.name || 'El proveedor'} responde: "${qs[i].a}"\n\nLa respuesta queda por escrito en tu propuesta${hold.proposal_token ? `: ${proposalUrl(hold.proposal_token)}` : ''}\n\nFiestaGo`,
  }).catch(() => {})
  return NextResponse.json({ ok: true })
}
