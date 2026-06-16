import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import {
  sendText,
  isValidPhoneE164ES,
  InvalidPhoneError,
} from '@/lib/whatsapp'
import {
  generateReply,
  countPlazasConSelloRestantes,
  type AgentTurn,
} from '@/lib/fiestago-agent'

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

function checkAdminAuth(req: NextRequest) {
  return req.headers.get('x-admin-password') === process.env.ADMIN_PASSWORD
}

// POST /api/admin/whatsapp/reprocess-orphans
//
// Encuentra inbounds que tienen provider_id pero NO han recibido respuesta
// nuestra (no hay outbound posterior dentro de las últimas N horas) y, para
// cada proveedor único, ejecuta el agente IA y manda la respuesta vía
// WhatsApp como si el mensaje acabara de llegar.
//
// Caso de uso típico: arreglamos el matching y queremos rescatar las
// conversaciones de proveedores high-intent (los que pulsaron "SI") que
// quedaron sin contestar.
//
// Body (todos opcionales):
//   { hours_back?: 24,
//     provider_ids?: ["uuid", ...] // limita a estos. Sin él procesa todos.
//     dry_run?: true               // calcula y devuelve, NO envía.
//   }
//
// Devuelve: { processed: [{ provider_id, name, reply, sent_wa_id, error }] }
export async function POST(req: NextRequest) {
  if (!checkAdminAuth(req)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const hoursBack: number       = Math.max(1, Math.min(parseInt(body.hours_back) || 24, 168))
  const providerIds: string[]   = Array.isArray(body.provider_ids) ? body.provider_ids : []
  const dryRun: boolean         = !!body.dry_run

  const supabase = createAdminClient()

  // 1. Encontrar provider_ids con un inbound reciente y NINGÚN outbound
  //    posterior al último inbound. Cada proveedor solo aparece una vez.
  const sinceIso = new Date(Date.now() - hoursBack * 3600_000).toISOString()

  // Cargamos los inbounds con provider_id en la ventana, ordenados desc
  let inboundQuery = supabase
    .from('whatsapp_messages')
    .select('id, provider_id, from_number, body, created_at')
    .eq('direction', 'inbound')
    .not('provider_id', 'is', null)
    .gte('created_at', sinceIso)
    .order('created_at', { ascending: false })
    .limit(500)
  if (providerIds.length > 0) inboundQuery = inboundQuery.in('provider_id', providerIds)

  const { data: inbounds, error: inErr } = await inboundQuery
  if (inErr) return NextResponse.json({ error: inErr.message }, { status: 500 })
  if (!inbounds || inbounds.length === 0) {
    return NextResponse.json({ processed: [], note: 'No hay inbounds con provider_id en esa ventana' })
  }

  // Por cada provider, quedarnos solo con el ÚLTIMO inbound (que ya viene
  // primero al estar ordenados desc).
  const lastInboundByProvider = new Map<string, typeof inbounds[number]>()
  for (const m of inbounds) {
    if (!lastInboundByProvider.has(m.provider_id!)) {
      lastInboundByProvider.set(m.provider_id!, m)
    }
  }

  // 2. Para cada proveedor candidato, comprobar si YA respondimos después
  //    del último inbound. Si no, procesar.
  const processed: any[] = []
  const plazasConSello = await countPlazasConSelloRestantes()

  const entries = Array.from(lastInboundByProvider.entries())
  for (const [providerId, lastIn] of entries) {
    // ¿Ya respondimos después de ese inbound?
    const { data: laterOut } = await supabase
      .from('whatsapp_messages')
      .select('id')
      .eq('direction', 'outbound')
      .eq('provider_id', providerId)
      .eq('status', 'sent')
      .gt('created_at', lastIn.created_at)
      .limit(1)
      .maybeSingle()
    if (laterOut) continue // ya hay respuesta, no toca

    // Cargar el proveedor
    const { data: provider } = await supabase
      .from('providers')
      .select('id, name, category, city, social_handle, phone, outreach_whatsapp, whatsapp_invalid')
      .eq('id', providerId)
      .single()
    if (!provider) continue
    if (provider.whatsapp_invalid) {
      processed.push({ provider_id: providerId, name: provider.name, skipped: 'whatsapp_invalid' })
      continue
    }

    // Reconstruir historial completo
    const { data: rows } = await supabase
      .from('whatsapp_messages')
      .select('direction, body, created_at')
      .eq('provider_id', provider.id)
      .order('created_at', { ascending: true })

    const history: AgentTurn[] = (rows ?? [])
      .filter((r: any) => r.body)
      .map((r: any) => ({
        role: r.direction === 'inbound' ? 'user' as const : 'assistant' as const,
        text: r.body as string,
      }))

    // Asegurar que el último turno es 'user' (el inbound)
    if (history.length === 0 || history[history.length - 1].role !== 'user') {
      processed.push({ provider_id: providerId, name: provider.name, skipped: 'historial sin user al final' })
      continue
    }

    // Generar respuesta
    let reply: string
    try {
      reply = await generateReply({
        provider: {
          name: provider.name,
          category: provider.category,
          city: provider.city,
          social_handle: provider.social_handle,
        },
        plazasConSello,
        history,
      })
    } catch (err: any) {
      processed.push({ provider_id: providerId, name: provider.name, error: 'Claude: ' + (err?.message || 'desconocido') })
      continue
    }
    if (!reply) {
      processed.push({ provider_id: providerId, name: provider.name, error: 'Claude devolvió vacío' })
      continue
    }

    if (dryRun) {
      processed.push({ provider_id: providerId, name: provider.name, reply, dry_run: true })
      continue
    }

    // Enviar al número del último inbound (que sabemos que es bueno porque
    // acaba de mandarnos un mensaje).
    const to = lastIn.from_number
    if (!to || !isValidPhoneE164ES(to)) {
      processed.push({ provider_id: providerId, name: provider.name, error: 'número no válido: ' + to })
      continue
    }

    try {
      const waId = await sendText(to, reply)
      await supabase.from('whatsapp_messages').insert({
        wa_message_id: waId || null,
        direction:     'outbound',
        from_number:   process.env.WHATSAPP_PHONE_NUMBER_ID ?? null,
        to_number:     to,
        type:          'text',
        body:          reply,
        status:        'sent',
        provider_id:   provider.id,
      })
      processed.push({
        provider_id: providerId,
        name:        provider.name,
        reply,
        sent_wa_id:  waId,
      })
    } catch (err: any) {
      if (err instanceof InvalidPhoneError) {
        await supabase.from('providers').update({
          whatsapp_invalid:        true,
          whatsapp_invalid_reason: err.message.slice(0, 500),
        }).eq('id', provider.id)
        processed.push({ provider_id: providerId, name: provider.name, error: 'InvalidPhone, marcado whatsapp_invalid' })
      } else {
        processed.push({ provider_id: providerId, name: provider.name, error: err?.message || 'sendText falló' })
      }
    }
  }

  return NextResponse.json({
    processed,
    summary: {
      total_inbounds_in_window: inbounds.length,
      unique_providers:         lastInboundByProvider.size,
      replied_now:              processed.filter(p => p.sent_wa_id).length,
      skipped_or_errored:       processed.filter(p => !p.sent_wa_id).length,
    },
  })
}
