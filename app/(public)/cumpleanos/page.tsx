import type { Metadata } from 'next'
import { VerticalLandingPage } from '../_components/VerticalLandingPage'

export const metadata: Metadata = {
  title:       'Cumpleaños inolvidables — Reserva en 3 pasos con FiestaGo',
  description: 'Anima cualquier cumpleaños — infantil, adulto o sorpresa — reservando animación, catering, tarta, fotografía y espacio con respaldo. Garantía de Éxito incluida.',
  alternates:  { canonical: 'https://fiestago.es/cumpleanos' },
  openGraph: {
    title:       'Cumpleaños inolvidables en FiestaGo',
    description: 'Animación, tarta, catering, fotografía y espacios. Reserva con Garantía de Éxito.',
    url:         'https://fiestago.es/cumpleanos',
    type:        'website',
  },
}

export default function CumpleanosLanding() {
  return (
    <VerticalLandingPage config={{
      slug:      'cumpleanos',
      eventType: 'cumpleanos',
      title:     'Cumpleaños inolvidables',
      emoji:     '🎂',
      hero: {
        headline: 'Que cada cumpleaños sea el mejor.',
        subhead:  'Animación, tarta, fotografía, catering y decoración. En 3 pasos, con respaldo si algo falla.',
        img:      'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=1920&q=85&auto=format&fit=crop',
      },
      intro: 'Organizar un cumpleaños no debería convertirse en un trabajo de medio tiempo. Encuentra animadores, fotógrafos, catering, tartas a medida y decoración para cualquier edad — todo verificado, todo con Garantía de Éxito incluida en cada reserva.',
      categories: ['animacion', 'pastel', 'foto', 'catering', 'espacios', 'flores'],
      benefits: [
        { icon: '🎈', title: 'Para cualquier edad',         body: 'Desde fiestas de princesas para los 5 años hasta cenas sorpresa de 40 cumpleaños. Filtramos por edad y temática.' },
        { icon: '🛡️', title: 'Si no aparecen, los pones tú', body: 'Si tu animador, fotógrafo o catering cancela, FiestaGo busca sustituto en 48h o te devuelve el 110%. Si no se presentan el día del evento, recibes el 100% más compensación.' },
        { icon: '⚡', title: 'Reserva en minutos',           body: 'No esperes 2 semanas a un presupuesto. Precio claro, calendario en tiempo real, pago seguro y a otra cosa.' },
      ],
      faq: [
        { q: '¿Puedo reservar cumpleaños infantil con poca antelación?',
          a: 'Sí. Muchos animadores tienen disponibilidad para 1-2 semanas vista, especialmente entre semana. El calendario de cada profesional muestra disponibilidad real en tiempo real.' },
        { q: '¿Cuánto cuesta un cumpleaños medio en España?',
          a: 'Para 20-30 niños, suele estar entre 300€ y 800€ contando animación, tarta y un catering ligero. Para cumpleaños de adulto en restaurante con catering tipo aperitivo, el rango es 30€-65€ por persona. Usa nuestra calculadora para tu caso concreto.' },
        { q: '¿Y si llueve y la fiesta era al aire libre?',
          a: 'Si tu proveedor de espacio o animación tiene un Plan B (sala cubierta, alternativa interior), la reserva se mantiene con esa adaptación. Si no, contacta con nosotros: aplicamos la Garantía de Éxito y buscamos alternativa o reembolsamos.' },
        { q: '¿Se puede reservar solo un servicio (por ejemplo, solo la tarta)?',
          a: 'Por supuesto. No tienes que reservar todo el pack — puedes traer cosas por tu cuenta y reservar solo lo que necesites en FiestaGo. La Garantía aplica solo a los servicios reservados aquí.' },
      ],
      ctaBudget: { min: 300, avg: 600, max: 1500, per: 'evento' },
    }}/>
  )
}
