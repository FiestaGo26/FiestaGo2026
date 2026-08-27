import Link from 'next/link'

// ─── Página de ayuda del proveedor ───────────────────────────────────
// Grid de tutoriales cortos (10-30s cada uno) en formato GIF.
// Los GIFs se generan con tools/tutorials/capture.mjs y se guardan en
// public/tutorials/*.gif. Mientras no existan, la card muestra un
// placeholder gris.
//
// Objetivo: proveedor busca solo lo que necesita, sin ver 8 min de
// vídeo seguido. Cada card enlaza al tab correspondiente del panel
// para que "tras ver el tutorial" pueda ir directo a hacerlo.

type Tutorial = {
  slug:     string
  title:    string
  duration: string
  hint:     string
  panelTab: string       // ?tab= al panel para hacer clic tras el tutorial
  category: 'basico' | 'ventas' | 'gestion' | 'marketing'
}

const TUTORIALS: Tutorial[] = [
  { slug: '01-primer-login',        title: 'Tu primer inicio de sesión',           duration: '20s', hint: 'Cómo acceder al panel y qué te encuentras.',                            panelTab: 'dashboard',    category: 'basico' },
  { slug: '02-perfil',              title: 'Rellenar tu perfil',                   duration: '30s', hint: 'Foto, descripción, ciudad y activar videollamada preventa.',           panelTab: 'profile',      category: 'basico' },
  { slug: '03-servicios',           title: 'Crear tu primer servicio',             duration: '45s', hint: 'Nombre, precio, anticipo, fotos y política de cancelación.',           panelTab: 'services',     category: 'basico' },
  { slug: '04-datos-fiscales',      title: 'Configurar datos fiscales',            duration: '30s', hint: 'NIF, régimen y activar facturación delegada Verifactu.',              panelTab: 'fiscal',       category: 'basico' },

  { slug: '05-presupuestos-ia',     title: 'Presupuestos con IA en 10 seg',         duration: '45s', hint: 'Pega el mensaje del cliente y la IA redacta el presupuesto.',          panelTab: 'quotes',       category: 'ventas' },
  { slug: '06-plantillas-whatsapp', title: 'Plantillas de WhatsApp',                duration: '30s', hint: 'Responder al cliente en 2 clics con mensajes ya escritos.',            panelTab: 'wa-replies',   category: 'ventas' },
  { slug: '07-cupones',             title: 'Crear y compartir cupones',             duration: '30s', hint: 'Descuentos para clientes concretos o campañas por servicio.',          panelTab: 'coupons',      category: 'ventas' },
  { slug: '08-videollamada',        title: 'Videollamada preventa',                 duration: '30s', hint: 'Aceptar solicitud y compartir sala Jitsi con el cliente.',            panelTab: 'video-calls',  category: 'ventas' },

  { slug: '09-aceptar-reserva',     title: 'Aceptar una reserva y facturar',        duration: '40s', hint: 'Confirmar → factura Verifactu se emite automáticamente.',              panelTab: 'bookings',     category: 'gestion' },
  { slug: '10-cobros',              title: 'Ver tus cobros y facturas',             duration: '25s', hint: 'Cuánto has cobrado por año/mes y descargar las facturas legales.',    panelTab: 'earnings',     category: 'gestion' },
  { slug: '11-mensajes',            title: 'Chat con clientes',                     duration: '25s', hint: 'Conversación interna con adjuntos y videollamada integrada.',         panelTab: 'messages',     category: 'gestion' },
  { slug: '12-disponibilidad',      title: 'Calendario y disponibilidad',           duration: '30s', hint: 'Marcar días libres y sincronizar con Google Calendar.',                panelTab: 'availability', category: 'gestion' },

  { slug: '13-google-business',     title: 'Posts en Google Business con IA',       duration: '35s', hint: 'Generar posts para tu ficha de Google Maps sin escribir.',            panelTab: 'gmb',          category: 'marketing' },
  { slug: '14-widget',              title: 'Widget para tu web',                    duration: '25s', hint: 'Botón para embed en tu web propia — botón o tarjeta.',                panelTab: 'embed',        category: 'marketing' },
  { slug: '15-compartir-servicio',  title: 'Compartir un servicio concreto',        duration: '20s', hint: 'Link directo al servicio + botón WhatsApp para cerrar leads.',        panelTab: 'services',     category: 'marketing' },
]

