import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requireClientAuth } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/mis-facturas?email=CLIENT_EMAIL
// Lista todas las facturas dirigidas al cliente (ambos tipos:
// comisión de FiestaGo y delegadas del proveedor).
export async function GET(req: NextRequest) {
  const email = new URL(req.url).searchParams.get('email')
  const auth = await requireClientAuth(req, email)
  if (!auth.ok) return auth.response

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('invoices')
    .select('id, full_number, issue_date, invoice_type, issuer_tax_name, concept, base_amount, tax_amount, total_amount, booking_id')
    .ilike('recipient_email', email!)
    .order('issue_date', { ascending: false })
    .limit(200)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ invoices: data || [] })
}
