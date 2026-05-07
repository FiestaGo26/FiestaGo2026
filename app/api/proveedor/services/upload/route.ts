import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

export const runtime = 'nodejs'
export const maxDuration = 30
export const dynamic = 'force-dynamic'

// POST /api/proveedor/services/upload
// multipart/form-data: file, provider_id, service_id (opcional)
// devuelve { url, media_type }
export async function POST(req: NextRequest) {
  const supabase = createAdminClient()

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const providerId = formData.get('provider_id') as string | null

  if (!file || !providerId) {
    return NextResponse.json({ error: 'file y provider_id requeridos' }, { status: 400 })
  }

  const ext = (file.name.split('.').pop() || 'bin').toLowerCase()
  const mediaType =
    ['jpg','jpeg','png','webp','gif','heic'].includes(ext) ? 'image' :
    ['mp4','mov','webm','m4v'].includes(ext) ? 'video' : null

  if (!mediaType) {
    return NextResponse.json({ error: 'Formato no soportado. Usa JPG/PNG/WEBP o MP4/MOV/WEBM' }, { status: 400 })
  }

  // Limit: imagen 10MB, vídeo 50MB
  const maxBytes = mediaType === 'video' ? 50 * 1024 * 1024 : 10 * 1024 * 1024
  if (file.size > maxBytes) {
    return NextResponse.json({
      error: `Archivo demasiado grande (${Math.round(file.size/1024/1024)}MB). Máximo ${maxBytes/1024/1024}MB.`
    }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const path = `services/${providerId}/${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`

  const { error: upErr } = await supabase.storage
    .from('provider-media')
    .upload(path, buffer, {
      contentType: file.type || (mediaType === 'video' ? 'video/mp4' : 'image/jpeg'),
      upsert: false,
    })
  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 })
  }

  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/provider-media/${path}`
  return NextResponse.json({ url, media_type: mediaType, path })
}
