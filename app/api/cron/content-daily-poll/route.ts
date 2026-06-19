import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { getVideoStatus, isConfigured } from '@/lib/heygen'
import { sendText, isValidPhoneE164ES } from '@/lib/whatsapp'

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

// Cron de polling · cada 5 min entre 08:05 y 08:30 CEST.
// Mira las filas con heygen_status in (pending, processing) generadas
// las últimas 24h y consulta HeyGen. Si termina, guarda video_url y
// notifica por WhatsApp al admin (env ADMIN_WHATSAPP_NUMBER).

function checkAuth(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && req.headers.get('x-cron-secret') === cronSecret) return true
  if (req.headers.get('x-admin-password') === process.env.ADMIN_PASSWORD) return true
  return false
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (!isConfigured()) return NextResponse.json({ error: 'HeyGen no configurado' }, { status: 500 })

  const supabase = createAdminClient()

  // Buscar pendientes de las últimas 24h
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data: pending, error: loadErr } = await supabase
    .from('content_videos')
    .select('id, heygen_video_id, pillar, topic, caption, scheduled_for')
    .in('heygen_status', ['pending', 'processing'])
    .gte('created_at', since)
    .order('created_at', { ascending: true })
    .limit(20)
  if (loadErr) return NextResponse.json({ error: loadErr.message }, { status: 500 })

  const updates: any[] = []
  for (const row of (pending || []) as any[]) {
    if (!row.heygen_video_id) continue
    try {
      const st = await getVideoStatus(row.heygen_video_id)
      if (st.status === 'completed' && st.videoUrl) {
        await supabase.from('content_videos').update({
          heygen_status:    'completed',
          video_url:        st.videoUrl,
          thumbnail_url:    st.thumbnailUrl,
          duration_seconds: st.duration,
          completed_at:     new Date().toISOString(),
        }).eq('id', row.id)

        // Notificación WhatsApp al admin (si está configurado y dentro
        // de la ventana de 24h con ese número — si no, no se envía).
        const adminPhone = process.env.ADMIN_WHATSAPP_NUMBER
        if (adminPhone && isValidPhoneE164ES(adminPhone)) {
          try {
            await sendText(
              adminPhone,
              `🎬 Vídeo de hoy listo (${row.pillar}):\n` +
              `"${row.topic}"\n\n` +
              `Descarga: ${st.videoUrl}\n\n` +
              `Caption para post:\n${row.caption || '—'}`
            )
            await supabase.from('content_videos').update({
              notified_at: new Date().toISOString(),
            }).eq('id', row.id)
          } catch (waErr: any) {
            // Notificación falló pero el vídeo se generó OK. No revertimos.
            console.error('[content-daily-poll] WhatsApp notify falló:', waErr.message)
          }
        }

        updates.push({ id: row.id, status: 'completed', video_url: st.videoUrl })
      } else if (st.status === 'failed') {
        await supabase.from('content_videos').update({
          heygen_status: 'failed',
          error:         st.error || 'HeyGen reportó failed sin detalle',
        }).eq('id', row.id)
        updates.push({ id: row.id, status: 'failed', error: st.error })
      } else {
        // Sigue processing — solo actualizamos el status si cambió
        await supabase.from('content_videos').update({
          heygen_status: st.status,
        }).eq('id', row.id)
        updates.push({ id: row.id, status: st.status })
      }
    } catch (err: any) {
      console.error('[content-daily-poll] error polling', row.id, err.message)
      updates.push({ id: row.id, error: err.message })
    }
  }

  return NextResponse.json({ ok: true, checked: pending?.length || 0, updates })
}
