import type { Metadata } from 'next'
import Link from 'next/link'
import { TERMS_VERSION_CURRENT } from '@/lib/terms'

export const metadata: Metadata = {
  title: 'Compromisos del Proveedor · FiestaGo',
  description: 'Lo que aceptas al inscribirte como proveedor en FiestaGo. Seis compromisos prácticos que respaldan nuestra Garantía de Éxito.',
}

export default function CompromisosPage() {
  return (
    <main className="bg-cream min-h-screen py-16 px-6">
      <article className="max-w-2xl mx-auto bg-white border border-stone-200 rounded-3xl p-8 md:p-12 shadow-card">
        <Link href="/profesionales" className="text-xs text-coral hover:underline mb-6 inline-block">← Volver</Link>
        <div className="text-[10px] font-bold tracking-widest uppercase text-coral mb-3">
          Versión {TERMS_VERSION_CURRENT} · Borrador interno
        </div>
        <h1 className="font-serif text-3xl md:text-4xl font-black text-ink mb-3 leading-tight">
          Compromisos del Proveedor en FiestaGo
        </h1>
        <p className="text-ink/55 text-sm leading-relaxed mb-8">
          Esto es lo que firmas al inscribirte. Es corto a propósito y la versión legal definitiva la afinamos con un abogado antes del lanzamiento del 10 de junio. Pero el espíritu es este.
        </p>

        <Section title="Por qué existen estos compromisos">
          FiestaGo le ofrece al cliente una <strong>Garantía de Éxito</strong>: si la celebración no sale bien, le respondemos económicamente. Para poder cumplir esa promesa, necesitamos confiar en que cada proveedor del marketplace respeta unos mínimos. Sin estos compromisos, FiestaGo cobraría una garantía que no podría sostener.
        </Section>

        <Section title="1. Responder en plazo" badge="Aviso → pausa">
          Respondes a cada solicitud de reserva en menos de <strong>48 horas</strong> (24h si la fecha del evento es en menos de 15 días). Si no respondes, la reserva se considera no aceptada y FiestaGo se la pasa a otro proveedor.
          <p className="mt-2 text-xs text-ink/55">Tras 3 no-respuestas en 30 días, tu perfil queda pausado.</p>
        </Section>

        <Section title="2. Cumplir el servicio reservado" badge="Diferencia o baja">
          Entregas exactamente el servicio que aparece en tu ficha y en la reserva confirmada: precio, duración, contenido, extras seleccionados. Lo que el cliente ve es lo que recibe.
          <p className="mt-2 text-xs text-ink/55">Cambios solo con acuerdo explícito por escrito en el chat de FiestaGo. Si incumples, cubrimos la diferencia al cliente y te la facturamos del siguiente pago.</p>
        </Section>

        <Section title="3. Comparecer al evento" badge="No-show: cargo entero + baja">
          Te presentas en la fecha y hora acordadas. Si surge una urgencia legítima, avisas con la máxima antelación posible y FiestaGo busca sustituto.
          <div className="mt-3">
            <p className="text-xs text-ink/55 mb-2">Si no apareces o cancelas con menos de 7 días, el cliente recibe reembolso del 100% más la siguiente compensación, todo descontado de tu próximo payout o facturado directamente:</p>
            <table className="text-xs w-full border border-stone-200 rounded-lg overflow-hidden mt-1">
              <thead className="bg-stone-50 text-ink/55">
                <tr><th className="text-left p-2 font-semibold">Ticket reserva</th><th className="text-right p-2 font-semibold">Compensación que asumes</th></tr>
              </thead>
              <tbody className="text-ink/75">
                {[
                  ['Hasta 500 €',    '300 €'],
                  ['500–2 000 €',    '500 €'],
                  ['2 000–5 000 €',  '1 000 €'],
                  ['5 000–15 000 €', '2 000 €'],
                  ['Más de 15 000 €','3 000 €'],
                ].map(([t,c]) => (
                  <tr key={t} className="border-t border-stone-100">
                    <td className="p-2">{t}</td>
                    <td className="p-2 text-right font-semibold text-coral">{c}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-[11px] text-ink/55 mt-2">Tras una segunda incidencia grave, baja permanente del marketplace.</p>
          </div>
        </Section>

        <Section title="4. Documentos en regla" badge="Pierdes el sello">
          Estás dado de alta como autónomo o empresa, declaras el IVA cuando corresponde, y tienes seguro de responsabilidad civil cuando tu actividad lo requiere (catering, animación con menores, espacios con aforo).
          <p className="mt-2 text-xs text-ink/55">FiestaGo guarda tu DNI/CIF en un bucket privado y lo elimina tras verificarte. Falsificar documentación = baja inmediata.</p>
        </Section>

        <Section title="5. No saltarse FiestaGo" badge="Aviso → baja">
          No contactas al cliente fuera de FiestaGo durante la primera reserva ni le invitas a reservar futuros eventos directamente contigo evitando la plataforma. La Garantía de Éxito solo funciona si toda la conversación y el pago pasan por aquí.
          <p className="mt-2 text-xs text-ink/55">Esto no impide relación comercial natural a largo plazo, una vez completada la reserva. Solo pedimos que la primera reserva por FiestaGo se gestione íntegramente dentro.</p>
        </Section>

        <Section title="6. Mantener la disponibilidad real" badge="Cuenta como no-show">
          Mantienes tu calendario actualizado. No aceptas reservas para fechas en las que ya estabas comprometido por otro canal.
          <p className="mt-2 text-xs text-ink/55">Cada doble-reserva por descuido tuyo cuenta como un no-show (ver punto 3).</p>
        </Section>

        <hr className="my-10 border-stone-200"/>

        <h2 className="font-serif text-2xl font-black text-ink mb-4">Lo que tú recibes a cambio</h2>
        <ul className="space-y-2 text-sm text-ink/75 leading-relaxed">
          <li><strong>Acceso al tráfico de FiestaGo</strong> sin coste fijo (sin cuotas, sin permanencia).</li>
          <li><strong>Tu primera reserva sin coste de servicio</strong> (0% al cliente).</li>
          <li><strong>Cobras el 100% del precio</strong> que pones en tu ficha. La comisión del 8% la paga el cliente como parte de la Garantía de Éxito.</li>
          <li><strong>Sello "Verificado"</strong> visible cuando entregas la documentación.</li>
          <li><strong>Marketing gratuito</strong> en nuestras redes y SEO.</li>
          <li><strong>Garantía operativa</strong>: si un cliente te pide un cambio abusivo, FiestaGo media a tu favor.</li>
          <li><strong>Pago en escrow</strong>: el dinero del cliente queda retenido por FiestaGo hasta que el evento se completa.</li>
        </ul>

        <hr className="my-10 border-stone-200"/>

        <p className="text-xs text-ink/45 leading-relaxed">
          Al inscribirte en FiestaGo confirmas que has leído y aceptas estos seis compromisos. La aceptación queda registrada con tu fecha y la versión del documento. Si actualizamos los compromisos, te pedimos volver a aceptarlos antes de seguir aceptando reservas.
        </p>
      </article>
    </main>
  )
}

function Section({ title, badge, children }: { title: string; badge?: string; children: React.ReactNode }) {
  return (
    <section className="mb-7">
      <div className="flex items-baseline justify-between gap-3 mb-2 flex-wrap">
        <h3 className="font-bold text-ink text-lg">{title}</h3>
        {badge && (
          <span className="text-[10px] font-bold uppercase tracking-widest text-coral bg-coral/10 border border-coral/20 px-2 py-0.5 rounded-full whitespace-nowrap">
            {badge}
          </span>
        )}
      </div>
      <div className="text-sm text-ink/75 leading-relaxed">{children}</div>
    </section>
  )
}
