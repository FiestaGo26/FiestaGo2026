import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/services/availability?service_id=...&months=3
// Endpoint PÚBLICO. Devuelve los días bloqueados del servicio desde hoy
// hasta `months` meses adelante (por defecto 6).
export async function GET(req: NextRequest) {
  const supabase = createAdminClient()
  const { searchParams } = new URL(req.url)
  const serviceId = searchParams.get('service_id')
  const months    = Math.min(parseInt(searchParams.get('months') || '6'), 12)
  if (!serviceId) return NextResponse.json({ error: 'service_id requerido' }, { status: 400 })

  const today = new Date()
  const toDate = new Date()
  toDate.setMonth(toDate.getMonth() + months)

  const fromStr = today.toISOString().slice(0, 10)
  const toStr   = toDate.toISOString().slice(0, 10)

  const { data, error } = await supabase
    .from('service_availability')
    .select('blocked_date')
    .eq('service_id', serviceId)
    .gte('blocked_date', fromStr)
    .lte('blocked_date', toStr)
    .order('blocked_date', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const blockedDates = (data || []).map((b: any) => b.blocked_date)
  return NextResponse.json({ blocked_dates: blockedDates })
}
