'use client'

// Cuenta cada página vista para la pestaña Visitas del panel
// (app/api/analytics/pageview). Sin cookies ni almacenamiento en el navegador.

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

let first = true

export default function PageViewTracker() {
  const pathname = usePathname()
  useEffect(() => {
    if (!pathname) return
    const params = new URLSearchParams(window.location.search)
    const body = JSON.stringify({
      path: pathname,
      referrer: first ? document.referrer : '',
      entry: first,
      utm_source: params.get('utm_source'), utm_medium: params.get('utm_medium'), utm_campaign: params.get('utm_campaign'),
      zone: params.get('zone'),
    })
    first = false
    try {
      if (!navigator.sendBeacon?.('/api/analytics/pageview', new Blob([body], { type: 'application/json' }))) throw new Error()
    } catch {
      fetch('/api/analytics/pageview', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {})
    }
  }, [pathname])
  return null
}
