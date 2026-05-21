'use client'

import { MouseEvent } from 'react'
import { useIsFavorite, toggleFavorite } from '@/lib/favorites'

type Props = {
  providerId: string
  /** 'card' = absolute-positioned heart sobre la foto (botón pequeño y blanco).
   *  'inline' = botón normal con texto al lado, para la ficha del proveedor. */
  variant?: 'card' | 'inline'
}

export default function FavoriteButton({ providerId, variant = 'card' }: Props) {
  const fav = useIsFavorite(providerId)

  function handleClick(e: MouseEvent) {
    // El card es un <Link> envolvente; evitamos navegar al hacer click en el corazón.
    e.preventDefault()
    e.stopPropagation()
    toggleFavorite(providerId)
  }

  if (variant === 'inline') {
    return (
      <button onClick={handleClick}
        aria-pressed={fav}
        aria-label={fav ? 'Quitar de favoritos' : 'Guardar como favorito'}
        className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-colors
          ${fav
            ? 'bg-coral/10 border-coral text-coral'
            : 'bg-white border-stone-200 text-ink hover:border-coral hover:text-coral'}`}>
        <span className="text-base">{fav ? '❤️' : '🤍'}</span>
        {fav ? 'Guardado' : 'Guardar'}
      </button>
    )
  }

  // variant 'card': corazón pequeño en esquina sobre la foto
  return (
    <button onClick={handleClick}
      aria-pressed={fav}
      aria-label={fav ? 'Quitar de favoritos' : 'Guardar como favorito'}
      className={`absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center
        backdrop-blur-sm transition-all shadow-sm
        ${fav ? 'bg-white text-coral scale-100' : 'bg-white/85 text-ink/70 hover:bg-white hover:text-coral hover:scale-110'}`}>
      <span className="text-lg leading-none">{fav ? '❤️' : '🤍'}</span>
    </button>
  )
}
