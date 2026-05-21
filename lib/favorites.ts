// Lista de proveedores favoritos del cliente. Vive en localStorage
// (no requiere login) y emite un evento global cuando cambia para
// que el contador del navbar se actualice en vivo.

const KEY = 'fiestago_favs'
const EVENT = 'fiestago:favs-change'

function readRaw(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr.filter(x => typeof x === 'string') : []
  } catch {
    return []
  }
}

function writeRaw(ids: string[]): void {
  if (typeof window === 'undefined') return
  // Dedupe manteniendo orden
  const seen = new Set<string>()
  const unique = ids.filter(id => seen.has(id) ? false : (seen.add(id), true))
  localStorage.setItem(KEY, JSON.stringify(unique))
  window.dispatchEvent(new CustomEvent(EVENT, { detail: unique }))
}

export function getFavorites(): string[] {
  return readRaw()
}

export function isFavorite(id: string): boolean {
  return readRaw().includes(id)
}

export function toggleFavorite(id: string): boolean {
  const current = readRaw()
  const exists = current.includes(id)
  const next = exists ? current.filter(x => x !== id) : [...current, id]
  writeRaw(next)
  return !exists  // devuelve el estado nuevo (true = ahora es favorito)
}

export function removeFavorite(id: string): void {
  const current = readRaw()
  writeRaw(current.filter(x => x !== id))
}

export function clearFavorites(): void {
  writeRaw([])
}

// Hook para que componentes reaccionen a cambios (en cualquier pestaña).
import { useEffect, useState } from 'react'

export function useFavorites(): string[] {
  const [favs, setFavs] = useState<string[]>([])

  useEffect(() => {
    setFavs(readRaw())  // primera carga client-side (evita hydration mismatch)
    const onChange = () => setFavs(readRaw())
    const onStorage = (e: StorageEvent) => { if (e.key === KEY) setFavs(readRaw()) }
    window.addEventListener(EVENT, onChange as EventListener)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener(EVENT, onChange as EventListener)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  return favs
}

export function useIsFavorite(id: string): boolean {
  const favs = useFavorites()
  return favs.includes(id)
}
