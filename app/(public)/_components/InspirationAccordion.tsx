'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { getPhoto } from '@/lib/constants'

// ─── Sección "¿Qué quieres celebrar?" — panel desplegable ──────────────
// Reemplaza el grid de 4 cards grandes por un accordion compacto que
// va mucho mejor en móvil. Cada item se abre revelando la imagen +
// descripción + CTA. La primera está abierta por defecto.

export type CollectionItem = {
  id:    string
  title: string
  hint:  string
  seed:  string
  href:  string
}

export default function InspirationAccordion({ items }: { items: CollectionItem[] }) {
  // Por defecto la primera está abierta — el usuario ve el "estado abierto"
  // sin tener que hacer clic, y al hacer clic en otra cambia sin tener que
  // cerrar la actual.
  const [openId, setOpenId] = useState<string | null>(items[0]?.id ?? null)

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white border border-stone-200 rounded-3xl overflow-hidden divide-y divide-stone-200">
        {items.map(item => {
          const isOpen = openId === item.id
          return (
            <div key={item.id}>
              <button
                type="button"
                onClick={() => setOpenId(isOpen ? null : item.id)}
                aria-expanded={isOpen}
                className={`
                  w-full flex items-center justify-between gap-4
                  px-5 sm:px-7 py-5 text-left
                  transition-colors
                  ${isOpen ? 'bg-cream/60' : 'hover:bg-cream/30'}
                `}>
                <span className="font-serif text-lg sm:text-xl text-ink leading-tight">
                  {item.title}
                </span>
                <span
                  className={`
                    shrink-0 text-2xl text-coral transition-transform duration-300
                    ${isOpen ? 'rotate-45' : 'rotate-0'}
                  `}
                  aria-hidden="true">
                  +
                </span>
              </button>

              <div
                className={`
                  grid transition-[grid-template-rows] duration-300 ease-out
                  ${isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}
                `}>
                <div className="overflow-hidden">
                  <div className="px-5 sm:px-7 pb-6 grid sm:grid-cols-[160px_1fr] gap-4 sm:gap-5 items-center">
                    <div className="relative w-full sm:w-40 aspect-[4/3] sm:aspect-square rounded-2xl overflow-hidden bg-stone-100">
                      <Image
                        src={getPhoto(item.seed, 0, 320, 320)}
                        alt={item.title}
                        fill className="object-cover"
                        sizes="(max-width: 640px) 100vw, 160px"/>
                    </div>
                    <div>
                      <p className="text-sm sm:text-base text-ink/70 leading-relaxed mb-4">
                        {item.hint}
                      </p>
                      <Link
                        href={item.href}
                        className="inline-flex items-center gap-1.5 text-sm font-semibold text-coral hover:text-coral-dark border-b border-coral/40 hover:border-coral pb-0.5 transition-colors">
                        Explorar {item.title.split(' ')[0].toLowerCase()}
                        <span aria-hidden="true">→</span>
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
