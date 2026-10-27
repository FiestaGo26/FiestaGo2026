// ───────────────────────────────────────────────────────────────────────
// Referencias de clientes del proveedor (simulación 12: en bodas pedían
// hablar con parejas que ya hubieran contratado a ese proveedor).
//
// El proveedor las añade en su panel con el consentimiento del cliente.
// En público solo se ve el resumen (nombre de pila, evento, fecha, ciudad,
// comentario); el contacto lo usa FiestaGo para poner en contacto a las
// dos partes cuando un cliente lo pide desde su propuesta.
// ───────────────────────────────────────────────────────────────────────

export type ClientReference = {
  id: string
  nombre: string        // nombre de pila
  evento: string        // "Boda, 120 invitados"
  fecha: string         // "Junio 2025"
  ciudad: string
  comentario: string    // lo que dice de su experiencia
  contacto: string      // email o teléfono: privado, solo FiestaGo
  consentimiento: boolean
}

export type PublicReference = Omit<ClientReference, 'contacto' | 'consentimiento'>

const clip = (v: unknown, n: number) => String(v ?? '').trim().slice(0, n)

/** Limpia lo que manda el panel (máx. 10, solo con consentimiento y contacto). */
export function cleanReferences(raw: unknown): ClientReference[] {
  return (Array.isArray(raw) ? raw : []).map((r: any, i: number) => ({
    id: clip(r?.id, 40) || `ref${Date.now()}${i}`,
    nombre: clip(r?.nombre, 40), evento: clip(r?.evento, 80), fecha: clip(r?.fecha, 40),
    ciudad: clip(r?.ciudad, 60), comentario: clip(r?.comentario, 400), contacto: clip(r?.contacto, 120),
    consentimiento: r?.consentimiento === true,
  })).filter(r => r.nombre && r.evento && r.contacto && r.consentimiento).slice(0, 10)
}

/** Lo que se enseña en público: sin contacto. */
export function publicReferences(raw: unknown): PublicReference[] {
  return (Array.isArray(raw) ? raw : []).filter((r: any) => r?.consentimiento && r?.nombre)
    .map((r: any) => ({ id: r.id, nombre: r.nombre, evento: r.evento, fecha: r.fecha, ciudad: r.ciudad, comentario: r.comentario }))
}
