import { createAdminClient } from '@/lib/supabase'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import PayFirstButton from './PayFirstButton'

// Página cliente para pagar el primer tramo (anticipo o 100%) de una
// reserva ya confirmada por el proveedor. La URL viene en el email de
// confirmación de reserva:
//   /pago-inicial/{bookingId}?email={client_email}
//
// Autenticación soft por email (mismo patrón que /pago-restante).
// Cuando Stripe esté vivo, este mismo componente disparará el checkout
// real. En modo TEST usa /api/mock/pay-first para simular.

export const dynamic = 'force-dynamic'

const EUR = (n: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 }).format(n)

const dateEs = (d: string | Date) =>
  new Date(d).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })

export default async function PagoInicialPage({
  params,
  searchParams,
}: {
  params: Promise<{ bookingId: string }>
  searchParams: Promise<{ email?: string }>
}) {
  const { bookingId } = await params
  const { email } = await searchParams

  const supabase = createAdminClient()
  const { data: booking } = await supabase
    .from('bookings')
    .select('*, providers(id, name, email, photo_url)')
    .eq('id', bookingId)
    .maybeSingle()

  if (!booking) notFound()

  // Verificación soft por email en la URL
  if (email && String(email).toLowerCase() !== String(booking.client_email).toLowerCase()) {
    return (
      <main className="min-h-screen bg-cream grid place-items-center px-6">
        <div className="max-w-md text-center">
          <div className="text-5xl mb-4">🔒</div>
          <h1 className="font-serif text-2xl text-ink mb-2">Enlace no válido</h1>
          <p className="text-ink/60 text-sm">El email no coincide con el titular de la reserva. Comprueba el enlace del email que te enviamos.</p>
        </div>
      </main>
    )
  }

  const provider = booking.providers
  const status = booking.first_payment_status
  const alreadyPaid  = status === 'paid'
  const wasCancelled = booking.status === 'cancelled'
  const amount       = Number(booking.first_payment_amount || 0)
  const totalAmount  = Number(booking.total_amount || 0)
  const secondAmount = Number(booking.second_payment_amount || 0)
  const hasSplit     = secondAmount > 0

  return (
    <main className="min-h-screen bg-cream py-16 px-6">
      <div className="max-w-lg mx-auto">
        <Link href="/mi-cuenta" className="text-xs text-coral hover:underline mb-6 inline-block">
          ← Ir a Mi cuenta
        </Link>

        <div className="bg-white border border-stone-200 rounded-3xl overflow-hidden shadow-card">
          <div className="p-6 md:p-8 border-b border-stone-200">
            <div className="text-[10px] font-bold tracking-widest uppercase text-coral mb-2">
              {hasSplit ? 'Pagar anticipo' : 'Pagar tu reserva'}
            </div>
            <h1 className="font-serif text-2xl md:text-3xl font-black text-ink mb-3 leading-tight">
              Tu reserva con {provider?.name || 'tu proveedor'}
            </h1>
            <p className="text-ink/60 text-sm">
              Evento el <strong>{dateEs(booking.event_date)}</strong>
            </p>
          </div>

          <div className="p-6 md:p-8">
            {alreadyPaid && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 text-center">
                <div className="text-4xl mb-2">✓</div>
                <div className="font-bold text-emerald-900 mb-1">Pago recibido</div>
                <p className="text-sm text-emerald-800/80">
                  Recibimos tu {hasSplit ? 'anticipo' : 'pago'} el {booking.first_payment_paid_at ? dateEs(booking.first_payment_paid_at) : 'la fecha registrada'}.
                  {hasSplit && ' El resto se cobrará 2 meses antes del evento.'}
                </p>
              </div>
            )}

            {wasCancelled && !alreadyPaid && (
              <div className="bg-stone-100 border border-stone-200 rounded-2xl p-5 text-center">
                <div className="text-3xl mb-2">✗</div>
                <div className="font-bold text-ink/70 mb-1">Reserva cancelada</div>
                <p className="text-sm text-ink/60">
                  Esta reserva ya no está activa. Si crees que es un error, escríbenos a{' '}
                  <a href="mailto:contacto@fiestago.es" className="text-coral underline">contacto@fiestago.es</a>.
                </p>
              </div>
            )}

            {!alreadyPaid && !wasCancelled && amount > 0 && (
              <>
                <div className="bg-cream-dark/50 border border-stone-200 rounded-2xl p-5 mb-6">
                  <div className="text-[10px] font-bold tracking-widest uppercase text-ink/45 mb-1">
                    {hasSplit ? 'Anticipo a pagar hoy' : 'Importe a pagar'}
                  </div>
                  <div className="font-serif text-4xl font-black text-coral mb-3">{EUR(amount)}</div>
                  {hasSplit && (
                    <div className="text-xs text-ink/55 leading-relaxed">
                      Resto pendiente: <strong className="text-ink/70">{EUR(secondAmount)}</strong> · vence el{' '}
                      <strong className="text-ink/70">{dateEs(booking.second_payment_due_date)}</strong> (2 meses antes del evento)
                    </div>
                  )}
                  {!hasSplit && totalAmount > 0 && (
                    <div className="text-xs text-ink/55 leading-relaxed">
                      Este pago cubre el 100% de tu reserva.
                    </div>
                  )}
                </div>

                {process.env.FIESTAGO_TEST_MODE === 'true' && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 text-xs text-amber-900 leading-relaxed">
                    <strong>Modo test:</strong> FiestaGo aún no tiene Stripe activo. El botón "Pagar" simula el cobro instantáneamente para poder probar el flujo end-to-end. Cuando se conecte Stripe, aquí saldrá el checkout real con tarjeta.
                  </div>
                )}

                <PayFirstButton bookingId={bookingId} email={booking.client_email} amount={amount} />

                <p className="text-[11px] text-ink/45 text-center mt-4 leading-relaxed">
                  Tu pago queda retenido por FiestaGo (escrow) hasta que el evento se complete.
                  Puedes seguir chateando con {provider?.name || 'tu proveedor'} desde{' '}
                  <Link href="/mi-cuenta" className="text-coral underline">Mi cuenta</Link>.
                </p>
              </>
            )}

            {!alreadyPaid && !wasCancelled && amount <= 0 && (
              <div className="text-sm text-ink/60 text-center">
                No hay importe pendiente en esta reserva. Cualquier duda: <a href="mailto:contacto@fiestago.es" className="text-coral underline">contacto@fiestago.es</a>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
