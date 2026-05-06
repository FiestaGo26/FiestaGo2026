'use client'

import Link from 'next/link'
import { ReactNode, useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

function Navbar() {
  const pathname = usePathname()
  const isHome = pathname === '/'
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    if (!isHome) { setScrolled(true); return }
    const onScroll = () => setScrolled(window.scrollY > 80)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [isHome])

  const overHero = isHome && !scrolled
  const linkBase = 'text-[11px] tracking-[0.18em] uppercase font-medium transition-colors'

  return (
    <header
      className={[
        'fixed top-0 left-0 right-0 z-50 transition-all duration-500',
        overHero ? 'py-6' : 'py-3',
        overHero ? 'bg-transparent' : 'bg-ivory/95 backdrop-blur-sm border-b border-bone-dark',
      ].join(' ')}
    >
      <nav className="max-w-7xl mx-auto px-6 md:px-10 flex items-center justify-between">
        <Link
          href="/"
          className={['font-serif text-xl tracking-tight font-medium', overHero ? 'text-white' : 'text-ink'].join(' ')}
        >
          FiestaGo<span className="text-gold">.</span>
        </Link>

        <div className="hidden md:flex items-center gap-8">
          {[
            ['Proveedores', '/proveedores'],
            ['Packs', '/#packs'],
            ['Ideas', '/#categorias'],
            ['Mis reservas', '/mis-reservas'],
          ].map(([label, href]) => (
            <Link
              key={label}
              href={href}
              className={[linkBase, overHero ? 'text-white/85 hover:text-white' : 'text-ink-soft hover:text-ink'].join(' ')}
            >
              {label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/proveedor/login"
            className={[linkBase, 'hidden sm:block', overHero ? 'text-white/85 hover:text-white' : 'text-ink-soft hover:text-ink'].join(' ')}
          >
            Acceder
          </Link>
          <Link
            href="/registro-proveedor"
            className={[linkBase, 'hidden md:block', overHero ? 'text-white/85 hover:text-white' : 'text-ink-soft hover:text-ink'].join(' ')}
          >
            Soy proveedor
          </Link>
          <Link
            href="/#packs"
            className={[
              'text-[11px] tracking-[0.15em] uppercase font-medium px-5 py-2.5 rounded-full transition-all',
              overHero ? 'bg-white text-ink hover:bg-bone' : 'bg-ink text-ivory hover:bg-ink-soft',
            ].join(' ')}
          >
            Reservar fecha
          </Link>
        </div>
      </nav>
    </header>
  )
}

function Footer() {
  return (
    <footer className="bg-ink text-white/60 pt-20 pb-10 px-6 md:px-10 mt-32">
      <div className="max-w-7xl mx-auto">
        <div className="grid md:grid-cols-12 gap-10 mb-16">
          <div className="md:col-span-5">
            <div className="font-serif text-3xl text-white font-medium mb-5 tracking-tight">
              FiestaGo<span className="text-gold">.</span>
            </div>
            <p className="text-sm leading-relaxed max-w-sm text-white/65">
              El marketplace de celebraciones que tu fiesta merece. Bodas, cumpleaños, despedidas y aniversarios — sin estrés, en una sola reserva.
            </p>
            <div className="flex gap-3 mt-8">
              {['Instagram', 'TikTok', 'Pinterest'].map(s => (
                <a
                  key={s}
                  href="#"
                  className="text-[11px] tracking-[0.18em] uppercase text-white/55 hover:text-white border-b border-transparent hover:border-white/40 pb-1 transition-colors"
                >
                  {s}
                </a>
              ))}
            </div>
          </div>

          {[
            { title: 'Celebraciones', links: [['Bodas', '/proveedores?categoria=planner'], ['Cumpleaños', '/#packs'], ['Despedidas', '/#packs'], ['Aniversarios', '/#packs']] },
            { title: 'Profesionales', links: [['Registrarse', '/registro-proveedor'], ['Acceder', '/proveedor/login']] },
            { title: 'FiestaGo', links: [['Sobre nosotros', '#'], ['Contacto', 'mailto:contacto@fiestago.es'], ['Términos', '#'], ['Privacidad', '#']] },
          ].map(col => (
            <div key={col.title} className="md:col-span-2">
              <div className="text-[11px] tracking-[0.22em] uppercase text-gold font-medium mb-5">{col.title}</div>
              <div className="flex flex-col gap-3">
                {col.links.map(([label, href]) => (
                  <Link key={label} href={href} className="text-sm text-white/65 hover:text-white transition-colors">
                    {label}
                  </Link>
                ))}
              </div>
            </div>
          ))}

          <div className="md:col-span-1"></div>
        </div>

        <div className="border-t border-white/10 pt-6 flex flex-col md:flex-row justify-between items-center gap-3 text-[11px] tracking-[0.15em] uppercase text-white/40">
          <span>© 2026 FiestaGo · Todos los derechos reservados</span>
          <span>contacto@fiestago.es</span>
        </div>
      </div>
    </footer>
  )
}

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen bg-ivory text-ink">
      <Navbar />
      <div className="flex-1">{children}</div>
      <Footer />
    </div>
  )
}
