import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { emailAdminNewProvider, emailProviderWelcome } from '@/lib/resend'

// Wrapper que dispara un email y, si Resend devuelve {ok:false} o lanza una
// excepción, escribe una notificación visible en /admin con el error real.
// Antes el .catch() nunca disparaba porque sendEmail() no rechaza la promise
// — solo devuelve {ok:false, error}. Resultado: fallos completamente silenciados.
function fireEmail(
  label: string,
  fn: () => Promise<{ ok: boolean; error?: string; id?: string }>,
  context: Record<string, any>,
) {
  const supabase = createAdminClient()
  fn().then(result => {
    if (!result?.ok) {
      console.error(`[email] ${label} FAILED:`, JSON.stringify(result), context)
      supabase.from('notifications').insert({
        type:       'email_send_failure',
        title:      `⚠️ Email no enviado · ${label}`,
        message:    `${result?.error || 'error desconocido'}. Comprueba RESEND_API_KEY, ADMIN_EMAIL y OUTREACH_FROM en Netlify.`,
        data:       { function: label, error: result, ...context },
        action_url: `/admin`,
      }).then(() => {})
    } else {
      console.log(`[email] ${label} sent, id=${result.id}`)
    }
  }).catch(err => {
    console.error(`[email] ${label} EXCEPTION:`, err?.message, context)
  })
}

// Campos que SÍ pueden viajar al cliente público. Se excluye cualquier canal
// de contacto directo (email, phone, website, instagram, tiktok, social_*) y
// cualquier dato interno (outreach_*, agent_*, user_id) para que un cliente
// no pueda saltarse el flujo de reserva de FiestaGo.
const PUBLIC_PROVIDER_FIELDS = `
  id, slug, name, category, city, address, description, short_desc,
  price_base, price_unit, years_active, specialties, tag,
  rating, total_reviews, total_bookings, featured, verified,
  photo_url, photo_idx, created_at
`

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
    let q = supabase.from('providers').select(PUBLIC_PROVIDER_FIELDS).eq('status', 'approved')
    if (id)   q = q.eq('id', id)
    if (slug) q = q.eq('slug', slug)
    const { data, error } = await q.maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ provider: null }, { status: 404 })
    return NextResponse.json({ provider: data })
  }

  let query = supabase
    .from('providers')
    .select(PUBLIC_PROVIDER_FIELDS)
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
          description, price_base, price_unit, specialties, referred_by,
          accept_terms } = body

  if (!name || !category || !city || !email) {
    return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 })
  }
  if (!accept_terms) {
    return NextResponse.json({ error: 'Tienes que aceptar los Compromisos del Proveedor' }, { status: 400 })
  }

  const { TERMS_VERSION_CURRENT } = await import('@/lib/terms')
  const acceptIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
              || req.headers.get('x-real-ip')
              || null
  const termsMeta = {
    terms_accepted_at:  new Date().toISOString(),
    terms_version:      TERMS_VERSION_CURRENT,
    terms_accepted_ip:  acceptIp,
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
        ...termsMeta,
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
      const target0 = updated || existing
      fireEmail('emailAdminNewProvider (existing)', () => emailAdminNewProvider(target0), {
        provider_id: target0.id, provider_email: target0.email,
      })
      // Bienvenida al proveedor (confirmando que su registro está en revisión)
      if (target0.email) {
        fireEmail('emailProviderWelcome (existing)', () => emailProviderWelcome(target0), {
          provider_id: target0.id, provider_email: target0.email,
        })
      }

      // Notificación en el panel (campana). Otras acciones como reservas o
      // incidencias ya lo hacen; el self-register se nos había escapado.
      const target = updated || existing
      supabase.from('notifications').insert({
        type:    'provider_self_registered',
        title:   `✍️ Nuevo proveedor registrado · ${target.name}`,
        message: `${target.category || 'Sin categoría'} en ${target.city || 'sin ciudad'}. Aprueba o rechaza desde el panel.`,
        data:    { provider_id: target.id, email: target.email, merged: true },
        action_url: `/admin#providers-${target.id}`,
      }).then(() => {})

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
      ...termsMeta,
    })
    .select()
    .single()

  if (error) {
    // Antes este return era silencioso: el toast del cliente desaparecía en
    // 4s y se perdía la causa real. Ahora dejamos rastro en notifications
    // para que /admin lo vea con el error exacto y un link al auth user
    // huérfano (si lo hubiese — viene del flujo de /registro-proveedor).
    console.error('[providers POST] INSERT failed:', JSON.stringify(error), { email, name, category, city })
    supabase.from('notifications').insert({
      type:       'provider_insert_failure',
      title:      `❌ Alta de proveedor FALLÓ · ${name}`,
      message:    `${error.message}. Email: ${email}. Ciudad: ${city}. Categoría: ${category}. Revisa /admin-tools/huerfanos para recuperarlo.`,
      data:       { email, name, category, city, db_error: error },
      action_url: `/admin-tools/huerfanos`,
    }).then(() => {})
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Notificar al admin (no bloquear si falla el email — fireEmail registra el
  // fallo en /admin para que NO se nos escape como antes).
  fireEmail('emailAdminNewProvider', () => emailAdminNewProvider(data), {
    provider_id: data.id, provider_email: data.email,
  })
  // Bienvenida al proveedor — antes existía la función pero NO se llamaba.
  if (data.email) {
    fireEmail('emailProviderWelcome', () => emailProviderWelcome(data), {
      provider_id: data.id, provider_email: data.email,
    })
  }

  // Notificación en el panel (campana).
  supabase.from('notifications').insert({
    type:    'provider_self_registered',
    title:   `✍️ Nuevo proveedor registrado · ${data.name}`,
    message: `${data.category || 'Sin categoría'} en ${data.city || 'sin ciudad'}. Aprueba o rechaza desde el panel.`,
    data:    { provider_id: data.id, email: data.email, merged: false },
    action_url: `/admin#providers-${data.id}`,
  }).then(() => {})

  return NextResponse.json({ provider: data, selfRegistered: true }, { status: 201 })
}
