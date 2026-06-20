import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase'
import PacksClient from './PacksClient'

export const metadata = {
  title: 'Packs · FiestaGo',
  description: 'Packs cerrados con precio claro para tu cumpleaños, boda, comunión o evento corporativo. Un único contacto, presupuesto cerrado.',
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function getActivePacks() {
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('packs')
      .select('*')
      .eq('status', 'active')
      .order('sort_order')
    if (error) {
      console.error('[packs/page] supabase error:', error.message)
      return []
    }
    return data || []
  } catch (err: any) {
    console.error('[packs/page] fetch error:', err?.message)
    return []
  }
}

export default async function PacksPage({
  searchParams,
}: {
  searchParams: { ciudad?: string; fecha?: string; categoria?: string }
}) {
  const packs = await getActivePacks()

  return (
    <main className="bg-cream min-h-screen">

      {/* ─── HERO ─── */}
      <section className="relative pt-24 md:pt-28 pb-10 md:pb-14">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <p className="text-xs font-bold tracking-[0.25em] uppercase text-coral mb-4">
            Sin presupuestos · Sin esperas
          </p>
          <h1 className="font-serif text-4xl md:text-6xl text-ink leading-[1.05] tracking-tight mb-5">
            Packs cerrados con{' '}
            <span className="italic font-light">precio claro</span>
          </h1>
          <p className="text-base md:text-lg text-ink/65 max-w-2xl mx-auto leading-relaxed">
            Cumpleaños, bodas, comuniones, eventos corporativos. Un único contacto, un único precio,
            todo coordinado. Si algo falla, te respondemos con la Garantía de Éxito.
          </p>
        </div>
      </section>

      {/* ─── FILTROS + LISTADO (cliente) ─── */}
      {packs.length === 0 ? (
        <section className="max-w-3xl mx-auto px-6 pb-24 text-center">
          <div className="bg-white border border-stone-200 rounded-3xl p-10 md:p-14">
            <div className="text-5xl mb-5">🎁</div>
            <h2 className="font-serif text-2xl md:text-3xl text-ink mb-4">
              No hay packs publicados ahora mismo
            </h2>
            <p className="text-sm md:text-base text-ink/60 leading-relaxed mb-6 max-w-md mx-auto">
              Estamos preparando nuevos packs. Mientras tanto, puedes contarnos qué celebras y
              te montamos un presupuesto a medida en menos de 24h.
            </p>
            <Link href="/contacto"
              className="inline-block bg-coral text-white font-bold px-7 py-3.5 rounded-xl text-sm hover:bg-coral-dark transition-colors shadow-coral">
              Cuéntanos qué celebras →
            </Link>
          </div>
        </section>
      ) : (
        <PacksClient
          packs={packs}
          initialCity={searchParams.ciudad || ''}
          initialDate={searchParams.fecha || ''}/>
      )}

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
