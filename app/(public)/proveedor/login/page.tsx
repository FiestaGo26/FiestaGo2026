'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function ProveedorLoginPage() {
  const router = useRouter()
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    setLoading(false)
    if (error) {
      setError(traducirError(error.message))
    } else {
      router.push('/proveedor/panel')
      router.refresh()
    }
  }

  function traducirError(msg: string) {
    if (msg.includes('Invalid login credentials')) return 'Email o contraseña incorrectos.'
    if (msg.includes('Email not confirmed')) return 'Tienes que confirmar tu email antes de acceder.'
    return msg
  }

  return (
    <main style={{ maxWidth: 420, margin: '4rem auto', padding: '0 1rem' }}>
      <h1 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>
        Acceso proveedores
      </h1>
      <p style={{ color: '#6B7280', marginBottom: '2rem' }}>
        Introduce tu email y contraseña para entrar a tu panel.
      </p>

      <form onSubmit={handleLogin}>
        <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.9rem', color: '#374151' }}>
          Email
        </label>
        <input
          type="email"
          required
          autoComplete="email"
          placeholder="tu@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{
            width: '100%',
            padding: '0.75rem',
            border: '1px solid #D1D5DB',
            borderRadius: 8,
            marginBottom: '1rem',
            fontSize: '1rem',
          }}
        />

        <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.9rem', color: '#374151' }}>
          Contraseña
        </label>
        <input
          type="password"
          required
          autoComplete="current-password"
          placeholder="Tu contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{
            width: '100%',
            padding: '0.75rem',
            border: '1px solid #D1D5DB',
            borderRadius: 8,
            marginBottom: '1rem',
            fontSize: '1rem',
          }}
        />

        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: '0.75rem',
            background: '#7C3AED',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            fontSize: '1rem',
            cursor: loading ? 'wait' : 'pointer',
          }}
        >
          {loading ? 'Entrando...' : 'Acceder'}
        </button>
      </form>

      {error && (
        <p style={{ color: '#991B1B', marginTop: '1rem', fontSize: '0.9rem' }}>
          {error}
        </p>
      )}

      <p style={{ marginTop: '2rem', fontSize: '0.85rem', color: '#6B7280', textAlign: 'center' }}>
        ¿Aún no eres proveedor?{' '}
        <a href="/proveedores/alta" style={{ color: '#7C3AED' }}>
          Solicita el alta aquí
        </a>
      </p>
    </main>
  )
}
