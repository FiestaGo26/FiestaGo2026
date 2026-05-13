import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function checkAuth(req: NextRequest) {
  return !!req.headers.get('x-provider-token')
}

// GET /api/proveedor/stats?provider_id=...&days=30
export async function GET(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const providerId = searchParams.get('provider_id')
  const days       = Math.min(parseInt(searchParams.get('days') || '30'), 365)
  if (!providerId) return NextResponse.json({ error: 'provider_id requerido' }, { status: 400 })

  const supabase = createAdminClient()
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  // Todos los eventos del rango
  const { data: events, error } = await supabase
    .from('provider_views')
    .select('event_type, service_id, created_at')
    .eq('provider_id', providerId)
    .gte('created_at', since)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const list = events || []
  // Stats por tipo de evento
  const byType: Record<string, number> = {}
  for (const e of list) byType[e.event_type] = (byType[e.event_type] || 0) + 1

  // Stats por día (para el gráfico)
  const byDay: Record<string, number> = {}
  for (const e of list) {
    if (e.event_type !== 'profile_view') continue
    const day = (e.created_at as string).slice(0, 10)
    byDay[day] = (byDay[day] || 0) + 1
  }
  // Generar serie de N días completos (con 0 en días sin eventos)
  const series: { date: string; views: number }[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
    const key = d.toISOString().slice(0, 10)
    series.push({ date: key, views: byDay[key] || 0 })
  }

  // Top servicios (cuántas vistas/clicks por servicio)
  const byService: Record<string, number> = {}
  for (const e of list) {
    if (!e.service_id) continue
    byService[e.service_id] = (byService[e.service_id] || 0) + 1
  }
  // Enriquecer con nombre del servicio
  const topServiceIds = Object.keys(byService).slice(0, 10)
  let topServices: any[] = []
  if (topServiceIds.length) {
    const { data: svcs } = await supabase
      .from('provider_services')
      .select('id, name, price')
      .in('id', topServiceIds)
    topServices = (svcs || []).map((s: any) => ({ ...s, views: byService[s.id] || 0 }))
      .sort((a: any, b: any) => b.views - a.views)
  }

  return NextResponse.json({
    total_events:        list.length,
    profile_views:       byType.profile_view       || 0,
    service_views:       byType.service_view       || 0,
    booking_started:     byType.booking_started    || 0,
    booking_completed:   byType.booking_completed  || 0,
    contact_clicked:     byType.contact_clicked    || 0,
    conversion_rate:     byType.profile_view ? +(((byType.booking_completed || 0) / byType.profile_view) * 100).toFixed(1) : 0,
    series,
    top_services:        topServices,
  })
}
