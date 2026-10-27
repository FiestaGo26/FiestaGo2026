'use client'

export default function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()}
      className="print:hidden text-xs font-semibold text-ink/70 border border-stone-300 rounded-full px-3 py-1.5 hover:bg-cream">
      ⬇ Descargar o imprimir el documento
    </button>
  )
}
