import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { sendTemplate, normalizePhone, isValidPhoneE164ES, InvalidPhoneError } from '@/lib/whatsapp'
import { buildOutreachDescriptor } from '@/lib/fiestago-agent'

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

function checkAuth(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && req.headers.get('x-cron-secret') === cronSecret) return true
  if (req.headers.get('x-admin-password') === process.env.ADMIN_PASSWORD) return true
  return false
}

// POST /api/admin/whatsapp/followup
// body opcional: {
//   days_since_first?: number = 7,
//   limit?: number = 30,
//   max_attempts?: number = 1,   // total de follow-ups WA permitidos por proveedor
//   dry_run?: boolean = false,
// }
//
// Manda un segundo (o tercero, según max_attempts) WhatsApp SOLO a los
// proveedores que:
//   · Recibieron el 1er toque por WhatsApp (outreach_sent + contacted_via='whatsapp')
//   · NO han respondido (no tienen ningún mensaje inbound en whatsapp_messages)
//   · No están marcados whatsapp_invalid
//   · Aún no han recibido el cap de follow-ups WA
//   · El último toque (outreach_at o whatsapp_followup_sent_at) tiene >= days_since_first
//
// Plantilla: usa WHATSAPP_FOLLOWUP_TEMPLATE si está definida; si no, la misma
// que el primer toque (WHATSAPP_OUTREACH_TEMPLATE). La plantilla debe aceptar
// los mismos 2 parámetros: {{1}} = nombre, {{2}} = descriptor (categoría+ciudad).
//
// Soporta dry_run=true para devolver la lista de candidatos sin enviar nada
// — usa esto antes de cada envío real para ver a quién impactarías.
export async function POST(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const daysSinceFirst = Math.max(1, parseInt(String(body.days_since_first)) || 7)
  const limit          = Math.min(Math.max(parseInt(String(body.limit)) || 30, 1), 200)
  const maxAttempts    = Math.min(Math.max(parseInt(String(body.max_attempts)) || 1, 1), 2)
  const dryRun         = body.dry_run === true

  const supabase = createAdminClient()
  const now = Date.now()
  const cutoffMs = now - daysSinceFirst * 86_400_000
  const cutoff = new Date(cutoffMs).toISOString()

  // 1) Candidatos potenciales: contactados por WA, pendientes, sin pasarse del cap,
  //    número no marcado como inválido, y el último toque es viejo.
  //    Usamos OR para el cutoff: el "último toque" es whatsapp_followup_sent_at si
  //    ya hubo follow-up, o outreach_at si aún no. Hacemos dos queries para
  //    no complicar la sintaxis de Supabase.
  const baseSelect = 'id, name, category, city, phone, outreach_whatsapp, outreach_at, whatsapp_followup_count, whatsapp_followup_sent_at'

  // 1a) followup_count = 0 (nunca enviado follow-up WA) + outreach_at viejo
  const { data: firstWave, error: firstErr } = await supabase
    .from('providers')
    .select(baseSelect)
    .eq('outreach_sent', true)
    .eq('status', 'pending')
    .eq('contacted_via', 'whatsapp')
    .or('whatsapp_invalid.is.null,whatsapp_invalid.eq.false')
    .or('whatsapp_followup_count.is.null,whatsapp_followup_count.eq.0')
    .lt('outreach_at', cutoff)
    .limit(limit * 2)   // pedimos más para tener margen tras filtrar inbound

  if (firstErr) {
    return NextResponse.json({ error: `Query candidatos falló: ${firstErr.message}` }, { status: 500 })
  }

  // 1b) Si el cap permite 2, también traemos los que ya tienen 1 follow-up y
  //     han pasado days_since_first desde el último.
  let secondWave: any[] = []
  if (maxAttempts >= 2) {
    const { data, error } = await supabase
      .from('providers')
      .select(baseSelect)
      .eq('outreach_sent', true)
      .eq('status', 'pending')
      .eq('contacted_via', 'whatsapp')
      .or('whatsapp_invalid.is.null,whatsapp_invalid.eq.false')
      .eq('whatsapp_followup_count', 1)
      .lt('whatsapp_followup_sent_at', cutoff)
      .limit(limit * 2)
    if (error) {
      return NextResponse.json({ error: `Query 2ª ola falló: ${error.message}` }, { status: 500 })
    }
    secondWave = data || []
  }

  const allCandidates = [...(firstWave || []), ...secondWave]

  if (allCandidates.length === 0) {
    return NextResponse.json({ candidates: 0, sent: 0, failed: 0, skipped: 0, dryRun, logs: [] })
  }

  // 2) Filtrar fuera a los que YA respondieron: buscamos todos los provider_id
  //    con al menos un mensaje inbound, y los excluimos.
  const candidateIds = allCandidates.map(p => p.id)
  const { data: inboundRows, error: inboundErr } = await supabase
    .from('whatsapp_messages')
    .select('provider_id')
    .eq('direction', 'inbound')
    .in('provider_id', candidateIds)

  if (inboundErr) {
    return NextResponse.json({ error: `Query inbound falló: ${inboundErr.message}` }, { status: 500 })
  }
  const respondedIds = new Set((inboundRows || []).map((r: { provider_id: string | null }) => r.provider_id))

  const eligible = allCandidates
    .filter(p => !respondedIds.has(p.id))
    .filter(p => p.phone || p.outreach_whatsapp)
    .slice(0, limit)

  // 3) Modo dry-run: solo devolvemos la lista, sin tocar nada.
  if (dryRun) {
    return NextResponse.json({
      candidates:    allCandidates.length,
      respondedOut:  respondedIds.size,
      eligible:      eligible.length,
      dryRun:        true,
      preview:       eligible.map(p => ({
        id: p.id, name: p.name, category: p.category, city: p.city,
        phone: p.phone || p.outreach_whatsapp,
        followup_count: p.whatsapp_followup_count || 0,
        outreach_at: p.outreach_at,
      })),
    })
  }

  // 4) Envío real. Plantilla: prefiere la específica de follow-up; si no,
  //    cae a la de outreach inicial.
  const followupTemplate = process.env.WHATSAPP_FOLLOWUP_TEMPLATE || process.env.WHATSAPP_OUTREACH_TEMPLATE
  if (!followupTemplate) {
    return NextResponse.json({
      error: 'Falta WHATSAPP_FOLLOWUP_TEMPLATE (o WHATSAPP_OUTREACH_TEMPLATE como fallback) en env vars',
    }, { status: 500 })
  }

  const logs: string[] = []
  let sent = 0
  let failed = 0
  let skipped = 0

  for (const p of eligible) {
    const rawPhone = p.phone || p.outreach_whatsapp || ''
    const to = normalizePhone(rawPhone) || ''
    if (!isValidPhoneE164ES(to)) {
      skipped++
      logs.push(`⊘ ${p.name} — teléfono no válido (${rawPhone})`)
      await supabase.from('providers').update({
        whatsapp_invalid: true,
        whatsapp_invalid_reason: `Número no E.164 al hacer follow-up: "${rawPhone}"`,
      }).eq('id', p.id)
      continue
    }

    const descriptor = buildOutreachDescriptor({ category: p.category, city: p.city })
    const attempt = (p.whatsapp_followup_count || 0) + 1

    try {
      const waId = await sendTemplate(to, {
        template:   followupTemplate,
        bodyParams: [p.name || 'hola', descriptor],
      })

      await supabase.from('whatsapp_messages').insert({
        wa_message_id: waId || null,
        direction:     'outbound',
        from_number:   process.env.WHATSAPP_PHONE_NUMBER_ID ?? null,
        to_number:     to,
        type:          'template',
        body:          `[plantilla follow-up #${attempt} (${followupTemplate}) a ${p.name}]`,
        status:        'sent',
        provider_id:   p.id,
      })

      await supabase.from('providers').update({
        whatsapp_followup_sent_at: new Date().toISOString(),
        whatsapp_followup_count:   attempt,
      }).eq('id', p.id)

      sent++
      logs.push(`✅ ${p.name} (${p.city}) — follow-up #${attempt} enviado`)
    } catch (err: any) {
      failed++
      if (err instanceof InvalidPhoneError) {
        await supabase.from('providers').update({
          whatsapp_invalid: true,
          whatsapp_invalid_reason: err.message.slice(0, 500),
        }).eq('id', p.id)
        logs.push(`✗ ${p.name} — teléfono marcado inválido: ${err.message}`)
      } else {
        logs.push(`✗ ${p.name} — fallo envío: ${err?.message || 'desconocido'}`)
      }
    }
  }

  return NextResponse.json({
    candidates:   allCandidates.length,
    respondedOut: respondedIds.size,
    eligible:     eligible.length,
    sent,
    failed,
    skipped,
    template:     followupTemplate,
    logs,
  })
}
