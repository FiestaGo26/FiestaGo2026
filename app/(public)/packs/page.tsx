import Link from 'next/link'
import Image from 'next/image'
import { createAdminClient } from '@/lib/supabase'
import { getPhoto } from '@/lib/constants'
import { precioCliente, formatEuro } from '@/lib/pricing'
import PackInquiryButton from './PackInquiryButton'

export const metadata = {
  title: 'Packs · FiestaGo',
  description: 'Packs cerrados con precio claro para tu cumpleaños, boda, comunión o evento corporativo. Un único contacto, presupuesto cerrado.',
}

export const dynamic = 'force-dynamic'

async function getActivePacks() {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('packs')
    .select('*')
    .eq('status', 'active')
    .order('sort_order')
  return data || []
}

export default async function PacksPage() {
  const packs = await getActivePacks()

  return (
    <main className="bg-cream min-h-screen">

      {/* ─── HERO ─── */}
      <section className="relative pt-24 md:pt-28 pb-12 md:pb-16">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <p className="text-xs font-bold tracking-[0.25em] uppercase text-coral mb-4">
            Sin presupuestos · Sin esperas
          </p>
          <h1 className="font-serif text-4xl md:text-6xl text-ink leading-[1.05] tracking-tight mb-5">
            Packs cerrados con{' '}
            <span className="italic font-light">precio claro</span>
          </h1>
          <p className="text-base md:text-lg text-ink/65 max-w-2xl mx-auto leading-relaxed">
            Cumpleaños, bodas, comuniones, eventos corporativos. Un único contacto, un único precio, todo coordinado.
            Si algo falla, te respondemos con la Garantía de Éxito.
          </p>
        </div>
      </section>

      {/* ─── LISTADO DE PACKS ─── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
          {packs.map((pack: any) => {
            const priceClient = precioCliente(Number(pack.price_base))
            return (
              <article key={pack.id}
                className="bg-white border border-stone-200 rounded-3xl overflow-hidden flex flex-col">

                {/* Foto */}
                <div className="relative aspect-[4/3] bg-stone-100">
                  <Image
                    src={getPhoto(pack.photo_seed || 'party', 0, 800, 600)}
                    alt={pack.name}
                    fill className="object-cover"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"/>
                  {pack.highlight && (
                    <div className="absolute top-3 left-3 bg-coral text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full">
                      {pack.highlight}
                    </div>
                  )}
                </div>

                {/* Cuerpo */}
                <div className="p-5 md:p-6 flex-1 flex flex-col">
                  <div className="flex items-start gap-3 mb-3">
                    <span className="text-3xl shrink-0 leading-none">{pack.emoji}</span>
                    <div className="min-w-0">
                      <h2 className="font-serif text-xl text-ink font-bold leading-tight">
                        {pack.name}
                      </h2>
                      {pack.duration && (
                        <div className="text-xs text-ink/50 mt-1">
                          ⏱ {pack.duration}
                          {pack.max_guests && <> · 👥 hasta {pack.max_guests} invitados</>}
                        </div>
                      )}
                    </div>
                  </div>

                  <p className="text-sm text-ink/70 leading-relaxed mb-4">
                    {pack.description}
                  </p>

                  {pack.includes && pack.includes.length > 0 && (
                    <ul className="space-y-1.5 mb-5">
                      {pack.includes.slice(0, 5).map((it: string) => (
                        <li key={it} className="flex items-start gap-2 text-xs text-ink/70 leading-snug">
                          <span className="text-coral shrink-0 mt-0.5">✓</span>
                          <span>{it}</span>
                        </li>
                      ))}
                      {pack.includes.length > 5 && (
                        <li className="text-xs text-ink/45 italic pl-5">
                          + {pack.includes.length - 5} más…
                        </li>
                      )}
                    </ul>
                  )}

                  {/* Precio + CTA */}
                  <div className="mt-auto pt-4 border-t border-stone-200">
                    <div className="flex items-baseline justify-between mb-3">
                      <div>
                        <div className="text-xs text-ink/50 uppercase tracking-wider mb-0.5">
                          Desde
                        </div>
                        <div className="font-serif text-2xl font-bold text-ink">
                          {formatEuro(priceClient)}
                        </div>
                        {pack.price_note && (
                          <div className="text-[10px] text-ink/45 mt-0.5">
                            {pack.price_note}
                          </div>
                        )}
                      </div>
                      <div className="text-[10px] text-ink/45 text-right max-w-[100px] leading-snug">
                        🛡 Garantía<br/>de Éxito<br/>incluida
                      </div>
                    </div>

                    <PackInquiryButton
                      packId={pack.id}
                      packName={pack.name}
                      packPrice={priceClient}/>
                  </div>
                </div>
              </article>
            )
          })}
        </div>

        {packs.length === 0 && (
          <div className="text-center py-16 text-ink/50">
            No hay packs disponibles ahora mismo.
          </div>
        )}
      </section>

      {/* ─── BLOQUE CONFIANZA ─── */}
      <section className="bg-ink text-white">
        <div className="max-w-5xl mx-auto px-6 py-14 md:py-16 text-center">
          <p className="text-xs font-bold tracking-[0.25em] uppercase text-coral mb-3">
            Cómo funciona
          </p>
          <h2 className="font-serif text-3xl md:text-4xl leading-tight mb-4">
            Reserva ahora · Confirmación en 24h
          </h2>
          <p className="text-white/65 max-w-2xl mx-auto leading-relaxed mb-8">
            Solicita el pack, te contactamos en menos de 24h para confirmar disponibilidad y detalles.
            El pago se retiene hasta el evento — si algo va mal, te respondemos con la Garantía de Éxito.
          </p>
          <Link href="/garantia"
            className="inline-block text-sm font-semibold border border-white/30 text-white px-6 py-3 rounded-xl hover:bg-white hover:text-ink transition-colors">
            Ver la Garantía de Éxito →
          </Link>
        </div>
      </section>
    </main>
  )
}
