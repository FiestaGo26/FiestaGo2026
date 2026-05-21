import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Alternativas a Bodas.net en 2026 — FiestaGo sin cuota anual',
  description: 'Comparativa de Bodas.net, Zankyou y FiestaGo en 2026. Sin cuota anual, sin permanencia, comisión la paga el cliente. Calculadora de ROI para profesionales de bodas y eventos.',
  alternates: { canonical: 'https://fiestago.es/alternativas-bodas-net' },
  openGraph: {
    title: 'Alternativas a Bodas.net en 2026',
    description: 'Marketplace de bodas y eventos sin cuota anual ni permanencia. Tú cobras al 100%, la comisión la paga el cliente.',
    url: 'https://fiestago.es/alternativas-bodas-net',
    type: 'article',
  },
}

// JSON-LD para que Google entienda la página como artículo comparativo.
// Incluye preguntas frecuentes para captar rich snippets.
const JSON_LD = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Article',
      headline: 'Alternativas a Bodas.net en 2026: comparativa para profesionales',
      author: { '@type': 'Person', name: 'Mariano · Fundador FiestaGo' },
      publisher: { '@type': 'Organization', name: 'FiestaGo', url: 'https://fiestago.es' },
      datePublished: '2026-05-21',
      mainEntityOfPage: 'https://fiestago.es/alternativas-bodas-net',
    },
    {
      '@type': 'FAQPage',
      mainEntity: [
        { '@type': 'Question', name: '¿Cuánto cuesta Bodas.net al año?',
          acceptedAnswer: { '@type': 'Answer', text: 'Bodas.net cobra una cuota anual a proveedores que va desde 600€ hasta 2.500€ aproximadamente, según el plan (Básico, Pro, Premium). Esa cuota es independiente de las solicitudes que recibas: la pagas exista o no demanda.' } },
        { '@type': 'Question', name: '¿FiestaGo es gratis para proveedores?',
          acceptedAnswer: { '@type': 'Answer', text: 'Sí, registrarte y mantener tu ficha en FiestaGo es completamente gratis. No hay cuota anual, mensual ni permanencia. Solo cuando recibes una reserva, el cliente paga un 8% adicional como Garantía de Éxito — tú cobras el 100% del precio que pongas en tu ficha.' } },
        { '@type': 'Question', name: '¿Puedo darme de baja en cualquier momento?',
          acceptedAnswer: { '@type': 'Answer', text: 'Sí. En FiestaGo no hay permanencia. Puedes pausar o eliminar tu ficha cuando quieras desde el panel de proveedor, sin coste ni penalización.' } },
        { '@type': 'Question', name: '¿Cuál es la diferencia clave entre FiestaGo y Bodas.net?',
          acceptedAnswer: { '@type': 'Answer', text: 'Bodas.net es un directorio publicitario: pagas por aparecer. FiestaGo es un marketplace transaccional: solo ganas dinero cuando hay reservas reales. Bodas.net cobra al proveedor; FiestaGo cobra al cliente como prima de garantía.' } },
        { '@type': 'Question', name: '¿Qué es la Garantía de Éxito de FiestaGo?',
          acceptedAnswer: { '@type': 'Answer', text: 'Es un seguro incluido en cada reserva, pagado por el cliente (8% extra sobre el precio que tú pongas). Si el proveedor falla — cancela última hora, no aparece, mala calidad — FiestaGo le devuelve económicamente al cliente hasta el 110% del importe. El proveedor cumplidor no paga nada.' } },
      ],
    },
  ],
}

