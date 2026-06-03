import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function checkAdminAuth(req: NextRequest) {
  return req.headers.get('x-admin-password') === process.env.ADMIN_PASSWORD
}

// POST /api/admin/mark-contacted
//   body: { id: string, channel: 'whatsapp' | 'web_form' | 'email' | 'instagram' | 'phone' }
//   Marca al proveedor como contactado vía un canal manual (el admin
//   abrió wa.me / la web / mailto y envió a mano). NO usa Resend ni
//   nada de pago — solo registra que ya se ha tocado.
const VALID_CHANNELS = ['whatsapp', 'web_form', 'email', 'instagram', 'phone'] as const
type Channel = typeof VALID_CHANNELS[number]

const TAG_MAP: Record<Channel, string> = {
  whatsapp:  'Contactado por WhatsApp',
  web_form:  'Contactado por web',
  email:     'Contactado por email',
  instagram: 'Contactado por DM',
  phone:     'Contactado por teléfono',
}

export async function POST(req: NextRequest) {
  if (!checkAdminAuth(req)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const id      = body.id as string
  const channel = body.channel as Channel

  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })
  if (!VALID_CHANNELS.includes(channel)) {
    return NextResponse.json({ error: `channel inválido: ${channel}` }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('providers')
    .update({
      outreach_sent: true,
      outreach_at:   new Date().toISOString(),
      contacted_via: channel,
      tag:           TAG_MAP[channel],
    })
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, channel })
}
