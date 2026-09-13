/**
 * Cliente de Stripe (servidor).
 *
 * Se instancia perezosamente para que los entornos sin STRIPE_SECRET_KEY
 * (modo test de FiestaGo, previews) puedan importar este módulo sin
 * reventar en el import. Quien necesite cobrar llama a getStripe() y
 * maneja el error; quien solo quiera saber si hay Stripe usa
 * isStripeConfigured().
 */

import Stripe from 'stripe'

let _stripe: Stripe | null = null

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY)
}

export function getStripe(): Stripe {
  if (_stripe) return _stripe
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY no configurada')
  _stripe = new Stripe(key, {
    // Sin apiVersion explícita: usamos la que fija el SDK instalado para
    // no desacoplar tipos y runtime en cada upgrade.
    appInfo: { name: 'FiestaGo', url: 'https://fiestago.es' },
    maxNetworkRetries: 2,
  })
  return _stripe
}

/** true si estamos en el modo mock (sin cobro real) de FiestaGo. */
export function isTestMode(): boolean {
  return process.env.FIESTAGO_TEST_MODE === 'true'
}
