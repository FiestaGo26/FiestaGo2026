import type { Metadata } from 'next'
import Link from 'next/link'
import { getBusinessWhatsapp } from '@/lib/whatsapp'

export const metadata: Metadata = {
  title: 'Quiénes somos · FiestaGo',
  description: 'Detrás de FiestaGo hay una persona con nombre y apellidos. Quién responde, cómo contactar y cómo trabajamos.',
  alternates: { canonical: 'https://fiestago.es/quienes-somos' },
}

const PHOTO = '/mariano.jpeg'
const hasPhoto = true
const HOURS = 'De lunes a viernes, de 10:00 a 20:00'

export default async function QuienesSomosPage() {
  const wa = await getBusinessWhatsapp()

  return (
    <main className="bg-cream">

      {/* HERO */}
      <section className="bg-ink text-white py-20 md:py-24">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h1 className="font-serif text-4xl md:text-6xl leading-[1.05] tracking-tight mb-6">
            Detrás de FiestaGo{' '}
            <span className="italic font-light text-coral">hay una persona.</span>
          </h1>
          <p className="text-lg md:text-xl text-white/85 leading-relaxed">
            Con nombre, apellidos y un WhatsApp donde contesta alguien de verdad.
          </p>
        </div>
      </section>

      {/* FUNDADOR */}
      <section className="max-w-4xl mx-auto px-6 py-16">
        <div className="bg-white border border-stone-200 rounded-2xl p-6 md:p-10 grid md:grid-cols-[220px_1fr] gap-8 items-center">
          {hasPhoto ? (
            <img src={PHOTO} alt="Mariano González Tejedo, fundador de FiestaGo"
              className="w-[220px] h-[220px] object-cover rounded-2xl mx-auto" />
          ) : (
            <div aria-hidden="true" className="w-[220px] h-[220px] rounded-2xl mx-auto bg-coral/10 text-coral font-serif text-6xl font-black flex items-center justify-center">MG</div>
          )}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-ink/50 mb-2">Fundador</div>
            <h2 className="font-serif text-3xl md:text-4xl font-black text-ink mb-4">Mariano González Tejedo</h2>
            <div className="space-y-3 text-ink/70 leading-relaxed">
              <p>
                Creé FiestaGo porque organizar una celebración no debería ser pedir diez presupuestos, esperar semanas y
                pagar por adelantado a alguien que no conoces, cruzando los dedos para que aparezca.
              </p>
              <p>
                En FiestaGo cada proveedor tiene su precio a la vista, el pago queda retenido hasta que termina tu evento
                y, si tu proveedor cancela, te buscamos sustituto o te devolvemos el dinero. Si tienes cualquier duda antes
                de reservar, escríbeme: prefiero resolverla contigo que perderte como cliente.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CONTACTO */}
      <section className="max-w-4xl mx-auto px-6 pb-12">
        <h2 className="font-serif text-3xl md:text-4xl font-black text-ink mb-3">Habla con nosotros</h2>
        <p className="text-ink/55 mb-8 leading-relaxed">
          Antes de reservar, pregunta lo que quieras: disponibilidad, qué incluye un servicio o cómo funciona la garantía.
        </p>
        <div className="grid sm:grid-cols-2 gap-5">
          {wa && (
            <a href={wa.link} target="_blank" rel="noopener noreferrer"
              className="bg-white border border-stone-200 rounded-2xl p-6 hover:border-coral transition-colors">
              <div className="text-[10px] font-bold uppercase tracking-widest text-ink/50 mb-2">WhatsApp</div>
              <div className="font-serif text-2xl font-black text-ink">{wa.display}</div>
              <p className="text-sm text-ink/60 mt-2">Te responde una persona del equipo {HOURS.toLowerCase()}. Fuera de ese horario, deja tu mensaje y te contesta nuestro asistente.</p>
            </a>
          )}
          <a href="mailto:contacto@fiestago.es"
            className="bg-white border border-stone-200 rounded-2xl p-6 hover:border-coral transition-colors">
            <div className="text-[10px] font-bold uppercase tracking-widest text-ink/50 mb-2">Email</div>
            <div className="font-serif text-2xl font-black text-ink">contacto@fiestago.es</div>
            <p className="text-sm text-ink/60 mt-2">Para consultas con más detalle o documentación.</p>
          </a>
        </div>
      </section>

      {/* CÓMO TRABAJAMOS */}
      <section className="bg-white border-y border-stone-200 py-16">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="font-serif text-3xl md:text-4xl font-black text-ink mb-8">Cómo trabajamos</h2>
          <div className="grid md:grid-cols-3 gap-5">
            {[
              { t: 'Proveedores verificados', b: 'Antes de publicar a un profesional comprobamos su DNI o CIF y su seguro de responsabilidad civil.' },
              { t: 'Tu dinero, retenido', b: 'Tu pago queda retenido en Stripe, una entidad de pagos regulada, y el proveedor no cobra hasta que termina tu evento.' },
              { t: 'Si algo falla, respondemos', b: 'Si tu proveedor cancela, te buscamos sustituto en 48 h o te devolvemos el 110 %.' },
            ].map(c => (
              <div key={c.t} className="border border-stone-200 rounded-2xl p-6">
                <h3 className="font-bold text-ink mb-2">{c.t}</h3>
                <p className="text-sm text-ink/65 leading-relaxed">{c.b}</p>
              </div>
            ))}
          </div>
          <p className="text-sm text-ink/55 mt-8 leading-relaxed">
            FiestaGo está abierto a celebraciones en toda España y cada semana se suman proveedores nuevos.{' '}
            <Link href="/garantia" className="text-coral underline">Lee la Garantía de Éxito completa</Link>.
          </p>
        </div>
      </section>

      {/* DATOS LEGALES */}
      <section className="max-w-3xl mx-auto px-6 py-16">
        <div className="bg-stone-100 border border-stone-200 rounded-xl p-5 text-sm text-ink/65 leading-relaxed">
          <strong className="text-ink">Datos del titular.</strong> FiestaGo (fiestago.es) es una actividad de
          Francisco Mariano González Tejedo, NIF 09437664M, con domicilio en C/ Turina 6, 33011 Oviedo (Asturias), España.
          Contacto: <a href="mailto:contacto@fiestago.es" className="text-coral underline">contacto@fiestago.es</a>.
          Más información en el <Link href="/aviso-legal" className="text-coral underline">aviso legal</Link>.
        </div>
      </section>
    </main>
  )
}
