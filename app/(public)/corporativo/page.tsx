import type { Metadata } from 'next'
import { VerticalLandingPage } from '../_components/VerticalLandingPage'

export const metadata: Metadata = {
  title:       'Eventos corporativos en 3 pasos — FiestaGo para empresas',
  description: 'Cenas de empresa, despedidas, lanzamientos y team buildings. Catering, espacios, AV, fotógrafo y animación con factura simplificada y respaldo.',
  alternates:  { canonical: 'https://fiestago.es/corporativo' },
  openGraph: {
    title:       'Eventos corporativos sin estrés logístico',
    description: 'Para Comunicación, RRHH y Office Managers. Reserva en 3 pasos con Garantía de Éxito.',
    url:         'https://fiestago.es/corporativo',
    type:        'website',
  },
}

export default function CorporativoLanding() {
  return (
    <VerticalLandingPage config={{
      slug:      'corporativo',
      eventType: 'corporativo',
      title:     'Eventos corporativos',
      emoji:     '🏢',
      hero: {
        headline: 'Tu evento de empresa sin la logística que te quita las tardes.',
        subhead:  'Cenas de Navidad, kickoffs, despedidas, lanzamientos, team buildings. Catering, espacios, sonido y fotografía en una sola reserva.',
        img:      'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=1920&q=85&auto=format&fit=crop',
      },
      intro: 'Si organizas eventos para tu empresa — comunicación interna, RRHH, office management — sabes lo que cuesta cuadrar 5 proveedores distintos. En FiestaGo reservas catering, espacio, AV, animación y fotografía con factura unificada y respaldo si algo falla.',
      categories: ['espacios', 'catering', 'musica', 'animacion', 'foto', 'flores'],
      benefits: [
        { icon: '🧾', title: 'Factura y proceso simplificado',  body: 'Una sola reserva, una sola factura. Pago retenido hasta el evento — útil para los procesos de aprobación interna y conciliación contable.' },
        { icon: '⚡', title: 'Reserva express',                 body: 'Sin esperar 3 semanas a un presupuesto. Precio cerrado, disponibilidad real y reserva inmediata. Si te toca cuadrar un evento en 10 días, FiestaGo lo permite.' },
        { icon: '🛡️', title: 'Backup si falla algo',            body: 'Si el catering cancela 48h antes o el espacio te falla, FiestaGo cubre hasta el 110% del importe. Para un evento corporativo, esa garantía vale oro.' },
      ],
      faq: [
        { q: '¿Podéis facturar a empresa con CIF?',
          a: 'Sí, todas nuestras facturas se emiten con CIF y los datos fiscales que indiques al hacer la reserva. Acceso al portal del cliente para descargar facturas en cualquier momento.' },
        { q: '¿Qué pasa si el evento se cancela por motivos internos?',
          a: 'Cada proveedor define su política de cancelación, visible en su ficha. La mayoría permiten cancelación con reembolso parcial hasta 30 días antes. En casos de fuerza mayor (huelgas, problemas de viaje, etc.) mediamos directamente.' },
        { q: '¿Reservas exclusivamente B2B o también particulares?',
          a: 'FiestaGo es marketplace mixto. Pero todos los proveedores en estas categorías están acostumbrados a evento corporativo y entienden las particularidades (timing más estricto, AV, identidad corporativa, etc.).' },
        { q: '¿Tenéis proveedores para eventos de más de 200 personas?',
          a: 'Sí, filtra por capacidad en cada categoría. Tenemos espacios para 300-500+ y catering escalable. Para eventos muy grandes, contacta directamente y te asignamos un gestor de cuenta.' },
      ],
      ctaBudget: { min: 1500, avg: 8000, max: 50000, per: 'evento' },
    }}/>
  )
}
