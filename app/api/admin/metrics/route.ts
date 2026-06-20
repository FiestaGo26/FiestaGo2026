import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function checkAdminAuth(req: NextRequest) {
  return req.headers.get('x-admin-password') === process.env.ADMIN_PASSWORD
}

// GET /api/admin/metrics
// Devuelve las métricas agregadas del marketplace. Pensado para una sola
// petición que carga la pestaña 📊 Métricas del admin.
export async function GET(req: NextRequest) {
  if (!checkAdminAuth(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const supabase = createAdminClient()

  // ───── Proveedores ─────
  const { data: providersRaw } = await supabase
    .from('providers')
    .select('id, status, category, city, contactable, outreach_sent, contacted_via, self_registered, created_at, verified, verification_status')

  const providers = providersRaw || []
  const byStatus: Record<string, number> = {}
  const byCategory: Record<string, number> = {}
  const byCity: Record<string, number> = {}
  for (const p of providers) {
    byStatus[p.status]     = (byStatus[p.status]     || 0) + 1
    byCategory[p.category] = (byCategory[p.category] || 0) + 1
    byCity[p.city]         = (byCity[p.city]         || 0) + 1
  }

  // Funnel de captación
  const found      = providers.length
  const contacted  = providers.filter((p: any) => p.outreach_sent).length
  const selfReg    = providers.filter((p: any) => p.self_registered).length
  const approved   = providers.filter((p: any) => p.status === 'approved').length
  const pending    = providers.filter((p: any) => p.status === 'pending').length
  const verified   = providers.filter((p: any) => p.verified).length

  const conversionRate = found > 0 ? (selfReg / found) * 100 : 0

  // Captación por canal de contacto
  const byContactedVia: Record<string, number> = { email: 0, instagram: 0 }
  for (const p of providers.filter((pp: any) => pp.outreach_sent)) {
    const v = (p.contacted_via || 'unknown') as string
    byContactedVia[v] = (byContactedVia[v] || 0) + 1
  }

  // ───── Bookings ─────
  const { data: bookingsRaw } = await supabase
    .from('bookings')
    .select('id, status, total_amount, provider_earns, commission_amt, created_at, confirmed_at, event_date')

  const bookings = bookingsRaw || []
  const bookingsByStatus: Record<string, number> = {}
  for (const b of bookings) bookingsByStatus[b.status] = (bookingsByStatus[b.status] || 0) + 1

  const confirmedBookings  = bookings.filter((b: any) => b.status === 'confirmed' || b.status === 'completed')
  const gmv          = confirmedBookings.reduce((s: number, b: any) => s + Number(b.total_amount || 0), 0)
  const commissions  = confirmedBookings.reduce((s: number, b: any) => s + Number(b.commission_amt || 0), 0)
  const avgTicket    = confirmedBookings.length > 0
    ? gmv / confirmedBookings.length
    : 0

  // Tasa de aceptación (confirmadas / (confirmadas + canceladas))
  const handled  = bookings.filter((b: any) => ['confirmed','completed','cancelled'].includes(b.status))
  const accepted = bookings.filter((b: any) => ['confirmed','completed'].includes(b.status))
  const acceptanceRate = handled.length > 0
    ? (accepted.length / handled.length) * 100
    : 0

  // ───── Incidencias ─────
  const { data: incidentsRaw } = await supabase
    .from('incidents')
    .select('id, status, type, compensation_amount, provider_charge, provider_charge_paid, sla_target_at, resolved_at, created_at')

  const incidents = incidentsRaw || []
  const incidentsByStatus: Record<string, number> = {}
  const incidentsByType: Record<string, number> = {}
  for (const i of incidents) {
    incidentsByStatus[i.status] = (incidentsByStatus[i.status] || 0) + 1
    incidentsByType[i.type]     = (incidentsByType[i.type]     || 0) + 1
  }

  const totalCompensated   = incidents.filter((i: any) => i.status === 'resolved')
    .reduce((s: number, i: any) => s + Number(i.compensation_amount || 0), 0)
  const totalCharged       = incidents.filter((i: any) => i.provider_charge_paid)
    .reduce((s: number, i: any) => s + Number(i.provider_charge || 0), 0)
  const pendingCharges     = incidents
    .filter((i: any) => i.status === 'resolved' && i.provider_charge && !i.provider_charge_paid)
    .reduce((s: number, i: any) => s + Number(i.provider_charge || 0), 0)

  // SLA cumplido (cerradas dentro del deadline)
  const closedIncidents = incidents.filter((i: any) => i.resolved_at)
  const slaRespected    = closedIncidents.filter((i: any) => {
    if (!i.sla_target_at) return true
    return new Date(i.resolved_at as any) <= new Date(i.sla_target_at)
  }).length
  const slaRate = closedIncidents.length > 0
    ? (slaRespected / closedIncidents.length) * 100
    : 100

  // ───── Quote Generator hook (medición del lift) ─────
  // Estrategia: agrupamos por provider_id sobre whatsapp_messages
  // y miramos cuáles recibieron al menos un outbound con
  // mentions_quote_gen=true. Comparamos su tasa de self-registration
  // contra la del grupo de control (proveedores contactados que NO
  // recibieron el gancho).
  const { data: hookRowsRaw } = await supabase
    .from('whatsapp_messages')
    .select('provider_id, mentions_quote_gen, direction')
    .eq('direction', 'outbound')
    .not('provider_id', 'is', null)

  const hookedSet = new Set<string>()  // proveedores que recibieron el gancho ≥ 1 vez
  const contactedByWaSet = new Set<string>()  // proveedores con cualquier outbound
  let hookMsgsTotal = 0
  for (const row of (hookRowsRaw || [])) {
    if (!row.provider_id) continue
    contactedByWaSet.add(row.provider_id)
    if (row.mentions_quote_gen) {
      hookedSet.add(row.provider_id)
      hookMsgsTotal++
    }
  }

  const providerById = new Map(providers.map((p: any) => [p.id, p]))
  let hookedSelfReg = 0
  hookedSet.forEach(pid => {
    const p = providerById.get(pid) as any
    if (p?.self_registered) hookedSelfReg++
  })
  let controlSelfReg = 0
  let controlSize    = 0
  contactedByWaSet.forEach(pid => {
    if (hookedSet.has(pid)) return
    controlSize++
    const p = providerById.get(pid) as any
    if (p?.self_registered) controlSelfReg++
  })
  const hookedConversion  = hookedSet.size  > 0 ? (hookedSelfReg  / hookedSet.size)  * 100 : 0
  const controlConversion = controlSize     > 0 ? (controlSelfReg / controlSize)     * 100 : 0
  const liftPp = hookedConversion - controlConversion

  // ───── Clientes / socios ─────
  const { count: customersCount } = await supabase
    .from('bookings')
    .select('client_email', { count: 'exact', head: true })

  return NextResponse.json({
    providers: {
      total:     found,
      contacted, selfReg,
      pending,   approved, verified,
      byStatus, byCategory, byCity, byContactedVia,
      conversionRate: Math.round(conversionRate * 10) / 10,
    },
    bookings: {
      total:           bookings.length,
      byStatus:        bookingsByStatus,
      confirmedTotal:  confirmedBookings.length,
      gmv:             Math.round(gmv * 100) / 100,
      commissions:     Math.round(commissions * 100) / 100,
      avgTicket:       Math.round(avgTicket * 100) / 100,
      acceptanceRate:  Math.round(acceptanceRate * 10) / 10,
    },
    incidents: {
      total:           incidents.length,
      byStatus:        incidentsByStatus,
      byType:          incidentsByType,
      totalCompensated:   Math.round(totalCompensated * 100) / 100,
      totalCharged:       Math.round(totalCharged * 100) / 100,
      pendingCharges:     Math.round(pendingCharges * 100) / 100,
      slaRate:         Math.round(slaRate * 10) / 10,
    },
    customers: {
      bookingEmails: customersCount || 0,
    },
    quoteGenHook: {
      msgsTotal:          hookMsgsTotal,
      hookedProviders:    hookedSet.size,
      hookedSelfReg,
      hookedConversion:   Math.round(hookedConversion  * 10) / 10,
      controlProviders:   controlSize,
      controlSelfReg,
      controlConversion:  Math.round(controlConversion * 10) / 10,
      liftPp:             Math.round(liftPp * 10) / 10,
    },
  })
}
