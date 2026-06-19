import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { pickPillarForToday, pickTopic, generateContent, PILLARS } from '@/lib/content-planner'
import { generateVideo, isConfigured } from '@/lib/heygen'

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

// Cron diario · 08:00 CEST (06:00 UTC verano / 07:00 invierno por el cron de
// Netlify, ver netlify/functions/content-daily-generate.mts).
//
// Pasos:
//   1. ¿Ya hay vídeo para hoy? Si sí, no hacer nada (idempotente).
//   2. Elegir pilar del día y topic (anti-repetición vs últimos 14 días).
//   3. Claude redacta guion 30s + caption + hashtags.
//   4. HeyGen arranca generación → devuelve video_id, status processing.
//   5. Guardar fila en content_videos con status=processing.
//
// El polling para descargar el vídeo final corre en /content-daily-poll.

function checkAuth(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && req.headers.get('x-cron-secret') === cronSecret) return true
  if (req.headers.get('x-admin-password') === process.env.ADMIN_PASSWORD) return true
  return false
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  // Permitir override manual desde admin (force=true reemplaza el del día)
  const body = await req.json().catch(() => ({}))
  const force: boolean = !!body.force

  if (!isConfigured()) {
    return NextResponse.json({
      error: 'HeyGen no configurado — define HEYGEN_API_KEY, HEYGEN_AVATAR_ID, HEYGEN_VOICE_ID',
    }, { status: 500 })
  }

  const supabase = createAdminClient()
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Madrid' })  // YYYY-MM-DD

  try {
    // 1. ¿Ya hay vídeo para hoy?
    if (!force) {
      const { data: existing } = await supabase
        .from('content_videos')
        .select('id, heygen_status')
        .eq('scheduled_for', today)
        .order('created_at', { ascending: false })
        .limit(1)
      if (existing && existing.length > 0) {
        return NextResponse.json({
          skipped: true,
          reason:  `Ya existe vídeo para ${today} (status: ${existing[0].heygen_status})`,
          id:      existing[0].id,
        })
      }
    }

    // 2. Pilar + topic
    const pillar = pickPillarForToday()
    const { data: recents } = await supabase
      .from('content_videos')
      .select('topic')
      .eq('pillar', pillar.id)
      .order('created_at', { ascending: false })
      .limit(14)
    const recentTopics = (recents || []).map((r: any) => r.topic).filter(Boolean)
    const topic = pickTopic(pillar, recentTopics)

    // 3. Claude → guion
    const content = await generateContent({ pillar, topic })

    // 4. HeyGen → arranca generación
    const heygenVideoId = await generateVideo({ script: content.script })

    // 5. Persistir
    const { data: row, error } = await supabase
      .from('content_videos')
      .insert({
        scheduled_for:        today,
        pillar:               pillar.id,
        topic,
        script:               content.script,
        caption:              content.caption,
        hashtags:             content.hashtags,
        cta_url:              pillar.ctaUrl,
        heygen_video_id:      heygenVideoId,
        heygen_status:        'processing',
        generation_started_at: new Date().toISOString(),
      })
      .select('id')
      .single()
    if (error) throw new Error(`Insert content_videos falló: ${error.message}`)

    return NextResponse.json({
      ok: true,
      id: row?.id,
      pillar: pillar.id,
      topic,
      heygen_video_id: heygenVideoId,
      script_preview: content.script.slice(0, 120) + '…',
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
