import Link from 'next/link'
import { ReactNode } from 'react'
import Navbar from './_components/Navbar'
import PwaInit from './_components/PwaInit'
import CookieBanner from './_components/CookieBanner'

const FOOTER_LINKS = [
  { title: 'Celebraciones', links: [['Bodas', '/proveedores?categoria=planner'], ['Cumpleaños', '/cumpleanos'], ['Comuniones', '/comuniones'], ['Empresa', '/corporativo'], ['Packs', '/#packs']] },
  { title: 'Profesionales', links: [['Saber más', '/profesionales'], ['Inscribirse', '/registro-proveedor'], ['Acceder a mi panel', '/proveedor/login'], ['Compromisos', '/proveedor/compromisos']] },
  { title: 'FiestaGo', links: [['Garantía de Éxito', '/garantia'], ['Términos de uso', '/terminos'], ['Aviso legal', '/aviso-legal'], ['Privacidad', '/privacidad'], ['Cookies', '/cookies']] },
]

// El pie es el reverso de la invitación: un panel de papel con el borde
// superior festoneado sobre tinta negra, y el nombre a todo lo ancho.
function Footer() {
  return (
    <footer className="mt-auto bg-[#0a0a0a] text-[#0a0a0a] font-[family-name:var(--font-schibsted)] tracking-[-0.01em] pt-16 overflow-hidden">
      <div className="relative mx-3 md:mx-[8.33%]">
        <svg className="block w-full h-[18px]" viewBox="0 0 1200 18" preserveAspectRatio="none" aria-hidden="true">
          <path fill="#f4f1ec" d={'M0 18 ' + Array.from({ length: 12 }, (_, i) => `A50 18 0 0 1 ${(i + 1) * 100} 18`).join(' ') + ' Z'} />
        </svg>
        <div className="bg-[#f4f1ec] px-6 md:px-14 pt-10 pb-8">
          <div className="grid gap-10 md:grid-cols-[1.2fr_2fr]">
            <div>
              <p className="text-[32px] leading-[0.95] font-extrabold tracking-[-0.05em]">Nos vemos en la fiesta.</p>
              <p className="mt-4 text-[16px] leading-relaxed max-w-[34ch]">
                Tu celebración con red de seguridad: bodas, cumpleaños, comuniones y cualquier evento privado en España.
              </p>
              <a href="mailto:contacto@fiestago.es" className="inline-block mt-6 text-[18px] font-semibold underline underline-offset-[6px] decoration-2">
                contacto@fiestago.es
              </a>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-8">
              {FOOTER_LINKS.map(col => (
                <div key={col.title}>
                  <div className="text-[16px] font-extrabold tracking-[-0.03em] mb-3">{col.title}</div>
                  <ul className="flex flex-col gap-2">
                    {col.links.map(([label, href]) => (
                      <li key={label}>
                        <Link href={href} className="text-[15px] text-[#55514b] hover:text-[#0a0a0a] transition-colors">{label}</Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
          <p className="mt-12 text-center text-[13px] text-[#55514b]">© 2026 FiestaGo. Todos los derechos reservados.</p>
        </div>
      </div>
      <div aria-hidden="true" className="select-none text-[#f4f1ec] font-extrabold leading-[0.8] tracking-[-0.07em] text-center whitespace-nowrap text-[22vw] -mb-[3vw] mt-6">
        FiestaGo
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
      <PwaInit/>
      <CookieBanner/>
    </div>
  )
}

