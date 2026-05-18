import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

export const runtime = 'nodejs'
export const maxDuration = 30
export const dynamic = 'force-dynamic'

const ALLOWED_TYPES = ['dni', 'cif', 'rc', 'otro']

// POST multipart/form-data: file, provider_id, doc_type
// Sube el documento al bucket privado verification-docs y marca el
// proveedor como pending. El doc nunca es accesible públicamente.
export async function POST(req: NextRequest) {
  const supabase = createAdminClient()
  const formData   = await req.formData()
  const file       = formData.get('file') as File | null
  const providerId = formData.get('provider_id') as string | null
  const docType    = (formData.get('doc_type') as string | null) || 'otro'

  if (!file || !providerId) {
    return NextResponse.json({ error: 'file y provider_id requeridos' }, { status: 400 })
  }
  if (!ALLOWED_TYPES.includes(docType)) {
    return NextResponse.json({ error: 'doc_type no válido' }, { status: 400 })
  }

  const ext = (file.name.split('.').pop() || 'bin').toLowerCase()
  if (!['jpg','jpeg','png','webp','heic','pdf'].includes(ext)) {
    return NextResponse.json({ error: 'Formato no soportado. JPG, PNG, WEBP, HEIC o PDF.' }, { status: 400 })
  }
  if (file.size > 8 * 1024 * 1024) {
    return NextResponse.json({ error: 'Archivo demasiado grande (máx 8MB)' }, { status: 400 })
  }

  // Borrar doc anterior si existía (para no acumular archivos sensibles)
  const { data: existing } = await supabase
    .from('providers').select('verification_doc_path')
    .eq('id', providerId).maybeSingle()
  if (existing?.verification_doc_path) {
    await supabase.storage.from('verification-docs').remove([existing.verification_doc_path]).catch(() => {})
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const path   = `${providerId}/${docType}-${Date.now()}.${ext}`

  const { error: upErr } = await supabase.storage
    .from('verification-docs')
    .upload(path, buffer, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    })
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

  const { error: updErr } = await supabase
    .from('providers')
    .update({
      verification_status:       'pending',
      verification_doc_path:     path,
      verification_doc_type:     docType,
      verification_submitted_at: new Date().toISOString(),
      verification_notes:        null,
    })
    .eq('id', providerId)

  if (updErr) {
    await supabase.storage.from('verification-docs').remove([path]).catch(() => {})
    return NextResponse.json({ error: updErr.message }, { status: 500 })
  }

  // Notificar al admin de la nueva solicitud
  await supabase.from('notifications').insert({
    type:    'new_verification',
    title:   'Nueva solicitud de verificación',
    message: `Un proveedor ha subido su ${docType.toUpperCase()} para revisión.`,
    data:    { provider_id: providerId, doc_type: docType },
    action_url: `/admin?provider=${providerId}`,
  }).then(() => {})

  return NextResponse.json({ ok: true, status: 'pending' })
}
