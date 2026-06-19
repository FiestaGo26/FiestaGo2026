import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requireProviderAuth } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/proveedor/quotes/mark-shared { providerId, id }
// Marca el presupuesto como compartido con el cliente (status=shared).
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const providerId: string = body.providerId
  const id: string = body.id
  const auth = await requireProviderAuth(req, providerId)
  if (!auth.ok) return auth.response
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('provider_quotes')
    .update({ status: 'shared', shared_at: new Date().toISOString() })
    .eq('id', id)
    .eq('provider_id', providerId)
    .eq('status', 'draft')  // solo si todavía no estaba shared
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
