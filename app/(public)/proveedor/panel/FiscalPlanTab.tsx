'use client'

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'

// Add-on "FiestaGo Fiscal" · 12€/mes. Todavía no está construido — este tab
// funciona como landing de venta dentro del panel para captar interés antes
// del lanzamiento. Cuando esté lista la funcionalidad real, se sustituye el
// contenido del estado 'active' por los módulos (OCR, 303, 130, alertas…).

type Plan = {
  fiscal_plan: 'none' | 'interested' | 'active' | 'cancelled'
  fiscal_plan_at: string | null
  fiscal_interest_at: string | null
}

const FEATURES = [
  { icon: '📸', title: 'OCR de gastos', body: 'Foto del ticket → extraemos proveedor, base, IVA y fecha en 2 segundos. Categorización automática con IA.' },
  { icon: '📚', title: 'Libro de ingresos y gastos', body: 'Se genera solo, en tiempo real. Exportable a CSV o PDF cuando quieras.' },
  { icon: '📊', title: 'Modelo 303 (IVA) en vivo', body: '"Llevas 428€ de IVA a pagar este trimestre." Cálculo actualizado con cada factura y cada gasto.' },
  { icon: '💶', title: 'Modelo 130 (IRPF)', body: 'Pago fraccionado calculado en vivo. Ves cuánto vas a pagar antes de que llegue el plazo.' },
  { icon: '⏰', title: 'Alertas de plazos', body: '5 días antes de cada fecha límite (20-abril, 20-julio, 20-octubre, 30-enero). Nunca más una sanción.' },
  { icon: '📄', title: 'PDF listo para AEAT', body: 'Descargas el modelo relleno y lo copias en el portal de la AEAT en 30 segundos.' },
  { icon: '🧠', title: 'Categorización IA de gastos', body: 'Decide si es deducible, si el IVA se soporta, en qué casilla va. Reduce errores.' },
  { icon: '🎯', title: 'Simulación IRPF anual', body: 'Según lo que llevas, cuánto te toca pagar/devolver en la renta. Sin sorpresas.' },
  { icon: '📈', title: 'Situación fiscal real', body: 'Cuánto te sobra de verdad este mes después de impuestos y RETA. Panel siempre actualizado.' },
  { icon: '⚡', title: 'Cero fricción de ingresos', body: 'Las facturas Verifactu ya están en el sistema (las emitimos por ti). Tú solo fotografías gastos.' },
]

const COMPARE = [
  { who: 'Gestoría tradicional', price: '60-80 €/mes', color: 'text-ink/60' },
  { who: 'Declarando',           price: '39 €/mes',    color: 'text-ink/60' },
  { who: 'Quipu',                price: '15-30 €/mes', color: 'text-ink/60' },
  { who: 'FiestaGo Fiscal',      price: '12 €/mes',    color: 'text-coral font-bold' },
]

