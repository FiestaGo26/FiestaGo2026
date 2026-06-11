import type { Metadata } from 'next'
import { VerticalLandingPage } from '../_components/VerticalLandingPage'

export const metadata: Metadata = {
  title:       'Comuniones y bautizos sin estrés — Reserva en 3 pasos con FiestaGo',
  description: 'Organiza la comunión o bautizo con restaurante, fotografía, decoración y tarta verificados. Garantía de Éxito incluida. Reserva en 3 pasos.',
  alternates:  { canonical: 'https://fiestago.es/comuniones' },
  openGraph: {
    title:       'Comuniones y bautizos en FiestaGo',
    description: 'Restaurante, foto, decoración y tarta para el día especial. Con respaldo si algo falla.',
    url:         'https://fiestago.es/comuniones',
    type:        'website',
  },
}

export default function ComunionesLanding() {
  return (
    <VerticalLandingPage config={{
      slug:      'comuniones',
      eventType: 'comunion',
      title:     'Comuniones y bautizos',
      emoji:     '✨',
      hero: {
        headline: 'El día especial, sin que tú te angusties.',
        subhead:  'Restaurante, fotógrafo, decoración, animación y tarta. Profesionales verificados y Garantía de Éxito incluida.',
        img:      'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=1920&q=85&auto=format&fit=crop',
      },
      intro: 'La comunión o el bautizo de tu hijo es un día único. Encuentra restaurante, fotógrafo, animación infantil, tarta personalizada y decoración floral — todo en una sola plataforma, con precios cerrados y respaldo si algo falla.',
      categories: ['espacios', 'foto', 'pastel', 'animacion', 'flores', 'papeleria'],
      benefits: [
        { icon: '👨‍👩‍👧', title: 'Pensado para familias',          body: 'Los restaurantes y proveedores en FiestaGo entienden las necesidades específicas: menús infantiles, espacios para niños, horarios flexibles.' },
        { icon: '📸', title: 'Fotografía profesional',           body: 'Fotógrafos especializados en comuniones, con reportajes completos y entrega de archivos en tiempo razonable. No te quedes con fotos del móvil.' },
        { icon: '🛡️', title: 'Si algo falla, te respondemos',    body: 'Si el restaurante cancela y no encontramos sustituto en 48h, recuperas el 110%. Si el fotógrafo no aparece o la tarta no llega, 100% más compensación. Nunca te quedas sin solución.' },
      ],
      faq: [
        { q: '¿Cuándo conviene reservar la comunión?',
          a: 'Mayo y junio son los meses pico — los buenos restaurantes y fotógrafos se reservan con 6-9 meses de antelación. Lo ideal es bloquear espacio y foto entre octubre y enero del año previo.' },
        { q: '¿Qué incluye un menú de comunión típico?',
          a: 'Aperitivo, primero, segundo (suele incluir opción menú infantil), postre con tarta de comunión, café y barra libre opcional. El rango habitual es 50€-90€ por adulto. La calculadora te da una estimación con datos reales.' },
        { q: '¿Puedo reservar solo el fotógrafo y la decoración?',
          a: 'Claro. Cada servicio se reserva independientemente. Si ya tienes restaurante reservado por tu cuenta, puedes traer solo la fotografía, la animación infantil o la tarta a FiestaGo.' },
        { q: '¿Qué pasa si el niño se pone enfermo y hay que cambiar fecha?',
          a: 'Cada proveedor define su política de cambios, visible en su ficha. La mayoría permiten cambio sin coste con 30+ días de antelación. Si el cambio es de última hora por causa médica justificada, contacta con nosotros y mediamos.' },
      ],
      ctaBudget: { min: 2500, avg: 4000, max: 8000, per: 'evento' },
    }}/>
  )
}
