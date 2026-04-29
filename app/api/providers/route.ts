import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

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
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ provider: data }, { status: 201 })
}
