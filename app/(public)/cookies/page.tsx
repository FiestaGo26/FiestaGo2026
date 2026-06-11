import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Política de Cookies · FiestaGo',
  description: 'Qué cookies usa FiestaGo, cuáles necesitan consentimiento y cómo gestionarlas desde tu navegador.',
  alternates: { canonical: 'https://fiestago.es/cookies' },
  robots: { index: true, follow: true },
}

export default function CookiesPage() {
  return (
    <main className="bg-cream min-h-screen py-16 px-6">
      <article className="max-w-2xl mx-auto bg-white border border-stone-200 rounded-3xl p-8 md:p-12 shadow-card">
        <Link href="/" className="text-xs text-coral hover:underline mb-6 inline-block">← Volver al inicio</Link>
        <div className="text-[10px] font-bold tracking-widest uppercase text-coral mb-3">
          Versión 1.0 — Junio 2026
        </div>
        <h1 className="font-serif text-3xl md:text-4xl font-black text-ink mb-3 leading-tight">
          Política de Cookies
        </h1>
        <p className="text-ink/55 text-sm leading-relaxed mb-10">
          Qué cookies usamos en fiestago.es y cómo puedes aceptarlas, rechazarlas o eliminarlas.
        </p>

        <Section title="1. ¿Qué son las cookies?">
          <p>
            Las cookies son pequeños archivos que se almacenan en tu dispositivo al visitar una web. Permiten recordar tus preferencias y entender cómo se usa la página.
          </p>
        </Section>

        <Section title="2. Cookies que utilizamos">
          <ul className="list-disc pl-5 space-y-2">
            <li><strong>Cookies técnicas (necesarias):</strong> imprescindibles para el funcionamiento de la Plataforma — sesión de usuario, autenticación, carrito de reserva y preferencias básicas. No requieren consentimiento.</li>
            <li><strong>Cookies analíticas:</strong> solo se instalan si las aceptas. Nos ayudan a medir el uso de la web de forma agregada para mejorarla.</li>
          </ul>
          <p className="mt-3">FiestaGo no utiliza cookies publicitarias de terceros.</p>
        </Section>

        <Section title="3. Cómo gestionar las cookies">
          <p>
            Puedes aceptar o rechazar las cookies no necesarias desde el aviso de cookies de la web, y eliminar o bloquear las cookies desde la configuración de tu navegador:
          </p>
          <ul className="list-disc pl-5 mt-3 space-y-1">
            <li>Chrome: Configuración → Privacidad y seguridad → Cookies</li>
            <li>Safari: Preferencias → Privacidad</li>
            <li>Firefox: Ajustes → Privacidad y seguridad</li>
          </ul>
          <p className="mt-3">
            Ten en cuenta que bloquear las cookies técnicas puede impedir el funcionamiento de partes de la Plataforma.
          </p>
        </Section>

        <Section title="4. Actualizaciones">
          <p>
            Esta política puede actualizarse para reflejar cambios en las cookies utilizadas. La versión vigente estará siempre publicada en esta página.
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
