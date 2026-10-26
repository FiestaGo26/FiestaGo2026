import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { proposalUrl } from '@/lib/proposals'
import { sendEmail } from '@/lib/resend'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const APP_URL = () => (process.env.NEXT_PUBLIC_APP_URL || 'https://fiestago.es').replace(/\/$/, '')

// POST /api/propuesta/<token>/videollamada — body: { preferred_slot? }
// El cliente pide ver al proveedor por videollamada antes de pagar la señal
// (10.ª simulación). El proveedor propone hora desde su panel y FiestaGo le
// manda al cliente el enlace: nadie comparte teléfono ni email.
export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  if (!/^[a-f0-9]{24}$/.test(params.token || '')) return NextResponse.json({ error: 'Propuesta no encontrada' }, { status: 404 })
  const { preferred_slot } = await req.json().catch(() => ({} as any))
  const supabase = createAdminClient()
  const { data: hold } = await supabase.from('date_holds')
    .select('id, provider_id, client_name, client_email, client_phone, event_date, providers(name, email)')
    .eq('proposal_token', params.token).maybeSingle()
  if (!hold) return NextResponse.json({ error: 'Propuesta no encontrada' }, { status: 404 })

  const { count } = await supabase.from('video_call_requests')
    .select('id', { count: 'exact', head: true })
    .eq('provider_id', hold.provider_id).eq('client_email', hold.client_email)
    .in('status', ['pending', 'proposed'])
  if ((count || 0) > 0) return NextResponse.json({ ok: true, already: true })

  const slot = preferred_slot ? String(preferred_slot).trim().slice(0, 200) : null
  const { error } = await supabase.from('video_call_requests').insert({
    provider_id: hold.provider_id,
    client_name: hold.client_name, client_email: hold.client_email, client_phone: hold.client_phone,
    reason: `Tiene tu propuesta${hold.event_date ? ` para el ${hold.event_date}` : ''} y quiere verte antes de reservar.`,
    preferred_slot: slot,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const prov: any = Array.isArray(hold.providers) ? hold.providers[0] : hold.providers
  if (prov?.email) {
    await sendEmail({
      to: prov.email,
      subject: '📹 Un cliente quiere verte por videollamada antes de reservar',
      text: `Hola,\n\nUn cliente que tiene tu propuesta quiere hacer una videollamada contigo antes de pagar la señal${slot ? ` (prefiere: ${slot})` : ''}.\n\nPropón día y hora desde tu panel (pestaña "Videollamadas"): le enviamos el enlace nosotros. 10 minutos de llamada suelen decidir la reserva.\n\n${APP_URL()}/proveedor/panel?tab=video-calls\n\nFiestaGo`,
    }).catch(() => {})
  }
  await sendEmail({
    to: process.env.ADMIN_EMAIL || 'contacto@fiestago.es',
    subject: `📹 ${hold.client_name} pide videollamada con ${prov?.name || 'un proveedor'}`,
    text: `${slot ? `Prefiere: ${slot}\n` : ''}Propuesta: ${proposalUrl(params.token)}`,
  }).catch(() => {})
  return NextResponse.json({ ok: true })
}
