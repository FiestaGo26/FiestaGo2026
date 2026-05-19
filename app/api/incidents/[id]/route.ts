import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { isAdminRequest } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// PATCH /api/incidents/[id]
// Solo admin. body: { status, resolution?, compensation_amount?, rejected_reason? }
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const supabase = createAdminClient()
  const body = await req.json().catch(() => ({}))
  const { status, resolution, compensation_amount, rejected_reason } = body || {}

  const updates: any = {}
  if (status) {
    if (!['open','investigating','resolved','rejected'].includes(status)) {
      return NextResponse.json({ error: 'status no válido' }, { status: 400 })
    }
    updates.status = status
    if (status === 'resolved' || status === 'rejected') {
      updates.resolved_at = new Date().toISOString()
      updates.resolved_by = req.headers.get('x-admin-email') || 'admin'
    }
  }
  if (resolution !== undefined)          updates.resolution = resolution
  if (compensation_amount !== undefined) updates.compensation_amount = Number(compensation_amount) || null
  if (rejected_reason !== undefined)     updates.rejected_reason = rejected_reason

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('incidents').update(updates)
    .eq('id', params.id).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ incident: data })
}
