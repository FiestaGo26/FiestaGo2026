import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Garantía de Éxito · FiestaGo',
  description: 'Si tu proveedor te falla, te devolvemos el dinero. Bodas, comuniones, cumpleaños o cualquier celebración — con respaldo económico real.',
  alternates: { canonical: 'https://fiestago.es/garantia' },
  openGraph: {
    title: 'Garantía de Éxito · FiestaGo',
    description: 'Si tu proveedor te falla, te devolvemos el dinero. La única plataforma de eventos en España que responde con su bolsillo.',
    type: 'website',
    url: 'https://fiestago.es/garantia',
  },
}

export default function GarantiaPage() {
  return (
    <main className="bg-cream">

      {/* HERO */}
      <section className="bg-ink text-white py-20 md:py-28">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 text-xs font-bold tracking-[0.22em] uppercase mb-6 bg-coral/95 text-white px-4 py-1.5 rounded-full">
            🛡 Nuestra promesa
          </div>
          <h1 className="font-serif text-4xl md:text-6xl leading-[1.05] tracking-tight mb-6">
            Si algo sale mal,{' '}
            <span className="italic font-light text-coral">respondemos.</span>
          </h1>
          <p className="text-lg md:text-xl text-white/85 leading-relaxed">
            Mientras Bodas.net o Zankyou se desentienden cuando hay un problema, en FiestaGo respaldamos cada reserva con nuestro propio dinero. Esto es exactamente qué cubrimos y cómo.
          </p>
        </div>
      </section>

      {/* PROMESA EN 3 LÍNEAS */}
      <section className="max-w-4xl mx-auto px-6 py-16">
        <div className="grid md:grid-cols-3 gap-5">
          {[
            { num:'48h',  label:'Para resolverte una cancelación', body:'Si tu proveedor cancela, te conseguimos un sustituto equivalente en 48h o te reembolsamos.' },
            { num:'110%', label:'Reembolso máximo',                body:'Si no podemos conseguirte un sustituto, te devolvemos el 110% de lo pagado. No solo el 100%.' },
            { num:'24/7', label:'Pago retenido',                   body:'El dinero del cliente no llega al proveedor hasta que la celebración termina. FiestaGo retiene el escrow.' },
          ].map(c => (
            <div key={c.num} className="bg-white border border-stone-200 rounded-2xl p-6">
              <div className="font-serif text-4xl font-black text-coral mb-2">{c.num}</div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-ink/50 mb-3">{c.label}</div>
              <p className="text-sm text-ink/70 leading-relaxed">{c.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* QUÉ CUBRE */}
      <section className="max-w-4xl mx-auto px-6 py-12">
        <h2 className="font-serif text-3xl md:text-4xl font-black text-ink mb-3">
          Qué cubre la Garantía
        </h2>
        <p className="text-ink/55 mb-8 leading-relaxed">
          Tres escenarios concretos con su acción y compensación. Sin letra pequeña.
        </p>
        <div className="space-y-4">
          {[
            {
              title: 'El proveedor cancela con más de 7 días de antelación',
              action: 'Te conseguimos un sustituto equivalente en menos de 48h, o te devolvemos el 110% del importe que hayas pagado.',
              tag: 'Cubierto',
              tagColor: 'bg-emerald-100 text-emerald-700 border-emerald-200',
            },
            {
              title: 'El proveedor no se presenta o cancela con menos de 7 días',
              action: 'Reembolso del 100% del importe pagado + compensación adicional escalonada según el ticket de la reserva (300€ a 3.000€).',
              tag: 'Cubierto',
              tagColor: 'bg-emerald-100 text-emerald-700 border-emerald-200',
            },
            {
              title: 'Fuerza mayor del cliente (fallecimiento familiar, hospitalización)',
              action: 'Aplazamos tu evento hasta 12 meses sin coste extra, con el mismo proveedor o con uno equivalente.',
              tag: 'Cubierto',
              tagColor: 'bg-emerald-100 text-emerald-700 border-emerald-200',
            },
          ].map(c => (
            <div key={c.title} className="bg-white border border-stone-200 rounded-2xl p-5">
              <div className="flex items-baseline justify-between gap-3 flex-wrap mb-3">
                <h3 className="font-bold text-ink text-base flex-1 min-w-0">{c.title}</h3>
                <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full border ${c.tagColor} whitespace-nowrap`}>
                  ✓ {c.tag}
                </span>
              </div>
              <p className="text-sm text-ink/70 leading-relaxed">{c.action}</p>
            </div>
          ))}
        </div>
      </section>

      {/* TABLA DE COMPENSACIÓN */}
      <section className="max-w-4xl mx-auto px-6 py-12">
        <h2 className="font-serif text-3xl md:text-4xl font-black text-ink mb-3">
          Cuánto recibes si tu proveedor falla
        </h2>
        <p className="text-ink/55 mb-8 leading-relaxed">
          Si tu proveedor no aparece o cancela con menos de 7 días, recibes el reembolso del 100% del importe pagado <strong>más</strong> esta compensación adicional. Escalonada según el precio de la reserva.
        </p>
        <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-card">
          <table className="w-full">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200">
                <th className="text-left p-4 text-xs font-bold text-ink/55 uppercase tracking-widest">Importe de tu reserva</th>
                <th className="text-right p-4 text-xs font-bold text-coral uppercase tracking-widest">Compensación adicional</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['Hasta 500 €',    '300 €'],
                ['500 – 2.000 €',  '500 €'],
                ['2.000 – 5.000 €','1.000 €'],
                ['5.000 – 15.000 €','2.000 €'],
                ['Más de 15.000 €','3.000 €'],
              ].map(([t,c]) => (
                <tr key={t} className="border-b border-stone-100 last:border-0">
                  <td className="p-4 text-sm text-ink/80">{t}</td>
                  <td className="p-4 text-sm text-right font-bold text-coral">{c}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-ink/45 mt-4 leading-relaxed">
          Ejemplo: si reservaste un proveedor por 1.000 € y no se presenta, recibes 1.080 € (reembolso) + 500 € (compensación) = <strong className="text-ink">1.580 €</strong>. La compensación la asume el proveedor que falla, no se carga al resto de la comunidad.
        </p>
      </section>

      {/* QUÉ NO CUBRE */}
      <section className="max-w-4xl mx-auto px-6 py-12">
        <h2 className="font-serif text-3xl md:text-4xl font-black text-ink mb-3">
          Qué no cubre
        </h2>
        <p className="text-ink/55 mb-8 leading-relaxed">
          Honestidad antes que letra pequeña. Estas situaciones quedan fuera de la garantía:
        </p>
        <div className="bg-white border border-stone-200 rounded-2xl p-6">
          <ul className="space-y-3">
            {[
              'Lluvia, viento o clima en eventos al aire libre.',
              'Insatisfacción subjetiva sin incumplimiento objetivo ("no me gustó cómo bailó el DJ", "el mago no era gracioso").',
              'Cambios pedidos por el cliente fuera del alcance contratado originalmente.',
              'Daños causados por invitados a la propiedad del proveedor.',
              'Reclamaciones presentadas más de 14 días después del evento.',
              'Eventos sin reserva confirmada y pagada íntegramente dentro de FiestaGo.',
            ].map(item => (
              <li key={item} className="flex items-start gap-3 text-sm text-ink/70 leading-relaxed">
                <span className="text-stone-400 shrink-0 mt-0.5">✕</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* CÓMO SE ACTIVA */}
      <section className="bg-white border-y border-stone-200 py-16">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="font-serif text-3xl md:text-4xl font-black text-ink mb-3">
            Cómo se activa
          </h2>
          <p className="text-ink/55 mb-10 leading-relaxed">
            Tres pasos. Si pasa lo peor, no tienes que pelearte por nada.
          </p>
          <ol className="space-y-6">
            {[
              { step:'1', title:'Lo reportas desde tu cuenta', body:'En /mi-cuenta tienes un botón "Reportar incidencia" en cada reserva. Cuéntanos qué ha pasado y sube prueba si tienes (capturas del chat, foto, factura externa).' },
              { step:'2', title:'Revisamos en 24h', body:'(4h si es la semana del evento). Verificamos contra los criterios objetivos, contactamos al proveedor y vemos qué solución encaja: sustituto, reembolso o compensación.' },
              { step:'3', title:'Ejecutamos la garantía', body:'Si aplica, hacemos la transferencia de reembolso o te confirmamos el proveedor sustituto. Cierras el caso sin papeles ni teléfonos.' },
            ].map(s => (
              <li key={s.step} className="flex gap-4">
                <div className="font-serif text-3xl font-black text-coral leading-none shrink-0">{s.step}</div>
                <div>
                  <h3 className="font-bold text-ink text-base mb-1">{s.title}</h3>
                  <p className="text-sm text-ink/65 leading-relaxed">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-3xl mx-auto px-6 py-16">
        <h2 className="font-serif text-3xl font-black text-ink text-center mb-10">
          Preguntas habituales
        </h2>
        <div className="space-y-3">
          {[
            ['¿Por qué cobráis al cliente y no al proveedor?',
             'Porque cobrar al cliente como servicio (no como comisión oculta) es lo que nos permite ofrecer la Garantía de Éxito de verdad. Bodas.net y compañía cobran al proveedor cuotas anuales pero no asumen ninguna responsabilidad cuando hay un problema. Nosotros sí.'],
            ['¿Cuánto tarda un reembolso?',
             'Una vez aprobada la incidencia, transferimos en máximo 5 días hábiles. Si la incidencia ocurre la misma semana del evento, lo priorizamos y suele estar en 24-48h.'],
            ['¿Qué pasa si yo (el cliente) cancelo?',
             'Aplica la política de cancelación del servicio que reservaste (flexible, moderada o estricta — viene indicada en cada ficha). El reembolso se calcula según los días que falten para el evento.'],
            ['¿Cubrís bodas Y otros eventos?',
             'Sí. Comuniones, bautizos, cumpleaños infantiles y de adultos, despedidas, eventos privados, eventos corporativos. La Garantía se aplica igual independientemente del tipo de celebración.'],
            ['¿Y si me ofrecen un descuento por pagar fuera de FiestaGo?',
             'Es legítimo que sospeches del proveedor que te lo propone — la Garantía solo cubre lo reservado dentro de FiestaGo. Cualquier pago externo te deja sin red de seguridad y a FiestaGo sin capacidad para mediar.'],
          ].map(([q, a], i) => (
            <details key={i} className="bg-white border border-stone-200 rounded-2xl p-5 group">
              <summary className="font-semibold text-ink cursor-pointer list-none flex items-center justify-between">
                <span>{q}</span>
                <span className="text-coral text-2xl group-open:rotate-45 transition-transform leading-none">+</span>
              </summary>
              <p className="text-ink/65 text-sm leading-relaxed mt-3">{a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-3xl mx-auto px-6 py-16 text-center">
        <h2 className="font-serif text-3xl md:text-4xl font-black text-ink mb-4 leading-tight">
          Reserva tu próxima celebración{' '}
          <span className="italic font-light text-coral">con red de seguridad.</span>
        </h2>
        <p className="text-ink/65 mb-8 max-w-xl mx-auto">
          Bodas, cumpleaños, comuniones o cualquier evento privado. La Garantía de Éxito te acompaña en cada reserva, sin coste extra para el proveedor.
        </p>
        <Link href="/servicios"
          className="inline-block bg-coral text-white font-bold px-10 py-4 rounded-xl hover:bg-coral-dark transition-colors shadow-coral text-lg">
          Buscar proveedores →
        </Link>
        <p className="text-xs text-ink/40 mt-4">
          ¿Dudas? Escribe a <a href="mailto:contacto@fiestago.es" className="text-coral hover:underline">contacto@fiestago.es</a>
        </p>
      </section>

      {/* Nota legal */}
      <section className="max-w-3xl mx-auto px-6 pb-16">
        <div className="bg-stone-100 border border-stone-200 rounded-xl p-5 text-xs text-ink/55 leading-relaxed">
          <strong className="text-ink">Aviso legal.</strong> La Garantía de Éxito FiestaGo solo aplica a reservas realizadas y pagadas íntegramente dentro de la plataforma (canal, comunicación y pago). Las condiciones detalladas y los importes específicos de compensación según ticket están disponibles en los Términos de Servicio. Los reembolsos se procesan al método de pago original. FiestaGo se reserva el derecho de verificar la veracidad de las reclamaciones antes de ejecutar la garantía.
        </div>
      </section>
    </main>
  )
}
