import Link from 'next/link'
import { ReactNode } from 'react'

function Navbar() {
  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-stone-200 shadow-sm">
      <nav className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="font-serif text-xl font-black text-ink tracking-tight flex items-center gap-2">
          <span className="text-2xl">🎉</span> FiestaGo
        </Link>
        <div className="hidden md:flex items-center gap-1">
          <Link href="/proveedores" className="text-sm font-medium text-ink/70 hover:text-coral px-3 py-2 rounded-xl transition-colors">
            Proveedores
          </Link>
          <Link href="/#packs" className="text-sm font-medium text-ink/70 hover:text-coral px-3 py-2 rounded-xl transition-colors">
            Packs
          </Link>
          <Link href="/mis-reservas" className="text-sm font-medium text-ink/70 hover:text-coral px-3 py-2 rounded-xl transition-colors">
            📅 Mis reservas
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/registro-proveedor"
            className="text-sm font-semibold border border-stone-200 text-ink px-4 py-2 rounded-xl hover:border-coral hover:text-coral transition-colors hidden sm:block">
            Soy proveedor
          </Link>
          <Link href="/#packs"
            className="text-sm font-bold bg-coral text-white px-5 py-2 rounded-xl hover:bg-coral-dark transition-colors shadow-coral">
            Reservar fiesta
          </Link>
        </div>
      </nav>
    </header>
  )
}

function Footer() {
  return (
    <footer className="bg-ink text-white/60 py-12 px-6 mt-auto">
      <div className="max-w-6xl mx-auto">
        <div className="grid md:grid-cols-4 gap-8 mb-10">
          <div>
            <div className="font-serif text-white text-xl font-black mb-3">🎉 FiestaGo</div>
            <p className="text-sm leading-relaxed">El marketplace de celebraciones #1 en España.</p>
          </div>
          {[
            { title:'Celebraciones', links:[['Bodas','/proveedores?categoria=planner'],['Cumpleaños','/#packs'],['Fiestas privadas','/#packs']] },
            { title:'Proveedores',   links:[['Registrarse','/registro-proveedor'],['Panel de acceso','/proveedor/login']] },
            { title:'Legal',         links:[['Términos de uso','#'],['Privacidad','#'],['Cookies','#']] },
          ].map(col => (
            <div key={col.title}>
              <div className="text-white font-semibold text-sm mb-4">{col.title}</div>
              <div className="flex flex-col gap-2">
                {col.links.map(([label, href]) => (
                  <Link key={label} href={href} className="text-sm hover:text-white transition-colors">{label}</Link>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="border-t border-white/10 pt-6 flex flex-col md:flex-row justify-between items-center gap-2 text-xs">
          <span>© 2025 FiestaGo. Todos los derechos reservados.</span>
          <span>partnerships@fiegago.es</span>
        </div>
      </div>
    </footer>
  )
}

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar/>
      <div className="flex-1">{children}</div>
      <Footer/>
    </div>
  )
}
