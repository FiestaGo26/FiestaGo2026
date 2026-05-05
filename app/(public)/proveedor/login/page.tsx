'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import toast from 'react-hot-toast'

export default function ProveedorLoginPage() {
  const router   = useRouter()
  const supabase = createClient()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      router.push('/proveedor/panel')
    } catch (err: any) {
      toast.error('Email o contraseña incorrectos')
    }
    setLoading(false)
  }

  async function handleForgot() {
    if (!email) { toast.error('Introduce tu email primero'); return }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/proveedor/panel`,
    })
    if (error) { toast.error('Error al enviar el email'); return }
    toast.success('Te hemos enviado un enlace para restablecer tu contraseña')
  }

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">🎉</div>
          <h1 className="font-serif text-2xl font-black text-ink mb-2">Accede a tu panel</h1>
          <p className="text-ink/55 text-sm">Introduce tu email y contraseña</p>
        </div>

        <form onSubmit={handleLogin} className="bg-white border border-stone-200 rounded-2xl p-7 shadow-card">
          <div className="mb-4">
            <label className="block text-xs font-bold text-ink/50 uppercase tracking-widest mb-2">Email</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} required
              placeholder="hola@minegocio.com"
              className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm text-ink outline-none focus:border-coral transition-colors"/>
          </div>

          <div className="mb-2">
            <label className="block text-xs font-bold text-ink/50 uppercase tracking-widest mb-2">Contraseña</label>
            <input type="password" value={password} onChange={e=>setPassword(e.target.value)} required
              placeholder="••••••••"
              className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm text-ink outline-none focus:border-coral transition-colors"/>
          </div>

          <div className="text-right mb-5">
            <button type="button" onClick={handleForgot}
              className="text-xs text-coral hover:underline">
              ¿Olvidaste tu contraseña?
            </button>
          </div>

          <button type="submit" disabled={loading}
            className="w-full bg-coral text-white font-bold py-3 rounded-xl text-sm hover:bg-coral-dark transition-colors disabled:opacity-50">
            {loading ? 'Entrando...' : 'Entrar a mi panel →'}
          </button>

          <p className="text-center text-xs text-ink/40 mt-5 pt-4 border-t border-stone-100">
            ¿No tienes cuenta?{' '}
            <a href="/registro-proveedor" className="text-coral hover:underline font-semibold">
              Regístrate gratis
            </a>
          </p>
        </form>
      </div>
    </div>
  )
}
