import type { Metadata } from 'next'
import Link from 'next/link'
import { TERMS_VERSION_CURRENT } from '@/lib/terms'

export const metadata: Metadata = {
  title: 'Compromisos del Proveedor · FiestaGo',
  description: 'Lo que aceptas al inscribirte como proveedor en FiestaGo. Ocho compromisos prácticos que respaldan nuestra Garantía de Éxito y el sistema legal de facturación.',
}

export default function CompromisosPage() {
  return (
    <main className="bg-cream min-h-screen py-16 px-6">
      <article className="max-w-2xl mx-auto bg-white border border-stone-200 rounded-3xl p-8 md:p-12 shadow-card">
        <Link href="/profesionales" className="text-xs text-coral hover:underline mb-6 inline-block">← Volver</Link>
        <div className="text-[10px] font-bold tracking-widest uppercase text-coral mb-3">
          Versión {TERMS_VERSION_CURRENT} — Agosto 2026
        </div>
        <h1 className="font-serif text-3xl md:text-4xl font-black text-ink mb-3 leading-tight">
          Compromisos del Proveedor en FiestaGo
        </h1>
        <p className="text-ink/55 text-sm leading-relaxed mb-8">
          Esto es lo que aceptas al inscribirte. Es corto a propósito, para que lo leas de verdad.
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

        <Section title="3. Comparecer al evento" badge="Lo importante: que el evento se celebre">
          Te presentas en la fecha y hora acordadas. Si necesitas cancelar una reserva confirmada, avisas lo antes posible y colaboras con FiestaGo en encontrar un sustituto — puedes incluso proponer tú a un profesional de confianza que cumpla nuestros requisitos.

          <p className="mt-3"><strong>Si se encuentra sustituto, no asumes penalización.</strong> Solo cubres la diferencia de precio si el sustituto es más caro que tu servicio.</p>

          <p className="mt-3"><strong>Si no se encuentra sustituto, asumes la penalización que financia la garantía al cliente:</strong></p>

          <table className="text-xs w-full border border-stone-200 rounded-lg overflow-hidden mt-2">
            <thead className="bg-stone-50 text-ink/55">
              <tr>
                <th className="text-left p-2 font-semibold">Cuándo cancelaste</th>
                <th className="text-right p-2 font-semibold">Penalización</th>
              </tr>
            </thead>
            <tbody className="text-ink/75">
              {[
                ['Más de 30 días antes',   '15% del ticket (mínimo 75€)'],
                ['Entre 7 y 30 días',      '25% del ticket (mínimo 150€)'],
                ['Menos de 7 días',        'Compensación según tabla: 300€ – 3.000€'],
              ].map(([t,c]) => (
                <tr key={t} className="border-t border-stone-100">
                  <td className="p-2">{t}</td>
                  <td className="p-2 text-right font-semibold text-coral">{c}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <p className="mt-4"><strong>Si no te presentas al evento (no-show), la penalización aplica siempre</strong> — compensación según tabla + baja tras la 2ª incidencia.</p>

          <p className="mt-3 text-xs text-ink/55">Tabla de compensaciones para cancelación con menos de 7 días o no-show:</p>
          <table className="text-xs w-full border border-stone-200 rounded-lg overflow-hidden mt-1">
            <thead className="bg-stone-50 text-ink/55">
              <tr>
                <th className="text-left p-2 font-semibold">Ticket reserva</th>
                <th className="text-right p-2 font-semibold">Compensación que asumes</th>
              </tr>
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

          <p className="mt-4 text-xs text-ink/55">
            La acumulación de 3 cancelaciones en 12 meses, aunque se haya encontrado sustituto, supone la pausa de tu perfil. Las penalizaciones se descuentan de tu próximo payout o se cargan en el método de pago vinculado a tu cuenta, y constituyen deuda líquida, vencida y exigible a favor de FiestaGo. Las urgencias de fuerza mayor acreditadas (hospitalización, fallecimiento familiar directo) se valoran caso por caso sin penalización automática.
          </p>
        </Section>

        <Section title="4. Documentos en regla" badge="Pierdes el sello">
          Aportas DNI/NIE o CIF veraces cuando FiestaGo te los solicita para verificar tu identidad y otorgarte el sello Verificado. Cuando tu actividad lo requiere (catering, animación con menores, espacios con aforo), aportas también seguro de responsabilidad civil vigente.
          <p className="mt-2 text-xs text-ink/55">FiestaGo guarda tu DNI/CIF en un bucket privado y lo elimina tras verificarte. Falsificar documentación = baja inmediata.</p>
          <p className="mt-3 text-xs text-ink/55">Antes de tu primera reserva confirmada, te pediremos firmar una domiciliación bancaria (mandato SEPA) para poder cargar, si llegara el caso, las penalizaciones del punto 3 cuando no existan payouts pendientes. En el momento del registro no necesitamos este dato — solo cuando estés a punto de aceptar tu primera reserva pagada.</p>
        </Section>

        <Section title="5. No saltarse FiestaGo" badge="Aviso → baja">
          No contactas al cliente fuera de FiestaGo durante la primera reserva ni le invitas a reservar futuros eventos directamente contigo evitando la plataforma. La Garantía de Éxito solo funciona si toda la conversación y el pago pasan por aquí.
          <p className="mt-2 text-xs text-ink/55">Esto no impide relación comercial natural a largo plazo, una vez completada la reserva. Solo pedimos que la primera reserva por FiestaGo se gestione íntegramente dentro.</p>
        </Section>

        <Section title="6. Mantener la disponibilidad real" badge="Cuenta como no-show">
          Mantienes tu calendario actualizado. No aceptas reservas para fechas en las que ya estabas comprometido por otro canal.
          <p className="mt-2 text-xs text-ink/55">Cada doble-reserva por descuido tuyo cuenta como un no-show (ver punto 3).</p>
        </Section>

        <Section title="7. Flexibilidad ante fuerza mayor del cliente" badge="Colaboración en reprogramación">
          Si el cliente sufre una causa de fuerza mayor (fallecimiento familiar directo, hospitalización), FiestaGo le permite aplazar el evento hasta 12 meses. Te comprometes a ofrecer una fecha alternativa razonable o, si no tienes disponibilidad, a facilitar que FiestaGo te sustituya sin penalización para nadie.
        </Section>

        <Section title="8. Estar de alta el día de emitir factura" badge="Imprescindible para cobrar">
          <p>
            <strong>Para cobrar cualquier reserva a través de FiestaGo debes estar dado de alta ese día en Hacienda (declaración censal 036) y en la Seguridad Social (RETA), o disponer del régimen equivalente</strong>. La responsabilidad fiscal y de Seguridad Social es exclusivamente tuya — FiestaGo actúa como plataforma intermediaria, no como empleador ni como colaborador fiscal.
          </p>

          <p className="mt-3">Cualquiera de estas opciones te permite facturar en la Plataforma:</p>
          <ul className="list-disc pl-5 mt-2 space-y-1 text-sm">
            <li><strong>Autónomo permanente</strong> (alta RETA todo el año)</li>
            <li><strong>Autónomo por días puntuales</strong> — te das de alta solo los días que emites factura o prestas servicio. Es lo más habitual en el sector eventos y perfectamente legal en España.</li>
            <li><strong>Sociedad</strong> con CIF (SL, SLU, SA, SLNE)</li>
            <li><strong>Cooperativa de facturación</strong></li>
          </ul>

          <p className="mt-4"><strong>Cuidado con las reservas de pago dividido:</strong> si tu servicio tiene anticipo configurado y el evento es a más de 60 días, se emiten <strong>dos facturas</strong> — una al reservar (por el anticipo) y otra al cobrar el resto, dos meses antes del evento. Si trabajas como autónomo por días puntuales, tienes que estar de alta AMBOS días. Si tu servicio no tiene anticipo, o si el evento es a menos de 60 días, se emite una sola factura y basta con estar de alta ese día.</p>

          <p className="mt-4"><strong>Facturación delegada (opcional).</strong> Puedes autorizar a FiestaGo a emitir facturas en tu nombre desde tus datos fiscales del panel, según el artículo 5 del Real Decreto 1619/2012. Cuando lo activas, nosotros generamos las facturas Verifactu (RD 1007/2023) por ti y las guardamos con hash SHA-256 encadenado, QR de verificación AEAT y numeración correlativa. Esto es una comodidad técnica — <strong>tú sigues siendo el sujeto pasivo</strong> y la obligación de estar dado de alta el día de la factura sigue siendo tuya. Puedes activarlo y desactivarlo cuando quieras.</p>

          <p className="mt-4"><strong>Cumplimiento DAC7.</strong> Al aceptar estos compromisos autorizas a FiestaGo a incluir tus datos fiscales y el importe agregado de tus reservas en el reporte anual DAC7 a la Agencia Tributaria, según la Directiva (UE) 2021/514 sobre plataformas digitales.</p>

          <p className="mt-4 text-xs text-ink/55">
            Si emitiéramos una factura en tu nombre (delegada) para una reserva en la que resultase que no estabas de alta ese día, la responsabilidad ante Hacienda y la Seguridad Social recae íntegramente sobre ti. FiestaGo se reserva el derecho a suspender la facturación delegada si detecta incumplimientos fiscales reiterados y a retener los payouts hasta la regularización.
          </p>
        </Section>

        <hr className="my-10 border-stone-200"/>

        <h2 className="font-serif text-2xl font-black text-ink mb-4">Lo que tú recibes a cambio</h2>
        <ul className="space-y-2 text-sm text-ink/75 leading-relaxed">
          <li><strong>Acceso al tráfico de FiestaGo</strong> sin coste fijo (sin cuotas, sin permanencia).</li>
          <li><strong>Cobras el 100% del precio</strong> que pones en tu ficha. La comisión del 8% la paga el cliente como parte de la Garantía de Éxito.</li>
          <li><strong>Sello "Verificado"</strong> visible cuando entregas la documentación.</li>
          <li><strong>Marketing gratuito</strong> en nuestras redes y SEO.</li>
          <li><strong>Garantía operativa</strong>: si un cliente te pide un cambio abusivo, FiestaGo media a tu favor.</li>
          <li><strong>Pago en escrow</strong>: el dinero del cliente queda retenido por FiestaGo hasta que el evento se completa.</li>
        </ul>

        <hr className="my-10 border-stone-200"/>

        <p className="text-xs text-ink/45 leading-relaxed">
          Al inscribirte en FiestaGo confirmas que has leído y aceptas estos <strong>ocho compromisos</strong>, <strong>incluidas las penalizaciones económicas del punto 3</strong> y la obligación fiscal del punto 8 (estar dado de alta el día de emitir factura). La aceptación queda registrada con tu fecha y la versión del documento. Si actualizamos los compromisos, te pedimos volver a aceptarlos antes de seguir aceptando reservas. La autorización de domiciliación bancaria (mandato SEPA) se solicitará por separado antes de tu primera reserva confirmada, no en este momento.
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
