import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requireProviderAuth } from '@/lib/auth'

export const runtime = 'nodejs'
export const maxDuration = 30
export const dynamic = 'force-dynamic'

// POST /api/proveedor/profile/upload-photo
export async function POST(req: NextRequest) {
  const formData   = await req.formData()
  const file       = formData.get('file') as File | null
  const providerId = formData.get('provider_id') as string | null

  if (!file || !providerId) {
    return NextResponse.json({ error: 'file y provider_id requeridos' }, { status: 400 })
  }

  const auth = await requireProviderAuth(req, providerId)
  if (!auth.ok) return auth.response

  const supabase = createAdminClient()

  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
  if (!['jpg','jpeg','png','webp','heic'].includes(ext)) {
    return NextResponse.json({ error: 'Formato no soportado. Usa JPG, PNG, WEBP o HEIC.' }, { status: 400 })
  }

  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({
      error: `Imagen demasiado grande (${Math.round(file.size/1024/1024)}MB). Máximo 10MB.`
    }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const path   = `providers/${providerId}/profile-${Date.now()}.${ext}`

  const { error: upErr } = await supabase.storage
    .from('provider-media')
    .upload(path, buffer, {
      contentType: file.type || 'image/jpeg',
      upsert: false,
    })
  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 })
  }

  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/provider-media/${path}`

  const { error: updErr } = await supabase
    .from('providers')
    .update({ photo_url: url })
    .eq('id', providerId)

  if (updErr) {
    // Limpiar el archivo huérfano si la actualización falla
    await supabase.storage.from('provider-media').remove([path]).catch(() => {})
    return NextResponse.json({ error: updErr.message }, { status: 500 })
  }

  return NextResponse.json({ url, path })
}
