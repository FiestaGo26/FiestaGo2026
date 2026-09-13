import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { getStripe, isStripeConfigured } from '@/lib/stripe'
import { compileEvidenceForBooking, gatherEvidence } from '@/lib/disputes/evidence'

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

/**
 * API del panel de disputas (/admin/disputas).
 *
 *   GET    ?              → listado + reservas vulnerables
 *   GET    ?dispute=ID    → detalle con la evidencia compilada
 *   PATCH                 → guarda la evidencia editada como BORRADOR
 *   POST   {action}       → 'recompile' | 'submit'
 *
 * El envío (submit) es irreversible y solo se hace desde aquí, a mano.
 * El webhook nunca envía: deja el borrador puesto y Stripe lo manda solo
 * si se agota el plazo.
 */

function checkAuth(req: NextRequest) {
  return req.headers.get('x-admin-password') === process.env.ADMIN_PASSWORD
}

export async function GET(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const supabase = createAdminClient()
  const disputeId = new URL(req.url).searchParams.get('dispute')

  // ── Detalle ───────────────────────────────────────────────────────────
  if (disputeId) {
    const { data: dispute } = await supabase
      .from('dispute_events')
      .select('*')
      .eq('stripe_dispute_id', disputeId)
      .maybeSingle()

    if (!dispute) return NextResponse.json({ error: 'Disputa no encontrada' }, { status: 404 })

    let bundle: any = null
    if (dispute.booking_id) {
      try {
        const data = await gatherEvidence(dispute.booking_id)
        bundle = {
          booking: data.booking,
          provider: data.provider,
          consent: data.consent,
          confirmation: data.confirmation,
          termsVersion: data.termsVersion
            ? {
                version_label: data.termsVersion.version_label,
                content_hash:  data.termsVersion.content_hash,
                published_at:  data.termsVersion.published_at,
              }
            : null,
          timeline: data.timeline,
          chatCount: data.chatMessages.length,
          whatsappCount: data.whatsappMessages.length,
          invoices: data.invoices,
        }
      } catch (err: any) {
        bundle = { error: err?.message || 'No se pudo reunir la evidencia' }
      }
    }

    return NextResponse.json({ dispute, bundle })
  }

  // ── Listado ───────────────────────────────────────────────────────────
  const { data: disputes } = await supabase
    .from('dispute_events')
    .select('*, bookings(id, client_name, client_email, event_date, total_amount, provider_id, service_confirmed_at, providers(name))')
    .order('opened_at', { ascending: false })
    .limit(200)

  // Reservas vulnerables: evento pasado, cobrado y SIN confirmación del
  // proveedor. Son las que perderíamos hoy mismo si llegara una disputa.
  const todayMadrid = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Madrid' })
  const { data: vulnerable } = await supabase
    .from('bookings')
    .select('id, client_name, client_email, event_date, total_amount, first_payment_status, status, service_confirmation_reminder_sent_at, providers(name, email)')
    .lt('event_date', todayMadrid)
    .is('service_confirmed_at', null)
    .in('status', ['confirmed', 'completed'])
    .eq('first_payment_status', 'paid')
    .order('event_date', { ascending: false })
    .limit(100)

  const rows: any[] = disputes || []
  const stats = {
    total:      rows.length,
    open:       rows.filter(d => !['won', 'lost', 'warning_closed'].includes(d.status || '')).length,
    pending:    rows.filter(d => !d.evidence_submitted_at).length,
    won:        rows.filter(d => d.status === 'won').length,
    lost:       rows.filter(d => d.status === 'lost').length,
    vulnerable: vulnerable?.length || 0,
  }

  return NextResponse.json({
    disputes: rows,
    vulnerable: vulnerable || [],
    stats,
    stripeConfigured: isStripeConfigured(),
  })
}

/** Guarda la evidencia editada en Stripe como borrador (sin enviar). */
export async function PATCH(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { dispute_id, evidence } = await req.json().catch(() => ({}))
  if (!dispute_id || !evidence || typeof evidence !== 'object') {
    return NextResponse.json({ error: 'Faltan dispute_id o evidence' }, { status: 400 })
  }

  const supabase = createAdminClient()

  try {
    const updated = await getStripe().disputes.update(dispute_id, { evidence })
    await supabase.from('dispute_events').update({
      evidence_payload: evidence,
      status: updated.status,
      notes: 'Evidencia editada desde el panel y guardada como borrador.',
    }).eq('stripe_dispute_id', dispute_id)

    return NextResponse.json({ ok: true, status: updated.status })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Error guardando la evidencia' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { action, dispute_id, evidence } = await req.json().catch(() => ({}))
  if (!dispute_id) return NextResponse.json({ error: 'Falta dispute_id' }, { status: 400 })

  const supabase = createAdminClient()
  const { data: dispute } = await supabase
    .from('dispute_events')
    .select('*')
    .eq('stripe_dispute_id', dispute_id)
    .maybeSingle()

  if (!dispute) return NextResponse.json({ error: 'Disputa no encontrada' }, { status: 404 })

  // ── Recompilar: regenera los tres PDF y los vuelve a adjuntar ─────────
  if (action === 'recompile') {
    if (!dispute.booking_id) {
      return NextResponse.json({ error: 'Esta disputa no tiene reserva asociada' }, { status: 400 })
    }
    try {
      const { files, evidence: compiled } = await compileEvidenceForBooking(dispute.booking_id)
      await getStripe().disputes.update(dispute_id, { evidence: compiled })
      await supabase.from('dispute_events').update({
        evidence_payload: compiled as any,
        evidence_files:   files as any,
        notes: files.errors?.length
          ? `Recompilada desde el panel con incidencias: ${files.errors.join(' · ')}`
          : 'Recompilada desde el panel. Borrador actualizado, pendiente de envío.',
      }).eq('stripe_dispute_id', dispute_id)

      return NextResponse.json({ ok: true, evidence: compiled, files })
    } catch (err: any) {
      return NextResponse.json({ error: err?.message || 'Error recompilando' }, { status: 500 })
    }
  }

  // ── Enviar: irreversible ──────────────────────────────────────────────
  if (action === 'submit') {
    if (dispute.evidence_submitted_at) {
      return NextResponse.json({ error: 'Esta evidencia ya se envió.' }, { status: 400 })
    }
    try {
      const payload = evidence && typeof evidence === 'object' ? evidence : dispute.evidence_payload
      if (!payload) {
        return NextResponse.json({ error: 'No hay evidencia que enviar. Recompílala primero.' }, { status: 400 })
      }
      const updated = await getStripe().disputes.update(dispute_id, {
        evidence: payload,
        submit: true,
      })
      await supabase.from('dispute_events').update({
        evidence_payload:      payload,
        evidence_submitted_at: new Date().toISOString(),
        status:                updated.status,
        notes:                 'Evidencia enviada manualmente desde el panel.',
      }).eq('stripe_dispute_id', dispute_id)

      return NextResponse.json({ ok: true, status: updated.status })
    } catch (err: any) {
      return NextResponse.json({ error: err?.message || 'Error enviando la evidencia' }, { status: 500 })
    }
  }

  return NextResponse.json({ error: `Acción desconocida: ${action}` }, { status: 400 })
}
