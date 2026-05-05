'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import toast from 'react-hot-toast'

export default function ResetPasswordPage() {
  const router   = useRouter()
  const supabase = createClient()
  const [password,  setPassword]  = useState('')
  const [confirm,   setConfirm]   = useState('')
  const [loading,   setLoading]   = useState(false)
  const [verifying, setVerifying] = useState(true)
  const [error,     setError]     = useState('')

  useEffect(() => {
    async function verifyToken() {
      try {
        // Get token from URL params
        const params = new URLSearchParams(window.location.search)
        const tokenHash = params.get('token_hash')
        const type      = params.get('type')

        // Also check hash fragment (some Supabase versions use this)
        const hash       = window.location.hash.substring(1)
        const hashParams = new URLSearchParams(hash)
        const accessToken  = hashParams.get('access_token')
        const refreshToken = hashParams.get('refresh_token')

        if (accessToken && refreshToken) {
          // Set session from hash tokens
          const { error } = await supabase.auth.setSession({
            access_token:  accessToken,
            refresh_token: refreshToken,
          })
          if (error) throw error
          setVerifying(false)
          return
        }

        if (tokenHash && type === 'recovery') {
          // Verify OTP token
          const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: 'recovery',
          })
          if (error) throw error
          setVerifying(false)
          return
        }

        // Check if already has session
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          setVerifying(false)
          return
        }

        setError('Enlace inválido o caducado. Solicita uno nuevo.')
      } catch (err: any) {
        setError('Enlace inválido o caducado. Solicita uno nuevo.')
      }
    }

    verifyToken()
  }, [])

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) { toast.error('Las contraseñas no coinciden'); return }
    if (password.length < 8)  { toast.error('Mínimo 8 caracteres'); return }

    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      toast.success('Contraseña actualizada correctamente ✓')
      setTimeout(() => router.push('/proveedor/login'), 1500)
    } catch (err: any) {
      toast.error(err.message || 'Error al actualizar la contraseña')
    }
    setLoading(false)
  }

  if (verifying && !error) return (
    <div className="min-h-screen bg-cream flex items-center justify-center">
      <div className="text-center">
        <div className="text-4xl mb-4 animate-pulse">🔒</div>
        <div className="text-ink/50 text-sm">Verificando enlace...</div>
      </div>
    </div>
  )

  if (error) return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        <div className="text-4xl mb-4">⚠️</div>
        <h2 className="font-serif text-xl font-bold text-ink mb-3">Enlace inválido</h2>
        <p className="text-ink/55 text-sm mb-6">{error}</p>
        <a href="/proveedor/login"
          className="inline-block bg-coral text-white font-bold px-8 py-3 rounded-xl text-sm hover:bg-coral-dark transition-colors">
          Volver al login
        </a>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">🔒</div>
          <h1 className="font-serif text-2xl font-black text-ink mb-2">Nueva contraseña</h1>
          <p className="text-ink/55 text-sm">Introduce tu nueva contraseña</p>
        </div>

        <form onSubmit={handleReset} className="bg-white border border-stone-200 rounded-2xl p-7 shadow-card">
          <div className="mb-4">
            <label className="block text-xs font-bold text-ink/50 uppercase tracking-widest mb-2">
              Nueva contraseña
            </label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres" required
              className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm text-ink outline-none focus:border-coral transition-colors"/>
          </div>

          <div className="mb-6">
            <label className="block text-xs font-bold text-ink/50 uppercase tracking-widest mb-2">
              Confirmar contraseña
            </label>
            <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
              placeholder="Repite la contraseña" required
              className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm text-ink outline-none focus:border-coral transition-colors"/>
          </div>

          <button type="submit" disabled={loading}
            className="w-full bg-coral text-white font-bold py-3 rounded-xl text-sm hover:bg-coral-dark transition-colors disabled:opacity-50">
            {loading ? 'Actualizando...' : 'Guardar nueva contraseña →'}
          </button>
        </form>
      </div>
    </div>
  )
}
