'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'

// Card individual de un tutorial. Se saca a Client Component porque
// necesita onError sobre el <img>, click para abrir en grande (lightbox),
// y listener de ESC para cerrarlo — cosas que los server components no
// soportan.
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
  const [open,  setOpen]  = useState(false)

  // ESC cierra el lightbox y bloquea scroll del body cuando está abierto
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open])

  return (
    <>
      <article className="bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col">
        <button type="button"
          onClick={() => imgOk && setOpen(true)}
          className={`relative bg-stone-100 aspect-video overflow-hidden block w-full text-left group ${imgOk ? 'cursor-zoom-in' : 'cursor-default'}`}
          aria-label={imgOk ? `Ver "${title}" en grande` : `${title} — grabación pendiente`}>
          {imgOk ? (
            <>
              <img src={`/tutorials/${slug}.gif`}
                alt={title}
                loading="lazy"
                className="w-full h-full object-cover"
                onError={() => setImgOk(false)}/>
              {/* Overlay de hover con "Ver en grande" */}
              <div className="absolute inset-0 bg-ink/0 group-hover:bg-ink/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                <span className="bg-white/95 text-ink text-xs font-bold px-3 py-1.5 rounded-lg shadow-lg">
                  🔍 Ver en grande
                </span>
              </div>
            </>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-ink/30">
              <div className="text-4xl mb-2">🎬</div>
              <div className="text-xs font-mono">Grabación pendiente</div>
            </div>
          )}
          <div className="absolute top-2 right-2 bg-ink/85 text-white text-[10px] font-bold px-2 py-1 rounded-md tabular-nums">
            {duration}
          </div>
        </button>
        <div className="p-4 flex-1 flex flex-col">
          <h3 className="font-semibold text-ink text-base mb-1 leading-tight">{title}</h3>
          <p className="text-sm text-ink/60 leading-snug mb-3 flex-1">{hint}</p>
          <Link href={`/proveedor/panel?tab=${panelTab}`}
            className="text-xs font-bold text-coral hover:text-coral-dark transition-colors self-start">
            Ir a esta sección del panel →
          </Link>
        </div>
      </article>

      {open && (
        <div onClick={() => setOpen(false)}
          className="fixed inset-0 bg-ink/85 backdrop-blur-sm z-[100] flex items-center justify-center p-4 md:p-8 cursor-zoom-out"
          role="dialog" aria-modal="true" aria-label={title}>
          <button type="button"
            onClick={() => setOpen(false)}
            aria-label="Cerrar"
            className="absolute top-4 right-4 md:top-6 md:right-6 w-10 h-10 rounded-full bg-white/90 text-ink hover:bg-white flex items-center justify-center text-xl font-bold shadow-lg transition-colors">
            ✕
          </button>
          <div onClick={e => e.stopPropagation()}
            className="max-w-5xl w-full max-h-[90vh] flex flex-col cursor-default">
            <img src={`/tutorials/${slug}.gif`}
              alt={title}
              className="w-full h-auto max-h-[80vh] object-contain rounded-xl shadow-2xl bg-black"/>
            <div className="mt-4 text-center text-white">
              <div className="font-serif text-xl md:text-2xl font-bold">{title}</div>
              <div className="text-sm text-white/70 mt-1">{hint}</div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
