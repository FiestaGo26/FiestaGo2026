'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function AuthCallbackPage() {
  const router   = useRouter()
  const supabase = createClient()
  const [msg, setMsg] = useState('Verificando acceso...')

  useEffect(() => {
    async function handleCallback() {
      try {
        // Handle hash-based token (magic link)
        const hash = window.location.hash
        if (hash) {
          const params = new URLSearchParams(hash.substring(1))
          const accessToken  = params.get('access_token')
          const refreshToken = params.get('refresh_token')

          if (accessToken && refreshToken) {
            const { error } = await supabase.auth.setSession({
              access_token:  accessToken,
              refresh_token: refreshToken,
            })
            if (error) throw error
            setMsg('Acceso verificado. Redirigiendo...')
            router.push('/proveedor/panel')
            return
          }
        }

        // Handle code-based token (PKCE)
        const { data, error } = await supabase.auth.exchangeCodeForSession(
          window.location.search
        )
        if (error) throw error
        if (data.session) {
          setMsg('Acceso verificado. Redirigiendo...')
          router.push('/proveedor/panel')
          return
        }

        // Check existing session
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          router.push('/proveedor/panel')
        } else {
          setMsg('No se pudo verificar el acceso.')
          setTimeout(() => router.push('/proveedor/login'), 2000)
        }
      } catch (err) {
        console.error(err)
        setMsg('Error al verificar. Redirigiendo al login...')
        setTimeout(() => router.push('/proveedor/login'), 2000)
      }
    }

    handleCallback()
  }, [])

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center">
      <div className="text-center">
        <div className="text-4xl mb-4 animate-pulse">🎉</div>
        <div className="text-ink/50 text-sm">{msg}</div>
      </div>
    </div>
  )
}

