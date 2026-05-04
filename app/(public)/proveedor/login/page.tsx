'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import toast from 'react-hot-toast'

export default function ProveedorLoginPage() {
  const [email,   setEmail]   = useState('')
  const [loading, setLoading] = useState(false)
  const [sent,    setSent]    = useState(false)
  const [mode,    setMode]    = useState<'magic'|'password'>('magic')
  const [password,setPassword]= useState('')

  const supabase = createClient()

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault()
    if (!email) return
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      if (error) throw error
      setSent(true)
      toast.success('Enlace enviado a tu email')
    } catch (err: any) {
      toast.error(err.message || 'Error al enviar el enlace')
    }
    setLoading(false)
  }

  async function handlePassword(e: React.FormEvent) {
    e.preventDefault()
    if (!email || !password) return
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      window.location.href = '/proveedor/panel'
    } catch (err: any) {
      toast.error(err.message || 'Email o contraseña incorrectos')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">🎉</div>
          <h1 className="font-serif text-2xl font-black text-ink mb-2">Panel del proveedor</h1>
          <p className="text-ink/55 text-sm">Accede con el email con el que te registraste</p>
        </div>

        {sent ? (
          <div className="bg-white border border-stone-200 rounded-2xl p-8 text-center shadow-card">
            <div className="text-4xl mb-4">📧</div>
            <h2 className="font-serif text-xl font-bold text-ink mb-3">Revisa tu email</h2>
            <p className="text-ink/55 text-sm leading-relaxed mb-6">
              Hemos enviado un enlace de acceso a{' '}
              <strong className="text-ink">{email}</strong>.
              Haz clic en el enlace para entrar a tu panel. Caduca en 15 minutos.
            </p>
            <button onClick={() => setSent(false)}
              className="text-sm text-coral hover:underline">
              Usar otro email
            </button>
          </div>
        ) : (
          <div className="bg-white border border-stone-200 rounded-2xl p-7 shadow-card">
            {/* Mode selector */}
            <div className="flex gap-2 mb-5 bg-stone-100 rounded-xl p-1">
              <button onClick={() => setMode('magic')}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  mode === 'magic' ? 'bg-white text-ink shadow-sm' : 'text-ink/50'
                }`}>
                🔗 Enlace mágico
              </button>
              <button onClick={() => setMode('password')}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  mode === 'password' ? 'bg-white text-ink shadow-sm' : 'text-ink/50'
                }`}>
                🔒 Contraseña
              </button>
            </div>

            {mode === 'magic' ? (
              <form onSubmit={handleMagicLink}>
                <div className="mb-5">
                  <label className="block text-xs font-bold text-ink/50 uppercase tracking-widest mb-2">
                    Tu email
                  </label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="hola@minegocio.com" required
                    className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm text-ink outline-none focus:border-coral transition-colors"/>
                </div>
                <button type="submit" disabled={loading}
                  className="w-full bg-coral text-white font-bold py-3 rounded-xl text-sm hover:bg-coral-dark transition-colors disabled:opacity-50">
                  {loading ? 'Enviando...' : 'Enviar enlace de acceso →'}
                </button>
                <p className="text-center text-xs text-ink/40 mt-3">
                  Te enviamos un enlace seguro que caduca en 15 minutos
                </p>
              </form>
            ) : (
              <form onSubmit={handlePassword}>
                <div className="mb-4">
                  <label className="block text-xs font-bold text-ink/50 uppercase tracking-widest mb-2">Email</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="hola@minegocio.com" required
                    className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm text-ink outline-none focus:border-coral transition-colors"/>
                </div>
                <div className="mb-5">
                  <label className="block text-xs font-bold text-ink/50 uppercase tracking-widest mb-2">Contraseña</label>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••" required
                    className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm text-ink outline-none focus:border-coral transition-colors"/>
                </div>
                <button type="submit" disabled={loading}
                  className="w-full bg-coral text-white font-bold py-3 rounded-xl text-sm hover:bg-coral-dark transition-colors disabled:opacity-50">
                  {loading ? 'Entrando...' : 'Entrar →'}
                </button>
                <button type="button" onClick={() => setMode('magic')}
                  className="w-full text-center text-xs text-coral hover:underline mt-3">
                  ¿Olvidaste tu contraseña? Usa el enlace mágico
                </button>
              </form>
            )}

            <p className="text-center text-xs text-ink/40 mt-5 pt-4 border-t border-stone-100">
              ¿No tienes cuenta?{' '}
              <a href="/registro-proveedor" className="text-coral hover:underline font-semibold">
                Regístrate gratis
              </a>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

