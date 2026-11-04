import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requireProviderAuth } from '@/lib/auth'
import { accountStatus, configured, onboardingLink, payoutNow } from '@/lib/stripe-connect'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/proveedor/stripe?provider_id=… → estado de su cuenta de cobros y saldo
export async function GET(req: NextRequest) {
  const providerId = new URL(req.url).searchParams.get('provider_id')
  const auth = await requireProviderAuth(req, providerId)
  if (!auth.ok) return auth.response
  if (!configured()) return NextResponse.json({ configured: false })
  try { return NextResponse.json(await accountStatus(createAdminClient(), providerId!)) }
  catch (err: any) { return NextResponse.json({ configured: true, error: err.message }, { status: 500 }) }
}

// POST /api/proveedor/stripe — body { provider_id, action: 'onboard' | 'payout' }
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}))
  const auth = await requireProviderAuth(req, b.provider_id)
  if (!auth.ok) return auth.response
  try {
    if (b.action === 'onboard') return NextResponse.json({ url: await onboardingLink(createAdminClient(), b.provider_id) })
    if (b.action === 'payout') return NextResponse.json(await payoutNow(createAdminClient(), b.provider_id))
    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}
