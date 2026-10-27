import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { proposalUrl } from '@/lib/proposals'
import { sendEmail } from '@/lib/resend'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/propuesta/<token>/referencia — body: { reference_id }
// El cliente pide hablar con una referencia del proveedor. FiestaGo hace la
// presentación (el contacto de la referencia nunca se publica).
export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  if (!/^[a-f0-9]{24}$/.test(params.token || '')) return NextResponse.json({ error: 'Propuesta no encontrada' }, { status: 404 })
  const { reference_id } = await req.json().catch(() => ({} as any))
  const supabase = createAdminClient()
  const { data: hold } = await supabase.from('date_holds')
    .select('provider_id, client_name, client_email, client_phone, event_date, event_type, providers(name, client_references)')
    .eq('proposal_token', params.token).maybeSingle()
  if (!hold) return NextResponse.json({ error: 'Propuesta no encontrada' }, { status: 404 })
  const prov: any = Array.isArray(hold.providers) ? hold.providers[0] : hold.providers
  const ref = (prov?.client_references || []).find((r: any) => r.id === reference_id && r.consentimiento)
  if (!ref) return NextResponse.json({ error: 'Referencia no encontrada' }, { status: 404 })

  const { count } = await supabase.from('reference_requests').select('id', { count: 'exact', head: true })
    .eq('proposal_token', params.token).eq('reference_id', ref.id)
  if ((count || 0) === 0) {
    await supabase.from('reference_requests').insert({
      provider_id: hold.provider_id, reference_id: ref.id, proposal_token: params.token,
      client_name: hold.client_name, client_email: hold.client_email,
    })
    await sendEmail({
      to: process.env.ADMIN_EMAIL || 'contacto@fiestago.es',
      subject: `🤝 ${hold.client_name} quiere hablar con una referencia de ${prov?.name}`,
      text: `Presenta a las dos partes (pide antes permiso a la referencia para pasarle el contacto del cliente, o haced una llamada a tres).\n\nReferencia: ${ref.nombre} · ${ref.evento} · ${ref.fecha} · ${ref.ciudad}\nContacto de la referencia: ${ref.contacto}\n\nCliente: ${hold.client_name} · ${hold.client_email}${hold.client_phone ? ` · ${hold.client_phone}` : ''}\nEvento: ${hold.event_type || ''} ${hold.event_date || ''}\nPropuesta: ${proposalUrl(params.token)}`,
    }).catch(() => {})
    await sendEmail({
      to: hold.client_email,
      subject: `Te ponemos en contacto con ${ref.nombre} · FiestaGo`,
      text: `Hola ${hold.client_name},\n\nHemos recibido tu petición para hablar con ${ref.nombre} (${ref.evento}${ref.fecha ? `, ${ref.fecha}` : ''}), cliente de ${prov?.name}. Le escribimos ahora y, en cuanto nos diga cuándo le va bien, os ponemos en contacto.\n\nFiestaGo`,
    }).catch(() => {})
  }
  return NextResponse.json({ ok: true })
}
