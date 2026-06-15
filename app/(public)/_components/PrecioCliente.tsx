// ───────────────────────────────────────────────────────────────────────
// Componente único para mostrar precios al CLIENTE en toda la app pública.
//
// El cliente siempre ve `precioCliente(base)` (= base + 8%). El proveedor
// nunca debe pasar por este componente — para él hay un componente aparte
// que muestra "Tú cobras X €".
//
// Variantes:
//   - default: "108 €" + microline "incluye 8 € de Garantía de Éxito"
//   - inline:  "108 €"  con tooltip al hover
//   - large:   "108 €"  grande + microline visible
//   - compact: solo "108 €" sin nada más (para celdas estrechas)
// ───────────────────────────────────────────────────────────────────────

import { precioCliente, formatEuro, textoGarantiaIncluida } from '@/lib/pricing'

type Props = {
  /** Precio base del proveedor o pack (en BD se guarda este número, no el final). */
  base: number | null | undefined
  /** Unidad ("por evento", "por persona", "por hora"...). Se muestra debajo. */
  unit?: string | null
  /** Estilo visual. */
  variant?: 'default' | 'inline' | 'large' | 'compact'
  className?: string
  /** Sufijo opcional ("desde", "/persona"). Útil para listados. */
  prefix?: string
  /** Color del importe. Default: hereda del padre. */
  color?: string
}

export default function PrecioCliente({
  base,
  unit,
  variant = 'default',
  className = '',
  prefix,
  color,
}: Props) {
  if (!base || base <= 0) {
    return <span className={className}>—</span>
  }

  const total = precioCliente(base)
  const tip   = textoGarantiaIncluida(base)
  const colorStyle = color ? { color } : undefined

  if (variant === 'compact') {
    return (
      <span className={className} title={tip} style={colorStyle}>
        {prefix ? `${prefix} ` : ''}{formatEuro(total)}
      </span>
    )
  }

  if (variant === 'inline') {
    return (
      <span className={`inline-flex items-baseline gap-1 ${className}`} title={tip}>
        <span className="font-semibold" style={colorStyle}>
          {prefix ? `${prefix} ` : ''}{formatEuro(total)}
        </span>
        <span className="text-[10px] opacity-60">·  garantía incl.</span>
      </span>
    )
  }

  if (variant === 'large') {
    return (
      <div className={className}>
        <div className="font-serif font-bold leading-tight" style={colorStyle}>
          {prefix ? <span className="text-base font-normal opacity-70 mr-1">{prefix}</span> : null}
          {formatEuro(total)}
        </div>
        {unit && <div className="text-[11px] opacity-60 mt-0.5">{unit}</div>}
        <div className="text-[11px] opacity-60 mt-0.5">{tip}</div>
      </div>
    )
  }

  // default
  return (
    <div className={className}>
      <div className="font-semibold" style={colorStyle}>
        {prefix ? <span className="text-xs font-normal opacity-70 mr-1">{prefix}</span> : null}
        {formatEuro(total)}
      </div>
      <div className="text-[10px] opacity-60 leading-tight">
        {tip}{unit ? ` · ${unit}` : ''}
      </div>
    </div>
  )
}
