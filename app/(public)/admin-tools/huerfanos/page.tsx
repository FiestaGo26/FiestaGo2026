'use client'

import { useEffect, useState } from 'react'
import { CATEGORIES } from '@/lib/constants'

// Página de recuperación de proveedores huérfanos: auth users con role=provider
// que se quedaron sin fila correspondiente en `providers` (signup OK pero el
// INSERT del provider falló). Para cada uno: completar con name/category/city
// y pulsar Recuperar para crear la ficha, o Eliminar para borrar el auth user.

type Orphan = {
  auth_user_id:       string
  email:              string
  name_hint:          string | null
  created_at:         string
  email_confirmed_at: string | null
}

export default function HuerfanosPage() {
  const [token, setToken]     = useState('')
  const [orphans, setOrphans] = useState<Orphan[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [draft, setDraft]     = useState<Record<string, { name: string; category: string; city: string }>>({})

  // Persistimos el token en sessionStorage para no tenerlo que poner cada
  // vez que se recarga (solo durante la sesión del navegador).
  useEffect(() => {
    const t = sessionStorage.getItem('fg_admin_token')
    if (t) setToken(t)
  }, [])
  useEffect(() => {
    if (token) sessionStorage.setItem('fg_admin_token', token)
  }, [token])

  async function fetchOrphans() {
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/admin/orphan-providers', {
        headers: { 'x-admin-token': token },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`)
      setOrphans(data.orphans || [])
      // Pre-rellenar drafts con el name_hint
      const d: Record<string, any> = {}
      for (const o of data.orphans) {
        d[o.auth_user_id] = { name: o.name_hint || '', category: 'catering', city: 'Valencia' }
      }
      setDraft(d)
    } catch (e: any) {
      setError(e.message || 'Error de red')
      setOrphans([])
    } finally {
      setLoading(false)
    }
  }

  async function recover(o: Orphan) {
    const d = draft[o.auth_user_id]
    if (!d?.name || !d?.category || !d?.city) {
      alert('Rellena nombre, categoría y ciudad antes de recuperar.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/admin/orphan-providers', {
        method:  'POST',
        headers: { 'content-type': 'application/json', 'x-admin-token': token },
        body:    JSON.stringify({
          auth_user_id: o.auth_user_id,
          email:        o.email,
          name:         d.name,
          category:     d.category,
          city:         d.city,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`)
      // Lo quitamos de la lista local
      setOrphans(prev => prev.filter(x => x.auth_user_id !== o.auth_user_id))
    } catch (e: any) {
      alert('No se pudo recuperar: ' + (e.message || 'error'))
    } finally {
      setLoading(false)
    }
  }

  async function remove(o: Orphan) {
    if (!confirm(`¿Eliminar la cuenta de ${o.email}? Esta acción NO se puede deshacer.`)) return
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/orphan-providers?auth_user_id=${o.auth_user_id}`, {
        method:  'DELETE',
        headers: { 'x-admin-token': token },
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Error ${res.status}`)
      }
      setOrphans(prev => prev.filter(x => x.auth_user_id !== o.auth_user_id))
    } catch (e: any) {
      alert('No se pudo eliminar: ' + (e.message || 'error'))
    } finally {
      setLoading(false)
    }
  }

  function updateDraft(id: string, field: 'name' | 'category' | 'city', value: string) {
    setDraft(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }))
  }

  return (
    <main className="bg-cream min-h-screen">
      <div className="max-w-5xl mx-auto px-6 py-10">

        <div className="mb-8">
          <a href="/admin" className="text-xs text-ink/50 hover:text-coral">← Volver al admin</a>
          <h1 className="font-serif text-3xl font-bold text-ink mt-2">Cuentas huérfanas</h1>
          <p className="text-sm text-ink/65 mt-2 max-w-2xl leading-relaxed">
            Auth users con <code className="bg-stone-100 px-1.5 py-0.5 rounded text-xs">role=provider</code> que
            NO tienen su fila correspondiente en <code className="bg-stone-100 px-1.5 py-0.5 rounded text-xs">providers</code>.
            Significan que el proveedor inició el registro, se creó su cuenta, pero el INSERT
            de su perfil falló (timeout, error de BD, cerró pestaña…). Aquí los recuperas
            completando nombre / categoría / ciudad, o los eliminas si era un test o bot.
          </p>
        </div>

        <div className="bg-white border border-stone-200 rounded-2xl p-5 mb-6">
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="block text-xs font-bold text-ink/50 uppercase tracking-widest mb-1">Admin token</label>
              <input type="password" value={token}
                onChange={e => setToken(e.target.value)}
                placeholder="ADMIN_TOKEN configurado en Netlify"
                className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm font-mono outline-none focus:border-coral"/>
            </div>
            <button onClick={fetchOrphans} disabled={!token || loading}
              className="bg-coral text-white font-bold px-5 py-2.5 rounded-xl text-sm hover:bg-coral-dark disabled:opacity-50">
              {loading ? 'Cargando…' : 'Buscar huérfanos'}
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-coral/5 border border-coral/30 rounded-xl p-4 mb-6 text-sm text-coral">
            {error}
          </div>
        )}

        {orphans.length === 0 && !loading && !error && (
          <div className="text-center py-12 text-ink/45 text-sm">
            Pulsa "Buscar huérfanos" para listar las cuentas pendientes de recuperar.
          </div>
        )}

        {orphans.length > 0 && (
          <div className="space-y-4">
            <div className="text-sm text-ink/60 mb-2">
              {orphans.length} cuenta{orphans.length === 1 ? '' : 's'} pendiente{orphans.length === 1 ? '' : 's'} de recuperar.
            </div>
            {orphans.map(o => {
              const d = draft[o.auth_user_id] || { name: '', category: 'catering', city: '' }
              const date = new Date(o.created_at).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })
              return (
                <div key={o.auth_user_id} className="bg-white border border-stone-200 rounded-2xl p-5">
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div>
                      <div className="font-bold text-ink">{o.email}</div>
                      <div className="text-xs text-ink/50">
                        Registrado: {date} {o.email_confirmed_at && '· ✓ confirmado'}
                      </div>
                    </div>
                    <button onClick={() => remove(o)} disabled={loading}
                      className="text-xs text-coral hover:underline disabled:opacity-50">
                      Eliminar cuenta
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                    <div>
                      <label className="block text-[10px] font-bold text-ink/50 uppercase tracking-wider mb-1">Nombre del negocio *</label>
                      <input value={d.name} onChange={e => updateDraft(o.auth_user_id, 'name', e.target.value)}
                        placeholder="ej. Bocados & Eventos"
                        className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-coral"/>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-ink/50 uppercase tracking-wider mb-1">Categoría *</label>
                      <select value={d.category} onChange={e => updateDraft(o.auth_user_id, 'category', e.target.value)}
                        className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-coral">
                        {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-ink/50 uppercase tracking-wider mb-1">Ciudad *</label>
                      <input value={d.city} onChange={e => updateDraft(o.auth_user_id, 'city', e.target.value)}
                        placeholder="ej. Valencia"
                        className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-coral"/>
                    </div>
                  </div>

                  <button onClick={() => recover(o)} disabled={loading || !d.name || !d.category || !d.city}
                    className="bg-sage text-white font-bold px-5 py-2.5 rounded-xl text-sm hover:opacity-90 disabled:opacity-40 transition">
                    ✓ Recuperar (crear ficha en pending)
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
