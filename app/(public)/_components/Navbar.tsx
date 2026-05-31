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

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-stone-200 shadow-sm">
      <nav className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="font-serif text-xl font-black text-ink tracking-tight flex items-center gap-2">
          <span className="text-2xl">🎉</span> FiestaGo
        </Link>
        <div className="hidden md:flex items-center gap-1">
          <Link href="/servicios" className="text-sm font-medium text-ink/70 hover:text-coral px-3 py-2 rounded-xl transition-colors">
            Servicios
          </Link>
          <div className="relative group">
            <button className="text-sm font-medium text-ink/70 hover:text-coral px-3 py-2 rounded-xl transition-colors inline-flex items-center gap-1">
              Celebraciones <span className="text-[10px]">▾</span>
            </button>
            <div className="absolute top-full left-0 pt-1 invisible opacity-0 group-hover:visible group-hover:opacity-100 transition-all duration-150 z-50">
              <div className="bg-white border border-stone-200 rounded-2xl shadow-xl py-2 min-w-[220px]">
                <Link href="/cumpleanos" className="block px-4 py-2 text-sm text-ink/80 hover:text-coral hover:bg-cream transition-colors">
                  🎂 Cumpleaños
                </Link>
                <Link href="/comuniones" className="block px-4 py-2 text-sm text-ink/80 hover:text-coral hover:bg-cream transition-colors">
                  ✨ Comuniones y bautizos
                </Link>
                <Link href="/corporativo" className="block px-4 py-2 text-sm text-ink/80 hover:text-coral hover:bg-cream transition-colors">
                  🏢 Eventos corporativos
                </Link>
                <Link href="/proveedores?categoria=planner" className="block px-4 py-2 text-sm text-ink/80 hover:text-coral hover:bg-cream transition-colors">
                  💍 Bodas
                </Link>
              </div>
            </div>
          </div>
          <Link href="/calculadora" className="text-sm font-medium text-ink/70 hover:text-coral px-3 py-2 rounded-xl transition-colors">
            🧮 Calculadora
          </Link>
          <Link href="/quiz" className="text-sm font-medium text-ink/70 hover:text-coral px-3 py-2 rounded-xl transition-colors">
            ✨ Quiz
          </Link>
          <Link href="/eventos-reales" className="text-sm font-medium text-ink/70 hover:text-coral px-3 py-2 rounded-xl transition-colors">
            📸 Inspírate
          </Link>
          {auth.email && !auth.isProvider && (
            <Link href="/mi-evento" className="text-sm font-medium text-ink/70 hover:text-coral px-3 py-2 rounded-xl transition-colors">
              📅 Mi evento
            </Link>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Corazón de favoritos — siempre visible, badge con count si hay alguno */}
          <Link href="/favoritos"
            aria-label="Mis favoritos"
            className="relative w-10 h-10 rounded-xl flex items-center justify-center text-lg
              border border-stone-200 text-ink hover:border-coral hover:text-coral transition-colors">
            <span>{favs.length > 0 ? '❤️' : '🤍'}</span>
            {favs.length > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-coral text-white text-[10px] font-bold flex items-center justify-center px-1">
                {favs.length > 99 ? '99+' : favs.length}
              </span>
            )}
          </Link>

          {/* Mi panel + Salir SOLO si está logueado (extra, antes de los botones de auth) */}
          {auth.email && !auth.loading && (
            <>
              <Link href={panelHref}
                className="text-sm font-semibold bg-ink text-white px-4 py-2 rounded-xl hover:bg-ink/85 transition-colors hidden md:inline-flex items-center gap-2">
                {auth.isProvider ? '🛠 Mi panel' : '📅 Mi cuenta'}
              </Link>
              <button onClick={handleLogout}
                className="text-xs text-ink/50 hover:text-coral px-2 transition-colors hidden lg:block">
                Salir
              </button>
            </>
          )}

          {/* Botones de auth SIEMPRE visibles (logueado o no) */}
          <Link href="/profesionales"
            className="hidden sm:inline-flex items-center gap-1 text-sm font-semibold border border-stone-200 text-ink px-4 py-2 rounded-xl hover:border-coral hover:text-coral transition-colors">
            🛠 Soy proveedor
          </Link>
          <Link href="/login"
            className="text-sm font-semibold border border-stone-200 text-ink px-4 py-2 rounded-xl hover:border-coral hover:text-coral transition-colors hidden sm:block">
            Acceder
          </Link>
          <Link href="/registro"
            className="text-sm font-semibold border border-coral/40 text-coral px-4 py-2 rounded-xl hover:bg-coral hover:text-white transition-colors hidden sm:block">
            Hazte socio
          </Link>
          <Link href="/servicios"
            className="text-sm font-bold bg-coral text-white px-5 py-2 rounded-xl hover:bg-coral-dark transition-colors shadow-coral">
            Reservar
          </Link>
        </div>
      </nav>
    </header>
  )
}
