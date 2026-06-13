import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Términos y Condiciones de Uso · FiestaGo',
  description: 'Términos y condiciones de uso de FiestaGo, el marketplace de celebraciones en España con Garantía de Éxito.',
  alternates: { canonical: 'https://fiestago.es/terminos' },
  robots: { index: true, follow: true },
}

export default function TerminosPage() {
  return (
    <main className="bg-cream min-h-screen py-16 px-6">
      <article className="max-w-2xl mx-auto bg-white border border-stone-200 rounded-3xl p-8 md:p-12 shadow-card">
        <Link href="/" className="text-xs text-coral hover:underline mb-6 inline-block">← Volver al inicio</Link>
        <div className="text-[10px] font-bold tracking-widest uppercase text-coral mb-3">
          Versión 1.0 — Junio 2026
        </div>
        <h1 className="font-serif text-3xl md:text-4xl font-black text-ink mb-3 leading-tight">
          Términos y Condiciones de Uso
        </h1>
        <p className="text-ink/55 text-sm leading-relaxed mb-10">
          Estas condiciones regulan el uso de FiestaGo (fiestago.es) por parte de Clientes y Proveedores.
        </p>

        <Section title="1. Identificación del titular">
          <p>
            FiestaGo (en adelante, “la Plataforma”) es un servicio operado por Francisco Mariano González Tejedo, con domicilio a efectos de notificaciones en Oviedo (Asturias), España, y correo electrónico de contacto <a href="mailto:contacto@fiestago.es" className="text-coral underline">contacto@fiestago.es</a>. Estos datos se actualizarán con la constitución de la sociedad operadora.
          </p>
        </Section>

        <Section title="2. Objeto">
          <p>
            FiestaGo es un marketplace en línea que conecta a particulares y empresas que desean contratar servicios para celebraciones y eventos privados (“Clientes”) con profesionales y empresas proveedoras de dichos servicios (“Proveedores”). FiestaGo actúa como intermediario: el contrato de prestación del servicio se celebra entre Cliente y Proveedor, sin perjuicio de las garantías que FiestaGo ofrece conforme a estos Términos.
          </p>
        </Section>

        <Section title="3. Registro y cuentas">
          <p>
            Para reservar o publicar servicios es necesario crear una cuenta con datos veraces y mantenerlos actualizados. El usuario es responsable de la confidencialidad de sus credenciales. FiestaGo puede suspender cuentas que incumplan estos Términos, los Compromisos del Proveedor o la legalidad vigente.
          </p>
        </Section>

        <Section title="4. Funcionamiento de las reservas">
          <ol className="list-decimal pl-5 space-y-2">
            <li>El Cliente selecciona un servicio con precio cerrado, fecha y condiciones visibles en la ficha del Proveedor.</li>
            <li>El pago se realiza íntegramente a través de la Plataforma. El importe queda retenido por FiestaGo (pago en depósito o “escrow”) hasta la finalización del evento.</li>
            <li>El Proveedor dispone de un plazo máximo de 48 horas (24 horas si el evento es en menos de 15 días) para aceptar la reserva.</li>
            <li>Confirmada la reserva, Cliente y Proveedor se comunican a través del chat de la Plataforma.</li>
          </ol>
        </Section>

        <Section title="5. Precio y Garantía de Éxito">
          <p>
            El Cliente abona el precio del servicio fijado por el Proveedor más una tarifa de servicio del 8% en concepto de Garantía de Éxito. Esta tarifa da acceso a la cobertura descrita en la página <Link href="/garantia" className="text-coral underline">Garantía de Éxito</Link>, cuyas condiciones forman parte integrante de estos Términos:
          </p>
          <ul className="list-disc pl-5 mt-3 space-y-2">
            <li>Si el Proveedor cancela una reserva confirmada, FiestaGo proporcionará un sustituto equivalente en un máximo de 48 horas o reembolsará al Cliente el 110% del importe pagado.</li>
            <li>Si el Proveedor no se presenta el día del evento, el Cliente recibirá el reembolso del 100% del importe pagado más una compensación adicional de entre 300€ y 3.000€ según el importe de la reserva, conforme a la tabla publicada en la página de la Garantía.</li>
            <li>En caso de fuerza mayor del Cliente debidamente acreditada (fallecimiento de familiar directo, hospitalización), el evento podrá aplazarse hasta 12 meses sin coste adicional.</li>
          </ul>
          <p className="mt-4">
            <strong>Límites y exclusiones.</strong> La Garantía de Éxito aplica exclusivamente a reservas realizadas, comunicadas y pagadas íntegramente dentro de la Plataforma, con un importe máximo cubierto de 25.000€ por reserva. Quedan excluidos los supuestos descritos en el apartado “Qué no cubre” de la página de la Garantía: condiciones meteorológicas en eventos al aire libre, insatisfacción subjetiva sin incumplimiento objetivo, cambios solicitados por el Cliente fuera del alcance contratado, daños causados por invitados, reclamaciones presentadas más de 14 días después del evento y operaciones realizadas total o parcialmente fuera de la Plataforma.
          </p>
        </Section>

        <Section title="6. Cancelación por el Cliente">
          <p>
            Cada servicio indica en su ficha la política de cancelación aplicable (flexible, moderada o estricta). El reembolso se calcula en función de la política aplicable y de los días restantes hasta el evento, y se procesa al método de pago original en un máximo de 5 días hábiles desde su aprobación.
          </p>
        </Section>

        <Section title="7. Obligaciones de los Proveedores">
          <p>
            Los Proveedores aceptan en su registro los <Link href="/proveedor/compromisos" className="text-coral underline">Compromisos del Proveedor</Link>, que forman parte integrante de estos Términos, incluyendo: la veracidad de la documentación aportada, el cumplimiento del servicio en los términos publicados, el régimen de penalizaciones por cancelación o incomparecencia, y la prohibición de derivar la operación fuera de la Plataforma durante la primera reserva.
          </p>
          <p>
            La autorización de domiciliación bancaria (mandato SEPA) necesaria para el cargo de las penalizaciones, cuando no existan payouts pendientes de los que descontarlas, se solicitará al Proveedor de forma separada antes de la confirmación de su primera reserva, no en el momento del registro inicial.
          </p>
        </Section>

        <Section title="8. Pagos a Proveedores">
          <p>
            FiestaGo libera el pago al Proveedor una vez completado el evento sin incidencias, descontando, en su caso, las cantidades adeudadas en virtud de los Compromisos del Proveedor. Las penalizaciones aceptadas constituyen deuda líquida, vencida y exigible.
          </p>
        </Section>

        <Section title="9. Reclamaciones e incidencias">
          <p>
            El Cliente puede reportar incidencias desde su cuenta dentro de los 14 días siguientes al evento. FiestaGo revisará la reclamación en un máximo de 24 horas (4 horas si la incidencia se produce la semana del evento) y resolverá conforme a criterios objetivos, pudiendo solicitar pruebas a ambas partes. FiestaGo se reserva el derecho de verificar la veracidad de las reclamaciones antes de ejecutar la Garantía.
          </p>
        </Section>

        <Section title="10. Propiedad intelectual e industrial">
          <p>
            La marca FiestaGo, el logotipo, el diseño de la Plataforma y sus contenidos son titularidad de FiestaGo o de sus licenciantes. Los Proveedores conservan la titularidad de las imágenes y textos que publican y otorgan a FiestaGo una licencia no exclusiva para su uso en la Plataforma y en acciones promocionales de la misma.
          </p>
        </Section>

        <Section title="11. Responsabilidad">
          <p>
            FiestaGo no es parte del contrato de prestación de servicios entre Cliente y Proveedor, sin perjuicio de la Garantía de Éxito. FiestaGo no responde de daños indirectos ni de supuestos excluidos de la Garantía. Nada en estos Términos limita los derechos irrenunciables que la legislación de consumidores reconoce al Cliente.
          </p>
        </Section>

        <Section title="12. Protección de datos">
          <p>
            El tratamiento de datos personales se rige por la <Link href="/privacidad" className="text-coral underline">Política de Privacidad</Link>.
          </p>
        </Section>

        <Section title="13. Modificaciones">
          <p>
            FiestaGo podrá modificar estos Términos publicando la nueva versión en esta página. Los cambios relevantes se comunicarán a los usuarios registrados. La versión aplicable a cada reserva será la vigente en el momento de su confirmación.
          </p>
        </Section>

        <Section title="14. Ley aplicable y jurisdicción">
          <p>
            Estos Términos se rigen por la legislación española. Para los consumidores, será competente el juzgado de su domicilio. La Comisión Europea pone a disposición una plataforma de resolución de litigios en línea: <a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noreferrer" className="text-coral underline">ec.europa.eu/consumers/odr</a>
          </p>
        </Section>

        <hr className="my-10 border-stone-200"/>

        <p className="text-xs text-ink/60 leading-relaxed">
          <strong className="text-ink">Contacto:</strong> <a href="mailto:contacto@fiestago.es" className="text-coral underline">contacto@fiestago.es</a>
        </p>
      </article>
    </main>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="font-bold text-ink text-lg mb-3">{title}</h2>
      <div className="text-sm text-ink/75 leading-relaxed space-y-2">{children}</div>
    </section>
  )
}
