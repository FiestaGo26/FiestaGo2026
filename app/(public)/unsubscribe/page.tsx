'use client'

import { useEffect, useState, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

function UnsubscribeInner() {
  const sp = useSearchParams()
  const email = sp?.get('email') || ''
  const id    = sp?.get('id')    || ''
  const [status, setStatus] = useState<'loading'|'ok'|'error'>('loading')

  useEffect(() => {
    if (!email || !id) { setStatus('error'); return }
    fetch('/api/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, id }),
    })
      .then(r => r.json())
      .then(d => setStatus(d.ok ? 'ok' : 'error'))
      .catch(() => setStatus('error'))
  }, [email, id])

  return (
    <main className="min-h-screen bg-cream flex items-center justify-center px-6 py-16">
      <div className="bg-white border border-stone-200 rounded-3xl p-10 shadow-card max-w-md w-full text-center">
        {status === 'loading' && (
          <>
            <div className="text-4xl mb-4">⏳</div>
            <p className="text-ink/60">Procesando tu solicitud...</p>
          </>
        )}
        {status === 'ok' && (
          <>
            <div className="text-5xl mb-4">✓</div>
            <h1 className="font-serif text-2xl font-black text-ink mb-3">Listo, te has dado de baja</h1>
            <p className="text-ink/60 text-sm mb-6">
              No volverás a recibir emails de FiestaGo. Si lo hiciste por error, escríbenos a{' '}
              <a href="mailto:contacto@fiestago.es" className="text-coral font-semibold">contacto@fiestago.es</a>.
            </p>
            <Link href="/" className="text-xs uppercase tracking-widest font-semibold text-ink underline underline-offset-4">
              ← Volver al inicio
            </Link>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="text-4xl mb-4">😔</div>
            <h1 className="font-serif text-2xl font-black text-ink mb-3">No pudimos procesar tu baja</h1>
            <p className="text-ink/60 text-sm mb-6">
              Algo falló. Escríbenos a{' '}
              <a href="mailto:contacto@fiestago.es" className="text-coral font-semibold">contacto@fiestago.es</a>
              {' '}y te quitamos manualmente.
            </p>
            <Link href="/" className="text-xs uppercase tracking-widest font-semibold text-ink underline underline-offset-4">
              ← Volver al inicio
            </Link>
          </>
        )}
      </div>
    </main>
  )
}

export default function UnsubscribePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-ink/40">Cargando...</div>}>
      <UnsubscribeInner />
    </Suspense>
  )
}
