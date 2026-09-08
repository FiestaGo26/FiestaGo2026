// Biblia de personajes · FiestaGo cinematic
//
// REGLA DE ORO ─────────────────────────────────────────────────────────
// El bloque `look` se copia LITERAL en cada prompt donde sale el personaje.
// Cambiar una sola palabra entre tomas te cambia la cara y se rompe la
// continuidad. No lo "mejores" toma a toma: si hay que tocarlo, se toca
// aquí y se regeneran TODAS las tomas de ese personaje.
//
// LEGAL ────────────────────────────────────────────────────────────────
// Todos los personajes son ficticios por diseño. No usar nombre, cara ni
// parecido de personas reales (derechos de imagen · LO 1/1982) ni marcas
// de terceros visibles en plano.

export type Character = {
  id:     string
  name:   string
  role:   string
  /** Bloque BLOQUEADO · se inyecta literal en todos los prompts. */
  look:   string
  /** Seed fija en Flux · ayuda a que la cara no derive entre tomas. */
  seed:   number
}

export const CHARACTERS: Character[] = [
  {
    id:   'marcos',
    name: 'Marcos',
    role: 'Fotógrafo de bodas, 38 años. El proveedor que paga cuota y no recibe nada.',
    seed: 730114,
    look:
      'a 38-year-old Spanish man with short dark brown hair, a neatly trimmed dark beard, ' +
      'warm olive skin, tired brown eyes with faint shadows under them, a small mole on his left cheek, ' +
      'wearing a charcoal grey henley shirt with the sleeves pushed up',
  },
  {
    id:   'lucia',
    name: 'Lucía',
    role: 'Novia, 31 años. La clienta que busca proveedor y no encuentra precios.',
    seed: 480902,
    look:
      'a 31-year-old Spanish woman with wavy shoulder-length chestnut hair, light warm skin, ' +
      'green-hazel eyes, subtle freckles across her nose, wearing a cream oversized knit jumper',
  },
]

export function character(id: string): Character {
  const c = CHARACTERS.find(x => x.id === id)
  if (!c) throw new Error(`Personaje desconocido: "${id}" · revisa src/cinematic/characters.ts`)
  return c
}

/**
 * Look cinematográfico común a TODAS las tomas. Va al final de cada prompt.
 * Es lo que hace que 3 clips generados por separado parezcan la misma pieza.
 */
export const LOOK =
  'shot on 35mm anamorphic lens, shallow depth of field, natural motivated lighting, ' +
  'muted warm color grade with deep shadows, subtle film grain, cinematic, photorealistic, ' +
  'vertical 9:16 framing'

/** Lo que NO queremos ver. Se pasa como negative prompt en cada generación. */
export const NEGATIVE =
  'text, watermark, logo, brand names, distorted face, extra fingers, deformed hands, ' +
  'plastic skin, oversaturated, cartoon, 3d render, blurry, low quality'
