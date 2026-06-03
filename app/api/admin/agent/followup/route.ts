import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { buildEmailFollowup, buildDmFollowup } from '@/lib/outreach'
import { emailProviderOutreach } from '@/lib/resend'

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

function checkAuth(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && req.headers.get('x-cron-secret') === cronSecret) return true
  if (req.headers.get('x-admin-password') === process.env.ADMIN_PASSWORD) return true
  return false
}

// POST /api/admin/agent/followup
// body opcional: { days_initial?: number = 7, days_between?: number = 7, limit?: number = 30 }
//
// Busca proveedores que cumplen TODAS estas condiciones:
//  · outreach_sent = true (recibieron 1er toque)
//  · followup_count < 2 (cap de 2 follow-ups, total 3 toques)
//  · status = 'pending' (no aprobados / no respondieron)
//  · Tiempo suficiente desde el último toque:
//      - followup_count=0 → outreach_at < now - days_initial
//      - followup_count=1 → followup_sent_at < now - days_between
//
// Para cada uno:
//  · Email (contacted_via='email'): manda follow-up por Resend AUTOMÁTICO.
//  · DM (contacted_via='instagram'): solo actualiza outreach_dm con el
//    siguiente draft y pone tag='Toca DM follow-up' para que Mariano lo
//    mande a mano desde Instagram (Meta no permite bot DMs).
export async function POST(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const daysInitial = Math.max(1, parseInt(String(body.days_initial)) || 7)
  const daysBetween = Math.max(1, parseInt(String(body.days_between)) || 7)
  const limit       = Math.min(Math.max(parseInt(String(body.limit)) || 30, 1), 100)

  const supabase = createAdminClient()
  const now = Date.now()
  const cutoffInitial = new Date(now - daysInitial * 86_400_000).toISOString()
  const cutoffBetween = new Date(now - daysBetween * 86_400_000).toISOString()

  // 1er follow-up: nunca lo hicimos y el primer toque es viejo
  const { data: firstWave } = await supabase
    .from('providers')
    .select('id, name, city, email, instagram, contacted_via, outreach_email, outreach_dm, followup_count, source')
    .eq('outreach_sent', true)
    .eq('status', 'pending')
    .eq('followup_count', 0)
    .lt('outreach_at', cutoffInitial)
    .limit(limit)

  // 2º follow-up: ya hicimos 1 y han pasado más días
  const { data: secondWave } = await supabase
    .from('providers')
    .select('id, name, city, email, instagram, contacted_via, outreach_email, outreach_dm, followup_count, source')
    .eq('outreach_sent', true)
    .eq('status', 'pending')
    .eq('followup_count', 1)
    .lt('followup_sent_at', cutoffBetween)
    .limit(limit)

  const candidates = [...(firstWave || []), ...(secondWave || [])].slice(0, limit)

  const logs: string[] = []
  let emailsSent = 0
  let dmsQueued  = 0
  let failed     = 0

  for (const p of candidates) {
    const attempt = (p.followup_count || 0) + 1   // 1 = primer follow-up, 2 = último
    const provLike = { name: p.name, city: p.city, source: p.source || null }

    // Canal: email > IG. Si contacted_via no está claro, deducimos.
    const via = p.contacted_via === 'instagram'
      ? 'instagram'
      : (p.contacted_via === 'email' || p.email) ? 'email'
      : (p.instagram ? 'instagram' : null)

    if (via === 'email' && p.email) {
      const followupBody = buildEmailFollowup(provLike, attempt)
      const subject = attempt >= 2
        ? `Último mensaje · FiestaGo en ${p.city}`
        : `¿Te encaja FiestaGo? · ${p.city}`
      const send = await emailProviderOutreach(
        { ...p, outreach_email: followupBody },
        { bodyOverride: followupBody, subjectOverride: subject }
      )
      if (send.ok) {
        emailsSent++
        await supabase.from('providers').update({
          followup_sent_at: new Date().toISOString(),
          followup_count:   attempt,
          outreach_email:   followupBody,
        }).eq('id', p.id)
        logs.push(`✉️  ${p.name} — follow-up #${attempt} enviado a ${p.email}`)
      } else {
        failed++
        logs.push(`✗ ${p.name} — fallo email: ${send.error}`)
      }
    } else if (via === 'instagram' && p.instagram) {
      // Solo trackeamos: actualizamos draft + tag para que se vea en el panel.
      const dmBody = buildDmFollowup(provLike, attempt)
      await supabase.from('providers').update({
        followup_sent_at: new Date().toISOString(),
        followup_count:   attempt,
        outreach_dm:      dmBody,
        tag:              attempt >= 2 ? 'DM final pendiente' : 'DM follow-up pendiente',
      }).eq('id', p.id)
      dmsQueued++
      logs.push(`📱 ${p.name} — DM follow-up #${attempt} en cola (manda desde IG: ${p.instagram})`)
    } else {
      failed++
      logs.push(`✗ ${p.name} — sin canal válido (contacted_via=${p.contacted_via})`)
    }
  }

  return NextResponse.json({
    candidates: candidates.length,
    emailsSent,
    dmsQueued,
    failed,
    logs,
  })
}
