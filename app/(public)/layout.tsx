import Link from 'next/link'
import { ReactNode } from 'react'
import Navbar from './_components/Navbar'

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
            { title:'Proveedores',   links:[['Registrarse','/registro-proveedor'],['Acceder a mi panel','/proveedor/login']] },
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
          <span>contacto@fiestago.es</span>
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

