import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requireProviderAuth } from '@/lib/auth'
import { generateQuote, renderQuoteHtml } from '@/lib/quote-generator'

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

// POST /api/proveedor/quotes/generate
// body: {
//   providerId,
//   brief,
//   client_name?, client_email?, client_phone?,
//   event_date?, event_city?, guest_count?
// }
//
// Llama a Claude → genera presupuesto estructurado + HTML render →
// guarda en BD con public_id (la URL que se comparte con el cliente).
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const providerId: string = body.providerId
  const auth = await requireProviderAuth(req, providerId)
  if (!auth.ok) return auth.response

  const brief: string = (body.brief || '').toString().trim()
  if (!brief || brief.length < 20) {
    return NextResponse.json({ error: 'El brief debe tener al menos 20 caracteres' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Contexto del proveedor para la IA
  const { data: provider, error: provErr } = await supabase
    .from('providers')
    .select('id, name, category, city, price_base, price_unit, email, phone')
    .eq('id', providerId)
    .single()
  if (provErr || !provider) {
    return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 })
  }

  try {
    const quote = await generateQuote({
      brief,
      provider: provider as any,
      eventDate:  body.event_date  || null,
      eventCity:  body.event_city  || null,
      guestCount: body.guest_count || null,
    })

    // Insertar primero (sin HTML) para obtener public_id real
    const { data: row, error: insErr } = await supabase
      .from('provider_quotes')
      .insert({
        provider_id:   providerId,
        client_name:   body.client_name  || null,
        client_email:  body.client_email || null,
        client_phone:  body.client_phone || null,
        event_date:    body.event_date   || null,
        event_city:    body.event_city   || null,
        guest_count:   body.guest_count  || null,
        brief,
        total_amount:  quote.clientTotal,
        status:        'draft',
        notes:         quote.internalNotes,
      })
      .select('id, public_id, created_at')
      .single()
    if (insErr || !row) {
      return NextResponse.json({ error: insErr?.message || 'Insert falló' }, { status: 500 })
    }

    // Render del HTML con el public_id real
    const html = renderQuoteHtml({
      quote,
      provider: provider as any,
      client: {
        name:  body.client_name  || null,
        email: body.client_email || null,
        phone: body.client_phone || null,
      },
      eventDate:  body.event_date  || null,
      eventCity:  body.event_city  || null,
      guestCount: body.guest_count || null,
      quoteRef:   row.public_id,
      issueDate:  new Date(row.created_at).toISOString().slice(0, 10),
    })

    await supabase
      .from('provider_quotes')
      .update({ quote_html: html, updated_at: new Date().toISOString() })
      .eq('id', row.id)

    return NextResponse.json({
      ok: true,
      id:           row.id,
      public_id:    row.public_id,
      total_amount: quote.clientTotal,
      items_count:  quote.items.length,
      internal_notes: quote.internalNotes,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error generando' }, { status: 500 })
  }
}
