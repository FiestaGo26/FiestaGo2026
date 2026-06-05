import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { normalizePhone, sendTemplate, sendText } from '@/lib/whatsapp'
import { generateOpeningMessage } from '@/lib/fiestago-agent'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function checkAdminAuth(req: NextRequest) {
  return req.headers.get('x-admin-password') === process.env.ADMIN_PASSWORD
}

const PROVIDER_COLS =
  'id, name, category, city, phone, outreach_whatsapp, outreach_sent, contacted_via, agent_fit_score'

// ─── GET: datos de la bandeja (proveedores con número + todos los mensajes) ──
export async function GET(req: NextRequest) {
  if (!checkAdminAuth(req)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const supabase = createAdminClient()

  // 1) Todos los mensajes (la tabla suele ser pequeña).
  const { data: messages } = await supabase
    .from('whatsapp_messages')
    .select('id, direction, body, type, status, created_at, provider_id')
    .order('created_at', { ascending: true })
    .limit(2000)

  // 2) Proveedores candidatos: tienen número y los ordenamos por encaje del agente.
  const { data: candidates } = await supabase
    .from('providers')
    .select(PROVIDER_COLS)
    .or('phone.not.is.null,outreach_whatsapp.not.is.null')
    .order('agent_fit_score', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(60)

  // 3) Proveedores referenciados por mensajes pero que no estén entre los
  //    candidatos (para que toda conversación tenga su ficha).
  const candidateIds = new Set((candidates ?? []).map((c: any) => c.id))
  const msgProviderIds = Array.from(
    new Set((messages ?? []).map((m: any) => m.provider_id).filter(Boolean))
  ).filter((id) => !candidateIds.has(id as string)) as string[]

  let extra: any[] = []
  if (msgProviderIds.length) {
    const { data } = await supabase
      .from('providers')
      .select(PROVIDER_COLS)
      .in('id', msgProviderIds)
    extra = data ?? []
  }

  return NextResponse.json({
    providers: [...(candidates ?? []), ...extra],
    messages: messages ?? [],
  })
}

// ─── POST: acciones de la bandeja ────────────────────────────────────────────
//   body: { op: 'outreach' | 'send' | 'draft', providerId: string, text?: string }
export async function POST(req: NextRequest) {
  if (!checkAdminAuth(req)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const op: string = body.op
  const providerId: string = body.providerId

  if (!op || !providerId) {
    return NextResponse.json({ error: 'op y providerId requeridos' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data: provider, error } = await supabase
    .from('providers')
    .select('id, name, category, city, social_handle, phone, outreach_whatsapp')
    .eq('id', providerId)
    .single()

  if (error || !provider) {
    return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 })
  }

  const to = normalizePhone(provider.outreach_whatsapp) || normalizePhone(provider.phone)

  try {
    // ── Borrador con IA (no envía nada) ──
    if (op === 'draft') {
      const text = await generateOpeningMessage({
        name: provider.name,
        category: provider.category,
        city: provider.city,
        social_handle: provider.social_handle,
      })
      return NextResponse.json({ ok: true, text })
    }

    if (!to) {
      return NextResponse.json(
        { error: 'El proveedor no tiene número de WhatsApp/teléfono' },
        { status: 400 }
      )
    }

    // ── Iniciar captación: plantilla aprobada (única vía en frío) ──
    if (op === 'outreach') {
      const waId = await sendTemplate(to, { bodyParams: [provider.name || 'hola'] })

      await supabase.from('whatsapp_messages').insert({
        wa_message_id: waId || null,
        direction: 'outbound',
        from_number: process.env.WHATSAPP_PHONE_NUMBER_ID ?? null,
        to_number: to,
        type: 'template',
        body: `[plantilla de captación enviada a ${provider.name}]`,
        status: 'sent',
        provider_id: provider.id,
      })

      await supabase
        .from('providers')
        .update({
          outreach_sent: true,
          outreach_at: new Date().toISOString(),
          contacted_via: 'whatsapp',
        })
        .eq('id', provider.id)

      return NextResponse.json({ ok: true })
    }

    // ── Enviar texto libre (solo dentro de la ventana de 24h) ──
    if (op === 'send') {
      const clean = (body.text || '').trim()
      if (!clean) return NextResponse.json({ error: 'El mensaje está vacío' }, { status: 400 })

      const waId = await sendText(to, clean)

      await supabase.from('whatsapp_messages').insert({
        wa_message_id: waId || null,
        direction: 'outbound',
        from_number: process.env.WHATSAPP_PHONE_NUMBER_ID ?? null,
        to_number: to,
        type: 'text',
        body: clean,
        status: 'sent',
        provider_id: provider.id,
      })

      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'op desconocida' }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Error desconocido' }, { status: 502 })
  }
}
