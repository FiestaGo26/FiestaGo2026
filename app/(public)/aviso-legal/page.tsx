import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Aviso Legal · FiestaGo',
  description: 'Datos identificativos del titular de fiestago.es conforme al artículo 10 de la Ley 34/2002 (LSSICE).',
  alternates: { canonical: 'https://fiestago.es/aviso-legal' },
  robots: { index: true, follow: true },
}

export default function AvisoLegalPage() {
  return (
    <main className="bg-cream min-h-screen py-16 px-6">
      <article className="max-w-2xl mx-auto bg-white border border-stone-200 rounded-3xl p-8 md:p-12 shadow-card">
        <Link href="/" className="text-xs text-coral hover:underline mb-6 inline-block">← Volver al inicio</Link>
        <div className="text-[10px] font-bold tracking-widest uppercase text-coral mb-3">
          Versión 1.0 — Agosto 2026
        </div>
        <h1 className="font-serif text-3xl md:text-4xl font-black text-ink mb-3 leading-tight">
          Aviso Legal
        </h1>
        <p className="text-ink/55 text-sm leading-relaxed mb-10">
          Información legal obligatoria conforme al artículo 10 de la Ley 34/2002 de Servicios de la Sociedad de la Información y Comercio Electrónico (LSSICE).
        </p>

        <Section title="1. Titular del sitio web">
          <p>
            El sitio web <a href="https://fiestago.es" className="text-coral underline">fiestago.es</a> (en adelante, "la Plataforma") es titularidad de <strong>Francisco Mariano González Tejedo</strong>, con NIF <span className="font-mono">{'{'}NIF{'}'}</span>, domicilio profesional en Oviedo (Asturias), España, y correo electrónico de contacto <a href="mailto:contacto@fiestago.es" className="text-coral underline">contacto@fiestago.es</a>.
          </p>
          <p className="text-xs text-ink/50 italic mt-3">
            Estos datos se actualizarán con la constitución de la sociedad operadora en el momento en que se produzca. El NIF aparecerá completo en el próximo despliegue una vez configurada la variable de entorno correspondiente.
          </p>
        </Section>

        <Section title="2. Actividad y objeto del sitio">
          <p>
            FiestaGo es un marketplace en línea que conecta a particulares y empresas que desean contratar servicios para celebraciones y eventos privados con profesionales y empresas proveedoras de dichos servicios. La Plataforma actúa como intermediario entre ambas partes, ofreciendo además una Garantía de Éxito que respalda cada reserva, un pack de herramientas basadas en inteligencia artificial para los proveedores y un sistema de emisión de facturas conforme al Reglamento Verifactu (RD 1007/2023).
          </p>
        </Section>

        <Section title="3. Actividad económica">
          <p>
            La actividad se ejerce como empresario individual (autónomo) dado de alta en los epígrafes IAE correspondientes a servicios digitales y de intermediación electrónica, con las obligaciones fiscales derivadas.
          </p>
        </Section>

        <Section title="4. Condiciones de uso">
          <p>
            El acceso y uso de la Plataforma se rige por los <Link href="/terminos" className="text-coral underline">Términos y Condiciones de Uso</Link>, la <Link href="/privacidad" className="text-coral underline">Política de Privacidad</Link> y la <Link href="/cookies" className="text-coral underline">Política de Cookies</Link>. El uso de la Plataforma implica la aceptación plena y sin reservas de estos textos legales en la versión publicada en cada momento en el sitio web.
          </p>
        </Section>

        <Section title="5. Propiedad intelectual e industrial">
          <p>
            La marca FiestaGo, el logotipo, el nombre de dominio, el diseño de la Plataforma, su código fuente, la estructura de la base de datos, los textos y demás elementos son titularidad del titular indicado en el apartado 1 o de sus licenciantes. Los contenidos publicados por los proveedores (fotografías, descripciones, ficha pública) son titularidad de estos, que otorgan a la Plataforma una licencia no exclusiva de uso para su exhibición y para acciones promocionales del marketplace.
          </p>
          <p>
            Cualquier reproducción, distribución, comunicación pública o transformación total o parcial de los contenidos de la Plataforma sin autorización expresa está prohibida y constituirá infracción de los derechos de propiedad intelectual e industrial.
          </p>
        </Section>

        <Section title="6. Responsabilidad">
          <p>
            El titular no garantiza la disponibilidad continua e ininterrumpida del sitio web, aunque adopta medidas técnicas y organizativas razonables para su correcto funcionamiento. En caso de interrupciones o errores técnicos, se procurará restablecer el servicio a la mayor brevedad.
          </p>
          <p>
            El titular no responde de los daños o perjuicios que pudieran derivarse del uso indebido de la Plataforma por parte de los usuarios, ni del contenido publicado por los proveedores en sus fichas, sin perjuicio de las obligaciones de moderación razonable y de las garantías específicas descritas en los <Link href="/terminos" className="text-coral underline">Términos de Uso</Link>.
          </p>
        </Section>

        <Section title="7. Enlaces a terceros">
          <p>
            La Plataforma puede incluir enlaces a sitios web de terceros (proveedores tecnológicos, redes sociales, autoridades públicas). El titular no controla dichos sitios y no responde de su contenido, política de privacidad o disponibilidad. El acceso a estos sitios queda bajo la exclusiva responsabilidad del usuario.
          </p>
        </Section>

        <Section title="8. Prestadores de servicios técnicos">
          <p>
            Para operar la Plataforma se utilizan los siguientes prestadores, que actúan como encargados del tratamiento conforme a la <Link href="/privacidad" className="text-coral underline">Política de Privacidad</Link>:
          </p>
          <ul className="list-disc pl-5 space-y-1 mt-3">
            <li>Alojamiento y CDN: Netlify (EE. UU. — cláusulas contractuales tipo)</li>
            <li>Base de datos, almacenamiento y autenticación: Supabase (UE)</li>
            <li>Envío de emails transaccionales: Resend (EE. UU. — cláusulas contractuales tipo)</li>
            <li>Inteligencia artificial: Anthropic Claude (EE. UU. — cláusulas contractuales tipo)</li>
            <li>Transcripción de audio: OpenAI Whisper (EE. UU. — cláusulas contractuales tipo)</li>
            <li>Comunicación con clientes: Meta WhatsApp Business API (EE. UU./Irlanda — cláusulas contractuales tipo)</li>
            <li>Sincronización de calendario: Google Calendar API (EE. UU. — cláusulas contractuales tipo)</li>
            <li>Videollamadas: Jitsi Meet (open source, sin registro de cuenta)</li>
            <li>Procesamiento de pagos (cuando se active): Stripe (Irlanda)</li>
          </ul>
        </Section>

        <Section title="9. Legislación aplicable">
          <p>
            La actividad del titular y el uso de la Plataforma se rigen por la legislación española y, en particular, por la Ley 34/2002 (LSSICE), el Reglamento (UE) 2016/679 (RGPD), la Ley Orgánica 3/2018 (LOPDGDD), la Ley General para la Defensa de los Consumidores y Usuarios (RDLeg 1/2007), la Ley 3/2014 sobre contratos con consumidores, el Real Decreto 1007/2023 (Reglamento Verifactu) y el Real Decreto 1619/2012 (Reglamento de Facturación).
          </p>
        </Section>

        <Section title="10. Contacto">
          <p>
            Para cualquier cuestión relacionada con este Aviso Legal o el uso del sitio web, puedes escribir a <a href="mailto:contacto@fiestago.es" className="text-coral underline">contacto@fiestago.es</a>.
          </p>
        </Section>

        <hr className="my-10 border-stone-200"/>

        <p className="text-xs text-ink/60 leading-relaxed">
          <strong className="text-ink">Última actualización:</strong> agosto de 2026.
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
