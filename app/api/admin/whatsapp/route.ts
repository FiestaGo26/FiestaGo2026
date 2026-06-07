import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { normalizePhone, sendTemplate, sendText } from '@/lib/whatsapp'
import { generateOpeningMessage, buildOutreachDescriptor } from '@/lib/fiestago-agent'

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

  if (!op) {
    return NextResponse.json({ error: 'op requerido' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // ── Op especial: enviar plantilla a un número arbitrario sin provider_id ──
  // Acepta { phone, name } → si existe ya un proveedor con ese tel lo reusa,
  // si no crea una ficha mínima ('WhatsApp ad-hoc'). Así el webhook puede
  // hacer match cuando el destinatario responda y el agente continúe solo.
  if (op === 'outreach_adhoc') {
    const rawPhone = String(body.phone || '').trim()
    const name = String(body.name || '').trim() || 'Contacto WhatsApp'
    const to = normalizePhone(rawPhone)
    if (!to) {
      return NextResponse.json({ error: 'Teléfono inválido' }, { status: 400 })
    }

    try {
      // 1. Buscar proveedor existente con ese número (mismos últimos 9 dígitos)
      const last9 = to.slice(-9)
      const { data: existing } = await supabase
        .from('providers')
        .select('id, name')
        .or(`phone.ilike.%${last9}%,outreach_whatsapp.ilike.%${last9}%`)
        .limit(1)

      let providerId: string
      let providerName: string
      if (existing && existing.length > 0) {
        providerId = existing[0].id
        providerName = existing[0].name || name
      } else {
        // 2. No existe → crear ficha mínima ad-hoc
        const { data: created, error: createErr } = await supabase
          .from('providers')
          .insert({
            name,
            category: 'foto', // categoría por defecto — el admin puede editarla luego
            city: 'Madrid',   // ciudad por defecto
            phone: '+' + to,
            status: 'pending',
            tag: 'WhatsApp ad-hoc',
            source: 'web',
            contactable: true,
            outreach_sent: true,
            outreach_at: new Date().toISOString(),
            contacted_via: 'whatsapp',
          })
          .select('id, name')
          .single()
        if (createErr || !created) {
          return NextResponse.json({ error: createErr?.message || 'Error creando ficha' }, { status: 500 })
        }
        providerId = created.id
        providerName = created.name || name
      }

      // 3. Enviar plantilla aprobada (única forma de escribir en frío).
      //    Para ad-hoc no sabemos categoría → descriptor genérico.
      const descriptor = buildOutreachDescriptor({ category: null, city: null })
      const waId = await sendTemplate(to, { bodyParams: [providerName, descriptor] })

      await supabase.from('whatsapp_messages').insert({
        wa_message_id: waId || null,
        direction: 'outbound',
        from_number: process.env.WHATSAPP_PHONE_NUMBER_ID ?? null,
        to_number: to,
        type: 'template',
        body: `[plantilla de captación ad-hoc enviada a ${providerName}]`,
        status: 'sent',
        provider_id: providerId,
      })

      // Asegurar marcado de contactado (por si era un proveedor preexistente)
      await supabase.from('providers')
        .update({
          outreach_sent: true,
          outreach_at:   new Date().toISOString(),
          contacted_via: 'whatsapp',
        })
        .eq('id', providerId)

      return NextResponse.json({ ok: true, provider_id: providerId, reused: !!existing?.length })
    } catch (err: any) {
      return NextResponse.json({ error: err?.message ?? 'Error desconocido' }, { status: 502 })
    }
  }

  // Resto de operaciones necesitan providerId
  const providerId: string = body.providerId
  if (!providerId) {
    return NextResponse.json({ error: 'providerId requerido' }, { status: 400 })
  }

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
      const descriptor = buildOutreachDescriptor({
        category: provider.category,
        city:     provider.city,
      })
      const waId = await sendTemplate(to, {
        bodyParams: [provider.name || 'hola', descriptor],
      })

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
