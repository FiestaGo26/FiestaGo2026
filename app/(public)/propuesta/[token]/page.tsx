import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase'
import { loadProposal } from '@/lib/proposals'
import { formatEuro } from '@/lib/pricing'
import { CATEGORIES } from '@/lib/constants'
import ProposalActions from './ProposalActions'
import ProposalQuestions from './ProposalQuestions'

// Propuesta escrita de un proveedor para un cliente concreto: precio
// cerrado para sus invitados y su fecha, qué incluye, la señal en euros,
// las condiciones y opiniones comprobables. Se puede compartir con quien
// decide con el cliente (no muestra su email ni su teléfono) y se reserva
// desde aquí con ese precio exacto.

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Tu propuesta · FiestaGo', robots: { index: false, follow: false } }

const fmtDate = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

export default async function ProposalPage({ params }: { params: { token: string } }) {
  const supabase = createAdminClient()
  const p = await loadProposal(supabase, params.token)
  if (!p) notFound()
  await supabase.from('date_holds').update({ proposal_viewed_at: new Date().toISOString() })
    .eq('id', p.hold_id).is('proposal_viewed_at', null)

  const { data: g } = await supabase.from('providers')
    .select('google_reviews').eq('id', p.provider.id).maybeSingle()
  const reviews: Array<{ text: string; stars: number; date: string | null }> = Array.isArray(g?.google_reviews) ? g!.google_reviews.slice(0, 3) : []
  const cat: any = CATEGORIES.find((c: any) => c.id === p.provider.category)
  const firstName = p.client_name.trim().split(/\s+/)[0]
  const holdActive = p.kind === 'hold' && p.status === 'active' && p.expires_at && new Date(p.expires_at) > new Date()
  const fichaUrl = `/proveedores/${p.provider.slug || p.provider.id}`

  return (
    <main className="bg-cream min-h-screen">
      <section className="max-w-2xl mx-auto px-4 sm:px-6 py-10 md:py-14">
        <div className="text-xs font-bold tracking-[0.18em] uppercase text-coral mb-3">Propuesta por escrito</div>
        <h1 className="font-serif text-3xl md:text-4xl font-bold text-ink leading-tight mb-2">
          {p.provider.name} para {p.event_type ? `tu ${p.event_type.toLowerCase()}` : 'tu evento'}
        </h1>
        <p className="text-ink/65 mb-8">
          Preparada para {firstName}
          {p.event_date ? ` · ${fmtDate(p.event_date)}` : ''}
          {p.guests ? ` · ${p.guests} invitados` : ''}
          {p.hours ? ` · ${p.hours} h` : ''}
          {cat ? ` · ${cat.label}` : ''}{p.provider.city ? ` en ${p.provider.city}` : ''}
        </p>

        {/* Precio */}
        <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-card mb-5">
          <div className="flex items-baseline justify-between gap-3 flex-wrap">
            <div className="text-sm text-ink/60">Precio total para tu caso</div>
            <div className="font-serif text-4xl font-black text-coral leading-none">{formatEuro(p.total)}</div>
          </div>
          <div className="text-xs text-ink/55 mt-1 text-right">Precio cerrado · IVA y Garantía de Éxito incluidos · sin extras ocultos</div>
          {p.per_person && <div className="text-sm text-ink/70 mt-1 text-right">≈ {formatEuro(p.per_person)} por persona ({p.guests} invitados)</div>}
          {p.details.fecha_confirmada && <div className="mt-3 inline-block text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full px-3 py-1">✓ {p.provider.name} confirma que tiene libre tu fecha</div>}
          <div className="mt-5 grid sm:grid-cols-2 gap-3 text-sm">
            <div className="bg-cream rounded-xl p-3">
              <div className="text-ink/55 text-xs">Al reservar (señal del {p.deposit_pct} %)</div>
              <div className="font-bold text-ink text-lg">{formatEuro(p.first_payment)}</div>
            </div>
            <div className="bg-cream rounded-xl p-3">
              <div className="text-ink/55 text-xs">{p.second_payment > 0 && p.second_payment_due ? `El resto, el ${fmtDate(p.second_payment_due)}` : 'Resto'}</div>
              <div className="font-bold text-ink text-lg">{p.second_payment > 0 ? formatEuro(p.second_payment) : 'Nada más'}</div>
            </div>
          </div>
          <p className="text-xs text-ink/55 mt-3">El dinero queda retenido en Stripe, una entidad de pagos regulada, y el proveedor no lo cobra hasta que termina tu evento.</p>
        </div>

        {/* Qué incluye */}
        <div className="bg-white border border-stone-200 rounded-2xl p-6 mb-5">
          <h2 className="font-serif text-xl font-bold text-ink mb-3">Qué incluye</h2>
          <p className="text-sm text-ink/80 whitespace-pre-line leading-relaxed">{p.includes}</p>
          {p.details.no_incluye && <><h3 className="font-semibold text-ink text-sm mt-4 mb-1">Qué no incluye</h3><p className="text-sm text-ink/75 whitespace-pre-line leading-relaxed">{p.details.no_incluye}</p></>}
          {p.details.plan_b && <><h3 className="font-semibold text-ink text-sm mt-4 mb-1">Plan B si llueve o hay un imprevisto</h3><p className="text-sm text-ink/75 whitespace-pre-line leading-relaxed">{p.details.plan_b}</p></>}
          <p className="text-xs text-ink/50 mt-4">Esta propuesta es solo de {p.provider.name}. El resto de tu celebración (local, comida, música…) lo contratas aparte, en FiestaGo o donde quieras.</p>
          {p.reply && <p className="text-sm text-ink/70 italic mt-4 border-l-2 border-coral/40 pl-3">“{p.reply}” — {p.provider.name}</p>}
        </div>

        {/* Trabajos del proveedor */}
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

        {/* Opiniones comprobables */}
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

        <ProposalQuestions token={p.token} providerName={p.provider.name} initial={p.questions}/>

        {/* Con quién contratas (7.ª simulación: no sabían quién factura ni quién responde) */}
        <div className="bg-white border border-stone-200 rounded-2xl p-6 mb-5">
          <h2 className="font-serif text-xl font-bold text-ink mb-3">Con quién contratas</h2>
          <ul className="text-sm text-ink/80 space-y-2 leading-relaxed list-disc pl-5">
            <li><strong>{p.provider.name}</strong> presta el servicio y responde de que sea lo que dice esta propuesta.{p.provider.verified ? ' Está verificado (DNI/CIF y seguro de responsabilidad civil).' : ''}</li>
            <li><strong>FiestaGo</strong> cobra la señal y el resto, los retiene en Stripe hasta después de tu evento y responde de la Garantía de Éxito con su propio dinero. Titular: Francisco Mariano González Tejedo, NIF 09437664M, C/ Turina 6, 33011 Oviedo.</li>
            <li><strong>Facturas:</strong> recibes la del servicio (a nombre de {p.provider.name}) y la de la Garantía (de FiestaGo), por email y en tu cuenta.</li>
            <li><strong>El precio de esta propuesta es el único que pagas.</strong> Ya incluye la Garantía; no hay más cargos.</li>
          </ul>
        </div>

        {/* Condiciones */}
        <div className="bg-white border border-stone-200 rounded-2xl p-6 mb-5">
          <h2 className="font-serif text-xl font-bold text-ink mb-3">Las condiciones, por escrito</h2>
          <ul className="text-sm text-ink/80 space-y-2 leading-relaxed list-disc pl-5">
            <li><strong>Si el proveedor cancela:</strong> te buscamos en 48 h un sustituto que cumpla las mismas funciones a un precio similar o te devolvemos todo lo pagado y un 10 % más.</li>
            <li><strong>Si no se presenta el día:</strong> te devolvemos lo pagado y una compensación según el importe (desde 300 €). Reembolsos en un máximo de 5 días hábiles.</li>
            {p.cancellation
              ? <li><strong>Si cancelas tú (política {p.cancellation.label.toLowerCase()}):</strong> {p.cancellation.rules.join(' ')}</li>
              : <li><strong>Si cancelas tú:</strong> se aplica la política de cancelación de su ficha.</li>}
            <li><strong>No cubre</strong> la lluvia ni los cambios que pidas tú. La garantía solo cubre lo que se reserva y paga dentro de FiestaGo.</li>
          </ul>
          <p className="text-xs text-ink/55 mt-3">
            Todo el detalle en <Link href="/garantia" className="underline">Garantía de Éxito</Link> y <Link href="/terminos" className="underline">Términos</Link>.
            ¿Quién está detrás? <Link href="/quienes-somos" className="underline">Quiénes somos</Link>.
          </p>
        </div>

        <ProposalActions
          token={p.token}
          firstPayment={p.first_payment}
          converted={p.status === 'converted'}
          hasDate={!!p.event_date}
          holdUntil={holdActive ? p.expires_at : null}
          providerName={p.provider.name}
          fichaUrl={fichaUrl}
        />
      </section>
    </main>
  )
}
