// ───────────────────────────────────────────────────────────────────────
// Búsqueda de proveedores por lotes (función de segundo plano: hasta 15 min).
// body { jobs: [{ category, city, count? }] } → lib/provider-search.ts para
// cada uno, en orden. Sirve para abrir una zona nueva de golpe (p. ej. los
// locales de Asturias) sin esperar a la rotación diaria. Gratis (OSM + DDG).
// Resultado en ops_log (kind 'provider_search').
//
// Auth: cabecera x-tick-secret = CEO_TICK_SECRET.
// ───────────────────────────────────────────────────────────────────────

import { createAdminClient } from '../../lib/supabase'
import { runProviderSearch } from '../../lib/provider-search'

export default async (req: Request) => {
  if (!process.env.CEO_TICK_SECRET || req.headers.get('x-tick-secret') !== process.env.CEO_TICK_SECRET) {
    return new Response('No autorizado', { status: 401 })
  }
  const { jobs } = await req.json().catch(() => ({} as any))
  if (!Array.isArray(jobs) || !jobs.length) return new Response('Faltan jobs', { status: 400 })

  const supabase = createAdminClient()
  const started = Date.now()
  const results: Array<{ category: string; city: string; saved: number; dup: number; noWa: number; error?: string }> = []
  for (const j of jobs.slice(0, 40)) {
    if (Date.now() - started > 13 * 60_000) break   // margen antes de los 15 min
    const r = await runProviderSearch({ category: j.category, city: j.city, count: j.count || 10 })
      .catch((err: any) => ({ saved: 0, skippedDup: 0, skippedNoWa: 0, error: err.message } as any))
    results.push({ category: j.category, city: j.city, saved: r.saved, dup: r.skippedDup, noWa: r.skippedNoWa, error: r.error })
  }
  await supabase.from('ops_log').insert({
    kind: 'provider_search', ok: results.every(r => !r.error),
    detail: { jobs: jobs.length, done: results.length, saved: results.reduce((n, r) => n + r.saved, 0), results },
  })
  return new Response('ok')
}
