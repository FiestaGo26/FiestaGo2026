import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { emailAdminNewProvider } from '@/lib/resend'

// GET /api/providers — list approved providers
export async function GET(req: NextRequest) {
  const supabase = createAdminClient()
  const { searchParams } = new URL(req.url)

  const category = searchParams.get('category')
  const city     = searchParams.get('city')
  const featured = searchParams.get('featured')
  const limit    = parseInt(searchParams.get('limit') || '50')
  const offset   = parseInt(searchParams.get('offset') || '0')

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
          description, price_base, price_unit, specialties } = body

  if (!name || !category || !city || !email) {
    return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 })
  }

  // Idempotencia: si ya existe un proveedor con este email, devolverlo en lugar de duplicar
  if (email) {
    const { data: existing } = await supabase
      .from('providers').select('*')
      .ilike('email', email.toLowerCase().trim())
      .maybeSingle()
    if (existing) {
      return NextResponse.json({ provider: existing, alreadyExists: true }, { status: 200 })
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
      source:       'self_registration',
      status:       'pending',
      contactable,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Notificar al admin (no bloquear si falla el email)
  emailAdminNewProvider(data).catch(err =>
    console.error('emailAdminNewProvider:', err.message))

  return NextResponse.json({ provider: data }, { status: 201 })
}
