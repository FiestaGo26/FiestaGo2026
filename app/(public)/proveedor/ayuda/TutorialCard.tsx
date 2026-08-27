'use client'

import Link from 'next/link'
import { useState } from 'react'

// Card individual de un tutorial. Se saca a Client Component porque
// necesita onError sobre el <img> para caer al placeholder cuando el
// GIF aún no se ha generado (los server components no soportan handlers).
export default function TutorialCard({
  slug, title, duration, hint, panelTab,
}: {
  slug:     string
  title:    string
  duration: string
  hint:     string
  panelTab: string
}) {
  const [imgOk, setImgOk] = useState(true)

  return (
    <article className="bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col">
      <div className="relative bg-stone-100 aspect-video overflow-hidden">
        {imgOk ? (
          <img src={`/tutorials/${slug}.gif`}
            alt={title}
            loading="lazy"
            className="w-full h-full object-cover"
            onError={() => setImgOk(false)}/>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-ink/30">
            <div className="text-4xl mb-2">🎬</div>
            <div className="text-xs font-mono">Grabación pendiente</div>
          </div>
        )}
        <div className="absolute top-2 right-2 bg-ink/85 text-white text-[10px] font-bold px-2 py-1 rounded-md tabular-nums">
          {duration}
        </div>
      </div>
      <div className="p-4 flex-1 flex flex-col">
        <h3 className="font-semibold text-ink text-base mb-1 leading-tight">{title}</h3>
        <p className="text-sm text-ink/60 leading-snug mb-3 flex-1">{hint}</p>
        <Link href={`/proveedor/panel?tab=${panelTab}`}
          className="text-xs font-bold text-coral hover:text-coral-dark transition-colors self-start">
          Ir a esta sección del panel →
        </Link>
      </div>
    </article>
  )
}
