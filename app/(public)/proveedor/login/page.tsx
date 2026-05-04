'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

export default function ProveedorLoginPage() {
  const router = useRouter()
  const [email,    setEmail]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const [sent,     setSent]     = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!email) return
    setLoading(true)

    try {
      const res  = await fetch('/api/proveedor/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)

      if (data.token) {
        // Guardar token en localStorage
        localStorage.setItem('fg_provider_token', data.token)
        localStorage.setItem('fg_provider_id',    data.providerId)
        router.push('/proveedor/panel')
      } else {
        setSent(true)
      }
    } catch (err: any) {
      toast.error(err.message || 'Error al iniciar sesión')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">🎉</div>
          <h1 className="font-serif text-2xl font-black text-ink mb-2">Panel del proveedor</h1>
          <p className="text-ink/55 text-sm">Accede con el email con el que te registraste en FiestaGo</p>
        </div>

        {sent ? (
          <div className="bg-white border border-stone-200 rounded-2xl p-8 text-center shadow-card">
            <div className="text-4xl mb-4">📧</div>
            <h2 className="font-serif text-xl font-bold text-ink mb-3">Revisa tu email</h2>
            <p className="text-ink/55 text-sm leading-relaxed mb-6">
              Hemos enviado un enlace de acceso a <strong className="text-ink">{email}</strong>.
              Haz clic en el enlace para entrar a tu panel.
            </p>
            <button onClick={() => setSent(false)}
              className="text-sm text-coral hover:underline">
              Usar otro email
            </button>
          </div>
        ) : (
          <form onSubmit={handleLogin}
            className="bg-white border border-stone-200 rounded-2xl p-7 shadow-card">
            <div className="mb-5">
              <label className="block text-xs font-bold text-ink/50 uppercase tracking-widest mb-2">
                Tu email de proveedor
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="hola@minegocio.com"
                required
                className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm text-ink outline-none focus:border-coral transition-colors"
              />
            </div>
            <button type="submit" disabled={loading}
              className="w-full bg-coral text-white font-bold py-3 rounded-xl text-sm hover:bg-coral-dark transition-colors disabled:opacity-50">
              {loading ? 'Verificando...' : 'Acceder a mi panel →'}
            </button>
            <p className="text-center text-xs text-ink/40 mt-4">
              ¿No tienes cuenta?{' '}
              <a href="/registro-proveedor" className="text-coral hover:underline">
                Regístrate gratis
              </a>
            </p>
          </form>
        )}
      </div>
    </div>
  )
}