export default function FiscalPlanTab({ providerId }: { providerId: string | null }) {
  const [plan, setPlan] = useState<Plan | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!providerId) return
    fetch(`/api/proveedor/fiscal-plan?providerId=${providerId}`, { headers: { 'x-provider-token': providerId } })
      .then((r: Response) => r.json())
      .then((d: { plan?: Plan }) => setPlan(d.plan || null))
      .catch(() => {})
  }, [providerId])

  async function toggleInterest(action: 'interest' | 'cancel_interest') {
    if (!providerId) return
    setSaving(true)
    try {
      const res = await fetch('/api/proveedor/fiscal-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-provider-token': providerId },
        body: JSON.stringify({ providerId, action }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setPlan(data.plan)
      toast.success(action === 'interest'
        ? 'Te avisaremos cuando lo lancemos ✓'
        : 'Interés retirado')
    } catch (err: any) {
      toast.error(err.message || 'Error')
    }
    setSaving(false)
  }

  const isActive     = plan?.fiscal_plan === 'active'
  const isInterested = plan?.fiscal_plan === 'interested'

  // ─── Estado ACTIVE (usuario ya paga) ───────────────────────────
  // Placeholder hasta que las herramientas reales estén construidas
  if (isActive) {
    return (
      <div className="max-w-3xl">
        <div className="mb-6">
          <div className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest mb-1">ADD-ON ACTIVO</div>
          <h1 className="font-serif text-2xl font-black text-ink">FiestaGo Fiscal</h1>
        </div>
        <div className="bg-white border border-stone-200 rounded-2xl p-8 shadow-card text-center">
          <div className="text-5xl mb-4">🚧</div>
          <h2 className="font-serif text-xl font-bold text-ink mb-2">En construcción</h2>
          <p className="text-ink/60 text-sm leading-relaxed max-w-lg mx-auto">
            Estamos construyendo los módulos de OCR de gastos, cálculo del 303 y del 130 en vivo, alertas de plazos y descarga automática de PDFs listos para la AEAT. Te avisaremos por email cuando cada pieza esté operativa.
          </p>
        </div>
      </div>
    )
  }

  // ─── Estado NONE / INTERESTED (paywall + landing) ──────────────
  return (
    <div className="max-w-3xl">
      {/* Hero de venta */}
      <div className="mb-6">
        <div className="text-[10px] font-bold text-coral uppercase tracking-widest mb-1">ADD-ON · PRÓXIMAMENTE</div>
        <h1 className="font-serif text-3xl font-black text-ink mb-2">FiestaGo Fiscal</h1>
        <p className="text-ink/65 text-sm leading-relaxed max-w-xl">
          Toda tu gestión fiscal preparada y calculada en tiempo real. Tú solo la presentas en la AEAT. Sin gestor, sin papeles perdidos, sin sanciones por plazos.
        </p>
      </div>

      {/* Precio · comparación */}
      <div className="bg-gradient-to-br from-coral/8 to-amber-50 border border-coral/20 rounded-2xl p-6 mb-6 shadow-card">
        <div className="flex items-baseline gap-3 mb-1">
          <span className="font-serif text-5xl font-black text-coral">12€</span>
          <span className="text-ink/60 text-sm">/ mes</span>
          <span className="ml-auto text-[10px] font-bold text-emerald-700 uppercase tracking-widest bg-emerald-100 px-2 py-1 rounded">1ª mes gratis al lanzar</span>
        </div>
        <p className="text-ink/70 text-xs mb-4">Sin permanencia · cancelas cuando quieras · cobras la 1ª mensualidad al activar.</p>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 pt-4 border-t border-coral/15">
          {COMPARE.map(c => (
            <div key={c.who} className={`flex justify-between text-xs ${c.color}`}>
              <span>{c.who}</span>
              <span className="font-mono tabular-nums">{c.price}</span>
            </div>
          ))}
        </div>
      </div>

      {/* CTA principal */}
      {isInterested ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 mb-8 shadow-card">
          <div className="flex items-start gap-3">
            <div className="text-2xl">✓</div>
            <div className="flex-1">
              <div className="font-bold text-emerald-900 text-sm">Estás en la lista de espera</div>
              <p className="text-emerald-800 text-xs mt-1 leading-relaxed">
                Te avisaremos por email en cuanto lancemos. Los primeros de la lista tienen la primera mensualidad gratis.
              </p>
            </div>
            <button onClick={() => toggleInterest('cancel_interest')} disabled={saving}
              className="text-xs text-emerald-700 hover:text-emerald-900 underline disabled:opacity-50">
              Retirar
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => toggleInterest('interest')} disabled={saving}
          className="w-full bg-coral text-white font-bold py-4 rounded-xl text-sm hover:bg-coral-dark transition-colors mb-8 disabled:opacity-50 shadow-card">
          {saving ? 'Guardando…' : '🔔 Avísame cuando esté disponible (1ª mensualidad gratis)'}
        </button>
      )}

      {/* Grid de funcionalidades (capadas visualmente) */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs font-bold text-ink/50 uppercase tracking-widest">Qué incluye</span>
          <span className="text-xl">🔒</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {FEATURES.map(f => (
            <div key={f.title} className="relative bg-white border border-stone-200 rounded-xl p-4 shadow-card overflow-hidden">
              <div className="flex items-start gap-3">
                <div className="text-2xl flex-shrink-0 opacity-40">{f.icon}</div>
                <div className="min-w-0 flex-1">
                  <div className="font-serif font-bold text-sm text-ink mb-0.5 flex items-center gap-2">
                    {f.title}
                    <span className="text-ink/25 text-xs">🔒</span>
                  </div>
                  <p className="text-xs text-ink/55 leading-relaxed">{f.body}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Cómo funciona */}
      <div className="bg-stone-50 border border-stone-200 rounded-2xl p-5 mb-6">
        <div className="text-xs font-bold text-ink/50 uppercase tracking-widest mb-3">Cómo funciona</div>
        <ol className="space-y-3">
          {[
            'FiestaGo ya emite tus facturas Verifactu — los ingresos entran solos',
            'Fotografías tus tickets desde el móvil · la IA los clasifica al momento',
            'Ves en vivo cuánto vas a pagar de IVA e IRPF este trimestre',
            'Al llegar el plazo, descargas el modelo relleno y lo pegas en la AEAT · 30 segundos',
          ].map((step, i) => (
            <li key={i} className="flex items-start gap-3 text-sm text-ink/80">
              <span className="font-mono font-bold text-coral text-xs mt-0.5 flex-shrink-0 w-5">{String(i + 1).padStart(2, '0')}</span>
              <span className="leading-relaxed">{step}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* Legal disclaimer */}
      <div className="text-[11px] text-ink/45 leading-relaxed">
        <strong className="text-ink/60">Aviso:</strong> FiestaGo Fiscal es una herramienta de preparación y cálculo. No sustituye a un asesor fiscal registrado. La presentación de los modelos en la AEAT y la responsabilidad tributaria corresponden al proveedor. Recomendamos revisión periódica por un asesor.
      </div>
    </div>
  )
}
