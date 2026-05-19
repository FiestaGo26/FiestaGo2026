'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'

// Cuotas medias estimadas de Bodas.net Premium (públicas, varían según ciudad).
// Mantener actualizado anualmente.
const BODAS_NET_ANNUAL_FEE = 3000  // €, cuota anual media Premium
const ZANKYOU_ANNUAL_FEE   = 2500  // €, equivalente
const FIESTAGO_COMMISSION  = 0.08  // 8% que paga el cliente, no el proveedor

export default function ProfesionalesPage() {
  const [ticket,   setTicket]   = useState(1500)
  const [bookings, setBookings] = useState(12)

  const facturado = ticket * bookings

  // En Bodas.net pagas la cuota fija ganes lo que ganes. Recibes el 100% del
  // precio acordado con el cliente menos la cuota (que se paga aparte).
  const bodasNetNeto = facturado - BODAS_NET_ANNUAL_FEE

  // En FiestaGo cobras el 100% que pones en tu ficha. El cliente paga un 8%
  // extra sobre tu precio (que cubre la Garantía de Éxito). Tú no pagas nada.
  const fiestagoNeto = facturado

  const ahorroAnual = fiestagoNeto - bodasNetNeto
  const ahorroPct   = facturado > 0 ? (ahorroAnual / facturado) * 100 : 0

  return (
    <main className="bg-cream min-h-screen">
      {/* HERO */}
      <section className="max-w-5xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="inline-block text-xs font-bold tracking-widest uppercase text-coral bg-coral/10 border border-coral/20 px-3 py-1 rounded-full mb-6">
          Para profesionales de eventos
        </div>
        <h1 className="font-serif text-4xl md:text-5xl font-black text-ink mb-5 leading-tight">
          Tu trabajo merece más que una <span className="italic font-light">cuota mensual</span>.
        </h1>
        <p className="text-ink/65 text-lg max-w-2xl mx-auto leading-relaxed">
          En FiestaGo cobras <strong className="text-ink">el 100% del precio que pones</strong>.
          Sin cuotas, sin permanencia. La comisión la paga el cliente como parte
          de la Garantía de Éxito.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/registro-proveedor"
            className="bg-coral text-white font-bold px-7 py-3.5 rounded-xl hover:bg-coral-dark transition-colors shadow-coral">
            Inscríbete en 60 segundos →
          </Link>
          <a href="#calculadora"
            className="border border-stone-300 text-ink font-semibold px-7 py-3.5 rounded-xl hover:border-coral hover:text-coral transition-colors">
            Calcular cuánto ahorras
          </a>
        </div>
      </section>

      {/* COMPARATIVA */}
      <section className="max-w-5xl mx-auto px-6 py-12">
        <h2 className="font-serif text-3xl font-black text-ink text-center mb-3">
          FiestaGo vs el resto
        </h2>
        <p className="text-ink/55 text-center max-w-2xl mx-auto mb-10">
          La diferencia no es solo precio. Es modelo entero.
        </p>
        <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200">
                <th className="text-left p-4 font-bold text-ink"></th>
                <th className="p-4 font-bold text-coral bg-coral/5">FiestaGo</th>
                <th className="p-4 font-bold text-ink/50">Bodas.net</th>
                <th className="p-4 font-bold text-ink/50">Zankyou</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['Cuota anual',                'Sin cuota',                  '≈ 3.000 €/año',    '≈ 2.500 €/año'],
                ['¿Quién paga comisión?',      'El cliente',                 'No hay (lead-gen)', 'No hay (lead-gen)'],
                ['¿Cobras el 100%?',           'Sí',                         'Sí (pero pagas cuota)', 'Sí (pero pagas cuota)'],
                ['Permanencia',                'Ninguna',                    '1 año',            '1 año'],
                ['Cobro de la reserva',        'Escrow en FiestaGo',         'Fuera de plataforma','Fuera de plataforma'],
                ['Garantía al cliente',        'Sí, hasta 110%',             'Ninguna',          'Ninguna'],
                ['Tipo de eventos',            'Todas las celebraciones',    'Solo bodas',       'Solo bodas'],
                ['Verificación de proveedores','DNI/CIF + sello',            'No',               'No'],
                ['Chat con el cliente',        'Integrado, con histórico',   'Email/teléfono',   'Email/teléfono'],
              ].map(([feature, fg, bnet, zank], i) => (
                <tr key={i} className="border-b border-stone-100 last:border-0">
                  <td className="p-4 font-semibold text-ink/80">{feature}</td>
                  <td className="p-4 text-coral font-bold bg-coral/5">{fg}</td>
                  <td className="p-4 text-ink/60">{bnet}</td>
                  <td className="p-4 text-ink/60">{zank}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-ink/40 text-center mt-3">
          Cuotas estimadas basadas en información pública de las plataformas, actualizado mayo 2026.
        </p>
      </section>

      {/* CALCULADORA */}
      <section id="calculadora" className="max-w-3xl mx-auto px-6 py-16">
        <h2 className="font-serif text-3xl font-black text-ink text-center mb-3">
          ¿Cuánto ganarías de más?
        </h2>
        <p className="text-ink/55 text-center mb-10">
          Mete tu ticket medio y cuántas reservas haces al año. Calculamos
          la diferencia.
        </p>

        <div className="bg-white border border-stone-200 rounded-3xl p-8 shadow-card">
          <div className="grid sm:grid-cols-2 gap-6 mb-8">
            <div>
              <label className="block text-xs font-bold text-ink/50 uppercase tracking-widest mb-2">
                Ticket medio por reserva
              </label>
              <div className="flex items-center gap-2">
                <input type="number" value={ticket} min={50} max={50000} step={50}
                  onChange={e => setTicket(parseInt(e.target.value) || 0)}
                  className="flex-1 border border-stone-200 rounded-xl px-4 py-3 text-lg font-bold text-ink outline-none focus:border-coral"/>
                <span className="text-ink/50 font-bold">€</span>
              </div>
              <input type="range" min={100} max={20000} step={100} value={ticket}
                onChange={e => setTicket(parseInt(e.target.value))}
                className="w-full mt-3 accent-coral"/>
            </div>
            <div>
              <label className="block text-xs font-bold text-ink/50 uppercase tracking-widest mb-2">
                Reservas al año
              </label>
              <div className="flex items-center gap-2">
                <input type="number" value={bookings} min={1} max={300} step={1}
                  onChange={e => setBookings(parseInt(e.target.value) || 0)}
                  className="flex-1 border border-stone-200 rounded-xl px-4 py-3 text-lg font-bold text-ink outline-none focus:border-coral"/>
              </div>
              <input type="range" min={1} max={100} step={1} value={bookings}
                onChange={e => setBookings(parseInt(e.target.value))}
                className="w-full mt-3 accent-coral"/>
            </div>
          </div>

          <div className="bg-coral/5 border-2 border-coral/30 rounded-2xl p-6 text-center">
            <div className="text-xs text-coral uppercase tracking-widest font-bold mb-3">
              Diferencia anual con FiestaGo
            </div>
            <div className="font-serif text-5xl font-black text-coral mb-2">
              +{ahorroAnual.toLocaleString('es-ES', { maximumFractionDigits: 0 })}€
            </div>
            <div className="text-sm text-ink/65">
              {ahorroPct > 0
                ? `Te quedas con un ${ahorroPct.toFixed(1)}% más de lo que facturas`
                : 'Con poco volumen el ahorro es menor — pero sigues sin pagar cuota'}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-6 text-sm">
            <div className="bg-stone-50 border border-stone-200 rounded-xl p-4">
              <div className="text-[10px] font-bold text-ink/45 uppercase tracking-widest mb-2">En Bodas.net</div>
              <div className="text-2xl font-bold text-ink">{bodasNetNeto.toLocaleString('es-ES')}€</div>
              <div className="text-xs text-ink/55 mt-1">
                {facturado.toLocaleString('es-ES')}€ facturado − {BODAS_NET_ANNUAL_FEE.toLocaleString('es-ES')}€ cuota
              </div>
            </div>
            <div className="bg-coral/5 border-2 border-coral/30 rounded-xl p-4">
              <div className="text-[10px] font-bold text-coral uppercase tracking-widest mb-2">En FiestaGo</div>
              <div className="text-2xl font-bold text-coral">{fiestagoNeto.toLocaleString('es-ES')}€</div>
              <div className="text-xs text-ink/55 mt-1">
                100% del precio. El cliente paga {(facturado * FIESTAGO_COMMISSION).toLocaleString('es-ES', { maximumFractionDigits: 0 })}€ extra como Garantía de Éxito
              </div>
            </div>
          </div>

          <div className="mt-8 text-center">
            <Link href="/registro-proveedor"
              className="inline-block bg-coral text-white font-bold px-8 py-4 rounded-xl hover:bg-coral-dark transition-colors shadow-coral">
              Inscríbete ahora — 60 segundos →
            </Link>
            <p className="text-xs text-ink/40 mt-3">
              Sin tarjeta, sin compromiso. Cancela cuando quieras.
            </p>
          </div>
        </div>
      </section>

      {/* GARANTÍA DE ÉXITO */}
      <section className="max-w-4xl mx-auto px-6 py-16">
        <div className="bg-ink text-white rounded-3xl p-10 md:p-14">
          <div className="text-xs font-bold tracking-widest uppercase text-coral mb-4">🛡 Garantía de Éxito</div>
          <h2 className="font-serif text-3xl md:text-4xl font-black mb-4 leading-tight">
            Por qué los clientes pagan más en FiestaGo
          </h2>
          <p className="text-white/70 leading-relaxed mb-6 max-w-2xl">
            Al cliente le cobramos un 8% extra sobre tu precio. A cambio,
            tiene la Garantía de Éxito: si algo sale mal —tu cancelas en
            el último momento, no apareces, o no se entrega lo prometido—
            le respondemos económicamente.
          </p>
          <p className="text-white/70 leading-relaxed mb-6 max-w-2xl">
            Eso es lo que nos diferencia de Bodas.net y compañía:
            <strong className="text-white"> nosotros tomamos responsabilidad</strong>.
            Y por eso el cliente paga por reservar con confianza, no solo
            por encontrar tu nombre.
          </p>
          <p className="text-white/70 leading-relaxed max-w-2xl">
            Para ti significa: clientes que vienen con intención real
            de reservar, no comparando 30 presupuestos sin saber a quién
            elegir.
          </p>
        </div>
      </section>

      {/* FAQ corto */}
      <section className="max-w-3xl mx-auto px-6 py-16">
        <h2 className="font-serif text-3xl font-black text-ink text-center mb-10">
          Preguntas habituales
        </h2>
        <div className="space-y-4">
          {[
            ['¿Cuánto me cuesta entrar?',
             'Nada. Ni cuota ni alta. Solo se aplica una comisión del 8% (pagada por el cliente) cuando hay reserva real. La primera reserva es 0% — la regalamos para que veas cómo va.'],
            ['¿Tengo que cambiar mi forma de trabajar?',
             'No. Sigues haciendo tu trabajo como siempre. FiestaGo te trae clientes, gestiona el pago y te protege con la mediación si algo se complica. Tú decides qué reservas aceptas.'],
            ['¿Y si un cliente intenta saltarse FiestaGo?',
             'La Garantía de Éxito solo aplica si la reserva se gestiona dentro de la plataforma. Esto te protege a ti también: si el cliente intenta no pagarte después, tienes a FiestaGo de testigo y arbitraje.'],
            ['¿Cuándo cobro?',
             'Cuando se completa el evento. Mantenemos el pago en escrow para que el cliente no pueda echarse atrás sin causa. Te transferimos en 5 días tras la celebración.'],
            ['¿Puedo darme de baja cuando quiera?',
             'Sí. Sin permanencia, sin cláusulas raras. Si en algún momento no te encaja, te vas y listo.'],
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

      {/* CTA final */}
      <section className="max-w-3xl mx-auto px-6 py-16 text-center">
        <h2 className="font-serif text-3xl md:text-4xl font-black text-ink mb-4 leading-tight">
          Lanzamiento el <span className="italic font-light">10 de junio</span>.
          Entra antes y te llevas el sello fundador.
        </h2>
        <p className="text-ink/65 mb-8 max-w-xl mx-auto">
          Los primeros profesionales que se inscriban tendrán visibilidad
          destacada, sello "Fundador" en su ficha y onboarding personal
          conmigo. Te lleva 60 segundos.
        </p>
        <Link href="/registro-proveedor"
          className="inline-block bg-coral text-white font-bold px-10 py-4 rounded-xl hover:bg-coral-dark transition-colors shadow-coral text-lg">
          Inscríbete ahora →
        </Link>
        <p className="text-xs text-ink/40 mt-4">
          ¿Dudas? Escribe a <a href="mailto:contacto@fiestago.es" className="text-coral hover:underline">contacto@fiestago.es</a>
        </p>
      </section>
    </main>
  )
}
