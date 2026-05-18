import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/proveedor/earnings?provider_id=...&year=2026
// Devuelve el desglose de cobros: total, comisión, neto + agregado mensual
// + lista de transacciones individuales. Solo cuenta reservas confirmadas
// o completadas (las canceladas/disputadas no entran).
export async function GET(req: NextRequest) {
  const supabase = createAdminClient()
  const { searchParams } = new URL(req.url)
  const providerId = searchParams.get('provider_id')
  const yearParam  = searchParams.get('year')
  const year       = yearParam ? parseInt(yearParam) : new Date().getFullYear()

  if (!providerId) {
    return NextResponse.json({ error: 'provider_id requerido' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('bookings')
    .select(`
      id, created_at, event_date, paid_at, client_name, status,
      total_amount, commission_rate, commission_amt, provider_earns, is_free_txn,
      event_type, city, provider_services(name)
    `)
    .eq('provider_id', providerId)
    .in('status', ['confirmed', 'completed'])
    .order('event_date', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const bookings = (data || []).map((b: any) => ({
    id:           b.id,
    date:         b.paid_at || b.event_date || b.created_at,
    event_date:   b.event_date,
    paid_at:      b.paid_at,
    client_name:  b.client_name,
    service_name: b.provider_services?.name || null,
    event_type:   b.event_type,
    city:         b.city,
    status:       b.status,
    total:        Number(b.total_amount) || 0,
    commission:   Number(b.commission_amt) || 0,
    net:          Number(b.provider_earns) || 0,
    is_free:      !!b.is_free_txn,
  }))

  // Filtrar por año (usa event_date para asignar al periodo)
  const inYear = bookings.filter((b: any) => {
    const d = new Date(b.event_date || b.date)
    return d.getFullYear() === year
  })

  // Totales del año
  const totals = inYear.reduce((acc: any, b: any) => ({
    gross: acc.gross + b.total,
    commission: acc.commission + b.commission,
    net:   acc.net + b.net,
    count: acc.count + 1,
  }), { gross: 0, commission: 0, net: 0, count: 0 })

  // Agregado mensual (12 meses del año pedido)
  const monthly: Array<{ month: number; label: string; gross: number; net: number; commission: number; count: number }> = []
  for (let m = 0; m < 12; m++) {
    const monthName = new Date(year, m, 1).toLocaleDateString('es-ES', { month: 'short' })
    const monthBookings = inYear.filter((b: any) => new Date(b.event_date || b.date).getMonth() === m)
    monthly.push({
      month: m,
      label: monthName,
      gross: monthBookings.reduce((s: number, b: any) => s + b.total, 0),
      net:   monthBookings.reduce((s: number, b: any) => s + b.net, 0),
      commission: monthBookings.reduce((s: number, b: any) => s + b.commission, 0),
      count: monthBookings.length,
    })
  }

  // Lista de años disponibles para el selector
  const yearsSet = new Set<number>()
  for (const b of bookings) {
    yearsSet.add(new Date(b.event_date || b.date).getFullYear())
  }
  yearsSet.add(year)
  const years = Array.from(yearsSet).sort((a, b) => b - a)

  return NextResponse.json({
    year,
    years,
    totals,
    monthly,
    transactions: inYear,
  })
}
