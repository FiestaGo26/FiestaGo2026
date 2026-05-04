import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

function checkAuth(req: NextRequest) {
  return !!req.headers.get('x-provider-token')
}

export async function GET(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const supabase = createAdminClient()
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 })

  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .eq('provider_id', id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ bookings: data || [] })
}

export async function PATCH(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const supabase = createAdminClient()
  const { id, status, providerId } = await req.json()
  if (!id || !status) return NextResponse.json({ error: 'Datos requeridos' }, { status: 400 })

  const updates: any = { status }
  if (status === 'confirmed') updates.confirmed_at = new Date().toISOString()
  if (status === 'cancelled') updates.cancelled_at = new Date().toISOString()

  const { data, error } = await supabase
    .from('bookings')
    .update(updates)
    .eq('id', id)
    .eq('provider_id', providerId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ booking: data })
}
