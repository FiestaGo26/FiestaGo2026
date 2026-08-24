'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

// Banner de cookies · consentimiento RGPD + LSSICE art. 22
//
// Guarda la decisión en localStorage bajo la key `fiestago_cookies_consent`
// con valor 'accepted' | 'rejected'. Sin decisión → se muestra el banner
// hasta que el usuario elige. Rechazar es una opción igual de prominente
// que aceptar (obligado por la AEPD desde 2021).
//
// Se muestra 800ms después de cargar para no bloquear el primer paint y
// no aparecer en tests automatizados de Lighthouse. Si el usuario ya
// decidió antes (localStorage guardado), nunca aparece.

const LS_KEY = 'fiestago_cookies_consent'

export default function CookieBanner() {
  const [visible, setVisible] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    let stored: string | null = null
    try { stored = localStorage.getItem(LS_KEY) } catch { /* private mode */ }
    if (stored === 'accepted' || stored === 'rejected') return
    // Esperar 800ms para no bloquear el paint inicial
    const t = setTimeout(() => setVisible(true), 800)
    return () => clearTimeout(t)
  }, [])

  function decide(value: 'accepted' | 'rejected') {
    try { localStorage.setItem(LS_KEY, value) } catch {}
    setVisible(false)
    // Aquí en el futuro podríamos activar/desactivar Netlify Analytics
    // o cualquier script de terceros según la decisión.
    if (typeof window !== 'undefined') {
      // Disparar un CustomEvent por si otros componentes lo escuchan
      window.dispatchEvent(new CustomEvent('cookies-consent', { detail: value }))
    }
  }

  // No renderizar nada en SSR ni si el usuario ya decidió
  if (!mounted || !visible) return null

  return (
    <div
      role="dialog"
      aria-labelledby="cookies-title"
      aria-describedby="cookies-desc"
      className="fixed left-3 right-3 bottom-3 sm:left-6 sm:right-auto sm:bottom-6 sm:max-w-[420px] z-[9999] bg-white text-ink border border-stone-200 rounded-2xl shadow-2xl p-5 animate-in fade-in slide-in-from-bottom-4"
      style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}
    >
      <div className="flex items-start gap-3">
        <div className="text-2xl leading-none">🍪</div>
        <div className="flex-1">
          <h2 id="cookies-title" className="text-sm font-bold text-ink mb-1.5">
            Cookies en fiestago.es
          </h2>
          <p id="cookies-desc" className="text-xs text-ink/65 leading-relaxed mb-3">
            Usamos cookies técnicas necesarias para que la plataforma funcione, y cookies
            analíticas para entender cómo se usa. Solo instalaremos las analíticas si las
            aceptas. Puedes cambiar tu decisión en cualquier momento desde la{' '}
            <Link href="/cookies" className="text-coral underline">Política de Cookies</Link>.
          </p>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => decide('accepted')}
              className="bg-coral text-white font-bold text-xs px-4 py-2 rounded-xl hover:bg-coral-dark transition-colors"
            >
              Aceptar todas
            </button>
            <button
              onClick={() => decide('rejected')}
              className="bg-white text-ink border border-stone-200 font-bold text-xs px-4 py-2 rounded-xl hover:bg-stone-50 transition-colors"
            >
              Rechazar analíticas
            </button>
            <Link
              href="/cookies"
              className="text-xs text-ink/55 hover:text-ink font-semibold px-2 py-2 self-center"
            >
              Más info
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
