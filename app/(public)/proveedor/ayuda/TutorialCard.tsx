'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import type { Tutorial } from './tutorials'

// Card individual de un tutorial · texto (pasos + consejos) por defecto,
// vídeo si se ha configurado uno para ese slug.
export default function TutorialCard({ t }: { t: Tutorial }) {
  const [open, setOpen] = useState(false)

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
        <div className="p-5 flex-1 flex flex-col">
          <div className="text-[10px] font-bold uppercase tracking-widest text-coral mb-2">
            {t.steps.length} pasos · lectura de 30 seg
          </div>
          <h3 className="font-serif text-lg font-bold text-ink leading-tight mb-1.5 text-balance">
            {t.title}
          </h3>
          <p className="text-sm text-ink/60 leading-snug mb-4 flex-1">{t.hint}</p>

          {/* Pasos numerados · muestro los 3 primeros como preview */}
          <ol className="space-y-1.5 mb-4">
            {t.steps.slice(0, 3).map((s, i) => (
              <li key={i} className="flex gap-2 text-xs text-ink/75 leading-snug">
                <span className="flex-none w-5 h-5 rounded-full bg-coral/10 text-coral font-bold text-[10px] flex items-center justify-center mt-0.5">
                  {i + 1}
                </span>
                <span className="line-clamp-2">{s}</span>
              </li>
            ))}
            {t.steps.length > 3 && (
              <li className="text-[11px] text-ink/45 pl-7">
                + {t.steps.length - 3} pasos más
              </li>
            )}
          </ol>

          <div className="flex gap-2 mt-auto">
            <button onClick={() => setOpen(true)}
              className="flex-1 text-xs font-bold bg-ink text-white py-2 rounded-lg hover:bg-ink/85 transition-colors">
              📖 Leer completo
            </button>
            <Link href={`/proveedor/panel?tab=${t.panelTab}`}
              className="text-xs font-bold text-coral hover:text-coral-dark px-3 py-2 border border-coral/30 rounded-lg transition-colors whitespace-nowrap">
              Ir al panel →
            </Link>
          </div>
        </div>
      </article>

      {open && (
        <div onClick={() => setOpen(false)}
          className="fixed inset-0 bg-ink/85 backdrop-blur-sm z-[100] flex items-center justify-center p-4 md:p-8"
          role="dialog" aria-modal="true" aria-label={t.title}>
          <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar"
            className="absolute top-4 right-4 md:top-6 md:right-6 w-10 h-10 rounded-full bg-white/90 text-ink hover:bg-white flex items-center justify-center text-xl font-bold shadow-lg z-10 transition-colors">
            ✕
          </button>
          <div onClick={e => e.stopPropagation()}
            className="max-w-2xl w-full max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl">
            <div className="p-6 md:p-8">
              <div className="text-[10px] font-bold uppercase tracking-widest text-coral mb-3">
                🎓 Tutorial · {t.steps.length} pasos
              </div>
              <h2 className="font-serif text-2xl md:text-3xl font-black text-ink mb-2 leading-tight text-balance">
                {t.title}
              </h2>
              <p className="text-base text-ink/70 mb-6 leading-relaxed">{t.hint}</p>

              {t.videoUrl && (
                <div className="mb-6 aspect-video bg-stone-100 rounded-xl overflow-hidden">
                  <video src={t.videoUrl} controls className="w-full h-full"/>
                </div>
              )}

              <div className="mb-6">
                <div className="text-[10px] font-bold uppercase tracking-widest text-ink/45 mb-3">
                  Cómo hacerlo
                </div>
                <ol className="space-y-3">
                  {t.steps.map((s, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="flex-none w-7 h-7 rounded-full bg-coral text-white font-bold text-xs flex items-center justify-center mt-0.5">
                        {i + 1}
                      </span>
                      <span className="text-sm text-ink leading-relaxed pt-0.5">{s}</span>
                    </li>
                  ))}
                </ol>
              </div>

              {t.tips && t.tips.length > 0 && (
                <div className="mb-6 bg-cream border border-stone-200 rounded-xl p-4">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-ink/60 mb-2">
                    💡 Consejos
                  </div>
                  <ul className="space-y-2">
                    {t.tips.map((tip, i) => (
                      <li key={i} className="text-sm text-ink/80 leading-relaxed pl-4 relative">
                        <span className="absolute left-0 top-1.5 w-1.5 h-1.5 rounded-full bg-coral"/>
                        {tip}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex gap-2">
                <Link href={`/proveedor/panel?tab=${t.panelTab}`}
                  onClick={() => setOpen(false)}
                  className="flex-1 text-center bg-coral text-white font-bold py-3 rounded-xl hover:bg-coral-dark transition-colors">
                  🚀 Hacerlo ahora en el panel
                </Link>
                <button onClick={() => setOpen(false)}
                  className="text-ink/60 hover:text-ink font-semibold px-4 py-3 border border-stone-200 rounded-xl transition-colors">
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
