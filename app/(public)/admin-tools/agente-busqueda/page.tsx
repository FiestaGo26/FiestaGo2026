'use client'

import { useEffect, useState } from 'react'
import { CATEGORIES } from '@/lib/constants'

// Página de búsqueda agéntica de proveedores. El admin elige categoría +
// ciudad, lanza una búsqueda contra Google Places, y los resultados se
// insertan en `providers` como leads (status=pending, tag='Lead Google Places').
// Después se aprueban o descartan desde /admin.

const CITY_DEFAULTS = ['Valencia', 'Madrid', 'Barcelona', 'Sevilla', 'Bilbao', 'Málaga', 'Alicante', 'Zaragoza']

type RunResult = {
  ok:            boolean
  searched:      number
  inserted:      number
  skipped:       number
  skippedItems?: Array<{ name?: string; reason: string }>
  insertedItems?: Array<{ id: string; name: string; city: string; phone?: string; website?: string; google_rating?: number }>
  error?:        string
  query?:        string
  city?:         string
}

export default function AgenteBusquedaPage() {
  const [token, setToken]         = useState('')
  const [category, setCategory]   = useState('catering')
  const [city, setCity]           = useState('Valencia')
  const [extraQuery, setExtraQuery] = useState('')
  const [maxResults, setMaxResults] = useState(20)
  const [loading, setLoading]     = useState(false)
  const [result, setResult]       = useState<RunResult | null>(null)
  const [error, setError]         = useState<string | null>(null)
  const [history, setHistory]     = useState<RunResult[]>([])

  useEffect(() => {
    const t = sessionStorage.getItem('fg_admin_token')
    if (t) setToken(t)
  }, [])
  useEffect(() => {
    if (token) sessionStorage.setItem('fg_admin_token', token)
  }, [token])

  async function runSearch() {
    setLoading(true); setError(null); setResult(null)
    try {
      const res = await fetch('/api/admin/agent/search', {
        method:  'POST',
        headers: { 'content-type': 'application/json', 'x-admin-token': token },
        body:    JSON.stringify({ category, city, extraQuery, maxResults }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok && !data.ok) {
        setError(data.error || `Error ${res.status}`)
      }
      setResult(data)
      setHistory(prev => [data, ...prev].slice(0, 10))
    } catch (e: any) {
      setError(e.message || 'Error de red')
    } finally {
      setLoading(false)
    }
  }

  const cat = CATEGORIES.find((c: any) => c.id === category)

  return (
    <main className="bg-cream min-h-screen">
      <div className="max-w-5xl mx-auto px-6 py-10">

        <div className="mb-8">
          <a href="/admin" className="text-xs text-ink/50 hover:text-coral">← Volver al admin</a>
          <h1 className="font-serif text-3xl font-bold text-ink mt-2">🔍 Agente Searcher</h1>
          <p className="text-sm text-ink/65 mt-2 max-w-2xl leading-relaxed">
            Busca proveedores reales en Google Places por categoría y ciudad,
            y los crea en <code className="bg-stone-100 px-1.5 py-0.5 rounded text-xs">providers</code> como
            leads (status pending, tag <em>Lead Google Places</em>) para que tú
            los apruebes o descartes desde el panel admin.
          </p>
        </div>

        <div className="bg-white border border-stone-200 rounded-2xl p-6 mb-6">
          <div className="mb-4">
            <label className="block text-xs font-bold text-ink/50 uppercase tracking-widest mb-1">
              Admin token
            </label>
            <input type="password" value={token}
              onChange={e => setToken(e.target.value)}
              placeholder="ADMIN_TOKEN de Netlify"
              className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm font-mono outline-none focus:border-coral"/>
          </div>

          <div className="grid md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-bold text-ink/50 uppercase tracking-widest mb-1">Categoría</label>
              <select value={category} onChange={e => setCategory(e.target.value)}
                className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-coral">
                {CATEGORIES.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
                ))}
              </select>
              <p className="text-[11px] text-ink/45 mt-1.5">
                Query base que Google recibe: <code className="bg-stone-100 px-1 rounded">{cat?.query}</code>
              </p>
            </div>
            <div>
              <label className="block text-xs font-bold text-ink/50 uppercase tracking-widest mb-1">Ciudad</label>
              <input type="text" value={city} onChange={e => setCity(e.target.value)}
                list="city-list"
                className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-coral"/>
              <datalist id="city-list">
                {CITY_DEFAULTS.map(c => <option key={c} value={c} />)}
              </datalist>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4 mb-5">
            <div>
              <label className="block text-xs font-bold text-ink/50 uppercase tracking-widest mb-1">
                Refinamiento opcional
              </label>
              <input type="text" value={extraQuery} onChange={e => setExtraQuery(e.target.value)}
                placeholder="ej. 'eventos corporativos' o 'gourmet'"
                className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-coral"/>
              <p className="text-[11px] text-ink/45 mt-1.5">Se concatena al query base para afinar.</p>
            </div>
            <div>
              <label className="block text-xs font-bold text-ink/50 uppercase tracking-widest mb-1">
                Máximo resultados (1-20)
              </label>
              <input type="number" min={1} max={20} value={maxResults}
                onChange={e => setMaxResults(Math.min(20, Math.max(1, parseInt(e.target.value) || 1)))}
                className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-coral"/>
              <p className="text-[11px] text-ink/45 mt-1.5">Google permite máx. 20 por petición.</p>
            </div>
          </div>

          <button onClick={runSearch} disabled={loading || !token}
            className="bg-coral text-white font-bold px-6 py-3 rounded-xl text-sm hover:bg-coral-dark disabled:opacity-50 transition-colors">
            {loading ? 'Buscando en Google…' : `🔍 Buscar y guardar como leads`}
          </button>

          <p className="text-[11px] text-ink/45 mt-3 leading-snug">
            Coste estimado: ~$0.032 por búsqueda. Google da $200/mes de crédito gratuito (≈6000 búsquedas).
            Si la búsqueda devuelve negocios ya existentes en tu BD, los saltamos automáticamente.
          </p>
        </div>

        {error && (
          <div className="bg-coral/5 border border-coral/30 rounded-xl p-4 mb-6 text-sm">
            <div className="font-bold text-coral mb-1">Error</div>
            <div className="font-mono text-xs text-ink break-words">{error}</div>
          </div>
        )}

        {result && (
          <div className={`border-2 rounded-2xl p-6 mb-6 ${result.ok ? 'bg-sage/5 border-sage/40' : 'bg-coral/5 border-coral/40'}`}>
            <div className="flex items-baseline gap-4 mb-4 flex-wrap">
              <div className="text-2xl font-bold">{result.ok ? '✅' : '⚠️'}</div>
              <div className="text-sm">
                <span className="font-bold text-ink">Búsqueda: </span>
                <code className="bg-white px-2 py-0.5 rounded text-xs">{result.query}</code>
                {result.city && <span className="text-ink/60"> en {result.city}</span>}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-5">
              <Stat label="Encontrados" value={result.searched} color="ink"/>
              <Stat label="Insertados nuevos" value={result.inserted} color="sage"/>
              <Stat label="Saltados" value={result.skipped} color="ink/55"/>
            </div>

            {result.error && (
              <div className="bg-white border border-coral/30 rounded-lg p-3 mb-3 text-xs font-mono text-coral break-words">
                {result.error}
              </div>
            )}

            {result.insertedItems && result.insertedItems.length > 0 && (
              <div>
                <div className="text-xs font-bold uppercase tracking-widest text-ink/55 mb-2">Insertados</div>
                <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-stone-50 text-[10px] uppercase tracking-wider text-ink/55">
                      <tr>
                        <th className="text-left p-3">Nombre</th>
                        <th className="text-left p-3">Ciudad</th>
                        <th className="text-left p-3">Teléfono</th>
                        <th className="text-left p-3">Web</th>
                        <th className="text-left p-3">★ Google</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.insertedItems.map(p => (
                        <tr key={p.id} className="border-t border-stone-100">
                          <td className="p-3 font-medium text-ink">{p.name}</td>
                          <td className="p-3 text-ink/65">{p.city}</td>
                          <td className="p-3 text-ink/65 font-mono text-xs">{p.phone || '—'}</td>
                          <td className="p-3 text-ink/65 text-xs">
                            {p.website ? (
                              <a href={p.website} target="_blank" rel="noopener" className="text-coral hover:underline truncate inline-block max-w-[200px]">
                                {p.website.replace(/^https?:\/\//, '')}
                              </a>
                            ) : '—'}
                          </td>
                          <td className="p-3 text-ink/65">{p.google_rating ? p.google_rating.toFixed(1) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <a href="/admin" className="inline-block mt-4 text-sm font-bold text-coral hover:underline">
                  Ir al panel para aprobarlos o descartarlos →
                </a>
              </div>
            )}

            {result.skippedItems && result.skippedItems.length > 0 && (
              <details className="mt-4 text-xs">
                <summary className="cursor-pointer text-ink/55 hover:text-coral">
                  Ver {result.skippedItems.length} saltados (ya existentes o cerrados)
                </summary>
                <ul className="mt-2 space-y-1 text-ink/55">
                  {result.skippedItems.map((s, i) => (
                    <li key={i}>· {s.name || '(sin nombre)'} — {s.reason}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}

        {history.length > 1 && (
          <div className="bg-white border border-stone-200 rounded-2xl p-5">
            <h3 className="font-bold text-sm text-ink mb-3">Historial de búsquedas (esta sesión)</h3>
            <div className="space-y-1.5 text-xs">
              {history.slice(1).map((h, i) => (
                <div key={i} className="flex items-center gap-3 text-ink/65">
                  <span>{h.ok ? '✓' : '⚠️'}</span>
                  <span className="font-mono">{h.query}</span>
                  <span>· {h.city}</span>
                  <span className="ml-auto">+{h.inserted} nuevos / {h.searched} totales</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-white border border-stone-200 rounded-xl p-3 text-center">
      <div className={`font-serif text-2xl font-bold text-${color}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-ink/50 mt-0.5">{label}</div>
    </div>
  )
}
