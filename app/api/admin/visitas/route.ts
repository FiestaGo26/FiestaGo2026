import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/admin/visitas?days=30 → resumen de visitas de la web (función visitas_summary)
export async function GET(req: NextRequest) {
  if (req.headers.get('x-admin-password') !== process.env.ADMIN_PASSWORD) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const days = Math.min(Math.max(parseInt(new URL(req.url).searchParams.get('days') || '30') || 30, 1), 365)
  const { data, error } = await createAdminClient().rpc('visitas_summary', { p_days: days })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ days, ...(data as any) })
}
