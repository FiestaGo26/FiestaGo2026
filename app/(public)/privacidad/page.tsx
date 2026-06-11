import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Política de Privacidad · FiestaGo',
  description: 'Cómo trata FiestaGo tus datos personales: finalidades, bases jurídicas, plazos de conservación y tus derechos bajo el RGPD.',
  alternates: { canonical: 'https://fiestago.es/privacidad' },
  robots: { index: true, follow: true },
}

export default function PrivacidadPage() {
  return (
    <main className="bg-cream min-h-screen py-16 px-6">
      <article className="max-w-2xl mx-auto bg-white border border-stone-200 rounded-3xl p-8 md:p-12 shadow-card">
        <Link href="/" className="text-xs text-coral hover:underline mb-6 inline-block">← Volver al inicio</Link>
        <div className="text-[10px] font-bold tracking-widest uppercase text-coral mb-3">
          Versión 1.0 — Junio 2026
        </div>
        <h1 className="font-serif text-3xl md:text-4xl font-black text-ink mb-3 leading-tight">
          Política de Privacidad
        </h1>
        <p className="text-ink/55 text-sm leading-relaxed mb-10">
          Cómo tratamos tus datos personales conforme al Reglamento (UE) 2016/679 (RGPD) y la LOPDGDD.
        </p>

        <Section title="1. Responsable del tratamiento">
          <p>
            Francisco Mariano González Tejedo, operador de FiestaGo (fiestago.es). Contacto: <a href="mailto:contacto@fiestago.es" className="text-coral underline">contacto@fiestago.es</a>. Estos datos se actualizarán con la constitución de la sociedad operadora.
          </p>
        </Section>

        <Section title="2. Datos que tratamos">
          <ul className="list-disc pl-5 space-y-2">
            <li><strong>Clientes:</strong> nombre, apellidos, email, teléfono, datos de la reserva y del evento, comunicaciones en el chat, datos de pago (procesados por el proveedor de pagos; FiestaGo no almacena números de tarjeta completos).</li>
            <li><strong>Proveedores:</strong> datos identificativos y de contacto, DNI/CIF, datos fiscales y bancarios (incluido el mandato SEPA), seguro de responsabilidad civil cuando aplica, contenido del perfil público, comunicaciones y métricas de actividad. El DNI/CIF se almacena en un repositorio privado y se elimina tras la verificación.</li>
            <li><strong>Visitantes de la web:</strong> datos técnicos de navegación conforme a la <Link href="/cookies" className="text-coral underline">Política de Cookies</Link>.</li>
          </ul>
        </Section>

        <Section title="3. Finalidades y legitimación">
          <div className="overflow-x-auto -mx-2">
            <table className="text-xs w-full border border-stone-200 rounded-lg overflow-hidden mt-1">
              <thead className="bg-stone-50 text-ink/55">
                <tr>
                  <th className="text-left p-3 font-semibold">Finalidad</th>
                  <th className="text-left p-3 font-semibold">Base jurídica</th>
                </tr>
              </thead>
              <tbody className="text-ink/75">
                {[
                  ['Gestionar el registro, las reservas, los pagos en depósito, la Garantía de Éxito y las incidencias', 'Ejecución de contrato (art. 6.1.b RGPD)'],
                  ['Verificar la identidad y documentación de los Proveedores', 'Ejecución de contrato e interés legítimo en la seguridad del marketplace'],
                  ['Cargar penalizaciones mediante mandato SEPA', 'Ejecución de contrato'],
                  ['Cumplir obligaciones fiscales, contables y de consumo', 'Obligación legal (art. 6.1.c RGPD)'],
                  ['Enviar comunicaciones comerciales propias', 'Consentimiento (art. 6.1.a RGPD), revocable en cualquier momento'],
                  ['Prevenir el fraude y verificar reclamaciones de la Garantía', 'Interés legítimo (art. 6.1.f RGPD)'],
                ].map(([finalidad, base]) => (
                  <tr key={finalidad} className="border-t border-stone-100 align-top">
                    <td className="p-3">{finalidad}</td>
                    <td className="p-3 text-ink/70">{base}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section title="4. Destinatarios">
          <p>
            Los datos se comunican únicamente a los prestadores necesarios para operar la Plataforma, que actúan como encargados del tratamiento: alojamiento e infraestructura (Netlify, Supabase), envío de emails transaccionales (Resend), procesamiento de pagos y, en su caso, asesores profesionales. Algunos prestadores pueden estar ubicados fuera del EEE; en tal caso, las transferencias se amparan en cláusulas contractuales tipo u otros mecanismos válidos del RGPD. No se ceden datos a terceros con fines comerciales.
          </p>
        </Section>

        <Section title="5. Plazos de conservación">
          <p>
            Los datos se conservan mientras la cuenta esté activa y, tras su cierre, bloqueados durante los plazos de prescripción legal (con carácter general, 6 años a efectos mercantiles y 4 a efectos fiscales). Los datos de reclamaciones de la Garantía se conservan mientras puedan derivarse responsabilidades.
          </p>
        </Section>

        <Section title="6. Derechos">
          <p>
            Puedes ejercer los derechos de acceso, rectificación, supresión, oposición, limitación y portabilidad escribiendo a <a href="mailto:contacto@fiestago.es" className="text-coral underline">contacto@fiestago.es</a> e identificándote adecuadamente. También puedes presentar una reclamación ante la Agencia Española de Protección de Datos (<a href="https://www.aepd.es" target="_blank" rel="noreferrer" className="text-coral underline">www.aepd.es</a>).
          </p>
        </Section>

        <Section title="7. Seguridad">
          <p>
            FiestaGo aplica medidas técnicas y organizativas apropiadas: cifrado en tránsito, control de accesos, almacenamiento de documentación sensible en repositorios privados y eliminación de la documentación identificativa tras la verificación.
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
