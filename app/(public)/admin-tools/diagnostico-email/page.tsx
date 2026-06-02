'use client'

import { useState } from 'react'

// Página de diagnóstico del envío de email. Para usar cuando NO llegan las
// notificaciones al admin (o al proveedor) tras un registro. Lanza un email
// de prueba contra /api/admin/test-email y muestra la respuesta de Resend
// con el error exacto.

type Result = {
  ok: boolean
  sentTo?: string
  resend?: { ok: boolean; error?: string; id?: string }
  envCheck?: Record<string, string>
  hint?: string
  error?: string
}

export default function DiagnosticoEmailPage() {
  const [token, setToken]   = useState('')
  const [to, setTo]         = useState('')
  const [loading, setLoad]  = useState(false)
  const [result, setResult] = useState<Result | null>(null)

  async function handleTest(e: React.FormEvent) {
    e.preventDefault()
    setLoad(true); setResult(null)
    try {
      const res = await fetch('/api/admin/test-email', {
        method: 'POST',
        headers: {
          'content-type':  'application/json',
          'x-admin-token': token,
        },
        body: JSON.stringify({ to }),
      })
      const data = await res.json().catch(() => ({ ok: false, error: 'Respuesta no es JSON' }))
      setResult(data)
    } catch (err: any) {
      setResult({ ok: false, error: err.message || 'Error de red' })
    } finally {
      setLoad(false)
    }
  }

  return (
    <main className="bg-cream min-h-screen">
      <div className="max-w-3xl mx-auto px-6 py-10">

        <div className="mb-8">
          <a href="/admin" className="text-xs text-ink/50 hover:text-coral">← Volver al admin</a>
          <h1 className="font-serif text-3xl font-bold text-ink mt-2">Diagnóstico de email</h1>
          <p className="text-sm text-ink/65 mt-2 max-w-xl leading-relaxed">
            Si las notificaciones de nuevos proveedores o reservas no te llegan,
            usa esta página para lanzar un email de prueba y ver el error real
            de Resend (dominio no verificado, API key vencida, rate limit, etc.).
          </p>
        </div>

        <div className="bg-white border border-stone-200 rounded-2xl p-6 mb-6">
          <form onSubmit={handleTest} className="flex flex-col gap-4">

            <div>
              <label className="block text-xs font-bold text-ink/50 uppercase tracking-widest mb-1">
                Admin token *
              </label>
              <input type="password" required value={token}
                onChange={e => setToken(e.target.value)}
                placeholder="El valor de ADMIN_TOKEN configurado en Netlify"
                className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm font-mono outline-none focus:border-coral"/>
              <p className="text-[11px] text-ink/45 mt-1.5 leading-snug">
                Configurado en Netlify → Site settings → Environment variables → <code className="bg-stone-100 px-1.5 py-0.5 rounded">ADMIN_TOKEN</code>.
                Si aún no existe, créalo (cadena de mín. 12 caracteres) y haz un redeploy.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-ink/50 uppercase tracking-widest mb-1">
                Email destinatario *
              </label>
              <input type="email" required value={to}
                onChange={e => setTo(e.target.value)}
                placeholder="tu@email.com"
                className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-coral"/>
              <p className="text-[11px] text-ink/45 mt-1.5">A dónde quieres que llegue el email de prueba.</p>
            </div>

            <button type="submit" disabled={loading || !token || !to}
              className="bg-coral text-white font-bold py-3 rounded-xl text-sm hover:bg-coral-dark disabled:opacity-50 transition-colors">
              {loading ? 'Enviando…' : '🚀 Lanzar test'}
            </button>
          </form>
        </div>

        {result && (
          <div className={`border-2 rounded-2xl p-6 ${result.ok ? 'bg-sage/5 border-sage/40' : 'bg-coral/5 border-coral/40'}`}>
            <div className="flex items-center gap-3 mb-4">
              <div className={`text-3xl ${result.ok ? 'text-sage' : 'text-coral'}`}>
                {result.ok ? '✅' : '❌'}
              </div>
              <div>
                <div className="font-bold text-lg text-ink">
                  {result.ok ? 'Email enviado' : 'Email NO enviado'}
                </div>
                <div className="text-sm text-ink/65">{result.hint || result.error}</div>
              </div>
            </div>

            {result.resend?.error && (
              <div className="bg-white border border-coral/30 rounded-xl p-4 mb-4">
                <div className="text-[10px] font-bold uppercase tracking-widest text-coral mb-1">Error de Resend</div>
                <div className="font-mono text-sm text-ink break-words">{result.resend.error}</div>
              </div>
            )}

            {result.resend?.id && (
              <div className="bg-white border border-sage/30 rounded-xl p-4 mb-4">
                <div className="text-[10px] font-bold uppercase tracking-widest text-sage mb-1">ID del email en Resend</div>
                <div className="font-mono text-xs text-ink">{result.resend.id}</div>
                <div className="text-xs text-ink/55 mt-1">
                  Puedes buscarlo en <a href="https://resend.com/emails" target="_blank" className="underline">resend.com/emails</a> para ver si abrió, hizo bounce o spam.
                </div>
              </div>
            )}

            {result.envCheck && (
              <div className="bg-white border border-stone-200 rounded-xl p-4">
                <div className="text-[10px] font-bold uppercase tracking-widest text-ink/50 mb-3">Variables de entorno en Netlify</div>
                <div className="space-y-2">
                  {Object.entries(result.envCheck).map(([k, v]) => {
                    const missing = v === 'FALTA' || v.startsWith('(no configurada')
                    return (
                      <div key={k} className="flex items-start gap-3 text-sm">
                        <span className={`mt-0.5 ${missing ? 'text-coral' : 'text-sage'}`}>{missing ? '⚠️' : '✓'}</span>
                        <div className="flex-1">
                          <code className="text-xs font-bold text-ink">{k}</code>
                          <div className={`text-xs ${missing ? 'text-coral' : 'text-ink/60'}`}>{v}</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="mt-8 bg-white border border-stone-200 rounded-2xl p-5">
          <h3 className="font-bold text-sm text-ink mb-3">Causas habituales de "Email NO enviado"</h3>
          <ul className="space-y-2.5 text-xs text-ink/70 leading-relaxed">
            <li>
              <strong className="text-ink">"You can only send testing emails…"</strong> —
              la API key es de tipo testing/sandbox. Crea una de producción en Resend.
            </li>
            <li>
              <strong className="text-ink">"The fiestago.es domain is not verified"</strong> —
              el <code>OUTREACH_FROM</code> apunta a un subdominio sin verificar. Verifica
              el dominio exacto en <a href="https://resend.com/domains" target="_blank" className="underline">resend.com/domains</a>.
            </li>
            <li>
              <strong className="text-ink">"Invalid API key"</strong> —
              la key se revocó o se copió con espacios. Regenera y pega de nuevo.
            </li>
            <li>
              <strong className="text-ink">"Rate limit exceeded"</strong> —
              superaste el cupo del plan (free son 100/día). Sube de plan o espera.
            </li>
          </ul>
        </div>

      </div>
    </main>
  )
}
