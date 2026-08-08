import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requireProviderAuth } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Versión actual del compromiso fiscal. Si cambia el texto, subir el sufijo y
// forzará al proveedor a re-leer y re-firmar antes del siguiente cobro.
const AGREEMENT_VERSION = 'fiscal-2026-07'

// Versión actual del consentimiento de facturación delegada (art. 5 RD 1619/2012).
const DELEGATED_INVOICING_VERSION = 'delegated-2026-08'

// Regímenes admitidos. Determina qué opciones ofrecemos en la UI y valida el
// input del POST para que nadie meta strings arbitrarios.
const VALID_REGIMES     = ['autonomo_permanente', 'autonomo_puntual', 'sociedad', 'cooperativa', 'otro']
const VALID_IVA_REGIMES = ['general', 'recargo_equivalencia', 'modulos', 'exento']

// GET /api/proveedor/fiscal?providerId=XXX
// Devuelve los datos fiscales actuales del proveedor + estado tax_ready +
// versión del compromiso vigente (para saber si necesita re-firmar).
export async function GET(req: NextRequest) {
  const providerId = new URL(req.url).searchParams.get('providerId')
  const auth = await requireProviderAuth(req, providerId)
  if (!auth.ok) return auth.response

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('providers')
    .select('tax_id, tax_name, tax_address, tax_regime, tax_iva_regime, tax_agreement_signed_at, tax_agreement_version, tax_ready, consent_delegated_invoicing, consent_delegated_invoicing_at, consent_delegated_invoicing_version, invoice_series')
    .eq('id', auth.data.id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const needsResign = data.tax_agreement_version !== AGREEMENT_VERSION
  const needsResignDelegated = data.consent_delegated_invoicing
    && data.consent_delegated_invoicing_version !== DELEGATED_INVOICING_VERSION
  return NextResponse.json({
    fiscal: data,
    agreementVersionCurrent: AGREEMENT_VERSION,
    delegatedVersionCurrent: DELEGATED_INVOICING_VERSION,
    needsResign,
    needsResignDelegated,
  })
}

// POST /api/proveedor/fiscal
// Body: { providerId, tax_id, tax_name, tax_address, tax_regime,
//         tax_iva_regime, accept_agreement,
//         consent_delegated_invoicing?, invoice_series? }
//
// Guarda los datos fiscales + firma del compromiso. Marca tax_ready=true.
// Los datos fiscales son responsabilidad DEL PROVEEDOR. FiestaGo solo los
// recoge para cumplir DAC7 y poder emitir factura al cliente cuando llegue
// el cobro. La firma del compromiso deja constancia de que él es responsable
// de estar al día con Hacienda y RETA cuando facture.
//
// consent_delegated_invoicing (opcional): activa la facturación delegada
// (FiestaGo emite facturas en nombre del proveedor por cada reserva).
// Requiere la firma del consentimiento específico (art. 5 RD 1619/2012).
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const {
    providerId,
    tax_id, tax_name, tax_address, tax_regime, tax_iva_regime,
    accept_agreement,
    consent_delegated_invoicing,
    invoice_series,
  } = body || {}

  const auth = await requireProviderAuth(req, providerId)
  if (!auth.ok) return auth.response

  if (!tax_id || !tax_name || !tax_address) {
    return NextResponse.json({ error: 'Rellena NIF/CIF, nombre fiscal y dirección' }, { status: 400 })
  }
  if (!VALID_REGIMES.includes(tax_regime)) {
    return NextResponse.json({ error: 'Régimen de actividad no válido' }, { status: 400 })
  }
  if (!VALID_IVA_REGIMES.includes(tax_iva_regime)) {
    return NextResponse.json({ error: 'Régimen de IVA no válido' }, { status: 400 })
  }
  if (!accept_agreement) {
    return NextResponse.json({ error: 'Tienes que aceptar el compromiso de responsabilidad fiscal' }, { status: 400 })
  }

  const updates: Record<string, any> = {
    tax_id:                  String(tax_id).trim().toUpperCase(),
    tax_name:                String(tax_name).trim(),
    tax_address:             String(tax_address).trim(),
    tax_regime,
    tax_iva_regime,
    tax_agreement_signed_at: new Date().toISOString(),
    tax_agreement_version:   AGREEMENT_VERSION,
    tax_ready:               true,
  }
  if (typeof consent_delegated_invoicing === 'boolean') {
    updates.consent_delegated_invoicing = consent_delegated_invoicing
    updates.consent_delegated_invoicing_at = consent_delegated_invoicing ? new Date().toISOString() : null
    updates.consent_delegated_invoicing_version = consent_delegated_invoicing ? DELEGATED_INVOICING_VERSION : null
  }
  if (typeof invoice_series === 'string' && invoice_series.trim()) {
    // Serie propia opcional. Uppercase, alfanumérico, máx 8 chars.
    const clean = invoice_series.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 8)
    updates.invoice_series = clean || null
  } else if (invoice_series === null || invoice_series === '') {
    updates.invoice_series = null
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('providers')
    .update(updates)
    .eq('id', auth.data.id)
    .select('tax_id, tax_name, tax_regime, tax_iva_regime, tax_agreement_signed_at, tax_ready, consent_delegated_invoicing, invoice_series')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ fiscal: data, ok: true })
}
