import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/coupons/validate?code=PROMO20&provider_id=...&service_id=...
// Devuelve { valid, percent_off, amount_off, error? } sin marcar como usado.
// El uso se contabiliza al crear la reserva (POST /api/bookings).
// service_id opcional: si el cupón está scoped a un servicio concreto y
// el service_id enviado no coincide, se rechaza.
export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams
  const code = (sp.get('code') || '').toUpperCase().trim()
  const providerId = sp.get('provider_id')
  const serviceId = sp.get('service_id') || null
  const total = Number(sp.get('total') || 0)

  if (!code || !providerId) {
    return NextResponse.json({ valid: false, error: 'Faltan datos' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data: coupon } = await supabase
    .from('coupons')
    .select('id, code, percent_off, max_uses, used_count, expires_at, active, service_id')
    .eq('provider_id', providerId)
    .eq('code', code)
    .maybeSingle()

  if (!coupon) {
    return NextResponse.json({ valid: false, error: 'Código no válido' })
  }
  if (!coupon.active) {
    return NextResponse.json({ valid: false, error: 'Cupón desactivado' })
  }
  if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
    return NextResponse.json({ valid: false, error: 'Cupón caducado' })
  }
  if (coupon.max_uses != null && coupon.used_count >= coupon.max_uses) {
    return NextResponse.json({ valid: false, error: 'Cupón agotado' })
  }
  // Scope por servicio: si el cupón está atado a un servicio concreto,
  // exigimos que el cliente lo esté aplicando ahí.
  if (coupon.service_id && coupon.service_id !== serviceId) {
    return NextResponse.json({
      valid: false,
      error: 'Este cupón solo se puede usar en un servicio concreto — elige el servicio correcto o pregúntale al proveedor',
    })
  }

  const amount_off = Math.round((total * coupon.percent_off / 100) * 100) / 100
  return NextResponse.json({
    valid: true,
    code: coupon.code,
    percent_off: coupon.percent_off,
    amount_off,
  })
}
