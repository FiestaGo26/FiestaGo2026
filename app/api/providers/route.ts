import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { emailAdminNewProvider } from '@/lib/resend'

// GET /api/providers — list approved providers
export async function GET(req: NextRequest) {
  const supabase = createAdminClient()
  const { searchParams } = new URL(req.url)

  const id       = searchParams.get('id')
  const slug     = searchParams.get('slug')
  const category = searchParams.get('category')
  const city     = searchParams.get('city')
  const featured = searchParams.get('featured')
  const limit    = parseInt(searchParams.get('limit') || '50')
  const offset   = parseInt(searchParams.get('offset') || '0')

  // Lookup directo por id o slug (para ficha individual)
  if (id || slug) {
    let q = supabase.from('providers').select('*').eq('status', 'approved')
    if (id)   q = q.eq('id', id)
    if (slug) q = q.eq('slug', slug)
    const { data, error } = await q.maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ provider: null }, { status: 404 })
    return NextResponse.json({ provider: data })
  }

  let query = supabase
    .from('providers')
    .select('*')
    .eq('status', 'approved')
    .order('featured', { ascending: false })
    .order('rating', { ascending: false })
    .range(offset, offset + limit - 1)

  if (category) query = query.eq('category', category)
  if (city)     query = query.eq('city', city)
  if (featured) query = query.eq('featured', true)

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ providers: data, count })
}

// POST /api/providers — register new provider (public)
export async function POST(req: NextRequest) {
  const supabase = createAdminClient()
  const body = await req.json()

  const { name, category, city, email, phone, website, instagram,
          description, price_base, price_unit, specialties, referred_by } = body

  if (!name || !category || !city || !email) {
    return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 })
  }

  // Idempotencia: si ya existe un proveedor con este email, MEZCLAR los datos
  // nuevos del formulario sobre la fila existente (solo campos que no se pisen
  // si quedan vacíos) y marcar self_registered=true para que el admin lo vea.
  if (email) {
    const { data: existing } = await supabase
      .from('providers').select('*')
      .ilike('email', email.toLowerCase().trim())
      .maybeSingle()
    if (existing) {
      const merged: any = {
        self_registered:    true,
        self_registered_at: new Date().toISOString(),
      }
      // Solo escribir si el formulario aporta valor y la fila estaba vacía o el
      // valor nuevo es distinto y más completo. NO sobrescribimos status ni tag
      // del lifecycle existente.
      if (name        && name        !== existing.name)        merged.name        = name
      if (category    && category    !== existing.category)    merged.category    = category
      if (city        && city        !== existing.city)        merged.city        = city
      if (phone       && !existing.phone)                      merged.phone       = phone
      if (website     && !existing.website)                    merged.website     = website
      if (instagram   && !existing.instagram)                  merged.instagram   = instagram
      if (description && description !== existing.description) merged.description = description
      if (price_base  && !existing.price_base)                 merged.price_base  = price_base
      if (price_unit  && !existing.price_unit)                 merged.price_unit  = price_unit
      if (Array.isArray(specialties) && specialties.length && (!existing.specialties || existing.specialties.length === 0)) {
        merged.specialties = specialties
      }
      if (referred_by && !existing.referred_by) merged.referred_by = referred_by

      const { data: updated } = await supabase
        .from('providers').update(merged).eq('id', existing.id).select().single()

      // Notificar al admin de que ESTE proveedor se ha registrado por su cuenta
      emailAdminNewProvider(updated || existing).catch(err =>
        console.error('emailAdminNewProvider (self-register existing):', err.message))

      return NextResponse.json({ provider: updated || existing, alreadyExists: true, selfRegistered: true }, { status: 200 })
    }
  }

  // Calcular contactable: cualquier canal accionable
  const ownWebsite = website && !/instagram\.com|tiktok\.com/i.test(website)
  const contactable = !!(email || phone || ownWebsite || instagram)

  const { data, error } = await supabase
    .from('providers')
    .insert({
      name, category, city, email,
      phone:        phone || null,
      website:      website || null,
      instagram:    instagram || null,
      description:  description || null,
      price_base:   price_base || null,
      price_unit:   price_unit || 'por evento',
      specialties:  specialties || [],
      source:       'web',
      status:       'pending',
      contactable,
      referred_by:  referred_by || null,
      self_registered:    true,
      self_registered_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Notificar al admin (no bloquear si falla el email)
  emailAdminNewProvider(data).catch(err =>
    console.error('emailAdminNewProvider:', err.message))

  return NextResponse.json({ provider: data, selfRegistered: true }, { status: 201 })
}