export default function AlternativasBodasNetPage() {
  const launchDays = Math.max(0, Math.ceil((new Date('2026-06-10').getTime() - Date.now()) / 86_400_000))

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}/>

      <main className="bg-cream">
        {/* Hero */}
        <section className="bg-gradient-to-br from-ink via-ink to-coral text-white">
          <div className="max-w-4xl mx-auto px-6 py-14 md:py-20">
            <div className="text-xs font-bold uppercase tracking-[0.25em] opacity-75 mb-3">Comparativa actualizada · {new Date().getFullYear()}</div>
            <h1 className="font-serif text-3xl md:text-5xl font-bold leading-tight tracking-tight">
              Alternativas a Bodas.net en {new Date().getFullYear()}: comparativa real para profesionales
            </h1>
            <p className="text-base md:text-lg opacity-90 mt-4 max-w-2xl leading-relaxed">
              Si te plantea darte de baja porque la cuota anual ya no te compensa, esta comparativa es para ti.
              Sin marketing comercial: precios, modelo de pago, comisiones y qué ofrece cada plataforma en 2026.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/registro-proveedor" className="bg-white text-coral font-bold px-6 py-3 rounded-xl text-sm hover:bg-cream transition-colors">
                Probar FiestaGo gratis →
              </Link>
              <Link href="/profesionales" className="border border-white/40 text-white font-bold px-6 py-3 rounded-xl text-sm hover:bg-white/10 transition-colors">
                Calcular mi ROI
              </Link>
            </div>
          </div>
        </section>

        {/* Tabla comparativa */}
        <section className="max-w-5xl mx-auto px-6 py-12 md:py-16">
          <div className="text-center mb-8">
            <h2 className="font-serif text-2xl md:text-3xl text-ink font-bold">FiestaGo · Bodas.net · Zankyou — cara a cara</h2>
            <p className="text-sm text-ink/55 mt-2">Datos públicos de planes 2025-2026. Bodas.net y Zankyou pertenecen al grupo The Knot Worldwide.</p>
          </div>

          <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="border-b border-stone-200 bg-cream/40">
                    <th className="text-left p-4 text-xs font-bold text-ink/55 uppercase tracking-wide">Característica</th>
                    <th className="text-center p-4">
                      <div className="font-serif text-lg font-bold text-coral">FiestaGo</div>
                      <div className="text-[10px] text-ink/55 uppercase tracking-wide">2026 · España</div>
                    </th>
                    <th className="text-center p-4">
                      <div className="font-serif text-lg font-bold text-ink/70">Bodas.net</div>
                      <div className="text-[10px] text-ink/55 uppercase tracking-wide">The Knot</div>
                    </th>
                    <th className="text-center p-4">
                      <div className="font-serif text-lg font-bold text-ink/70">Zankyou</div>
                      <div className="text-[10px] text-ink/55 uppercase tracking-wide">The Knot</div>
                    </th>
                  </tr>
                </thead>
                <tbody className="text-ink/85">
                  {[
                    { feat: 'Cuota anual', fg: 'Cero', bn: '600 – 2.500€', zk: '500 – 1.800€', highlight: true },
                    { feat: 'Permanencia',  fg: 'No', bn: '12 meses', zk: '12 meses', highlight: true },
                    { feat: 'Pago de la comisión', fg: 'El cliente (8%)', bn: 'Tú, vía cuota', zk: 'Tú, vía cuota' },
                    { feat: 'Lo que cobras por reserva', fg: '100% de tu precio', bn: '100% (cuota ya pagada)', zk: '100% (cuota ya pagada)' },
                    { feat: 'Riesgo si no hay reservas', fg: 'Cero (pago variable)', bn: 'Pierdes la cuota', zk: 'Pierdes la cuota' },
                    { feat: 'Sistema de garantía al cliente', fg: 'Sí, incluida (hasta 110%)', bn: 'No', zk: 'No' },
                    { feat: 'Bloqueo automático de fechas', fg: 'Sí', bn: 'Manual', zk: 'Manual' },
                    { feat: 'Categorías cubiertas', fg: 'Bodas + cumples + comuniones + corp.', bn: 'Solo bodas', zk: 'Solo bodas' },
                    { feat: 'Promoción en redes (@fiestagospain)', fg: 'Incluida', bn: 'Plan Premium', zk: 'Plan Premium' },
                  ].map((row, i) => (
                    <tr key={i} className={`border-b border-stone-100 ${row.highlight ? 'bg-coral/5' : ''}`}>
                      <td className="p-3 px-4 font-semibold text-ink/80">{row.feat}</td>
                      <td className="p-3 px-4 text-center font-semibold text-coral">{row.fg}</td>
                      <td className="p-3 px-4 text-center text-ink/65">{row.bn}</td>
                      <td className="p-3 px-4 text-center text-ink/65">{row.zk}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <p className="text-xs text-ink/45 mt-3 text-center">
            Datos basados en planes públicos. Para el desglose con tus números, usa la <Link href="/profesionales" className="text-coral underline">calculadora de ROI</Link>.
          </p>
        </section>

        {/* Tres argumentos clave */}
        <section className="bg-white border-y border-stone-200 py-12 md:py-16">
          <div className="max-w-5xl mx-auto px-6">
            <h2 className="font-serif text-2xl md:text-3xl text-ink font-bold text-center mb-10">
              Por qué el modelo de FiestaGo es radicalmente diferente
            </h2>
            <div className="grid md:grid-cols-3 gap-5">
              {[
                {
                  icon: '💸', title: 'Cuota cero, riesgo cero',
                  body: 'En Bodas.net o Zankyou pagas entre 600 y 2.500€/año aunque no recibas una sola solicitud. En FiestaGo solo hay coste cuando hay reserva — y lo paga el cliente, no tú. Si tienes un mal año, no pierdes nada.'
                },
                {
                  icon: '🛡️', title: 'Garantía que vende por ti',
                  body: 'Cada reserva en FiestaGo incluye Garantía de Éxito: si algo falla, el cliente recupera hasta el 110%. Cobramos un 8% al cliente para sostenerla. Esa garantía es lo que convierte "interesado" en "pago ya". Bodas.net no la tiene.'
                },
                {
                  icon: '🎯', title: 'Solicitudes cualificadas',
                  body: 'En portales con cuota recibes leads de gente que solo está mirando. En FiestaGo el cliente se compromete económicamente al reservar — son solicitudes que vienen con fecha, datos y prepago. Menos tiempo perdido en presupuestos sin cierre.'
                },
              ].map(c => (
                <div key={c.title} className="bg-cream/60 border border-stone-100 rounded-2xl p-6">
                  <div className="text-3xl mb-3">{c.icon}</div>
                  <h3 className="font-serif text-lg text-ink font-bold mb-2">{c.title}</h3>
                  <p className="text-sm text-ink/70 leading-relaxed">{c.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="max-w-3xl mx-auto px-6 py-12 md:py-16">
          <h2 className="font-serif text-2xl md:text-3xl text-ink font-bold text-center mb-8">Preguntas frecuentes</h2>
          <div className="space-y-3">
            {(JSON_LD['@graph'][1] as any).mainEntity.map((q: any, i: number) => (
              <details key={i} className="bg-white border border-stone-200 rounded-xl overflow-hidden group">
                <summary className="px-5 py-4 cursor-pointer font-semibold text-ink text-sm flex items-center justify-between hover:bg-cream/40">
                  {q.name}
                  <span className="text-coral group-open:rotate-45 transition-transform">+</span>
                </summary>
                <div className="px-5 pb-4 text-sm text-ink/70 leading-relaxed">{q.acceptedAnswer.text}</div>
              </details>
            ))}
          </div>
        </section>

        {/* CTA final */}
        <section className="bg-gradient-to-br from-coral to-coral-dark text-white">
          <div className="max-w-3xl mx-auto px-6 py-14 text-center">
            <div className="text-xs font-bold uppercase tracking-[0.25em] opacity-80 mb-3">
              Faltan {launchDays} días para el lanzamiento
            </div>
            <h2 className="font-serif text-3xl md:text-4xl font-bold leading-tight">
              Únete antes del 10 de junio y entra en el catálogo inicial
            </h2>
            <p className="text-sm md:text-base opacity-90 mt-3 max-w-xl mx-auto">
              Los primeros profesionales tienen mejor posición en los resultados y aparecen destacados sin coste extra.
              Registrarse lleva 60 segundos.
            </p>
            <div className="mt-7 flex flex-wrap gap-3 justify-center">
              <Link href="/registro-proveedor" className="bg-white text-coral font-bold px-6 py-3 rounded-xl text-sm hover:bg-cream transition-colors">
                Inscribirme gratis →
              </Link>
              <Link href="/profesionales" className="border border-white/40 text-white font-bold px-6 py-3 rounded-xl text-sm hover:bg-white/10 transition-colors">
                Saber más
              </Link>
            </div>
          </div>
        </section>
      </main>
    </>
  )
}
