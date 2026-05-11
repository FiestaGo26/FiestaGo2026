import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/search?q=...&ciudad=...&tipo=packs|proveedores|servicios|todo
export async function GET(req: NextRequest) {
  const supabase = createAdminClient()
  const { searchParams } = new URL(req.url)
  const q       = (searchParams.get('q') || '').trim()
  const ciudad  = (searchParams.get('ciudad') || '').trim()
  const fecha   = (searchParams.get('fecha') || '').trim()  // YYYY-MM-DD, opcional
  const tipo    = (searchParams.get('tipo') || 'todo').toLowerCase()
  const limit   = Math.min(parseInt(searchParams.get('limit') || '24'), 60)

  const wantPacks      = tipo === 'packs'       || tipo === 'todo'
  const wantProviders  = tipo === 'proveedores' || tipo === 'todo'
  const wantServices   = tipo === 'servicios'   || tipo === 'todo'

  const ilike = q ? `%${q}%` : null

  // PACKS
  let packs: any[] = []
  if (wantPacks) {
    let query = supabase.from('packs').select('*').eq('status', 'active').limit(limit)
    if (ilike) query = query.or(`name.ilike.${ilike},description.ilike.${ilike},category.ilike.${ilike}`)
    const { data } = await query
    packs = (data || []).map((p: any) => ({ ...p, _kind: 'pack' as const }))
  }

  // PROVIDERS
  let providers: any[] = []
  if (wantProviders) {
    let query = supabase.from('providers').select('*').eq('status', 'approved').order('rating', { ascending: false }).limit(limit)
    if (ciudad) query = query.eq('city', ciudad)
    if (ilike)  query = query.or(`name.ilike.${ilike},description.ilike.${ilike},short_desc.ilike.${ilike},category.ilike.${ilike}`)
    const { data } = await query
    providers = (data || []).map((p: any) => ({ ...p, _kind: 'provider' as const }))
  }

  // SERVICES (con datos del proveedor para enlace + ciudad)
  let services: any[] = []
  if (wantServices) {
    let query = supabase
      .from('provider_services')
      .select('*, providers!inner(id, name, slug, city, category, status)')
      .eq('status', 'active')
      .eq('providers.status', 'approved')
      .order('created_at', { ascending: false })
      .limit(limit)
    if (ciudad) query = query.eq('providers.city', ciudad)
    if (ilike)  query = query.or(`name.ilike.${ilike},description.ilike.${ilike}`)
    const { data } = await query
    services = (data || []).map((s: any) => ({
      ...s,
      _kind: 'service' as const,
      provider: s.providers,
    }))

    // Filtrar por fecha si nos la pasan (excluir servicios bloqueados ese día)
    if (fecha && services.length) {
      const { data: blocked } = await supabase
        .from('service_availability')
        .select('service_id')
        .eq('blocked_date', fecha)
        .in('service_id', services.map((s: any) => s.id))
      const blockedIds = new Set((blocked || []).map((b: any) => b.service_id))
      services = services.filter((s: any) => !blockedIds.has(s.id))
    }
  }

  return NextResponse.json({
    q,
    ciudad,
    fecha,
    tipo,
    counts: {
      packs:      packs.length,
      providers:  providers.length,
      services:   services.length,
      total:      packs.length + providers.length + services.length,
    },
    packs,
    providers,
    services,
  })
}
