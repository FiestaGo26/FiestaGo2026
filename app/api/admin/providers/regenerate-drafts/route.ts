import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { buildEmailDraft, buildDmDraft, buildWhatsAppDraft } from '@/lib/outreach'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function checkAdminAuth(req: NextRequest) {
  return req.headers.get('x-admin-password') === process.env.ADMIN_PASSWORD
}

// POST /api/admin/providers/regenerate-drafts
// Regenera outreach_email y outreach_dm para todos los pending + outreach_sent=false
export async function POST(req: NextRequest) {
  if (!checkAdminAuth(req)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  const supabase = createAdminClient()

  // Cargar TODOS los pendientes (haya sido contactado o no — el draft solo se muestra al admin)
  const { data: candidates, error } = await supabase
    .from('providers')
    .select('id, name, city, email, phone, instagram, source, outreach_sent')
    .eq('status', 'pending')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!candidates || !candidates.length) {
    return NextResponse.json({ updated: 0, emailDraftsRegenerated: 0, dmDraftsRegenerated: 0, waDraftsRegenerated: 0, total: 0 })
  }

  let updatedRows = 0
  let emailCount = 0
  let dmCount = 0
  let waCount = 0

  for (const p of candidates as any[]) {
    const updates: any = {}
    if (p.email) {
      updates.outreach_email = buildEmailDraft(p)
      emailCount++
    }
    if (p.instagram) {
      updates.outreach_dm = buildDmDraft(p)
      dmCount++
    }
    if (p.phone) {
      updates.outreach_whatsapp = buildWhatsAppDraft(p)
      waCount++
    }
    if (Object.keys(updates).length === 0) continue
    const { error: upErr } = await supabase.from('providers').update(updates).eq('id', p.id)
    if (!upErr) updatedRows++
  }

  return NextResponse.json({
    total: candidates.length,
    updated: updatedRows,
    emailDraftsRegenerated: emailCount,
    dmDraftsRegenerated: dmCount,
    waDraftsRegenerated: waCount,
  })
}
