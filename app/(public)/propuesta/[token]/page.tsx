import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase'
import { loadProposal, noShowCompensation } from '@/lib/proposals'
import { formatEuro } from '@/lib/pricing'
import { CATEGORIES } from '@/lib/constants'
import ProposalActions from './ProposalActions'
import ProposalQuestions from './ProposalQuestions'
import PrintButton from './PrintButton'
import ReferenceList from './ReferenceList'
import { uniqueReviews } from '@/lib/google-reviews'

// Propuesta escrita de un proveedor para un cliente concreto: precio
// cerrado para sus invitados y su fecha, qué incluye, la señal en euros,
// las condiciones y opiniones comprobables. Se puede compartir con quien
// decide con el cliente (no muestra su email ni su teléfono) y se reserva
// desde aquí con ese precio exacto.

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Documento de reserva · FiestaGo', robots: { index: false, follow: false } }

const fmtDate = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

export default async function ProposalPage({ params }: { params: { token: string } }) {
  const supabase = createAdminClient()
  const p = await loadProposal(supabase, params.token)
  if (!p) notFound()
  await supabase.from('date_holds').update({ proposal_viewed_at: new Date().toISOString() })
    .eq('id', p.hold_id).is('proposal_viewed_at', null)

  const { data: g } = await supabase.from('providers')
    .select('google_reviews').eq('id', p.provider.id).maybeSingle()
  const reviews: Array<{ text: string; stars: number; date: string | null }> = Array.isArray(g?.google_reviews) ? uniqueReviews(g!.google_reviews as Array<{ text: string; stars: number; date: string | null }>).slice(0, 3) : []
  const cat: any = CATEGORIES.find((c: any) => c.id === p.provider.category)
  const firstName = p.client_name.trim().split(/\s+/)[0]
  const holdActive = p.kind === 'hold' && p.status === 'active' && p.expires_at && new Date(p.expires_at) > new Date()
  const fichaUrl = `/proveedores/${p.provider.slug || p.provider.id}`

  const comp = noShowCompensation(p.total)
  const answered = p.questions.filter(q => q.a)
  const box = 'bg-white border border-stone-200 rounded-2xl p-6 mb-5 print:border-0 print:p-0 print:mb-6'

  return (
    <main className="bg-cream min-h-screen print:bg-white">
      <section className="max-w-2xl mx-auto px-4 sm:px-6 py-10 md:py-14">
        {/* ── Documento de reserva: un único documento con todo ── */}
        <div className="bg-white border-2 border-ink/10 rounded-2xl p-6 mb-5 shadow-card print:shadow-none print:border-0 print:p-0">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <div className="font-serif text-2xl font-black text-ink leading-none">FiestaGo</div>
              <div className="text-[11px] font-bold tracking-[0.18em] uppercase text-coral mt-1">Documento de reserva</div>
            </div>
            <PrintButton/>
          </div>
          <h1 className="font-serif text-2xl md:text-3xl font-bold text-ink leading-tight mb-1">
            {p.provider.name}{cat ? ` · ${cat.label}` : ''}
          </h1>
          <p className="text-sm text-ink/65 mb-5">
            Para {firstName}{p.event_type ? ` · ${p.event_type}` : ''}
            {p.event_date ? ` · ${fmtDate(p.event_date)}` : ''}
            {p.guests ? ` · ${p.guests} invitados` : ''}
            {p.hours ? ` · ${p.hours} h` : ''}
            {p.provider.city ? ` · ${p.provider.city}` : ''}
          </p>
          <div className="flex items-baseline justify-between gap-3 flex-wrap border-t border-stone-200 pt-4">
            <div className="text-sm text-ink/60">Precio del servicio</div>
            <div className="font-serif text-4xl font-black text-coral leading-none">{formatEuro(p.total)}</div>
          </div>
          <div className="text-xs text-ink/55 mt-1 text-right">Precio único y cerrado · IVA y Garantía de Éxito FiestaGo incluidos</div>
          {p.per_person && <div className="text-sm text-ink/70 mt-1 text-right">≈ {formatEuro(p.per_person)} por invitado</div>}
          {p.details.fecha_confirmada && <div className="mt-3 inline-block text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full px-3 py-1">✓ {p.provider.name} confirma que tiene libre tu fecha</div>}
        </div>

        {/* 1. El servicio */}
        <div className={box}>
          <h2 className="font-serif text-xl font-bold text-ink mb-3">1. El servicio</h2>
          <h3 className="font-semibold text-ink text-sm mb-1">Qué incluye</h3>
          <p className="text-sm text-ink/80 whitespace-pre-line leading-relaxed">{p.includes}</p>
          {p.details.no_incluye && <><h3 className="font-semibold text-ink text-sm mt-4 mb-1">Qué no incluye</h3><p className="text-sm text-ink/75 whitespace-pre-line leading-relaxed">{p.details.no_incluye}</p></>}
          {p.details.requisitos && <><h3 className="font-semibold text-ink text-sm mt-4 mb-1">Qué necesita del local o de ti</h3><p className="text-sm text-ink/75 whitespace-pre-line leading-relaxed">{p.details.requisitos}</p></>}
          {p.details.plan_b && <><h3 className="font-semibold text-ink text-sm mt-4 mb-1">Plan B si llueve o hay un imprevisto</h3><p className="text-sm text-ink/75 whitespace-pre-line leading-relaxed">{p.details.plan_b}</p></>}
          {(p.extras.length > 0 || p.unit_extra) && (
            <>
              <h3 className="font-semibold text-ink text-sm mt-4 mb-1">Extras opcionales (precio final de cada uno)</h3>
              <ul className="text-sm text-ink/80 space-y-1">
                {p.unit_extra && <li className="flex justify-between gap-3"><span>Cada {p.unit_extra.label}</span><span className="font-semibold">{formatEuro(p.unit_extra.price)}</span></li>}
                {p.extras.map(e => <li key={e.id} className="flex justify-between gap-3"><span>{e.label}</span><span className="font-semibold">{formatEuro(e.price)}</span></li>)}
              </ul>
              <p className="text-[11px] text-ink/50 mt-1">IVA y Garantía de Éxito FiestaGo incluidos. Los marcas al reservar y se suman al total.</p>
            </>
          )}
          {p.reply && <p className="text-sm text-ink/70 italic mt-4 border-l-2 border-coral/40 pl-3">“{p.reply}” — {p.provider.name}</p>}
          <p className="text-xs text-ink/50 mt-4">Este documento es solo de {p.provider.name}. El resto de tu celebración lo contratas aparte, en FiestaGo o donde quieras.</p>
        </div>

        {/* 2. Detalles acordados por escrito */}
        {answered.length > 0 && (
          <div className={box}>
            <h2 className="font-serif text-xl font-bold text-ink mb-3">2. Detalles acordados por escrito</h2>
            <ul className="text-sm text-ink/80 space-y-3 leading-relaxed">
              {answered.map((q, i) => (
                <li key={i}><div className="font-semibold text-ink">{q.q}</div><div>{q.a} <span className="text-ink/45">— {q.by === 'fiestago' ? 'FiestaGo' : p.provider.name}</span></div></li>
              ))}
            </ul>
          </div>
        )}

        {/* 3. Pagos */}
        <div className={box}>
          <h2 className="font-serif text-xl font-bold text-ink mb-3">{answered.length ? '3' : '2'}. Cómo pagas</h2>
          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            <div className="bg-cream rounded-xl p-3">
              <div className="text-ink/55 text-xs">Al reservar (señal del {p.deposit_pct} %)</div>
              <div className="font-bold text-ink text-lg">{formatEuro(p.first_payment)}</div>
            </div>
            <div className="bg-cream rounded-xl p-3">
              <div className="text-ink/55 text-xs">{p.second_payment > 0 && p.second_payment_due ? `El resto, el ${fmtDate(p.second_payment_due)}` : 'Resto'}</div>
              <div className="font-bold text-ink text-lg">{p.second_payment > 0 ? formatEuro(p.second_payment) : 'Nada más'}</div>
            </div>
          </div>
          <p className="text-xs text-ink/55 mt-3">Pagas a FiestaGo dentro de la web. El dinero queda retenido en Stripe, una entidad de pagos regulada, y {p.provider.name} no lo cobra hasta que termina tu evento. Recibirás la factura con el desglose por email y en tu cuenta.</p>
        </div>

        {/* 4. Garantía de Éxito FiestaGo y condiciones */}
        <div className={box}>
          <h2 className="font-serif text-xl font-bold text-ink mb-1">{answered.length ? '4' : '3'}. Garantía de Éxito FiestaGo y condiciones</h2>
          <p className="text-xs text-ink/55 mb-3">La Garantía de Éxito FiestaGo la da FiestaGo, con su propio dinero, no el proveedor. {p.provider.name} ha firmado con FiestaGo sus compromisos: si cancela, ayuda a buscar sustituto o asume una penalización.</p>
          <ul className="text-sm text-ink/80 space-y-2 leading-relaxed list-disc pl-5">
            <li><strong>Si el proveedor cancela:</strong> te buscamos en 48 h un sustituto que cumpla las mismas funciones a un precio similar o te devolvemos todo lo pagado y un 10 % más.</li>
            <li><strong>Si no se presenta el día:</strong> te devolvemos lo pagado y {formatEuro(comp)} de compensación. Reembolsos en un máximo de 5 días hábiles.</li>
            <li><strong>Reserva sin riesgo:</strong> si en los 7 días siguientes a pagar la señal no cerráis los detalles finales o cambian tus planes, cancelas y te devolvemos la señal entera (eventos a 30 días o más).</li>
            {p.cancellation
              ? <li><strong>Después de esos 7 días, si cancelas tú (política {p.cancellation.label.toLowerCase()}):</strong> {p.cancellation.rules.join(' ')}</li>
              : <li><strong>Después de esos 7 días, si cancelas tú:</strong> se aplica la política de cancelación de su ficha.</li>}
            <li><strong>No cubre</strong> la lluvia ni los cambios que pidas tú. Solo cubre lo que se reserva y paga dentro de FiestaGo.</li>
          </ul>
          <p className="text-xs text-ink/55 mt-3">
            Presta el servicio {p.provider.name}{p.provider.verified ? ' (verificado: DNI/CIF y seguro de responsabilidad civil)' : ''}. FiestaGo: Francisco Mariano González Tejedo, NIF 09437664M, C/ Turina 6, 33011 Oviedo.
            Detalle completo en <Link href="/garantia" className="underline">Garantía de Éxito FiestaGo</Link> y <Link href="/terminos" className="underline">Términos</Link>.
          </p>
        </div>

        {/* Sobre el proveedor (fuera del documento) */}
        <div className="print:hidden">
        {p.photos.length > 0 && (
          <div className="bg-white border border-stone-200 rounded-2xl p-6 mb-5">
            <h2 className="font-serif text-xl font-bold text-ink mb-3">Sus trabajos</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {p.photos.map((src, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={src} alt={`Trabajo de ${p.provider.name}`} className="w-full aspect-square object-cover rounded-xl" loading="lazy"/>
              ))}
            </div>
          </div>
        )}

        {(p.provider.google_rating || reviews.length > 0) && (
          <div className="bg-white border border-stone-200 rounded-2xl p-6 mb-5">
            <h2 className="font-serif text-xl font-bold text-ink mb-1">Opiniones de Google</h2>
            {p.provider.google_rating && (
              <p className="text-sm text-ink/70 mb-3">
                <span className="font-bold text-ink">{Number(p.provider.google_rating).toFixed(1).replace('.', ',')} ★</span>
                {p.provider.google_rating_count ? ` · ${p.provider.google_rating_count} opiniones` : ''} · búscalo en Google Maps por su nombre y compruébalo.
              </p>
            )}
            <div className="space-y-3">
              {reviews.map((r, i) => (
                <blockquote key={i} className="text-sm text-ink/75 bg-cream rounded-xl p-3">
                  <div className="text-amber-500 text-xs mb-1">{'★'.repeat(Math.round(r.stars))}</div>
                  “{r.text.length > 280 ? `${r.text.slice(0, 280)}…` : r.text}”
                  {r.date && <div className="text-[11px] text-ink/45 mt-1">{new Date(r.date).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}</div>}
                </blockquote>
              ))}
            </div>
          </div>
        )}

        {p.references.length > 0 && <ReferenceList token={p.token} providerName={p.provider.name} references={p.references}/>}

        <ProposalQuestions token={p.token} providerName={p.provider.name} initial={p.questions}/>
        </div>

        <div className="text-center mb-5 print:hidden">
          <Link href={`/mi-celebracion/${p.token}`} className="text-sm font-semibold text-coral underline">Ver tu celebración completa: total, lo que necesita el local y lo que falta →</Link>
        </div>

        <div className="print:hidden">
        <ProposalActions
          token={p.token}
          firstPayment={p.first_payment}
          total={p.total}
          depositPct={p.deposit_pct}
          extras={p.extras.map(e => ({ id: e.id, label: e.label, price: e.price }))}
          converted={p.status === 'converted'}
          hasDate={!!p.event_date}
          holdUntil={holdActive ? p.expires_at : null}
          providerName={p.provider.name}
          fichaUrl={fichaUrl}
        />
        </div>
      </section>
    </main>
  )
}
