import Link from 'next/link'
import { ReactNode } from 'react'
import Navbar from './_components/Navbar'
import WaitlistBanner from './_components/WaitlistBanner'
import PwaInit from './_components/PwaInit'

function Footer() {
  return (
    <footer className="bg-ink text-white/60 py-12 px-6 mt-auto">
      <div className="max-w-6xl mx-auto">
        <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-8 mb-10">
          <div>
            <img src="/logo-white.svg" alt="FiestaGo" className="h-9 w-auto mb-4" />
            <p className="text-sm leading-relaxed">Tu celebración con red de seguridad. Bodas, cumpleaños, comuniones y cualquier evento privado en España.</p>
          </div>
          {[
            { title:'Celebraciones', links:[['Bodas','/proveedores?categoria=planner'],['Cumpleaños','/#packs'],['Fiestas privadas','/#packs']] },
            { title:'Proveedores',   links:[['Saber más','/profesionales'],['Inscribirse','/registro-proveedor'],['Acceder a mi panel','/proveedor/login']] },
            { title:'FiestaGo',      links:[['🛡 Garantía de Éxito','/garantia'],['Compromisos del Proveedor','/proveedor/compromisos']] },
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
      <WaitlistBanner/>
      <Navbar/>
      <div className="flex-1">{children}</div>
      <Footer/>
      <PwaInit/>
    </div>
  )
}

