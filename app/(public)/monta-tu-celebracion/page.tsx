import type { Metadata } from 'next'
import Builder from './Builder'

export const metadata: Metadata = {
  title: 'Monta tu celebración · FiestaGo',
  description: 'Elige el local y añade música, catering, tarta, fotógrafo o peluquería. Ves el precio total al momento, con IVA y Garantía de Éxito FiestaGo incluidos.',
}

export default function Page() {
  return (
    <main className="bg-cream min-h-screen">
      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-10 md:py-14">
        <div className="text-xs font-bold tracking-[0.18em] uppercase text-coral mb-3">Monta tu celebración</div>
        <h1 className="font-serif text-3xl md:text-4xl font-bold text-ink leading-tight mb-2">Tu celebración entera, con el precio total al momento</h1>
        <p className="text-ink/65 mb-8">Elige el local y añade lo que necesites. Cada servicio es de un profesional independiente; el precio de cada uno ya lleva el IVA y la Garantía de Éxito FiestaGo.</p>
        <Builder />
      </section>
    </main>
  )
}
