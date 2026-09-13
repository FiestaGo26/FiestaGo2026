'use client'

import CheckoutConsentForm from '../../_components/CheckoutConsentForm'

// Segundo tramo (resto, dos meses antes del evento).
//
// Se cobra SIEMPRE on-session desde este enlace, nunca off-session con la
// tarjeta guardada: sin SCA no hay traslado de responsabilidad al emisor
// y una disputa por fraude se pierde de oficio.
export default function PayRestButton({
  bookingId, email, amount, clauseText,
}: {
  bookingId: string
  email: string
  amount: number
  clauseText: string
}) {
  return (
    <CheckoutConsentForm
      bookingId={bookingId}
      email={email}
      amount={amount}
      stage="balance"
      clauseText={clauseText}
    />
  )
}
