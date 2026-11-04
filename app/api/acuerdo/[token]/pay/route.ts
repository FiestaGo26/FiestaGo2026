import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { checkoutForAgreement, type PaymentKind } from '@/lib/stripe-connect'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/acuerdo/<token>/pay — body { kind: 'senal' | 'resto' | 'total' } → { url } de Stripe Checkout
export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const b = await req.json().catch(() => ({}))
  const kind: PaymentKind = b.kind === 'senal' ? 'senal' : b.kind === 'resto' ? 'resto' : 'total'
  try {
    return NextResponse.json({ url: await checkoutForAgreement(createAdminClient(), params.token, kind) })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}
