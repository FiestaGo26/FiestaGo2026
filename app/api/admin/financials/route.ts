import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/admin/financials?year=2026
//
// Consolidado financiero para admin: facturas emitidas, ranking de
// proveedores, ranking de clientes, evolución mensual, payouts
// pendientes y cobros por facturar. Todo en una sola petición para
// simplificar el tab del panel.
export async function GET(req: NextRequest) {
  if (req.headers.get('x-admin-password') !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const url = new URL(req.url)
  const year = parseInt(url.searchParams.get('year') || String(new Date().getFullYear()))

  const supabase = createAdminClient()

  // ─── Bookings del año ─────────────────────────────────────────────
  const yStart = `${year}-01-01`
  const yEnd   = `${year + 1}-01-01`

  const { data: allBookings } = await supabase
    .from('bookings')
    .select('id, provider_id, client_email, client_name, event_date, paid_at, created_at, status, total_amount, commission_amt, provider_earns, first_payment_status, first_payment_paid_at, first_payment_amount, second_payment_status, second_payment_paid_at, second_payment_amount, providers(name, category, city)')
    .gte('event_date', yStart)
    .lt('event_date', yEnd)
    .order('event_date', { ascending: false })

  const bookings = (allBookings || []) as any[]

  // ─── Facturas del año ─────────────────────────────────────────────
  const { data: allInvoices } = await supabase
    .from('invoices')
    .select('id, booking_id, full_number, issue_date, invoice_type, base_amount, tax_amount, total_amount, recipient_name, recipient_email, issuer_provider_id, issuer_tax_name, cancelled_at')
    .gte('issue_date', yStart)
    .lt('issue_date', yEnd)
    .order('issue_date', { ascending: false })

  const invoices = (allInvoices || []) as any[]

  // ─── Totales globales ─────────────────────────────────────────────
  const confirmed = bookings.filter(b => b.status === 'confirmed' || b.status === 'completed')
  const gmv         = confirmed.reduce((s, b) => s + Number(b.total_amount || 0), 0)
  const commissions = confirmed.reduce((s, b) => s + Number(b.commission_amt || 0), 0)
  const providerRev = confirmed.reduce((s, b) => s + Number(b.provider_earns || 0), 0)

  // Cobrado real (lo que ha entrado en Stripe/pagos actualmente): suma de
  // first_payment_amount cuando paid + second_payment_amount cuando paid
  const cobrado = bookings.reduce((s, b) => {
    let x = 0
    if (b.first_payment_status  === 'paid') x += Number(b.first_payment_amount  || 0)
    if (b.second_payment_status === 'paid') x += Number(b.second_payment_amount || 0)
    return s + x
  }, 0)

  // Facturado (suma de facturas no canceladas)
  const facturado = invoices
    .filter(i => !i.cancelled_at)
    .reduce((s, i) => s + Number(i.total_amount || 0), 0)

  // Diferencia = lo cobrado que aún no está facturado
  const pendienteFacturar = Math.max(0, Math.round((cobrado - facturado) * 100) / 100)

  // ─── Ranking de proveedores ───────────────────────────────────────
  const byProvider = new Map<string, {
    provider_id:  string
    name:         string
    category:     string
    city:         string
    bookings:     number
    gmv:          number
    commissions:  number
    provider_rev: number
    cobrado:      number
    pendientePayout: number  // cobrado pero aún no transferido al proveedor
  }>()

  for (const b of confirmed) {
    if (!b.provider_id) continue
    const key = b.provider_id
    const p = byProvider.get(key) || {
      provider_id: key,
      name:     (b.providers?.name || '(sin nombre)') as string,
      category: (b.providers?.category || '—') as string,
      city:     (b.providers?.city || '—') as string,
      bookings: 0, gmv: 0, commissions: 0, provider_rev: 0,
      cobrado: 0, pendientePayout: 0,
    }
    p.bookings++
    p.gmv          += Number(b.total_amount    || 0)
    p.commissions  += Number(b.commission_amt  || 0)
    p.provider_rev += Number(b.provider_earns  || 0)

    let cobradoEsteBooking = 0
    if (b.first_payment_status  === 'paid') cobradoEsteBooking += Number(b.first_payment_amount  || 0)
    if (b.second_payment_status === 'paid') cobradoEsteBooking += Number(b.second_payment_amount || 0)
    p.cobrado += cobradoEsteBooking
    // Lo que sale al proveedor = cobrado × (provider_earns / total_amount)
    // (proporción, porque la comisión se queda FG). Manual: implementar payouts en fase Stripe.
    const total = Number(b.total_amount || 0)
    if (total > 0 && cobradoEsteBooking > 0) {
      p.pendientePayout += Math.round((cobradoEsteBooking * Number(b.provider_earns || 0) / total) * 100) / 100
    }

    byProvider.set(key, p)
  }
  const providersRanking = Array.from(byProvider.values())
    .sort((a, b) => b.gmv - a.gmv)
    .map(p => ({
      ...p,
      gmv:          Math.round(p.gmv          * 100) / 100,
      commissions:  Math.round(p.commissions  * 100) / 100,
      provider_rev: Math.round(p.provider_rev * 100) / 100,
      cobrado:      Math.round(p.cobrado      * 100) / 100,
      pendientePayout: Math.round(p.pendientePayout * 100) / 100,
      avgTicket:    p.bookings > 0 ? Math.round((p.gmv / p.bookings) * 100) / 100 : 0,
    }))

  // ─── Ranking de clientes ──────────────────────────────────────────
  const byClient = new Map<string, {
    email:    string
    name:     string
    bookings: number
    gasto:    number
    ultimoEvento: string | null
  }>()
  for (const b of confirmed) {
    if (!b.client_email) continue
    const key = String(b.client_email).toLowerCase()
    const c = byClient.get(key) || { email: key, name: b.client_name || '', bookings: 0, gasto: 0, ultimoEvento: null }
    c.bookings++
    c.gasto += Number(b.total_amount || 0)
    if (b.event_date && (!c.ultimoEvento || b.event_date > c.ultimoEvento)) {
      c.ultimoEvento = b.event_date
    }
    byClient.set(key, c)
  }
  const clientsRanking = Array.from(byClient.values())
    .sort((a, b) => b.gasto - a.gasto)
    .slice(0, 50)
    .map(c => ({ ...c, gasto: Math.round(c.gasto * 100) / 100 }))

  // ─── Evolución mensual ────────────────────────────────────────────
  const monthly: Array<{
    month: number
    label: string
    bookings: number
    gmv: number
    commissions: number
    cobrado: number
    facturado: number
  }> = []
  for (let m = 0; m < 12; m++) {
    const monthName = new Date(year, m, 1).toLocaleDateString('es-ES', { month: 'short' })
    const bkThis = confirmed.filter(b => {
      const d = new Date(b.event_date || b.created_at)
      return d.getFullYear() === year && d.getMonth() === m
    })
    const cobradoThis = bookings.reduce((s, b) => {
      let x = 0
      if (b.first_payment_paid_at) {
        const d = new Date(b.first_payment_paid_at)
        if (d.getFullYear() === year && d.getMonth() === m) x += Number(b.first_payment_amount || 0)
      }
      if (b.second_payment_paid_at) {
        const d = new Date(b.second_payment_paid_at)
        if (d.getFullYear() === year && d.getMonth() === m) x += Number(b.second_payment_amount || 0)
      }
      return s + x
    }, 0)
    const facturadoThis = invoices.filter(i => {
      if (i.cancelled_at) return false
      const d = new Date(i.issue_date)
      return d.getFullYear() === year && d.getMonth() === m
    }).reduce((s, i) => s + Number(i.total_amount || 0), 0)

    monthly.push({
      month: m,
      label: monthName,
      bookings:    bkThis.length,
      gmv:         Math.round(bkThis.reduce((s, b) => s + Number(b.total_amount   || 0), 0) * 100) / 100,
      commissions: Math.round(bkThis.reduce((s, b) => s + Number(b.commission_amt || 0), 0) * 100) / 100,
      cobrado:     Math.round(cobradoThis   * 100) / 100,
      facturado:   Math.round(facturadoThis * 100) / 100,
    })
  }

  // ─── Reservas pendientes de facturar ──────────────────────────────
  // Reservas confirmadas/pagadas al menos parcialmente que aún no tienen
  // TODAS las facturas emitidas (comisión FG + delegada por cada pago).
  const invByBooking = new Map<string, any[]>()
  for (const i of invoices) {
    if (!i.booking_id) continue
    const arr = invByBooking.get(i.booking_id) || []
    arr.push(i)
    invByBooking.set(i.booking_id, arr)
  }

  const pendientesFacturar: Array<any> = []
  for (const b of confirmed) {
    const invs = invByBooking.get(b.id) || []
    const hasCommission = invs.some(i => i.invoice_type === 'commission_fiestago')
    const delegatedInvs = invs.filter(i => i.invoice_type === 'delegated').length
    const paidFirst  = b.first_payment_status  === 'paid'
    const paidSecond = b.second_payment_status === 'paid'
    const paymentsDone = (paidFirst ? 1 : 0) + (paidSecond ? 1 : 0)
    // Debería haber tantas delegadas como pagos hechos, y 1 comisión FG.
    if (paymentsDone > 0 && (!hasCommission || delegatedInvs < paymentsDone)) {
      pendientesFacturar.push({
        booking_id: b.id,
        provider_name: b.providers?.name || '—',
        client_name:   b.client_name,
        client_email:  b.client_email,
        event_date:    b.event_date,
        pagos_hechos:  paymentsDone,
        facturas_emitidas: invs.length,
        falta_comision:  !hasCommission,
        falta_delegadas: Math.max(0, paymentsDone - delegatedInvs),
      })
    }
  }

  // ─── Payouts pendientes por proveedor ─────────────────────────────
  // Suma de lo cobrado pero aún no transferido al proveedor
  // (por ahora todo, hasta implementar sistema de payouts).
  const payoutsRanking = providersRanking
    .filter(p => p.pendientePayout > 0)
    .sort((a, b) => b.pendientePayout - a.pendientePayout)
    .map(p => ({
      provider_id: p.provider_id,
      name:        p.name,
      pendientePayout: p.pendientePayout,
      bookings:    p.bookings,
    }))

  return NextResponse.json({
    year,
    totals: {
      bookings:    confirmed.length,
      gmv:              Math.round(gmv         * 100) / 100,
      commissions:      Math.round(commissions * 100) / 100,
      provider_rev:     Math.round(providerRev * 100) / 100,
      cobrado:          Math.round(cobrado     * 100) / 100,
      facturado:        Math.round(facturado   * 100) / 100,
      pendienteFacturar,
      invoicesCount:    invoices.filter(i => !i.cancelled_at).length,
    },
    providersRanking,
    clientsRanking,
    monthly,
    pendientesFacturar,
    payoutsRanking,
    invoices: invoices.slice(0, 200),  // las 200 más recientes con detalle
  })
}
