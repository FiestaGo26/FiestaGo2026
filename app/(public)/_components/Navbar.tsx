'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

type AuthState = {
  loading: boolean
  email: string | null
  isProvider: boolean
}

export default function Navbar() {
  const router   = useRouter()
  const supabase = createClient()
  const [auth, setAuth] = useState<AuthState>({ loading: true, email: null, isProvider: false })

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
          <Link href="/#packs" className="text-sm font-medium text-ink/70 hover:text-coral px-3 py-2 rounded-xl transition-colors">
            Packs
          </Link>
        </div>

        <div className="flex items-center gap-2">
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
          <Link href="/registro-proveedor"
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
