import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function checkAdminAuth(req: NextRequest) {
  return req.headers.get('x-admin-password') === process.env.ADMIN_PASSWORD
}

// GET /api/admin/waitlist?format=csv para exportar.
// Sin format devuelve JSON con stats + lista.
export async function GET(req: NextRequest) {
  if (!checkAdminAuth(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const supabase = createAdminClient()
  const { searchParams } = new URL(req.url)
  const format = searchParams.get('format')

  const { data, error } = await supabase
    .from('waitlist')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const entries = data || []

  if (format === 'csv') {
    const headers = ['email','name','city','event_type','event_date','guests','source','referred_by','created_at']
    const csv = [
      headers.join(','),
      ...entries.map((r: any) => headers.map(h => {
        const v = r[h]
        if (v == null) return ''
        const s = String(v).replace(/"/g, '""')
        return /[",\n]/.test(s) ? `"${s}"` : s
      }).join(','))
    ].join('\n')
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="waitlist-${new Date().toISOString().slice(0,10)}.csv"`,
      },
    })
  }

  const stats = {
    total: entries.length,
    active: entries.filter((e: any) => !e.unsubscribed_at).length,
    byCity: entries.reduce((acc: Record<string, number>, e: any) => {
      const c = (e.city || 'Sin ciudad').toLowerCase()
      acc[c] = (acc[c] || 0) + 1
      return acc
    }, {}),
    byEventType: entries.reduce((acc: Record<string, number>, e: any) => {
      const t = e.event_type || 'sin-definir'
      acc[t] = (acc[t] || 0) + 1
      return acc
    }, {}),
    last7d: entries.filter((e: any) => Date.now() - new Date(e.created_at).getTime() < 7 * 86_400_000).length,
  }

  return NextResponse.json({ entries, stats })
}
