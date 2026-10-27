// ───────────────────────────────────────────────────────────────────────
// El cliente ve un único precio por servicio y cada extra con su precio
// final. Por eso en los textos libres del proveedor no puede haber
// importes ni cosas que "se cobran aparte" sin precio: todo eso va como
// extra. (Simulación 15: el aviso "(importe aparte…)" y los extras sin
// precio se leían como costes ocultos.) Se usa en el panel y en la API.
// ───────────────────────────────────────────────────────────────────────

const FIGURE = /(?:€\s*\d[\d.,]*|\d[\d.,]*\s*(?:€|euros?\b|eur\b))/i
const CHARGED = /(se cobra|lo cobro|cobramos|coste adicional|tiene un coste|tiene coste|suplemento|con cargo|a consultar|seg[uú]n (?:mi |nuestra )?tarifa|(?:precio|importe|presupuesto|coste) aparte|se factura aparte|se presupuesta aparte|se paga aparte)/i

const sentences = (text: string) => text.split(/(?<=[.;!?\n])/).map(s => s.trim()).filter(Boolean)
const words = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^a-z0-9]+/).filter(w => w.length >= 4)

/** Frase con un importe escrito, o null. */
export function priceInText(text: string): string | null {
  return sentences(text || '').find(s => FIGURE.test(s)) || null
}

/** Frase que dice que algo se cobra aparte sin que esté en los extras, o null. */
export function unpricedExtra(text: string, extraLabels: string[] = []): string | null {
  const known = new Set(extraLabels.flatMap(words))
  return sentences(text || '').find(s => CHARGED.test(s) && !words(s).some(w => known.has(w))) || null
}

/** Mensaje para el proveedor si algún texto lleva importes o extras sin precio. */
export function priceTextProblem(texts: string[], extraLabels: string[] = []): string | null {
  for (const t of texts) {
    const fig = priceInText(t)
    if (fig) return `Quita el importe de «${fig.slice(0, 90)}»: el cliente solo ve el precio de tu propuesta. Si es algo que se paga aparte, añádelo en Extras con su precio.`
    const ex = unpricedExtra(t, extraLabels)
    if (ex) return `Dices que algo se cobra aparte («${ex.slice(0, 90)}»). Añádelo en Extras con su precio para que el cliente vea el total sin sorpresas.`
  }
  return null
}
