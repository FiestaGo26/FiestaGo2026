'use client'

// Error boundary específico del panel /admin. En lugar del genérico
// "Application error: a client-side exception has occurred" muestra
// el mensaje + stack en pantalla para poder diagnosticar problemas
// en móvil sin conectar el inspector de Safari iOS.

import { useEffect, useState } from 'react'

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error('[admin error boundary]', error)
  }, [error])

  const fullText = [
    `MSG: ${error.message}`,
    error.digest ? `DIGEST: ${error.digest}` : null,
    `URL: ${typeof window !== 'undefined' ? window.location.href : ''}`,
    `UA: ${typeof navigator !== 'undefined' ? navigator.userAgent : ''}`,
    `STACK:\n${error.stack || '(sin stack)'}`,
  ].filter(Boolean).join('\n\n')

  async function copyAll() {
    try {
      await navigator.clipboard.writeText(fullText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Safari iOS a veces falla con clipboard fuera de gesture: caemos a select
      const ta = document.getElementById('err-textarea') as HTMLTextAreaElement | null
      if (ta) { ta.select() }
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#080B12',
      color: '#F0F4FF',
      padding: 16,
      fontFamily: 'IBM Plex Mono, ui-monospace, monospace',
      fontSize: 13,
      lineHeight: 1.5,
    }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: '#EF4444', marginBottom: 12 }}>
          ⚠️ Error en el panel admin
        </div>

        <div style={{
          background: '#7F1D1D22',
          border: '1px solid #DC2626',
          borderRadius: 10,
          padding: 12,
          marginBottom: 12,
          color: '#FCA5A5',
          wordBreak: 'break-word',
        }}>
          <strong>{error.message || '(sin mensaje)'}</strong>
          {error.digest && (
            <div style={{ marginTop: 6, fontSize: 11, opacity: 0.8 }}>
              digest: {error.digest}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <button onClick={() => reset()} style={{
            background: '#06B6D4', color: '#000',
            padding: '10px 16px', borderRadius: 8, border: 'none',
            fontWeight: 700, fontSize: 13, cursor: 'pointer',
          }}>
            🔄 Reintentar
          </button>
          <button onClick={copyAll} style={{
            background: 'transparent', color: '#F0F4FF',
            padding: '10px 16px', borderRadius: 8,
            border: '1px solid #1F2937',
            fontWeight: 700, fontSize: 13, cursor: 'pointer',
          }}>
            {copied ? '✓ Copiado' : '📋 Copiar todo'}
          </button>
          <button onClick={() => { try { localStorage.removeItem('fg_admin_pass') } catch {}; location.reload() }} style={{
            background: 'transparent', color: '#9CA3AF',
            padding: '10px 16px', borderRadius: 8,
            border: '1px solid #1F2937',
            fontWeight: 700, fontSize: 13, cursor: 'pointer',
          }}>
            🚪 Cerrar sesión y recargar
          </button>
        </div>

        <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 6 }}>
          Selecciona y copia este texto, mándamelo y arreglo lo que sea:
        </div>
        <textarea
          id="err-textarea"
          readOnly
          value={fullText}
          rows={14}
          style={{
            width: '100%',
            background: '#111827',
            color: '#F0F4FF',
            border: '1px solid #1F2937',
            borderRadius: 10,
            padding: 10,
            fontSize: 11,
            fontFamily: 'inherit',
            resize: 'vertical',
          }}
        />
      </div>
    </div>
  )
}
