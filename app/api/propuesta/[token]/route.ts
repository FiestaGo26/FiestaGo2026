import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { maskContacts } from '@/lib/date-holds'
import { proposalUrl, type ProposalQuestion } from '@/lib/proposals'
import { sendEmail } from '@/lib/resend'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const APP_URL = () => (process.env.NEXT_PUBLIC_APP_URL || 'https://fiestago.es').replace(/\/$/, '')
const MAX_QUESTIONS = 10

// POST /api/propuesta/<token> — body: { question }
// El cliente pregunta al proveedor desde su propuesta; el proveedor contesta
// en su panel y la respuesta queda por escrito en la propuesta. (7.ª
// simulación: las dudas concretas sin respuesta escrita —alergias, plan B
// si llueve, espacio— eran el segundo motivo de descarte.)
export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const { question } = await req.json().catch(() => ({} as any))
  const q = maskContacts(String(question || '').trim().slice(0, 1000))
  if (q.length < 5) return NextResponse.json({ error: 'Escribe tu pregunta' }, { status: 400 })
  if (!/^[a-f0-9]{24}$/.test(params.token || '')) return NextResponse.json({ error: 'Propuesta no encontrada' }, { status: 404 })

  const supabase = createAdminClient()
  const { data: hold } = await supabase.from('date_holds')
    .select('id, client_name, questions, providers(name, email)')
    .eq('proposal_token', params.token).maybeSingle()
  if (!hold) return NextResponse.json({ error: 'Propuesta no encontrada' }, { status: 404 })

  const qs: ProposalQuestion[] = Array.isArray(hold.questions) ? hold.questions : []
  if (qs.length >= MAX_QUESTIONS) return NextResponse.json({ error: 'Has hecho muchas preguntas. Responde al email de la propuesta y te llamamos.' }, { status: 429 })
  qs.push({ q, asked_at: new Date().toISOString(), a: null, answered_at: null })
  await supabase.from('date_holds').update({ questions: qs }).eq('id', hold.id)

  const prov: any = Array.isArray(hold.providers) ? hold.providers[0] : hold.providers
  if (prov?.email) {
    await sendEmail({
      to: prov.email,
      subject: '❓ Un cliente te pregunta antes de reservar · FiestaGo',
      text: `Hola,\n\nUn cliente que tiene tu propuesta te pregunta:\n\n"${q}"\n\nContéstale desde tu panel ("Peticiones de clientes"): la respuesta le llega por escrito y queda en su propuesta. Responder rápido y en concreto es lo que más ayuda a que reserve.\n\n${APP_URL()}/proveedor/panel\n\nFiestaGo`,
    }).catch(() => {})
  }
  await sendEmail({
    to: process.env.ADMIN_EMAIL || 'contacto@fiestago.es',
    subject: `❓ Pregunta de ${hold.client_name} a ${prov?.name || 'un proveedor'}`,
    text: `"${q}"\n\nPropuesta: ${proposalUrl(params.token)}`,
  }).catch(() => {})

  return NextResponse.json({ ok: true, questions: qs })
}
