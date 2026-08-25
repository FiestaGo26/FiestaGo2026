import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { generateGmbPost } from '@/lib/gmb-generator'
import { emailProviderGmbWeeklyReminder } from '@/lib/emails/gmb-reminder'

export const runtime = 'nodejs'
export const maxDuration = 300
export const dynamic = 'force-dynamic'

/**
 * Cron semanal · recordatorio para publicar en Google Business.
 *
 * Ejecutar 1 vez a la semana (idealmente lunes 09:00 hora Madrid). Auth
 * via header x-cron-secret. Idempotente: usa gmb_last_weekly_reminder_at
 * en la fila del proveedor para no reenviar más de 1 vez cada 6 días,
 * aunque el cron corra varias veces.
 *
 * Para cada proveedor:
 *   1. Debe estar activo y aprobado
 *   2. gmb_weekly_reminders_enabled = true (default true)
 *   3. Debe tener email
 *   4. Su último post con status='published' >= 7 días o nunca ha publicado
 *   5. gmb_last_weekly_reminder_at IS NULL o > 6 días atrás
 *
 * Acción:
 *   · Elige un topic rotativo según semana del año (para no repetir siempre lo mismo)
 *   · Genera el post con IA (guardado como draft en provider_gmb_posts)
 *   · Envía email con copia rápida
 *   · Marca gmb_last_weekly_reminder_at
 */

// Rotación de temas para que la IA no repita siempre lo mismo. La semana
// del año selecciona uno determinístico — misma semana = mismo tema.
const TOPIC_POOL = [
  'Fechas libres del próximo mes para nuevas reservas',
  'Testimonio o momento memorable de un evento reciente',
  'Tip práctico útil para clientes que planean su evento',
  'Detrás de las cámaras / cómo trabajo un evento típico',
  'Promoción o descuento especial de temporada',
  'Nuevo servicio o mejora que estás ofreciendo',
  'Preguntas frecuentes que te hacen tus clientes',
  'Recordatorio de por qué reservar con antelación',
]

function pickTopic(dt: Date): string {
  const jan1 = new Date(dt.getFullYear(), 0, 1).getTime()
  const week = Math.floor((dt.getTime() - jan1) / (7 * 86400_000))
  return TOPIC_POOL[week % TOPIC_POOL.length]
}

function daysAgo(iso: string | null | undefined): number {
  if (!iso) return Infinity
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return Infinity
  return Math.floor((Date.now() - then) / 86400_000)
}

export async function POST(req: NextRequest) {
  if (req.headers.get('x-cron-secret') !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const now = new Date()

  // Candidatos: proveedores activos, con email, con recordatorios activos.
  const { data: providers, error } = await supabase
    .from('providers')
    .select('id, name, category, city, slug, email, google_business_url, gmb_last_weekly_reminder_at')
    .eq('status', 'active')
    .eq('gmb_weekly_reminders_enabled', true)
    .not('email', 'is', null)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const results: Array<{ provider_id: string; status: string; note?: string }> = []
  const base = new URL(req.url).origin

  for (const p of providers || []) {
    // Anti-spam: si ya recibió recordatorio en los últimos 6 días, saltar.
    if (daysAgo(p.gmb_last_weekly_reminder_at) < 6) {
      results.push({ provider_id: p.id, status: 'skipped', note: 'reminder-recent' })
      continue
    }

    // Consulta al último post PUBLICADO. Si el más reciente es <7d, saltar.
    const { data: lastPub } = await supabase
      .from('provider_gmb_posts')
      .select('published_at')
      .eq('provider_id', p.id)
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (lastPub && daysAgo(lastPub.published_at) < 7) {
      results.push({ provider_id: p.id, status: 'skipped', note: 'published-recently' })
      continue
    }

    const daysSince = lastPub?.published_at
      ? daysAgo(lastPub.published_at)
      : 30   // si nunca ha publicado, mostramos "30 días" como métrica de urgencia

    try {
      const topic = pickTopic(now)
      const post = await generateGmbPost({
        provider: {
          name:     p.name,
          category: p.category,
          city:     p.city,
          slug:     p.slug,
          email:    p.email,
        },
        topic,
      })

      // Guardar el draft en el mismo sitio donde el proveedor ve sus posts,
      // para que si entra al panel ya lo tenga listo (además del email).
      await supabase.from('provider_gmb_posts').insert({
        provider_id: p.id,
        topic:      `[Recordatorio semanal] ${topic}`,
        body:       post.body,
        cta_label:  post.ctaLabel,
        cta_url:    post.ctaUrl,
        status:     'draft',
      })

      // Enviar email
      const send = await emailProviderGmbWeeklyReminder({
        to:                p.email!,
        providerName:      p.name,
        daysSincePublish:  Math.min(daysSince, 999),
        postBody:          post.body,
        postCtaLabel:      post.ctaLabel,
        postCtaUrl:        post.ctaUrl,
        googleBusinessUrl: p.google_business_url || null,
        panelUrl:          `${base}/proveedor/panel?tab=gmb`,
        unsubscribeUrl:    `${base}/proveedor/panel?tab=gmb&unsubscribe=1`,
      })

      if (!send.ok) {
        results.push({ provider_id: p.id, status: 'email-error', note: send.error })
        continue
      }

      await supabase
        .from('providers')
        .update({ gmb_last_weekly_reminder_at: now.toISOString() })
        .eq('id', p.id)

      results.push({ provider_id: p.id, status: 'sent' })
    } catch (err: any) {
      results.push({ provider_id: p.id, status: 'error', note: err.message })
    }
  }

  const scanned = providers?.length || 0
  const sent    = results.filter(r => r.status === 'sent').length
  return NextResponse.json({ ok: true, scanned, sent, results })
}
