'use client'

// Cómo cobra un servicio: por personas, por horas o precio cerrado. Siempre
// con IVA incluido. El sistema calcula el total para el caso del cliente
// (lib/pricing.ts → priceFor) y le enseña también cuánto sale por persona.

import { formatEuro, precioCliente, priceFor, type PricingUnit } from '@/lib/pricing'

export type PricingValue = {
  unit: PricingUnit
  included: string      // personas u horas que incluye el precio
  extra: string         // € por persona u hora de más
}

const UNITS: Array<[PricingUnit, string, string]> = [
  ['guests', 'Por personas', 'Fotógrafo, local, catering… El precio incluye unas personas y cobras cada persona de más.'],
  ['hours',  'Por horas',    'DJ, animación… El precio incluye unas horas y cobras cada hora de más.'],
  ['fixed',  'Precio cerrado', 'Da igual cuántos sean o cuánto dure (una tarta, un photocall…).'],
]

export default function PricingFields({ price, value, onChange }: {
  price: number
  value: PricingValue
  onChange: (v: PricingValue) => void
}) {
  const set = (p: Partial<PricingValue>) => onChange({ ...value, ...p })
  const inc = Number(value.included) || 0
  const extra = Number(value.extra) || 0
  const svc = {
    price,
    pricing_unit: value.unit,
    included_guests: value.unit === 'guests' ? inc : null, extra_guest_price: value.unit === 'guests' ? extra : null,
    included_hours: value.unit === 'hours' ? inc : null, extra_hour_price: value.unit === 'hours' ? extra : null,
  }
  const exampleQty = value.unit === 'hours' ? inc + 2 : inc + 10
  const example = priceFor(svc, value.unit === 'hours' ? { hours: exampleQty } : { guests: exampleQty })
  const what = value.unit === 'hours' ? 'horas' : 'personas'

  return (
    <div className="col-span-2 bg-cream-dark border border-stone-200 rounded-xl p-3">
      <div className="text-xs font-bold text-ink/60 uppercase tracking-widest mb-1">Cómo cobras (IVA incluido)</div>
      <div className="flex flex-wrap gap-2 mb-2">
        {UNITS.map(([id, label]) => (
          <button key={id} type="button" onClick={() => set({ unit: id })}
            className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${value.unit === id ? 'bg-coral text-white border-coral' : 'bg-white text-ink/70 border-stone-200'}`}>
            {label}
          </button>
        ))}
      </div>
      <p className="text-[11px] text-ink/55 mb-2 leading-relaxed">{UNITS.find(u => u[0] === value.unit)?.[2]}</p>
      {value.unit !== 'fixed' && (
        <div className="grid grid-cols-2 gap-3">
          <input type="number" min={1} value={value.included} onChange={e => set({ included: e.target.value })}
            placeholder={value.unit === 'hours' ? 'Horas que incluye (p. ej. 4)' : 'Personas que incluye (p. ej. 30)'}
            className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm text-ink outline-none focus:border-coral"/>
          <input type="number" min={0} step="0.5" value={value.extra} onChange={e => set({ extra: e.target.value })}
            placeholder={value.unit === 'hours' ? '€ por hora de más (p. ej. 90)' : '€ por persona de más (p. ej. 45)'}
            className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm text-ink outline-none focus:border-coral"/>
        </div>
      )}
      {price > 0 && (
        <div className="text-[11px] text-ink/60 mt-2">
          Todos los precios llevan el IVA incluido.
          {value.unit !== 'fixed' && inc > 0 && extra > 0 && <> Ejemplo: con {exampleQty} {what} tú cobras <strong>{formatEuro(example)}</strong> y el cliente ve <strong>{formatEuro(precioCliente(example))}</strong> (Garantía incluida). Con {inc} {what} o menos, el precio base.</>}
        </div>
      )}
    </div>
  )
}

/** Del servicio guardado al valor del formulario. */
export function pricingValueOf(s: { pricing_unit?: string | null; included_guests?: number | null; extra_guest_price?: number | null; included_hours?: number | null; extra_hour_price?: number | null }): PricingValue {
  const unit: PricingUnit = s.pricing_unit === 'hours' || s.pricing_unit === 'fixed' || s.pricing_unit === 'guests'
    ? s.pricing_unit
    : Number(s.included_guests) > 0 ? 'guests' : Number(s.included_hours) > 0 ? 'hours' : 'fixed'
  return unit === 'hours'
    ? { unit, included: String(s.included_hours ?? ''), extra: String(s.extra_hour_price ?? '') }
    : unit === 'guests'
    ? { unit, included: String(s.included_guests ?? ''), extra: String(s.extra_guest_price ?? '') }
    : { unit, included: '', extra: '' }
}

/** Del formulario a los campos de la API. */
export function pricingPayload(v: PricingValue) {
  const inc = Number(v.included) || null, extra = Number(v.extra) || null
  return {
    pricing_unit: v.unit,
    included_guests:   v.unit === 'guests' ? inc : null,
    extra_guest_price: v.unit === 'guests' ? extra : null,
    included_hours:    v.unit === 'hours' ? inc : null,
    extra_hour_price:  v.unit === 'hours' ? extra : null,
  }
}
