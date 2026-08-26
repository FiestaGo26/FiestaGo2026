import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { emailProviderWelcome } from '@/lib/resend'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/admin/resend-welcome?provider_id=X
// Header: x-admin-password
//
// Reenvía el email de bienvenida al proveedor indicado. Útil cuando el
// proveedor lo borró, no le llegó, o queremos probar el nuevo copy tras
// un cambio.
export async function POST(req: NextRequest) {
  if (req.headers.get('x-admin-password') !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const providerId = new URL(req.url).searchParams.get('provider_id')
  if (!providerId) {
    return NextResponse.json({ error: 'provider_id requerido' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data: provider } = await supabase
    .from('providers').select('id, name, email, slug, city, phone')
    .eq('id', providerId).maybeSingle()
  if (!provider) return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 })
  if (!provider.email) return NextResponse.json({ error: 'Proveedor sin email' }, { status: 400 })

  const result = await emailProviderWelcome(provider)
  return NextResponse.json(result)
}
