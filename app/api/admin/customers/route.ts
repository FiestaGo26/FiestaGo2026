import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function checkAdminAuth(req: NextRequest) {
  return req.headers.get('x-admin-password') === process.env.ADMIN_PASSWORD
}

type Customer = {
  id: string
  email: string | null
  created_at: string
  last_sign_in_at: string | null
  name: string | null
  phone: string | null
  city: string | null
  accepts_marketing: boolean | null
  email_confirmed: boolean
}

// GET /api/admin/customers?q=search
export async function GET(req: NextRequest) {
  if (!checkAdminAuth(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const supabase = createAdminClient()
  const { searchParams } = new URL(req.url)
  const q = (searchParams.get('q') || '').toLowerCase().trim()

  // listUsers pagina de 1000 en 1000. Recorremos hasta agotar.
  const all: any[] = []
  let page = 1
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    all.push(...(data?.users || []))
    if (!data?.users?.length || data.users.length < 1000) break
    page++
    if (page > 20) break  // safety: 20k usuarios máx
  }

  const customers: Customer[] = all
    .filter(u => u.user_metadata?.account_type === 'customer')
    .map(u => ({
      id: u.id,
      email: u.email || null,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at || null,
      name: u.user_metadata?.full_name || u.user_metadata?.name || null,
      phone: u.user_metadata?.phone || null,
      city: u.user_metadata?.city || null,
      accepts_marketing: u.user_metadata?.accepts_marketing ?? null,
      email_confirmed: !!u.email_confirmed_at,
    }))

  const filtered = q
    ? customers.filter(c =>
        (c.email || '').toLowerCase().includes(q) ||
        (c.name  || '').toLowerCase().includes(q) ||
        (c.city  || '').toLowerCase().includes(q))
    : customers

  filtered.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))

  return NextResponse.json({
    customers: filtered,
    total: filtered.length,
    stats: {
      total:     customers.length,
      marketing: customers.filter(c => c.accepts_marketing).length,
      confirmed: customers.filter(c => c.email_confirmed).length,
    },
  })
}
