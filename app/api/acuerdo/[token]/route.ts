import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { sendEmail } from '@/lib/resend'
import { formatEuro } from '@/lib/pricing'
import { loadAgreement, acceptanceFingerprint, agreementUrl, withGuarantee } from '@/lib/agreements'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/acuerdo/<token> — el cliente acepta el acuerdo
// body { name, agree: true, guarantee?: boolean }
export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const b = await req.json().catch(() => ({}))
  const supabase = createAdminClient()
  const a = await loadAgreement(supabase, params.token)
  if (!a) return NextResponse.json({ error: 'Acuerdo no encontrado' }, { status: 404 })
  if (a.status !== 'enviado') return NextResponse.json({ error: a.status === 'aceptado' ? 'Ya está aceptado' : 'Este acuerdo está anulado' }, { status: 400 })
  const name = String(b.name || '').trim().slice(0, 120)
  if (name.length < 3 || b.agree !== true) return NextResponse.json({ error: 'Escribe tu nombre completo y marca la casilla' }, { status: 400 })

  const ip = req.headers.get('x-nf-client-connection-ip') || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || ''
  const guarantee = a.guarantee_offered && b.guarantee === true
  const { data, error } = await supabase.from('service_agreements').update({
    status: 'aceptado', accepted_at: new Date().toISOString(), accepted_name: name,
    accepted_fingerprint: acceptanceFingerprint(a, name, ip, req.headers.get('user-agent') || ''),
    guarantee_chosen: a.guarantee_offered ? guarantee : null,
  }).eq('id', a.id).eq('status', 'enviado').select('accepted_at, accepted_fingerprint').maybeSingle()
  if (error || !data) return NextResponse.json({ error: 'No se ha podido guardar. Inténtalo de nuevo.' }, { status: 500 })

  const total = guarantee ? withGuarantee(a.price_total) : a.price_total
  const summary = `«${a.service_title}» por ${formatEuro(total)}${guarantee ? ' (con la Garantía de Éxito FiestaGo)' : ''}`
  const link = agreementUrl(a.token)
  await Promise.all([
    sendEmail({ to: a.client_email, subject: `Acuerdo aceptado con ${a.provider.name} · FiestaGo`,
      text: `Hola ${a.client_name},\n\nHas aceptado el acuerdo con ${a.provider.name}: ${summary}.\n\nQueda registrado (código ${data.accepted_fingerprint}). Puedes verlo y descargarlo cuando quieras: ${link}\n\nFiestaGo` }).catch(() => {}),
    a.provider.email ? sendEmail({ to: a.provider.email, subject: `${a.client_name} ha aceptado tu acuerdo · FiestaGo`,
      text: `Hola ${a.provider.name},\n\n${a.client_name} ha aceptado el acuerdo ${summary}.${guarantee ? '\n\nHa elegido la Garantía de Éxito FiestaGo: para que sea válida, el pago tiene que hacerse por FiestaGo.' : ''}\n\nEstá registrado aquí: ${link}\n\nFiestaGo` }).catch(() => {}) : Promise.resolve(),
  ])
  return NextResponse.json({ ok: true, accepted_at: data.accepted_at, code: data.accepted_fingerprint })
}