const GROUPS = [
  { id: 'basico',    label: 'Empezar',        icon: '🚀', desc: 'Lo primero al llegar a FiestaGo.' },
  { id: 'ventas',    label: 'Cerrar ventas',  icon: '💬', desc: 'Herramientas para convertir consultas en reservas.' },
  { id: 'gestion',   label: 'Gestionar',      icon: '📋', desc: 'Reservas, cobros, chat y calendario.' },
  { id: 'marketing', label: 'Promocionarte',  icon: '📣', desc: 'Aparecer más y llegar a más clientes.' },
] as const

export const metadata = {
  title: 'Ayuda para proveedores · FiestaGo',
  description: 'Guías cortas para aprovechar todas las funcionalidades de FiestaGo en menos de 10 minutos.',
}

export default function AyudaPage() {
  return (
    <main className="min-h-screen bg-cream">
      <div className="max-w-5xl mx-auto px-6 py-14 md:py-20">
        <div className="mb-12 md:mb-16">
          <div className="text-xs font-bold tracking-[0.22em] uppercase text-coral mb-4">
            🎓 Centro de ayuda
          </div>
          <h1 className="font-serif text-4xl md:text-5xl font-black text-ink leading-tight mb-4 text-balance">
            Aprende a usar FiestaGo en tutoriales cortos
          </h1>
          <p className="text-base md:text-lg text-ink/60 max-w-2xl leading-relaxed">
            Cada guía dura menos de 45 segundos y te lleva directo a la parte
            del panel que necesitas. Ve solo las que te interesen — no hace falta
            verlo todo del tirón.
          </p>
        </div>

        {GROUPS.map(group => {
          const items = TUTORIALS.filter(t => t.category === group.id)
          return (
            <section key={group.id} className="mb-14">
              <header className="mb-5 flex items-baseline justify-between gap-4">
                <div>
                  <h2 className="font-serif text-2xl md:text-3xl font-bold text-ink flex items-center gap-3">
                    <span>{group.icon}</span> {group.label}
                  </h2>
                  <p className="text-sm text-ink/55 mt-1">{group.desc}</p>
                </div>
                <div className="text-xs text-ink/40 font-mono whitespace-nowrap">
                  {items.length} guías
                </div>
              </header>

              <div className="grid sm:grid-cols-2 gap-4">
                {items.map(t => (
                  <article key={t.slug} className="bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col">
                    <div className="relative bg-stone-100 aspect-video overflow-hidden">
                      {/* Cuando el capturador genere el GIF, se sirve
                          desde /tutorials/{slug}.gif. Mientras tanto,
                          placeholder con nombre del tutorial. */}
                      <img src={`/tutorials/${t.slug}.gif`}
                        alt={t.title}
                        loading="lazy"
                        className="w-full h-full object-cover"
                        onError={(e: any) => {
                          e.currentTarget.style.display = 'none'
                          e.currentTarget.parentElement.querySelector('.tutorial-placeholder')?.classList.remove('hidden')
                        }}/>
                      <div className="tutorial-placeholder absolute inset-0 flex flex-col items-center justify-center text-ink/30 hidden">
                        <div className="text-4xl mb-2">🎬</div>
                        <div className="text-xs font-mono">Grabación pendiente</div>
                      </div>
                      <div className="absolute top-2 right-2 bg-ink/85 text-white text-[10px] font-bold px-2 py-1 rounded-md tabular-nums">
                        {t.duration}
                      </div>
                    </div>
                    <div className="p-4 flex-1 flex flex-col">
                      <h3 className="font-semibold text-ink text-base mb-1 leading-tight">{t.title}</h3>
                      <p className="text-sm text-ink/60 leading-snug mb-3 flex-1">{t.hint}</p>
                      <Link href={`/proveedor/panel?tab=${t.panelTab}`}
                        className="text-xs font-bold text-coral hover:text-coral-dark transition-colors self-start">
                        Ir a esta sección del panel →
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )
        })}

        <footer className="mt-16 pt-8 border-t border-stone-200 text-center">
          <p className="text-sm text-ink/55 mb-4">
            ¿Sigues con dudas después de ver los tutoriales?
          </p>
          <a href="mailto:contacto@fiestago.es"
            className="inline-block bg-coral text-white font-bold text-sm px-6 py-3 rounded-xl hover:bg-coral-dark transition-colors">
            📧 Escríbenos a contacto@fiestago.es
          </a>
        </footer>
      </div>
    </main>
  )
}
