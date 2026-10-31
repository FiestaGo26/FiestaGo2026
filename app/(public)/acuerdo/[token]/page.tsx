import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase'
import { loadAgreement, withGuarantee } from '@/lib/agreements'
import { formatEuro } from '@/lib/pricing'
import PrintButton from '../../propuesta/[token]/PrintButton'
import AcceptAgreement from './AcceptAgreement'

// Acuerdo de servicio entre el cliente y el proveedor (lib/agreements.ts).
// Arriba FiestaGo, nada más: el resto son compromisos entre ellos dos.

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Acuerdo de servicio · FiestaGo', robots: { index: false, follow: false } }

const fmtDate = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

export default async function AgreementPage({ params }: { params: { token: string } }) {
  const a = await loadAgreement(createAdminClient(), params.token)
  if (!a) notFound()
  const row = (label: string, value: string | null | undefined) => value ? (
    <div className="py-2 border-b border-stone-100 last:border-0">
      <div className="text-xs font-semibold text-ink/55 uppercase tracking-wide">{label}</div>
      <div className="text-sm text-ink whitespace-pre-line leading-relaxed mt-0.5">{value}</div>
    </div>
  ) : null

  return (
    <main className="bg-cream min-h-screen">
      <section className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
        <div className="bg-white border border-stone-200 rounded-2xl p-6 md:p-8 shadow-card">
          <div className="flex justify-between items-start mb-6">
            <div className="font-serif text-2xl font-black text-coral">FiestaGo</div>
            <div className="print:hidden"><PrintButton /></div>
          </div>
          <h1 className="font-serif text-2xl md:text-3xl font-bold text-ink mb-1">Acuerdo de servicio</h1>
          <p className="text-sm text-ink/60 mb-6">
            Entre <strong>{a.client_name}</strong> (cliente) y <strong>{a.provider.legal_name || a.provider.name}</strong>{a.provider.tax_id ? ` (NIF/CIF ${a.provider.tax_id})` : ''} (proveedor).
            {a.status === 'aceptado' && a.accepted_at && <> Aceptado el {new Date(a.accepted_at).toLocaleString('es-ES', { dateStyle: 'long', timeStyle: 'short' })} por {a.accepted_name}.</>}
            {a.status === 'cancelado' && <> <strong>Anulado por el proveedor.</strong></>}
          </p>

          {row('Servicio', a.service_title)}
          {row('Evento', [a.event_type, a.event_date ? fmtDate(a.event_date) : null, a.event_place, a.guests ? `${a.guests} invitados` : null, a.hours ? `${a.hours} h` : null].filter(Boolean).join(' · '))}
          {row('Qué incluye', a.includes)}
          {row('Qué no incluye', a.not_includes)}
          <div className="py-3 border-b border-stone-100">
            <div className="text-xs font-semibold text-ink/55 uppercase tracking-wide">Precio total</div>
            <div className="font-serif text-3xl font-black text-ink">{formatEuro(a.guarantee_chosen ? withGuarantee(a.price_total) : a.price_total)}</div>
            <div className="text-xs text-ink/55">IVA incluido{a.guarantee_chosen ? ', con la Garantía de Éxito FiestaGo' : ''}.{a.deposit_amount ? ` Señal: ${formatEuro(a.deposit_amount)}.` : ''}</div>
          </div>
          {row('Cómo se paga', a.payment_terms)}
          {row('Si hay que cancelar', a.cancellation_terms)}
          {row('Otras condiciones', a.other_terms)}

          {a.guarantee_offered && (
            <div className="mt-4 bg-cream border border-stone-200 rounded-xl p-4 text-sm text-ink/80">
              <strong>Garantía de Éxito FiestaGo (opcional).</strong> Por {formatEuro(withGuarantee(a.price_total) - a.price_total)} más, si el proveedor cancela FiestaGo busca un sustituto en 48 h o te devuelve todo y un 10 % más; si no se presenta, te devuelve lo pagado y una compensación. Solo cubre lo que se paga por FiestaGo. <a href="/garantia" className="underline">Condiciones</a>.
              {a.guarantee_chosen === true && <div className="mt-1 font-semibold text-ink">✓ Elegida por el cliente.</div>}
              {a.guarantee_chosen === false && <div className="mt-1 text-ink/60">No elegida.</div>}
            </div>
          )}

          {a.status === 'aceptado' && a.accepted_fingerprint && (
            <p className="text-xs text-ink/50 mt-4">Código de registro de la aceptación: <span className="font-mono">{a.accepted_fingerprint}</span></p>
          )}
          {a.status === 'enviado' && <AcceptAgreement token={a.token} guaranteeOffered={a.guarantee_offered} price={a.price_total} priceWithGuarantee={withGuarantee(a.price_total)} />}

          <p className="text-[11px] text-ink/45 mt-6 leading-relaxed">
            Este acuerdo es entre el cliente y el proveedor: los compromisos sobre el servicio, el precio, el pago y las cancelaciones son suyos.
            FiestaGo solo facilita la herramienta y guarda el registro de lo acordado{a.guarantee_offered ? ', y responde de la Garantía de Éxito FiestaGo solo si el cliente la elige y paga por FiestaGo' : ''}.
          </p>
        </div>
      </section>
    </main>
  )
}
