'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { startBookingPayment } from '../_actions/checkout'
import {
  ADVANCE_FORFEIT_CHECKBOX_LABEL,
  GENERAL_TERMS_CHECKBOX_LABEL,
} from '@/lib/legal/clauses'

/**
 * Formulario de pago con captura de consentimiento.
 *
 * Tres cosas que parecen de diseño y son de defensa jurídica:
 *
 *  1. La cláusula de pérdida del anticipo se renderiza VISIBLE en la
 *     página, no detrás de un enlace ni de un modal. Que el texto esté
 *     en el DOM en el momento del pago es lo que después se defiende
 *     ante el emisor de la tarjeta.
 *
 *  2. Dos checkboxes SEPARADOS: condiciones generales + privacidad por
 *     un lado, pérdida del anticipo y política de reembolso por otro.
 *     Ninguno premarcado. Agregarlos en uno solo es justo lo que usa el
 *     emisor para tumbar la evidencia.
 *
 *  3. El texto exacto que se muestra viaja de vuelta al Server Action,
 *     que lo compara con el suyo antes de guardarlo. Lo que se guarda
 *     como "texto mostrado" es siempre lo que se mostró.
 */

const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ''

const eur = (n: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 }).format(n || 0)

export default function CheckoutConsentForm({
  bookingId, email, amount, stage, clauseText,
}: {
  bookingId: string
  email: string
  amount: number
  stage: 'deposit' | 'balance'
  clauseText: string
}) {
  const router = useRouter()
  const [acceptedGeneral, setAcceptedGeneral] = useState(false)
  const [acceptedForfeit, setAcceptedForfeit] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err,  setErr]  = useState<string | null>(null)
  const [clientSecret, setClientSecret] = useState<string | null>(null)

  const stripePromise = useMemo(
    () => (PUBLISHABLE_KEY ? loadStripe(PUBLISHABLE_KEY) : null),
    []
  )

  const canPay = acceptedGeneral && acceptedForfeit && !busy

  async function submit() {
    if (!canPay) return
    setBusy(true)
    setErr(null)
    try {
      const res = await startBookingPayment({
        bookingId,
        email,
        stage,
        acceptedGeneralTerms:   acceptedGeneral,
        acceptedAdvanceForfeit: acceptedForfeit,
        // El texto que el navegador ha renderizado de verdad, leído del
        // propio DOM — no una constante que podría haber divergido.
        displayedClauseText:
          document.getElementById('clausula-anticipo')?.textContent || clauseText,
        pageUrl: window.location.href,
        locale:  navigator.language || 'es-ES',
      })

      if (!res.ok) {
        setErr(res.error)
        setBusy(false)
        return
      }

      if (res.mode === 'stripe') {
        setClientSecret(res.clientSecret)
        setBusy(false)
        return
      }

      // Modo test: el cobro se simula en el servidor, refrescamos estado.
      router.refresh()
    } catch (e: any) {
      setErr(e?.message || 'Error inesperado procesando el pago.')
      setBusy(false)
    }
  }

  // ── Paso 2 · datos de la tarjeta (SCA on-session) ────────────────────
  if (clientSecret && stripePromise) {
    return (
      <Elements
        stripe={stripePromise}
        options={{ clientSecret, locale: 'es', appearance: { theme: 'flat' } }}
      >
        <CardStep amount={amount} />
      </Elements>
    )
  }

  // ── Paso 1 · cláusula visible + dos checkboxes ───────────────────────
  return (
    <div>
      <div className="bg-white border-2 border-stone-300 rounded-2xl p-5 mb-4">
        <div className="text-[10px] font-bold tracking-widest uppercase text-ink/45 mb-2">
          Condiciones de esta reserva · léelas antes de pagar
        </div>
        {/* Texto literal en el DOM. Es la prueba. */}
        <div
          id="clausula-anticipo"
          className="text-[13px] leading-relaxed text-ink/80 whitespace-pre-line"
        >
          {clauseText}
        </div>
      </div>

      <label className="flex items-start gap-3 mb-3 cursor-pointer">
        <input
          type="checkbox"
          checked={acceptedGeneral}
          onChange={e => setAcceptedGeneral(e.target.checked)}
          className="mt-0.5 w-4 h-4 accent-coral flex-shrink-0"
        />
        <span className="text-xs text-ink/70 leading-relaxed" title={GENERAL_TERMS_CHECKBOX_LABEL}>
          He leído y acepto las{' '}
          <a href="/terminos" target="_blank" rel="noopener" className="text-coral underline">
            Condiciones de uso
          </a>{' '}
          y la{' '}
          <a href="/privacidad" target="_blank" rel="noopener" className="text-coral underline">
            Política de privacidad
          </a>{' '}
          de FiestaGo.
        </span>
      </label>

      <label className="flex items-start gap-3 mb-5 cursor-pointer">
        <input
          type="checkbox"
          checked={acceptedForfeit}
          onChange={e => setAcceptedForfeit(e.target.checked)}
          className="mt-0.5 w-4 h-4 accent-coral flex-shrink-0"
        />
        <span className="text-xs text-ink/70 leading-relaxed">
          {ADVANCE_FORFEIT_CHECKBOX_LABEL}
        </span>
      </label>

      <button
        onClick={submit}
        disabled={!canPay}
        className="w-full bg-coral text-white font-bold py-4 rounded-2xl text-base hover:bg-coral-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {busy ? 'Procesando…' : `Pagar ${eur(amount)}`}
      </button>

      {!canPay && !busy && (
        <p className="text-[11px] text-ink/45 text-center mt-2">
          Marca las dos casillas para continuar.
        </p>
      )}

      {err && (
        <div className="mt-3 bg-red-50 border border-red-200 text-red-700 rounded-xl px-3 py-2 text-xs">
          {err}
        </div>
      )}
    </div>
  )
}

/**
 * Confirmación on-session: el cliente introduce la tarjeta y pasa el 3DS
 * de su banco en este mismo momento. Nunca cobramos el segundo plazo
 * off-session con la tarjeta guardada — sin traslado de responsabilidad
 * al emisor, una disputa por fraude se pierde de oficio.
 */
function CardStep({ amount }: { amount: number }) {
  const stripe = useStripe()
  const elements = useElements()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function confirm() {
    if (!stripe || !elements) return
    setBusy(true)
    setErr(null)
    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}${window.location.pathname}?pago=procesado`,
      },
    })
    // Solo volvemos aquí si la confirmación falló antes de redirigir.
    if (error) {
      setErr(error.message || 'No se pudo completar el pago.')
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="bg-white border border-stone-200 rounded-2xl p-4 mb-4">
        <PaymentElement />
      </div>
      <button
        onClick={confirm}
        disabled={!stripe || busy}
        className="w-full bg-coral text-white font-bold py-4 rounded-2xl text-base hover:bg-coral-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {busy ? 'Confirmando con tu banco…' : `Pagar ${eur(amount)}`}
      </button>
      <p className="text-[11px] text-ink/45 text-center mt-3 leading-relaxed">
        Tu banco puede pedirte confirmar la operación. El cargo aparecerá en tu extracto como <strong>FIESTAGO</strong>.
      </p>
      {err && (
        <div className="mt-3 bg-red-50 border border-red-200 text-red-700 rounded-xl px-3 py-2 text-xs">
          {err}
        </div>
      )}
    </div>
  )
}
