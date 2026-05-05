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
  const [ready,     setReady]     = useState(false)

  useEffect(() => {
    // Supabase sets the session automatically from the URL hash
    supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true)
    })
  }, [])

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) { toast.error('Las contraseñas no coinciden'); return }
    if (password.length < 8)  { toast.error('Mínimo 8 caracteres'); return }

    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      toast.success('Contraseña actualizada correctamente')
      setTimeout(() => router.push('/proveedor/login'), 1500)
    } catch (err: any) {
      toast.error(err.message || 'Error al actualizar la contraseña')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">🔒</div>
          <h1 className="font-serif text-2xl font-black text-ink mb-2">Nueva contraseña</h1>
          <p className="text-ink/55 text-sm">Introduce tu nueva contraseña para acceder al panel</p>
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
