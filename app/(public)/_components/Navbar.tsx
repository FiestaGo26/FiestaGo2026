'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useFavorites } from '@/lib/favorites'

type AuthState = {
  loading: boolean
  email: string | null
  isProvider: boolean
}

export default function Navbar() {
  const router   = useRouter()
  const supabase = createClient()
  const [auth, setAuth] = useState<AuthState>({ loading: true, email: null, isProvider: false })
  const favs = useFavorites()

  useEffect(() => {
    let active = true
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!active) return
      if (!user) {
        setAuth({ loading: false, email: null, isProvider: false })
        return
      }
      // Es proveedor si su email aparece en la tabla providers
      const { data: prov } = await supabase
        .from('providers')
        .select('id')
        .eq('email', user.email)
        .maybeSingle()
      setAuth({ loading: false, email: user.email || null, isProvider: !!prov })
    }
    load()
    // Reaccionar a cambios de sesión (login/logout en cualquier pestaña)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => { load() })
    return () => { active = false; subscription.unsubscribe() }
  }, [supabase])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/')
  }

  const panelHref = auth.isProvider ? '/proveedor/panel' : '/mi-cuenta'

  const link = 'whitespace-nowrap text-[15px] font-semibold text-ink px-3 py-2 hover:underline underline-offset-[6px] decoration-2'

  return (
    <header className="sticky top-0 z-50 bg-[#f4f1ec] font-[family-name:var(--font-schibsted)] tracking-[-0.01em]">
      <nav className="max-w-[1440px] mx-auto px-4 md:px-8 h-20 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-3" aria-label="FiestaGo — inicio">
          <img src="/logo.svg" alt="" className="h-12 w-auto" />
          <span className="hidden sm:inline text-[22px] font-extrabold tracking-[-0.06em] text-ink">FiestaGo</span>
        </Link>
        <div className="hidden lg:flex items-center gap-1">
          <Link href="/proveedores" className={link}>Proveedores</Link>
          <Link href="/servicios" className={link}>Servicios</Link>
          <div className="relative group">
            <button className={`${link} inline-flex items-center gap-1.5`}>
              Celebraciones
              <svg width="10" height="7" viewBox="0 0 12 8" aria-hidden="true"><path d="M1 1l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2" /></svg>
            </button>
            <div className="absolute top-full left-0 pt-2 invisible opacity-0 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100 transition-opacity duration-150 z-50">
              <div className="bg-[#f4f1ec] shadow-[0_12px_40px_rgba(10,10,10,0.14)] py-2 min-w-[240px]">
                {[
                  ['Bodas', '/proveedores?categoria=planner'],
                  ['Cumpleaños', '/cumpleanos'],
                  ['Comuniones y bautizos', '/comuniones'],
                  ['Eventos de empresa', '/corporativo'],
                ].map(([label, href]) => (
                  <Link key={href} href={href} className="block px-5 py-2.5 text-[15px] text-ink hover:bg-[#dedad3] transition-colors">
                    {label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
          <Link href="/monta-tu-celebracion" className={link}>Monta tu celebración</Link>
          <Link href="/calculadora" className={link}>Calculadora</Link>
          <Link href="/eventos-reales" className={link}>Inspírate</Link>
          {auth.email && !auth.isProvider && (
            <Link href="/mi-evento" className={link}>Mi evento</Link>
          )}
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          <Link href="/favoritos"
            aria-label="Mis favoritos"
            className="relative w-11 h-11 flex items-center justify-center text-ink hover:bg-[#dedad3] transition-colors">
            <svg width="22" height="20" viewBox="0 0 24 22" aria-hidden="true">
              <path d="M12 20.5S2 14.3 2 7.6A5.1 5.1 0 0 1 12 5a5.1 5.1 0 0 1 10 2.6c0 6.7-10 12.9-10 12.9Z"
                fill={favs.length > 0 ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
            </svg>
            {favs.length > 0 && (
              <span className="absolute top-1 right-0.5 min-w-[18px] h-[18px] rounded-full bg-[#256f82] text-white text-[11px] font-semibold flex items-center justify-center px-1">
                {favs.length > 99 ? '99+' : favs.length}
              </span>
            )}
          </Link>

          {auth.email && !auth.loading && (
            <>
              <Link href={panelHref} className={`${link} hidden md:inline-flex`}>
                {auth.isProvider ? 'Mi panel' : 'Mi cuenta'}
              </Link>
              <button onClick={handleLogout}
                className="text-[14px] text-ink/70 hover:text-ink px-2 transition-colors hidden lg:block">
                Salir
              </button>
            </>
          )}

          <Link href="/profesionales" className={`${link} hidden xl:inline-flex`}>Soy proveedor</Link>
          <Link href="/login" className={`${link} hidden sm:inline-flex`}>Acceder</Link>
          <Link href="/registro" className={`${link} hidden 2xl:inline-flex`}>Hazte socio</Link>
          <Link href="/servicios"
            className="inline-flex items-center h-11 px-5 bg-[#0a0a0a] text-[#f4f1ec] text-[15px] font-semibold hover:bg-[#2a2826] active:translate-y-px transition-colors">
            Reservar
          </Link>
        </div>
      </nav>
    </header>
  )
}
