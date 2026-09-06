import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requireProviderAuth } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/proveedor/fiscal-plan?providerId=XXX
// Devuelve el estado actual del add-on fiscal del proveedor.
export async function GET(req: NextRequest) {
  const providerId = new URL(req.url).searchParams.get('providerId')
  const auth = await requireProviderAuth(req, providerId)
  if (!auth.ok) return auth.response

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('providers')
    .select('fiscal_plan, fiscal_plan_at, fiscal_interest_at')
    .eq('id', auth.data.id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ plan: data })
}

// POST /api/proveedor/fiscal-plan
// Body: { providerId, action: 'interest' | 'cancel_interest' }
//
// 'interest' → marca al proveedor como interesado (para lanzamiento).
// 'cancel_interest' → deshace el interés.
//
// La activación real ('active') se hará vía Stripe cuando esté implementada.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { providerId, action } = body || {}

  const auth = await requireProviderAuth(req, providerId)
  if (!auth.ok) return auth.response

  if (!['interest', 'cancel_interest'].includes(action)) {
    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const updates: Record<string, any> = action === 'interest'
    ? { fiscal_plan: 'interested', fiscal_interest_at: new Date().toISOString() }
    : { fiscal_plan: 'none',       fiscal_interest_at: null }

  const { data, error } = await supabase
    .from('providers')
    .update(updates)
    .eq('id', auth.data.id)
    .select('fiscal_plan, fiscal_plan_at, fiscal_interest_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Aviso al admin cuando alguien nuevo se apunta (útil para medir demanda)
  if (action === 'interest') {
    supabase.from('notifications').insert({
      type:       'fiscal_plan_interest',
      title:      `🧾 Interés en FiestaGo Fiscal · ${auth.data.name}`,
      message:    `${auth.data.name} (${auth.data.email}) quiere el add-on fiscal cuando esté disponible.`,
      data:       { provider_id: auth.data.id, provider_email: auth.data.email },
      action_url: `/admin#providers-${auth.data.id}`,
    }).then(() => {})
  }

  return NextResponse.json({ plan: data, ok: true })
}
