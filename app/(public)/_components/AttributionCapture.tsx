'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { captureTouch } from '@/lib/attribution'

// Guarda utm_* y referrer de la visita (ver lib/attribution.ts).
export default function AttributionCapture() {
  const pathname = usePathname()
  useEffect(() => { captureTouch() }, [pathname])
  return null
}
