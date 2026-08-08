import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requireProviderAuth } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/proveedor/invoices?providerId=X
// Lista las facturas emitidas en nombre del proveedor (delegadas).
export async function GET(req: NextRequest) {
  const providerId = new URL(req.url).searchParams.get('providerId')
  const auth = await requireProviderAuth(req, providerId)
  if (!auth.ok) return auth.response

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('invoices')
    .select('id, full_number, issue_date, invoice_type, recipient_name, recipient_email, base_amount, tax_amount, total_amount, verifactu_mode, cancelled_at')
    .eq('issuer_provider_id', auth.data.id)
    .order('issue_date', { ascending: false })
    .limit(200)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ invoices: data || [] })
}
