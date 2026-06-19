import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /q/<public_id> — página pública del presupuesto que abre el cliente.
// Devuelve el HTML renderizado directamente (no Next page).
// Si el presupuesto fue marcado como "shared" pero aún no se había visto,
// registra la primera vista (viewed_by_client_at).
export async function GET(req: NextRequest, ctx: { params: Promise<{ public_id: string }> }) {
  const { public_id } = await ctx.params
  if (!public_id) {
    return new NextResponse('Not found', { status: 404 })
  }

  const supabase = createAdminClient()
  const { data: quote, error } = await supabase
    .from('provider_quotes')
    .select('id, quote_html, status, viewed_by_client_at, shared_at')
    .eq('public_id', public_id)
    .single()

  if (error || !quote || !quote.quote_html) {
    return new NextResponse(
      `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Presupuesto no encontrado</title>` +
      `<style>body{font-family:system-ui;padding:60px;text-align:center;color:#374151}</style>` +
      `</head><body><h1>Presupuesto no disponible</h1><p>Este enlace ya no es válido o el presupuesto fue retirado.</p></body></html>`,
      { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    )
  }

  // Registrar primera vista del cliente (idempotente)
  if (quote.shared_at && !quote.viewed_by_client_at) {
    await supabase
      .from('provider_quotes')
      .update({
        viewed_by_client_at: new Date().toISOString(),
        status:              quote.status === 'shared' ? 'viewed' : quote.status,
      })
      .eq('id', quote.id)
  }

  return new NextResponse(quote.quote_html, {
    status: 200,
    headers: {
      'Content-Type':  'text/html; charset=utf-8',
      'Cache-Control': 'private, no-cache, no-store, must-revalidate',
      'X-Robots-Tag':  'noindex, nofollow',  // no queremos que Google indexe presupuestos
    },
  })
}
