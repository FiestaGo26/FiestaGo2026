// ───────────────────────────────────────────────────────────────────────
// Opiniones de Google de los proveedores aprobados (segundo plano: hasta
// 15 min). Ver lib/google-reviews.ts. Body opcional: { maxAgeDays, limit }.
//
// Auth: cabecera x-tick-secret = CEO_TICK_SECRET (la misma del latido).
// ───────────────────────────────────────────────────────────────────────

import { createAdminClient } from '../../lib/supabase'
import { refreshGoogleReviews } from '../../lib/google-reviews'

export default async (req: Request) => {
  if (!process.env.CEO_TICK_SECRET || req.headers.get('x-tick-secret') !== process.env.CEO_TICK_SECRET) {
    return new Response('No autorizado', { status: 401 })
  }
  const body = await req.json().catch(() => ({} as any))
  const out = await refreshGoogleReviews(createAdminClient(), body)
  console.log('[google-reviews]', JSON.stringify(out))
  return new Response('ok')
}
