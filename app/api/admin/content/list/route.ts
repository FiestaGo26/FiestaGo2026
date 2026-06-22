import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { activeMode, pickPillarForToday } from '@/lib/content-planner'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function checkAdmin(req: NextRequest) {
  return req.headers.get('x-admin-password') === process.env.ADMIN_PASSWORD
}

// GET /api/admin/content/list — últimos 50 vídeos + modo/pilar de hoy.
export async function GET(req: NextRequest) {
  if (!checkAdmin(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('content_videos')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const pillarToday = pickPillarForToday()
  return NextResponse.json({
    videos: data || [],
    mode:   activeMode(),
    pillarToday: { id: pillarToday.id, label: pillarToday.label },
  }, {
    // Sin caché: el panel necesita siempre el estado más reciente
    // (especialmente cuando un vídeo está en processing y queremos
    // ver el cambio a completed sin recargar la página).
    headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
  })
}
