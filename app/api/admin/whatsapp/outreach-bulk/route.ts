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

// POST /api/admin/whatsapp/outreach-bulk
// body opcional: { limit?: number = 50, dry_run?: boolean = false }
//
// Manda el PRIMER WhatsApp (plantilla WHATSAPP_OUTREACH_TEMPLATE) en bulk a
// proveedores que NUNCA fueron contactados. Hermano del endpoint
// /api/admin/whatsapp/followup, pero para el primer toque en vez del segundo.
//
// Selecciona providers con:
//   · outreach_sent = false (o null) → nunca contactados
//   · status = 'pending'
//   · phone o outreach_whatsapp no nulo
//   · whatsapp_invalid != true → número no marcado como malo
//
// Por defecto manda en lotes de 50 (pulsa varias veces si quieres más).
// Soporta dry_run para previsualizar a quién impactarías.
export async function POST(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const limit  = Math.min(Math.max(parseInt(String(body.limit)) || 50, 1), 200)
  const dryRun = body.dry_run === true

  const supabase = createAdminClient()

  // 1) Candidatos: pendientes, no contactados, número válido, no marcado inválido.
  //    Ordenados por agent_fit_score DESC (los de mayor encaje primero), y
  //    como tiebreak created_at ASC para que los más antiguos del catálogo
  //    salgan antes (justo).
  const { data: rows, error } = await supabase
    .from('providers')
    .select('id, name, category, city, phone, outreach_whatsapp, agent_fit_score, created_at')
    .or('outreach_sent.is.null,outreach_sent.eq.false')
    .or('whatsapp_invalid.is.null,whatsapp_invalid.eq.false')
    .eq('status', 'pending')
    .or('phone.not.is.null,outreach_whatsapp.not.is.null')
    .order('agent_fit_score', { ascending: false, nullsFirst: false })
    .order('created_at',      { ascending: true })
    .limit(limit * 2)   // un colchón por si filtramos algunos por teléfono malo

  if (error) {
    return NextResponse.json({ error: `Query candidatos falló: ${error.message}` }, { status: 500 })
  }

  const eligible = (rows || [])
    .filter((p: any) => p.phone || p.outreach_whatsapp)
    .slice(0, limit)

  // 2) Dry-run: solo devolvemos la lista, sin tocar nada.
  if (dryRun) {
    return NextResponse.json({
      eligible: eligible.length,
      dryRun:   true,
      preview:  eligible.map((p: any) => ({
        id: p.id, name: p.name, category: p.category, city: p.city,
        phone: p.phone || p.outreach_whatsapp,
        score: p.agent_fit_score,
      })),
    })
  }

  // 3) Envío real. Requiere la plantilla de outreach inicial configurada.
  const outreachTemplate = process.env.WHATSAPP_OUTREACH_TEMPLATE
  if (!outreachTemplate) {
    return NextResponse.json({
      error: 'Falta WHATSAPP_OUTREACH_TEMPLATE (nombre de la plantilla de captación aprobada en Meta)',
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
        whatsapp_invalid_reason: `Número no E.164 al hacer bulk outreach: "${rawPhone}"`,
      }).eq('id', p.id)
      continue
    }

    const descriptor = buildOutreachDescriptor({ category: p.category, city: p.city })

    try {
      const waId = await sendTemplate(to, {
        template:   outreachTemplate,
        bodyParams: [p.name || 'hola', descriptor],
      })

      await supabase.from('whatsapp_messages').insert({
        wa_message_id: waId || null,
        direction:     'outbound',
        from_number:   process.env.WHATSAPP_PHONE_NUMBER_ID ?? null,
        to_number:     to,
        type:          'template',
        body:          `[plantilla outreach bulk (${outreachTemplate}) a ${p.name}]`,
        status:        'sent',
        provider_id:   p.id,
      })

      await supabase.from('providers').update({
        outreach_sent: true,
        outreach_at:   new Date().toISOString(),
        contacted_via: 'whatsapp',
      }).eq('id', p.id)

      sent++
      logs.push(`✅ ${p.name} (${p.city}) — primer toque enviado`)
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
    eligible: eligible.length,
    sent,
    failed,
    skipped,
    template: outreachTemplate,
    logs,
  })
}
