import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { emailProviderWelcome } from '@/lib/resend'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Reenvía el email de bienvenida al proveedor indicado. Útil para
// probar cambios en el copy sin crear un proveedor nuevo.
//
// GET  /api/admin/resend-welcome?provider_id=X&pwd=ADMIN_PASSWORD
//      (o con header x-admin-password) — abrir desde el navegador
// POST /api/admin/resend-welcome?provider_id=X con header
async function handle(req: NextRequest) {
  const url = new URL(req.url)
  const pwd = url.searchParams.get('pwd') || req.headers.get('x-admin-password')
  if (pwd !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const providerId = url.searchParams.get('provider_id')
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

export const GET  = handle
export const POST = handle
