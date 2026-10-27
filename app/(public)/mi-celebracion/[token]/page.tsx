import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase'
import { loadProposal, type Proposal } from '@/lib/proposals'
import { formatEuro } from '@/lib/pricing'
import { CATEGORIES } from '@/lib/constants'
import { venueSummary, type VenueFeatures } from '@/lib/venue'

// "Tu celebración": todas las propuestas del cliente para su evento en una
// vista, con el total, las señales y lo que el local tiene que tener (lo
// que piden los proveedores). 10.ª simulación: al contratar proveedores
// sueltos no sabían el coste total ni si encajaban entre sí.

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Tu celebración · FiestaGo', robots: { index: false, follow: false } }

const NEEDS: Array<[RegExp, string[]]> = [
  [/boda/i, ['espacios', 'catering', 'foto', 'musica', 'flores', 'belleza', 'pastel']],
  [/comuni/i, ['espacios', 'catering', 'pastel', 'foto', 'animacion', 'belleza']],
  [/infantil|niñ|cumple.*(hij|peque)/i, ['espacios', 'animacion', 'pastel']],
  [/cumple|aniversario|fiesta/i, ['espacios', 'catering', 'musica', 'pastel']],
]

export default async function CelebrationPage({ params }: { params: { token: string } }) {
  const supabase = createAdminClient()
  const first = await loadProposal(supabase, params.token)
  if (!first) notFound()

  // Las demás propuestas del mismo cliente para la misma fecha (o sin fecha)
  const { data: others } = await supabase.from('date_holds')
    .select('proposal_token, event_date')
    .ilike('client_email', first.client_email)
    .not('proposal_token', 'is', null).not('quote_total', 'is', null)
    .gte('created_at', new Date(Date.now() - 180 * 86400_000).toISOString())
  const tokens: string[] = Array.from(new Set<string>((others || [])
    .filter((o: any) => !first.event_date || !o.event_date || o.event_date === first.event_date)
    .map((o: any) => o.proposal_token as string)))
  const proposals = (await Promise.all(tokens.map(t => loadProposal(supabase, t)))).filter(Boolean) as Proposal[]

  const total = proposals.reduce((n, p) => n + p.total, 0)

  // El local elegido: si no admite catering externo o ya incluye la comida,
  // un catering aparte no encaja (simulación 15: motivo n.º 1 de no reservar)
  const venueProp = proposals.find(p => p.provider.category === 'espacios')
  const { data: venue } = venueProp
    ? await supabase.from('providers').select('name, venue_type, venue_features').eq('id', venueProp.provider.id).maybeSingle()
    : { data: null }
  const vf = (venue?.venue_features || {}) as VenueFeatures
  const foodIncluded = ['restaurante', 'hotel', 'local_con_catering'].includes(venue?.venue_type || '')
  const noExternal = !!venue?.venue_type && !vf.catering_externo
  const cateringProps = proposals.filter(p => p.provider.category === 'catering')
  const venueWarnings = venue ? [
    ...(cateringProps.length && noExternal ? [`${venue.name} no admite catering externo: la comida tiene que ser la del local. Quita ${cateringProps.map(p => p.provider.name).join(' y ')} o elige un local que admita catering externo.`] : []),
    ...(cateringProps.length && foodIncluded && !noExternal ? [`${venue.name} ya incluye la comida en su precio: comprueba que no estás pagando dos veces la comida con ${cateringProps.map(p => p.provider.name).join(' y ')}.`] : []),
    ...(cateringProps.length && venue.venue_type && !vf.cocina ? [`${venue.name} no tiene cocina: confirma en la propuesta de ${cateringProps.map(p => p.provider.name).join(' y ')} que trae todo lo necesario (y, si se paga aparte, que esté en sus extras).`] : []),
  ] : []
  const deposits = proposals.reduce((n, p) => n + p.first_payment, 0)
  const have = new Set(proposals.map(p => p.provider.category))
  const needs = (NEEDS.find(([re]) => re.test(first.event_type || ''))?.[1] || ['espacios', 'catering', 'musica', 'foto'])
    .filter(c => !have.has(c) && !(c === 'catering' && venue && (foodIncluded || noExternal)))
  const requirements = proposals.filter(p => p.details.requisitos && !/^nada\.?$/i.test(p.details.requisitos.trim()))
  const label = (id: string) => (CATEGORIES as readonly any[]).find(c => c.id === id)?.label || id

  return (
    <main className="bg-cream min-h-screen">
      <section className="max-w-2xl mx-auto px-4 sm:px-6 py-10 md:py-14">
        <div className="text-xs font-bold tracking-[0.18em] uppercase text-coral mb-3">Tu celebración</div>
        <h1 className="font-serif text-3xl md:text-4xl font-bold text-ink leading-tight mb-2">
          {first.event_type ? `Tu ${first.event_type.toLowerCase()}` : 'Tu evento'}{first.event_date ? `, el ${new Date(`${first.event_date}T12:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}` : ''}
        </h1>
        <p className="text-ink/65 mb-8">Cada servicio es un proveedor independiente. Aquí tienes todo junto para ver el total y que encaje.</p>

        <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-card mb-5">
          <div className="space-y-3">
            {proposals.map(p => (
              <Link key={p.token} href={`/propuesta/${p.token}`} className="flex justify-between gap-3 text-sm hover:text-coral">
                <span><strong className="text-ink">{p.provider.name}</strong> <span className="text-ink/55">· {label(p.provider.category)}{p.status === 'converted' ? ' · ✅ reservado' : ''}</span></span>
                <span className="font-semibold text-ink whitespace-nowrap">{formatEuro(p.total)}</span>
              </Link>
            ))}
          </div>
          <div className="border-t border-stone-200 mt-4 pt-4 flex justify-between items-baseline">
            <span className="text-sm text-ink/65">Total de lo que tienes hasta ahora (IVA y Garantía incluidos)</span>
            <span className="font-serif text-3xl font-black text-coral">{formatEuro(total)}</span>
          </div>
          <div className="text-xs text-ink/55 text-right mt-1">Señales para reservarlo todo: {formatEuro(deposits)}</div>
          {first.guests ? <div className="text-xs text-ink/55 text-right">≈ {formatEuro(Math.round(total / first.guests * 100) / 100)} por invitado</div> : null}
        </div>

        {venue && (
          <div className={`border rounded-2xl p-6 mb-5 ${venueWarnings.length ? 'bg-amber-50 border-amber-200' : 'bg-white border-stone-200'}`}>
            <h2 className="font-serif text-xl font-bold text-ink mb-1">Tu local</h2>
            <p className="text-sm text-ink/75">{venue.name}{venueSummary(venue.venue_type, vf) ? ` · ${venueSummary(venue.venue_type, vf)}` : ''}</p>
            <p className="text-xs text-ink/55 mt-1">Todos tus proveedores ven esta ficha del local.</p>
            {venueWarnings.length > 0 && (
              <ul className="text-sm text-amber-900 space-y-2 list-disc pl-5 mt-3">
                {venueWarnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            )}
          </div>
        )}

        {requirements.length > 0 && (
          <div className="bg-white border border-stone-200 rounded-2xl p-6 mb-5">
            <h2 className="font-serif text-xl font-bold text-ink mb-1">Lo que tu local tiene que tener</h2>
            <p className="text-xs text-ink/55 mb-3">Compruébalo con el local antes de reservar: es lo que necesitan tus proveedores.</p>
            <ul className="text-sm text-ink/80 space-y-2 list-disc pl-5">
              {requirements.map(p => <li key={p.token}><strong>{p.provider.name}:</strong> {p.details.requisitos}</li>)}
            </ul>
          </div>
        )}

        {needs.length > 0 && (
          <div className="bg-white border border-stone-200 rounded-2xl p-6 mb-5">
            <h2 className="font-serif text-xl font-bold text-ink mb-1">Lo que suele faltar</h2>
            <p className="text-xs text-ink/55 mb-3">Para un evento así, la gente suele contratar también:</p>
            <div className="flex flex-wrap gap-2">
              {needs.map(c => (
                <Link key={c} href={`/proveedores?categoria=${c}`} className="text-sm bg-cream border border-stone-200 rounded-full px-3 py-1.5 text-ink hover:border-coral">
                  {label(c)} →
                </Link>
              ))}
            </div>
          </div>
        )}

        <p className="text-xs text-ink/55 text-center">Todo lo que reserves aquí lleva la Garantía de Éxito FiestaGo y la Reserva sin riesgo de 7 días. ¿Dudas? Responde a cualquier email de FiestaGo y te llamamos.</p>
      </section>
    </main>
  )
}
