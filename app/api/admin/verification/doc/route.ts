import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function checkAdminAuth(req: NextRequest) {
  return req.headers.get('x-admin-password') === process.env.ADMIN_PASSWORD
}

// GET /api/admin/verification/doc?provider_id=...
// Devuelve un signed URL temporal (5 min) para que el admin vea el
// documento. El bucket es privado, no hay forma de leerlo sin signed URL.
export async function GET(req: NextRequest) {
  if (!checkAdminAuth(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const supabase = createAdminClient()
  const { searchParams } = new URL(req.url)
  const providerId = searchParams.get('provider_id')
  if (!providerId) return NextResponse.json({ error: 'provider_id requerido' }, { status: 400 })

  const { data: prov } = await supabase
    .from('providers')
    .select('verification_doc_path')
    .eq('id', providerId).maybeSingle()

  if (!prov?.verification_doc_path) {
    return NextResponse.json({ error: 'Este proveedor no ha subido documento' }, { status: 404 })
  }

  const { data: signed, error } = await supabase.storage
    .from('verification-docs')
    .createSignedUrl(prov.verification_doc_path, 60 * 5)  // 5 min

  if (error || !signed?.signedUrl) {
    return NextResponse.json({ error: error?.message || 'No se pudo generar el enlace' }, { status: 500 })
  }

  return NextResponse.json({ url: signed.signedUrl })
}
