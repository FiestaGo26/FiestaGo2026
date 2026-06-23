import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requireProviderAuth } from '@/lib/auth'
import { generateQuote, renderQuoteHtml, type ProviderQuoteContext } from '@/lib/quote-generator'
import { loadOrInitPrefs } from '@/app/api/proveedor/quote-prefs/route'

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
    // ─── Cargamos en paralelo todo lo que la IA va a usar como ground truth ───
    //   1. Servicios reales del proveedor (con precios) → usa esos precios
    //      literales si el brief encaja con uno.
    //   2. Preferencias del proveedor (señal %, conditions, includes/excludes,
    //      estilo, notas de pricing).
    //   3. Últimos 3 presupuestos para mantener consistencia.
    const [servicesRes, prefs, recentRes] = await Promise.all([
      supabase
        .from('provider_services')
        .select('name, description, price, price_unit, duration, status')
        .eq('provider_id', providerId)
        .eq('status', 'active')
        .order('sort_order', { ascending: true })
        .limit(20),
      loadOrInitPrefs(supabase, providerId),
      supabase
        .from('provider_quotes')
        .select('created_at, brief, total_amount, quote_html')
        .eq('provider_id', providerId)
        .order('created_at', { ascending: false })
        .limit(3),
    ])

    // Re-derivamos items de los últimos presupuestos extrayendo del HTML
    // (no guardamos el JSON estructurado en BD por simplicidad — el HTML
    // pintado es la fuente de verdad). Aquí basta con un snippet del brief
    // + total; los items detallados los dejamos al cerebro inferir.
    const recentQuotes = (recentRes.data || []).map((q: any) => ({
      created_at:    q.created_at as string,
      brief_snippet: (q.brief || '').slice(0, 200),
      items:         [] as Array<{ concept: string; quantity: number; unitPrice: number }>,
      total:         Number(q.total_amount || 0),
    }))

    const context: ProviderQuoteContext = {
      services: (servicesRes.data || []).map((s: any) => ({
        name:        s.name,
        description: s.description,
        price:       s.price != null ? Number(s.price) : null,
        price_unit:  s.price_unit,
        duration:    s.duration,
      })),
      prefs: prefs ? {
        deposit_pct:        prefs.deposit_pct,
        validity_days:      prefs.validity_days,
        default_includes:   prefs.default_includes   || [],
        default_excludes:   prefs.default_excludes   || [],
        default_conditions: prefs.default_conditions || [],
        language_style:     prefs.language_style,
        pricing_notes:      prefs.pricing_notes,
      } : undefined,
      recentQuotes,
    }

    const quote = await generateQuote({
      brief,
      provider: provider as any,
      eventDate:  body.event_date  || null,
      eventCity:  body.event_city  || null,
      guestCount: body.guest_count || null,
      context,
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
