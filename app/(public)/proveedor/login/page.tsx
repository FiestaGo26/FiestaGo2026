'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function ProveedorLoginPage() {
  const router = useRouter()
  const supabase = createClient()

  const [step, setStep] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  async function sendCode(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setInfo(null)

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false, // solo proveedores ya existentes
      },
    })

    setLoading(false)
    if (error) {
      setError(error.message)
    } else {
      setStep('code')
      setInfo('Te hemos enviado un código de 6 dígitos a tu email.')
    }
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.verifyOtp({
      email,
      token: code.trim(),
      type: 'email',
    })

    setLoading(false)
    if (error) {
      setError(error.message)
    } else {
      router.push('/proveedor/panel')
      router.refresh()
    }
  }

  return (
    <main style={{ maxWidth: 420, margin: '4rem auto', padding: '0 1rem' }}>
      <h1 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>
        Acceso proveedores
      </h1>
      <p style={{ color: '#6B7280', marginBottom: '2rem' }}>
        {step === 'email'
          ? 'Introduce tu email y te enviaremos un código de acceso.'
          : `Introduce el código de 6 dígitos que hemos enviado a ${email}.`}
      </p>

      {step === 'email' ? (
        <form onSubmit={sendCode}>
          <input
            type="email"
            required
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
            {loading ? 'Enviando...' : 'Enviar código'}
          </button>
        </form>
      ) : (
        <form onSubmit={verifyCode}>
          <input
            type="text"
            required
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid #D1D5DB',
              borderRadius: 8,
              marginBottom: '1rem',
              fontSize: '1.25rem',
              letterSpacing: '0.5rem',
              textAlign: 'center',
            }}
          />
          <button
            type="submit"
            disabled={loading || code.length !== 6}
            style={{
              width: '100%',
              padding: '0.75rem',
              background: '#7C3AED',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              fontSize: '1rem',
              cursor: loading ? 'wait' : 'pointer',
              opacity: loading || code.length !== 6 ? 0.6 : 1,
            }}
          >
            {loading ? 'Verificando...' : 'Acceder'}
          </button>
          <button
            type="button"
            onClick={() => {
              setStep('email')
              setCode('')
              setError(null)
              setInfo(null)
            }}
            style={{
              width: '100%',
              marginTop: '0.75rem',
              padding: '0.5rem',
              background: 'transparent',
              color: '#6B7280',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            ← Cambiar email
          </button>
        </form>
      )}

      {info && (
        <p style={{ color: '#065F46', marginTop: '1rem', fontSize: '0.9rem' }}>
          {info}
        </p>
      )}
      {error && (
        <p style={{ color: '#991B1B', marginTop: '1rem', fontSize: '0.9rem' }}>
          {error}
        </p>
      )}
    </main>
  )
}
