'use client'

import { useEffect, useState } from 'react'

// Registra el service worker + gestiona el prompt "Instalar la app".
// Es totalmente silencioso si el navegador no soporta PWA.
//
// Aparece un mini-banner una sola vez (se descarta o se acepta y se
// recuerda en localStorage). Solo en navegadores que lanzan el evento
// 'beforeinstallprompt' (Chrome, Edge, Samsung Internet). En iOS Safari
// no se puede automatizar el install; ahí ofrecemos instrucciones.

const DISMISSED_KEY = 'fg_pwa_install_dismissed'
const INSTALLED_KEY = 'fg_pwa_installed'

export default function PwaInit() {
  const [installEvt, setInstallEvt] = useState<any>(null)
  const [show, setShow]             = useState(false)
  const [isIos, setIsIos]           = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    // Registrar el SW
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(err =>
        console.warn('[SW] registro fallido:', err.message))
    }

    // Detectar iOS Safari (sin beforeinstallprompt nativo)
    const ua = window.navigator.userAgent
    const isIosUa = /iPhone|iPad|iPod/i.test(ua)
    const isStandalone = (window.navigator as any).standalone === true
                      || window.matchMedia('(display-mode: standalone)').matches
    const dismissed   = localStorage.getItem(DISMISSED_KEY) === '1'
    const alreadyInst = localStorage.getItem(INSTALLED_KEY) === '1'

    if (isStandalone || alreadyInst) return  // ya está instalado

    if (isIosUa && !dismissed) {
      // Mostrar mini-tutorial iOS después de 8s para no molestar al primer scroll
      const t = setTimeout(() => { setIsIos(true); setShow(true) }, 8_000)
      return () => clearTimeout(t)
    }

    // Chrome/Edge/Samsung: el navegador dispara beforeinstallprompt
    const handler = (e: Event) => {
      if (dismissed) return
      e.preventDefault()
      setInstallEvt(e)
      // Esperar a que el usuario haya visto algo de contenido antes del prompt
      setTimeout(() => setShow(true), 5_000)
    }
    window.addEventListener('beforeinstallprompt', handler)
    window.addEventListener('appinstalled', () => {
      localStorage.setItem(INSTALLED_KEY, '1')
      setShow(false)
    })
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  async function handleInstall() {
    if (!installEvt) return
    installEvt.prompt()
    const choice = await installEvt.userChoice
    if (choice.outcome === 'accepted') {
      localStorage.setItem(INSTALLED_KEY, '1')
    } else {
      localStorage.setItem(DISMISSED_KEY, '1')
    }
    setShow(false)
  }

  function handleDismiss() {
    localStorage.setItem(DISMISSED_KEY, '1')
    setShow(false)
  }

  if (!show) return null

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-md px-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-stone-200 overflow-hidden">
        <div className="bg-gradient-to-r from-coral to-coral-dark p-4 flex items-start gap-3">
          <div className="text-3xl">📱</div>
          <div className="flex-1">
            <div className="text-white font-bold text-sm">Instala FiestaGo en tu móvil</div>
            <div className="text-white/85 text-xs mt-0.5">
              Acceso directo, más rápido, funciona sin conexión.
            </div>
          </div>
          <button onClick={handleDismiss}
            aria-label="Cerrar"
            className="text-white/80 hover:text-white text-lg leading-none w-7 h-7 -mr-1 flex items-center justify-center">
            ×
          </button>
        </div>

        {isIos ? (
          <div className="p-4 text-xs text-ink/75 leading-relaxed">
            En tu iPhone toca el botón <strong>Compartir</strong> ⎙ del navegador
            y elige <strong>"Añadir a pantalla de inicio"</strong>.
          </div>
        ) : (
          <div className="p-4">
            <button onClick={handleInstall}
              className="w-full bg-ink text-white font-bold py-2.5 rounded-xl text-sm hover:bg-ink/85 transition-colors">
              Instalar app
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
