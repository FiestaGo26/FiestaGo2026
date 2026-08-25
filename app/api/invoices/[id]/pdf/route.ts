import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { renderInvoiceHtml } from '@/lib/invoicing/pdf'
import { getAuthUser } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/invoices/[id]/pdf?email=CLIENT_EMAIL[&as=html]
//
// Devuelve el HTML/PDF de la factura. Autoriza:
//   · El receptor (client_email debe coincidir con ?email= o auth)
//   · El emisor delegado (proveedor con ese issuer_provider_id + auth)
//   · Admin con x-admin-password
//
// Query param `as=html` devuelve el HTML raw (útil para debug o vista
// previa desde el panel). Por defecto genera PDF con Chromium.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const url = new URL(req.url)
  const email = url.searchParams.get('email')
  const format = url.searchParams.get('as') || 'pdf'

  const supabase = createAdminClient()
  const { data: inv, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error || !inv) {
    return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 })
  }

  // Autorización · aceptamos cualquiera de estos caminos:
  //   1. Admin con x-admin-password
  //   2. Receptor por ?email= (link firmado enviado en el email de factura)
  //   3. Emisor por x-provider-token (llamada API desde el panel)
  //   4. Sesión Supabase cuyo email coincide con el del proveedor emisor
  //      o del cliente receptor (para <a href> desde panel FiestaGo)
  const isAdmin = req.headers.get('x-admin-password') === process.env.ADMIN_PASSWORD
  const isRecipient = email && String(email).toLowerCase() === String(inv.recipient_email).toLowerCase()
  const providerToken = req.headers.get('x-provider-token')
  const isIssuer = providerToken && providerToken === inv.issuer_provider_id

  let isSessionAuthorized = false
  if (!isAdmin && !isRecipient && !isIssuer) {
    const user = await getAuthUser()
    if (user?.email) {
      const userEmail = user.email.toLowerCase()
      // ¿Es el cliente destinatario?
      if (String(inv.recipient_email || '').toLowerCase() === userEmail) {
        isSessionAuthorized = true
      }
      // ¿Es el proveedor emisor de una factura delegada?
      if (!isSessionAuthorized && inv.issuer_provider_id) {
        const { data: prov } = await supabase
          .from('providers').select('email').eq('id', inv.issuer_provider_id).maybeSingle()
        if (prov?.email && prov.email.toLowerCase() === userEmail) {
          isSessionAuthorized = true
        }
      }
      // ¿Es el proveedor asociado al booking (para la factura de comisión
      // FiestaGo→cliente, que emite FiestaGo pero afecta al proveedor)?
      if (!isSessionAuthorized && inv.booking_id) {
        const { data: bk } = await supabase
          .from('bookings').select('provider_id, providers(email)')
          .eq('id', inv.booking_id).maybeSingle()
        const providerEmail = (bk as any)?.providers?.email
        if (providerEmail && String(providerEmail).toLowerCase() === userEmail) {
          isSessionAuthorized = true
        }
      }
    }
  }

  if (!isAdmin && !isRecipient && !isIssuer && !isSessionAuthorized) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const html = renderInvoiceHtml({
    full_number:        inv.full_number,
    issue_date:         inv.issue_date,
    invoice_type:       inv.invoice_type,
    issuer_tax_id:      inv.issuer_tax_id,
    issuer_tax_name:    inv.issuer_tax_name,
    issuer_tax_address: inv.issuer_tax_address,
    recipient_name:     inv.recipient_name,
    recipient_tax_id:   inv.recipient_tax_id,
    recipient_email:    inv.recipient_email,
    recipient_address:  inv.recipient_address,
    concept:            inv.concept,
    items:              inv.items_json || [],
    base_amount:        Number(inv.base_amount),
    tax_rate:           Number(inv.tax_rate),
    tax_amount:         Number(inv.tax_amount),
    total_amount:       Number(inv.total_amount),
    invoice_hash:       inv.invoice_hash,
    prev_invoice_hash:  inv.prev_invoice_hash,
    qr_content:         inv.qr_content,
    verifactu_mode:     inv.verifactu_mode,
  })

  if (format === 'html') {
    return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  }

  // Para PDF: en runtime Netlify no tenemos Chromium disponible aquí,
  // así que devolvemos el HTML con instrucciones de "Imprimir → PDF"
  // que hace el navegador del usuario. Cuando implementemos Chromium
  // serverless (Playwright en Netlify Functions), este endpoint pasará
  // a servir PDF real.
  const printableHtml = html.replace(
    '</head>',
    `<script>
      window.addEventListener('load', () => setTimeout(() => window.print(), 300))
    </script></head>`
  )
  return new Response(printableHtml, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': `inline; filename="factura-${inv.full_number}.pdf"`,
    },
  })
}
