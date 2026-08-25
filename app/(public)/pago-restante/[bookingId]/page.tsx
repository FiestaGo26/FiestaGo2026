import { createAdminClient } from '@/lib/supabase'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import PayRestButton from './PayRestButton'

// Página cliente para pagar el segundo tramo de una reserva con anticipo.
// La URL viene en los emails de recordatorio del cron:
//   /pago-restante/{bookingId}?email={client_email}
//
// La autenticación por email es soft (mismo patrón que /api/messages) —
// suficiente para test E2E; cuando Stripe esté vivo, Stripe Checkout
// añadirá su propia capa de verificación de tarjeta.

export const dynamic = 'force-dynamic'

const EUR = (n: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 }).format(n)

const dateEs = (d: string | Date) =>
  new Date(d).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })

export default async function PagoRestantePage({
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
  const status = booking.second_payment_status
  const alreadyPaid    = status === 'paid'
  const notNeeded      = status === 'not_needed'
  const wasCancelled   = status === 'cancelled' || booking.status === 'cancelled'
  const isOverdue      = status === 'overdue'
  const amount         = Number(booking.second_payment_amount || 0)
  const dueDate        = booking.second_payment_due_date

  return (
    <main className="min-h-screen bg-cream py-16 px-6">
      <div className="max-w-lg mx-auto">
        <Link href="/mi-cuenta" className="text-xs text-coral hover:underline mb-6 inline-block">
          ← Ir a Mi cuenta
        </Link>

        <div className="bg-white border border-stone-200 rounded-3xl overflow-hidden shadow-card">
          <div className="p-6 md:p-8 border-b border-stone-200">
            <div className="text-[10px] font-bold tracking-widest uppercase text-coral mb-2">
              Pago restante
            </div>
            <h1 className="font-serif text-2xl md:text-3xl font-black text-ink mb-3 leading-tight">
              Tu reserva con {provider?.name || 'tu proveedor'}
            </h1>
            <p className="text-ink/60 text-sm">
              Evento el <strong>{dateEs(booking.event_date)}</strong>
            </p>
          </div>

          <div className="p-6 md:p-8">
            {notNeeded && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 text-center">
                <div className="text-4xl mb-2">✓</div>
                <div className="font-bold text-emerald-900 mb-1">Ya está todo pagado</div>
                <p className="text-sm text-emerald-800/80">Esta reserva se pagó al 100% al reservar. No hay segundo pago pendiente.</p>
              </div>
            )}

            {alreadyPaid && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 text-center">
                <div className="text-4xl mb-2">✓</div>
                <div className="font-bold text-emerald-900 mb-1">Pago completado</div>
                <p className="text-sm text-emerald-800/80">
                  Recibimos tu pago restante el {booking.second_payment_paid_at ? dateEs(booking.second_payment_paid_at) : 'la fecha registrada'}.
                  Tu reserva queda al 100%.
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

            {!notNeeded && !alreadyPaid && !wasCancelled && amount > 0 && (
              <>
                {isOverdue && (
                  <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-5 text-sm text-red-900">
                    <strong>Este pago está vencido.</strong> Aún estás dentro del periodo de gracia de 7 días, pero pasado ese plazo la reserva se cancelará automáticamente.
                  </div>
                )}

                <div className="bg-cream-dark/50 border border-stone-200 rounded-2xl p-5 mb-6">
                  <div className="text-[10px] font-bold tracking-widest uppercase text-ink/45 mb-1">Importe restante</div>
                  <div className="font-serif text-4xl font-black text-coral mb-3">{EUR(amount)}</div>
                  {dueDate && (
                    <div className="text-xs text-ink/55">
                      Fecha límite: <strong className="text-ink/70">{dateEs(dueDate)}</strong> (2 meses antes del evento)
                    </div>
                  )}
                </div>

                {process.env.FIESTAGO_TEST_MODE === 'true' && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 text-xs text-amber-900 leading-relaxed">
                    <strong>Modo test:</strong> FiestaGo aún no tiene Stripe activo. El botón "Pagar" simula el cobro instantáneamente para poder probar el flujo end-to-end. Cuando se conecte Stripe, aquí saldrá el checkout real con tarjeta.
                  </div>
                )}

                <PayRestButton bookingId={bookingId} email={booking.client_email} amount={amount} />

                <p className="text-[11px] text-ink/45 text-center mt-4 leading-relaxed">
                  Tu pago queda retenido por FiestaGo (escrow) hasta que el evento se complete.
                  Puedes seguir chateando con {provider?.name || 'tu proveedor'} desde{' '}
                  <Link href="/mi-cuenta" className="text-coral underline">Mi cuenta</Link>.
                </p>
              </>
            )}

            {!notNeeded && !alreadyPaid && !wasCancelled && amount <= 0 && (
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
