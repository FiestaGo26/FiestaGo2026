'use client'

import CheckoutConsentForm from '../../_components/CheckoutConsentForm'

// Primer tramo (anticipo o 100% al reservar).
//
// Toda la lógica vive en CheckoutConsentForm, compartido con el pago
// restante: cláusula de pérdida del anticipo visible en la página, dos
// checkboxes separados, consentimiento registrado antes de crear el
// PaymentIntent y confirmación on-session con SCA.
export default function PayFirstButton({
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
      stage="deposit"
      clauseText={clauseText}
    />
  )
}
