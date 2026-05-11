'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const router   = useRouter()
  const supabase = createClient()

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [saving,   setSaving]   = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      toast.success('¡Bienvenido de vuelta!')
      router.push('/mi-cuenta')
    } catch (err: any) {
      toast.error(err.message || 'Email o contraseña incorrectos')
    }
    setSaving(false)
  }

  return (
    <div className="min-h-screen bg-cream py-16 px-6">
      <div className="max-w-md mx-auto">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-ink/50 hover:text-coral mb-6 transition-colors">
          ← Volver al inicio
        </Link>

        <div className="bg-white border border-stone-200 rounded-2xl p-8 shadow-card">
          <div className="text-center mb-6">
            <h1 className="font-serif text-3xl font-black text-ink mb-2">Inicia sesión</h1>
            <p className="text-ink/55 text-sm">Accede a tu calendario de reservas y descuentos.</p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div>
              <label className="block text-xs font-bold text-ink/50 uppercase tracking-widest mb-1">Email</label>
              <input required type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="tu@email.com"
                className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm text-ink outline-none focus:border-coral transition-colors"/>
            </div>
            <div>
              <label className="block text-xs font-bold text-ink/50 uppercase tracking-widest mb-1">Contraseña</label>
              <input required type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm text-ink outline-none focus:border-coral transition-colors"/>
            </div>

            <button type="submit" disabled={saving}
              className="bg-coral text-white font-bold py-3 rounded-xl text-sm hover:bg-coral-dark transition-colors disabled:opacity-50 mt-2">
              {saving ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-stone-100 text-center text-sm text-ink/60">
            ¿Aún no tienes cuenta? <Link href="/registro" className="text-coral font-semibold hover:underline">Hazte socio gratis</Link>
          </div>
        </div>

        <div className="mt-6 text-center text-xs text-ink/40">
          ¿Eres profesional? <Link href="/proveedor/login" className="text-coral hover:underline">Acceso de proveedor</Link>
        </div>
      </div>
    </div>
  )
}
