import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { createAdminClient } from '@/lib/supabase'
import { requireProviderAuth } from '@/lib/auth'
import { PROPOSAL_DOC_LABELS, type ProposalDocument, type QuoteDetails } from '@/lib/proposals'

export const runtime = 'nodejs'
export const maxDuration = 30
export const dynamic = 'force-dynamic'

// Documentos de la propuesta (menú, boceto, póliza, certificado del
// hinchable…). Quedan registrados en la propuesta y el cliente los ve en
// su documento de reserva. Simulación 14: "me lo envía antes de reservar"
// sin adjuntarlo era uno de los motivos para no pagar la señal.
// Una vez reservado no se pueden quitar: es lo acordado.

const BUCKET = 'proposal-docs'
const EXT = ['pdf', 'jpg', 'jpeg', 'png', 'webp']
const MAX_DOCS = 10

async function loadHold(holdId: string, providerId: string) {
  const { data } = await createAdminClient().from('date_holds')
    .select('id, provider_id, status, quote_details').eq('id', holdId).maybeSingle()
  return data && data.provider_id === providerId ? data : null
}

// POST multipart/form-data: file, provider_id, hold_id, label
export async function POST(req: NextRequest) {
  const form = await req.formData()
  const file = form.get('file') as File | null
  const providerId = form.get('provider_id') as string | null
  const holdId = form.get('hold_id') as string | null
  const label = String(form.get('label') || '')
  if (!file || !providerId || !holdId) return NextResponse.json({ error: 'Falta el archivo' }, { status: 400 })
  if (!(label in PROPOSAL_DOC_LABELS)) return NextResponse.json({ error: 'Tipo de documento no válido' }, { status: 400 })

  const auth = await requireProviderAuth(req, providerId)
  if (!auth.ok) return auth.response
  const hold = await loadHold(holdId, providerId)
  if (!hold) return NextResponse.json({ error: 'Petición no encontrada' }, { status: 404 })

  const ext = (file.name.split('.').pop() || '').toLowerCase()
  if (!EXT.includes(ext)) return NextResponse.json({ error: 'Formato no soportado. PDF, JPG, PNG o WEBP.' }, { status: 400 })
  if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: 'Archivo demasiado grande (máx. 10 MB)' }, { status: 400 })

  const details = (hold.quote_details || {}) as QuoteDetails
  const docs = details.documents || []
  if (docs.length >= MAX_DOCS) return NextResponse.json({ error: `Máximo ${MAX_DOCS} documentos por propuesta` }, { status: 400 })

  const supabase = createAdminClient()
  const id = randomBytes(6).toString('hex')
  const path = `${providerId}/${holdId}/${id}.${ext}`
  const { error: upErr } = await supabase.storage.from(BUCKET)
    .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type || 'application/octet-stream', upsert: false })
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

  const doc: ProposalDocument = { id, label: label as ProposalDocument['label'], name: file.name.slice(0, 120), path, uploaded_at: new Date().toISOString() }
  await supabase.from('date_holds').update({ quote_details: { ...details, documents: [...docs, doc] } }).eq('id', hold.id)
  return NextResponse.json({ document: { id, label: doc.label, name: doc.name, uploaded_at: doc.uploaded_at } })
}

// DELETE — body: { provider_id, hold_id, doc_id }
export async function DELETE(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const auth = await requireProviderAuth(req, body.provider_id)
  if (!auth.ok) return auth.response
  const hold = await loadHold(body.hold_id, body.provider_id)
  if (!hold) return NextResponse.json({ error: 'Petición no encontrada' }, { status: 404 })
  if (hold.status === 'converted') return NextResponse.json({ error: 'El cliente ya ha reservado: los documentos quedan como lo acordado' }, { status: 400 })

  const details = (hold.quote_details || {}) as QuoteDetails
  const doc = (details.documents || []).find(d => d.id === body.doc_id)
  if (!doc) return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })
  const supabase = createAdminClient()
  await supabase.storage.from(BUCKET).remove([doc.path]).catch(() => {})
  await supabase.from('date_holds').update({ quote_details: { ...details, documents: (details.documents || []).filter(d => d.id !== doc.id) } }).eq('id', hold.id)
  return NextResponse.json({ ok: true })
}
