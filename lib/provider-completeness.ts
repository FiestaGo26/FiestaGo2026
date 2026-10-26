// ───────────────────────────────────────────────────────────────────────
// Ficha completa del proveedor (9.ª simulación: con proveedores sin fotos,
// sin precio ni opiniones nadie paga la señal, aunque el proceso sea bueno).
//
// Completa = al menos un servicio con precio + 6 fotos de trabajos +
// identidad verificada. Se muestra en su panel como lista de tareas, el
// CEO la ve en su snapshot y los lunes se recuerda por email a quien le
// falte algo (como mucho una vez por semana).
// ───────────────────────────────────────────────────────────────────────

import type { SupabaseClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/resend'

export const MIN_PHOTOS = 6
const APP_URL = () => (process.env.NEXT_PUBLIC_APP_URL || 'https://fiestago.es').replace(/\/$/, '')

export type Completeness = {
  provider_id: string
  priced_services: number
  photos: number
  verified: boolean
  complete: boolean
  missing: string[]
}

export async function profileCompleteness(supabase: SupabaseClient, providerIds?: string[]): Promise<Completeness[]> {
  let q = supabase.from('providers')
    .select('id, verification_status, provider_services(price, status, service_media(id))')
    .eq('status', 'approved')
  if (providerIds?.length) q = q.in('id', providerIds)
  const { data } = await q
  return (data || []).map((p: any) => {
    const svcs = (p.provider_services || []).filter((s: any) => s.status !== 'inactive')
    const priced = svcs.filter((s: any) => Number(s.price) > 0).length
    const photos = svcs.reduce((n: number, s: any) => n + (s.service_media?.length || 0), 0)
    const verified = p.verification_status === 'approved'
    const missing = [
      priced ? null : 'un servicio con su precio (IVA incluido)',
      photos >= MIN_PHOTOS ? null : `${MIN_PHOTOS - photos} foto${MIN_PHOTOS - photos > 1 ? 's' : ''} más de trabajos tuyos`,
      verified ? null : 'verificar tu identidad (DNI o CIF)',
    ].filter(Boolean) as string[]
    return { provider_id: p.id, priced_services: priced, photos, verified, complete: missing.length === 0, missing }
  })
}

/** Resumen para el CEO. */
export async function completenessSummary(supabase: SupabaseClient) {
  const all = await profileCompleteness(supabase)
  return {
    approved: all.length,
    complete: all.filter(c => c.complete).length,
    without_priced_service: all.filter(c => !c.priced_services).length,
    with_less_than_6_photos: all.filter(c => c.photos < MIN_PHOTOS).length,
    not_verified: all.filter(c => !c.verified).length,
  }
}

/** Lunes: recuerda a cada proveedor lo que le falta (una vez por semana como mucho). */
export async function remindIncompleteProfiles(supabase: SupabaseClient, limit = 30) {
  const all = (await profileCompleteness(supabase)).filter(c => !c.complete)
  if (!all.length) return 0
  const since = new Date(Date.now() - 6 * 86400_000).toISOString()
  const { data: provs } = await supabase.from('providers')
    .select('id, name, email, profile_reminder_at')
    .in('id', all.map(c => c.provider_id))
    .not('email', 'is', null)
    .or(`profile_reminder_at.is.null,profile_reminder_at.lt.${since}`)
    .limit(limit)
  let sent = 0
  for (const p of provs || []) {
    const c = all.find(x => x.provider_id === p.id)!
    const r = await sendEmail({
      to: p.email,
      subject: 'Tu ficha en FiestaGo: te falta poco para recibir reservas',
      text: `Hola ${p.name},\n\nHemos probado con clientes cómo deciden: sin precio a la vista y sin fotos de trabajos parecidos al suyo, casi nadie reserva, aunque el resto les convenza.\n\nA tu ficha le falta:\n${c.missing.map(m => `· ${m}`).join('\n')}\n\nSon 10 minutos desde tu panel: ${APP_URL()}/proveedor/panel\n\nCon la ficha completa te mostramos antes a los clientes de tu zona.\n\nFiestaGo`,
    }).catch(() => ({ ok: false }))
    await supabase.from('providers').update({ profile_reminder_at: new Date().toISOString() }).eq('id', p.id)
    if ((r as any).ok) sent++
  }
  return sent
}
