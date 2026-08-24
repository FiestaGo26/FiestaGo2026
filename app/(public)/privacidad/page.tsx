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
          Versión 1.1 — Agosto 2026
        </div>
        <h1 className="font-serif text-3xl md:text-4xl font-black text-ink mb-3 leading-tight">
          Política de Privacidad
        </h1>
        <p className="text-ink/55 text-sm leading-relaxed mb-10">
          Cómo tratamos tus datos personales conforme al Reglamento (UE) 2016/679 (RGPD) y la LOPDGDD.
        </p>

        <Section title="1. Responsable del tratamiento">
          <p>
            Francisco Mariano González Tejedo, operador de FiestaGo (fiestago.es). Contacto: <a href="mailto:contacto@fiestago.es" className="text-coral underline">contacto@fiestago.es</a>. Los datos identificativos completos figuran en el <Link href="/aviso-legal" className="text-coral underline">Aviso Legal</Link> y se actualizarán con la constitución de la sociedad operadora.
          </p>
        </Section>

        <Section title="2. Datos que tratamos">
          <ul className="list-disc pl-5 space-y-2">
            <li><strong>Clientes:</strong> nombre, apellidos, email, teléfono, datos de la reserva y del evento, comunicaciones en el chat (incluidos mensajes de texto, audio, vídeo, imagen y enlaces a videollamadas), solicitudes de videollamada previa a proveedores, datos de pago (procesados por el proveedor de pagos; FiestaGo no almacena números de tarjeta completos) y facturas emitidas al cliente.</li>
            <li><strong>Proveedores:</strong> datos identificativos y de contacto, DNI/CIF y datos fiscales completos (NIF, nombre fiscal, dirección fiscal, régimen de actividad y de IVA), consentimientos firmados (compromiso de responsabilidad fiscal y, opcionalmente, consentimiento de facturación delegada según art. 5 RD 1619/2012), datos bancarios (incluido el mandato SEPA cuando corresponda), seguro de responsabilidad civil cuando aplica, contenido del perfil público (fotos, servicios, precios), comunicaciones y métricas de actividad. El DNI/CIF se almacena en un repositorio privado y se elimina tras la verificación.</li>
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
                  ['Gestionar el registro, las reservas (incluidos anticipos y pagos divididos), los pagos en depósito, la Garantía de Éxito y las incidencias', 'Ejecución de contrato (art. 6.1.b RGPD)'],
                  ['Verificar la identidad y documentación de los Proveedores', 'Ejecución de contrato e interés legítimo en la seguridad del marketplace'],
                  ['Emitir facturas conforme al Reglamento Verifactu (RD 1007/2023), tanto propias como en régimen de facturación delegada por cuenta del Proveedor (art. 5 RD 1619/2012, previo consentimiento del sujeto pasivo)', 'Obligación legal y ejecución de contrato'],
                  ['Reporte anual DAC7 a la Agencia Tributaria de operaciones realizadas por Proveedores en la Plataforma', 'Obligación legal (Directiva UE 2021/514)'],
                  ['Facilitar videollamadas previas a la reserva entre clientes potenciales y proveedores, y videollamadas post-reserva integradas en el chat de la Plataforma', 'Ejecución de contrato y consentimiento del cliente al enviar la solicitud'],
                  ['Transcribir a texto los mensajes de audio recibidos por WhatsApp de proveedores captados, para permitir que el asistente conversacional los procese', 'Interés legítimo en la eficiencia de la captación'],
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

        <Section title="4. Destinatarios y transferencias internacionales">
          <p>
            Los datos se comunican únicamente a los prestadores necesarios para operar la Plataforma, que actúan como encargados del tratamiento con contrato firmado:
          </p>
          <ul className="list-disc pl-5 space-y-1 mt-3">
            <li>Alojamiento e infraestructura: <strong>Netlify</strong> (EE. UU.)</li>
            <li>Base de datos, almacenamiento y autenticación: <strong>Supabase</strong> (UE)</li>
            <li>Emails transaccionales: <strong>Resend</strong> (EE. UU.)</li>
            <li>Inteligencia artificial (generación de presupuestos, plantillas y posts): <strong>Anthropic Claude</strong> (EE. UU.)</li>
            <li>Transcripción de audio: <strong>OpenAI Whisper</strong> (EE. UU.)</li>
            <li>Mensajería con proveedores captados: <strong>Meta WhatsApp Business API</strong> (EE. UU. / Irlanda)</li>
            <li>Sincronización bidireccional de calendario: <strong>Google Calendar</strong> (EE. UU.), solo cuando el Proveedor lo autoriza expresamente</li>
            <li>Videollamadas: <strong>Jitsi Meet</strong> (open source, comunidad europea 8x8) — la Plataforma solo genera enlaces a salas efímeras, sin registro de cuenta ni almacenamiento de la grabación</li>
            <li>Procesamiento de pagos (cuando se active): <strong>Stripe</strong> (Irlanda)</li>
            <li>Autoridades públicas, cuando exista obligación legal: Agencia Estatal de Administración Tributaria, Agencia Española de Protección de Datos, órganos judiciales</li>
          </ul>
          <p className="mt-3">
            Los prestadores fuera del EEE se someten a cláusulas contractuales tipo aprobadas por la Comisión Europea u otros mecanismos válidos del RGPD. No se ceden datos a terceros con fines comerciales.
          </p>
        </Section>

        <Section title="5. Plazos de conservación">
          <p>
            Los datos se conservan mientras la cuenta esté activa y, tras su cierre, bloqueados durante los plazos de prescripción legal (con carácter general, 6 años a efectos mercantiles y 4 a efectos fiscales). Las facturas emitidas se conservan íntegras junto con su encadenamiento de hash SHA-256 durante el plazo mercantil de 6 años y son inmutables (para anular se emite una factura rectificativa). Los datos de reclamaciones de la Garantía se conservan mientras puedan derivarse responsabilidades.
          </p>
        </Section>

        <Section title="6. Derechos">
          <p>
            Puedes ejercer los derechos de acceso, rectificación, supresión, oposición, limitación y portabilidad escribiendo a <a href="mailto:contacto@fiestago.es" className="text-coral underline">contacto@fiestago.es</a> e identificándote adecuadamente. También puedes presentar una reclamación ante la Agencia Española de Protección de Datos (<a href="https://www.aepd.es" target="_blank" rel="noreferrer" className="text-coral underline">www.aepd.es</a>).
          </p>
          <p className="mt-2 text-xs text-ink/60">
            Nota específica sobre facturas: dado que la ley obliga a su conservación durante los plazos indicados, el ejercicio del derecho de supresión sobre datos incluidos en facturas se limitará al bloqueo (no accesibilidad ordinaria) hasta el vencimiento de dichos plazos.
          </p>
        </Section>

        <Section title="7. Seguridad">
          <p>
            FiestaGo aplica medidas técnicas y organizativas apropiadas: cifrado en tránsito (TLS 1.3), control de accesos con Row Level Security a nivel de base de datos, almacenamiento de documentación sensible en repositorios privados con URLs firmadas de corta duración, eliminación de la documentación identificativa tras la verificación, y separación estricta entre datos de captación (comunicaciones con proveedores no aprobados) y datos operativos.
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
