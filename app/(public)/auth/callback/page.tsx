'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function AuthCallbackPage() {
  const router   = useRouter()
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        router.push('/proveedor/panel')
      } else {
        router.push('/proveedor/login')
      }
    })
  }, [])

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center">
      <div className="text-center">
        <div className="text-4xl mb-4">🎉</div>
        <div className="text-ink/50 text-sm">Verificando acceso...</div>
      </div>
    </div>
  )
}
