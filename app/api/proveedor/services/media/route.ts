import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requireProviderAuth } from '@/lib/auth'

export const runtime = 'nodejs'
export const maxDuration = 30
export const dynamic = 'force-dynamic'

const MAX_MEDIA_PER_SERVICE = 10

// GET /api/proveedor/services/media?service_id=...
export async function GET(req: NextRequest) {
  const supabase = createAdminClient()
  const { searchParams } = new URL(req.url)
  const serviceId = searchParams.get('service_id')
  if (!serviceId) return NextResponse.json({ error: 'service_id requerido' }, { status: 400 })

  const { data: svc } = await supabase
    .from('provider_services').select('provider_id').eq('id', serviceId).maybeSingle()
  if (!svc) return NextResponse.json({ error: 'Servicio no encontrado' }, { status: 404 })

  const auth = await requireProviderAuth(req, svc.provider_id)
  if (!auth.ok) return auth.response

  const { data, error } = await supabase
    .from('service_media')
    .select('id, url, thumbnail_url, media_type, sort_order, is_primary, storage_path')
    .eq('service_id', serviceId)
    .order('is_primary', { ascending: false })
    .order('sort_order',  { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ media: data || [] })
}

// POST multipart/form-data: file, service_id, provider_id
// Sube el archivo y crea fila en service_media. Si es la primera imagen
// del servicio, queda marcada como primary y actualiza provider_services.media_url.
export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file       = formData.get('file') as File | null
  const serviceId  = formData.get('service_id') as string | null
  const providerId = formData.get('provider_id') as string | null

  if (!file || !serviceId || !providerId) {
    return NextResponse.json({ error: 'file, service_id y provider_id requeridos' }, { status: 400 })
  }

  const auth = await requireProviderAuth(req, providerId)
  if (!auth.ok) return auth.response

  const supabase = createAdminClient()

  // Validar que el servicio pertenece al provider
  const { data: svc } = await supabase
    .from('provider_services')
    .select('id, provider_id')
    .eq('id', serviceId).maybeSingle()
  if (!svc || svc.provider_id !== providerId) {
    return NextResponse.json({ error: 'Servicio no encontrado' }, { status: 404 })
  }

  // Comprobar límite
  const { count } = await supabase
    .from('service_media')
    .select('id', { count: 'exact', head: true })
    .eq('service_id', serviceId)
  if ((count || 0) >= MAX_MEDIA_PER_SERVICE) {
    return NextResponse.json({
      error: `Máximo ${MAX_MEDIA_PER_SERVICE} archivos por servicio. Elimina alguno primero.`
    }, { status: 400 })
  }

  const ext = (file.name.split('.').pop() || 'bin').toLowerCase()
  const mediaType =
    ['jpg','jpeg','png','webp','gif','heic'].includes(ext) ? 'image' :
    ['mp4','mov','webm','m4v'].includes(ext) ? 'video' : null
  if (!mediaType) {
    return NextResponse.json({ error: 'Formato no soportado' }, { status: 400 })
  }
  const maxBytes = mediaType === 'video' ? 50 * 1024 * 1024 : 10 * 1024 * 1024
  if (file.size > maxBytes) {
    return NextResponse.json({
      error: `Archivo demasiado grande (${Math.round(file.size/1024/1024)}MB). Máximo ${maxBytes/1024/1024}MB.`
    }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const path   = `services/${providerId}/${serviceId}/${Date.now()}-${Math.random().toString(36).slice(2,6)}.${ext}`

  const { error: upErr } = await supabase.storage
    .from('provider-media')
    .upload(path, buffer, {
      contentType: file.type || (mediaType === 'video' ? 'video/mp4' : 'image/jpeg'),
      upsert: false,
    })
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/provider-media/${path}`

  const isFirst = (count || 0) === 0

  const { data: row, error: insErr } = await supabase
    .from('service_media')
    .insert({
      service_id:   serviceId,
      provider_id:  providerId,
      url,
      media_type:   mediaType,
      storage_path: path,
      sort_order:   count || 0,
      is_primary:   isFirst,
    })
    .select()
    .single()

  if (insErr) {
    await supabase.storage.from('provider-media').remove([path]).catch(() => {})
    return NextResponse.json({ error: insErr.message }, { status: 500 })
  }

  // Si es la primera, sincronizar provider_services.media_url para mantener
  // compatibilidad con listados que aún leen ese campo.
  if (isFirst) {
    await supabase
      .from('provider_services')
      .update({ media_url: url, media_type: mediaType })
      .eq('id', serviceId)
  }

  return NextResponse.json({ media: row })
}

// PATCH body: { id, service_id, provider_id, is_primary?: true }
// Marca una imagen como portada (y desmarca el resto del servicio).
export async function PATCH(req: NextRequest) {
  const { id, service_id, provider_id, is_primary } = await req.json().catch(() => ({}))

  if (!id || !service_id || !provider_id) {
    return NextResponse.json({ error: 'id, service_id y provider_id requeridos' }, { status: 400 })
  }

  const auth = await requireProviderAuth(req, provider_id)
  if (!auth.ok) return auth.response

  const supabase = createAdminClient()
  const { data: svc } = await supabase
    .from('provider_services')
    .select('provider_id').eq('id', service_id).maybeSingle()
  if (!svc || svc.provider_id !== provider_id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  if (is_primary === true) {
    // Desmarcar el actual primary, luego marcar el nuevo
    await supabase.from('service_media').update({ is_primary: false })
      .eq('service_id', service_id).eq('is_primary', true)
    const { data: target } = await supabase.from('service_media')
      .update({ is_primary: true })
      .eq('id', id).select().single()

    if (target?.url) {
      await supabase.from('provider_services')
        .update({ media_url: target.url, media_type: target.media_type })
        .eq('id', service_id)
    }
    return NextResponse.json({ media: target })
  }

  return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 })
}

// DELETE ?id=...&service_id=...&provider_id=...
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id         = searchParams.get('id')
  const serviceId  = searchParams.get('service_id')
  const providerId = searchParams.get('provider_id')

  if (!id || !serviceId || !providerId) {
    return NextResponse.json({ error: 'id, service_id y provider_id requeridos' }, { status: 400 })
  }

  const auth = await requireProviderAuth(req, providerId)
  if (!auth.ok) return auth.response

  const supabase = createAdminClient()
  const { data: svc } = await supabase
    .from('provider_services').select('provider_id')
    .eq('id', serviceId).maybeSingle()
  if (!svc || svc.provider_id !== providerId) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { data: media } = await supabase
    .from('service_media').select('storage_path, is_primary')
    .eq('id', id).maybeSingle()

  if (!media) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  await supabase.from('service_media').delete().eq('id', id)
  if (media.storage_path) {
    await supabase.storage.from('provider-media').remove([media.storage_path]).catch(() => {})
  }

  // Si era la portada, ascender la siguiente
  if (media.is_primary) {
    const { data: next } = await supabase.from('service_media')
      .select('id, url, media_type')
      .eq('service_id', serviceId)
      .order('sort_order', { ascending: true })
      .limit(1)
      .maybeSingle()
    if (next) {
      await supabase.from('service_media').update({ is_primary: true }).eq('id', next.id)
      await supabase.from('provider_services')
        .update({ media_url: next.url, media_type: next.media_type })
        .eq('id', serviceId)
    } else {
      await supabase.from('provider_services')
        .update({ media_url: null, media_type: 'none' })
        .eq('id', serviceId)
    }
  }

  return NextResponse.json({ ok: true })
}
