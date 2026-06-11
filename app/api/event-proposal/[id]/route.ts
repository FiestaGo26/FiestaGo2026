import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/event-proposal/[id]
// Devuelve una propuesta guardada para que cualquiera con el link la vea.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('event_proposals')
    .select('id, event_type, guests, city, budget_total, style, event_date, categories, packages, created_at, views_count')
    .eq('id', id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data)  return NextResponse.json({ error: 'Propuesta no encontrada' }, { status: 404 })

  // Incrementar contador de visitas (best-effort, no bloquea)
  supabase.from('event_proposals')
    .update({ views_count: (data.views_count || 0) + 1 })
    .eq('id', id)
    .then(() => {}, () => {})

  return NextResponse.json({ proposal: data })
}
