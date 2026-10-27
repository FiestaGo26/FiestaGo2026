'use client'

// Tipo de local y qué incluye (solo para espacios y catering): así el
// cliente sabe al momento si tiene cocina, mesas o zona cubierta.

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { VENUE_FEATURES, VENUE_TYPES, type VenueFeatures } from '@/lib/venue'

export default function VenueCard({ providerId, apiFetch }: {
  providerId: string
  apiFetch: (url: string, init?: RequestInit) => Promise<Response>
}) {
  const [category, setCategory] = useState<string | null>(null)
  const [type, setType] = useState<string>('')
  const [features, setFeatures] = useState<VenueFeatures>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    apiFetch(`/api/proveedor/venue?provider_id=${providerId}`).then(r => r.json()).then(d => {
      setCategory(d.category || null); setType(d.venue_type || ''); setFeatures(d.venue_features || {})
    }).catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providerId])

  if (category !== 'espacios' && category !== 'catering') return null

  async function save() {
    setSaving(true)
    try {
      const res = await apiFetch('/api/proveedor/venue', { method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider_id: providerId, venue_type: type || null, venue_features: features }) })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.error || 'No se pudo guardar')
      setType(d.venue_type || ''); setFeatures(d.venue_features || {})
      toast.success('Guardado ✓')
    } catch (err: any) { toast.error(err.message) }
    setSaving(false)
  }

  return (
    <div className="bg-white border border-stone-200 rounded-2xl p-5 mb-6 shadow-card">
      <h2 className="font-serif text-xl font-bold text-ink mb-1">Tu local: qué es y qué incluye</h2>
      <p className="text-xs text-ink/55 mb-4">Lo ve el cliente en tu ficha al montar su celebración. Si eres restaurante u hotel, la cocina y las mesas se dan por incluidas.</p>
      <select value={type} onChange={e => setType(e.target.value)}
        className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm text-ink mb-3">
        <option value="">Elige qué tipo de local es</option>
        {Object.entries(VENUE_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
      <div className="grid sm:grid-cols-2 gap-2 mb-3">
        {Object.entries(VENUE_FEATURES).map(([k, v]) => (
          <label key={k} className="flex items-center gap-2 text-sm text-ink/80">
            <input type="checkbox" className="accent-coral" checked={!!(features as any)[k]}
              onChange={e => setFeatures(f => ({ ...f, [k]: e.target.checked }))}/>
            {v}
          </label>
        ))}
      </div>
      <label className="text-xs font-semibold text-ink">Aforo máximo
        <input type="number" min={1} value={features.aforo || ''} onChange={e => setFeatures(f => ({ ...f, aforo: Number(e.target.value) || undefined }))}
          className="mt-1 w-full border border-stone-200 rounded-xl px-3 py-2 text-sm text-ink"/>
      </label>
      <button type="button" onClick={save} disabled={saving} className="mt-3 bg-coral text-white text-xs font-bold px-4 py-2 rounded-xl disabled:opacity-50">
        {saving ? 'Guardando…' : 'Guardar'}
      </button>
    </div>
  )
}
