import TutorialCard from './TutorialCard'
import { TUTORIALS } from './tutorials'

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
            Aprende a usar FiestaGo en 30 segundos por sección
          </h1>
          <p className="text-base md:text-lg text-ink/60 max-w-2xl leading-relaxed">
            Cada guía tiene 3-6 pasos concretos + consejos, y un botón para
            saltar directamente a esa sección del panel. Lee solo lo que necesites.
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
                  {items.length} {items.length === 1 ? 'guía' : 'guías'}
                </div>
              </header>

              <div className="grid sm:grid-cols-2 gap-4">
                {items.map(t => (
                  <TutorialCard key={t.slug} t={t}/>
                ))}
              </div>
            </section>
          )
        })}

        <footer className="mt-16 pt-8 border-t border-stone-200 text-center">
          <p className="text-sm text-ink/55 mb-4">
            ¿Sigues con dudas después de leer los tutoriales?
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
