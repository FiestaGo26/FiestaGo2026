/**
 * Cliente mínimo de Supabase sobre REST. Sin dependencias: en la GitHub
 * Action interesa instalar lo menos posible, y solo hacemos tres cosas
 * (consultar, subir un fichero e insertar una fila).
 *
 * Usa la service_role key: solo corre en CI, nunca en el navegador.
 */
const URL_ = () => must('SUPABASE_URL', process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL)
const KEY  = () => must('SUPABASE_SERVICE_ROLE_KEY', process.env.SUPABASE_SERVICE_ROLE_KEY)

function must(name, v) {
  if (!v) throw new Error(`Falta ${name}`)
  return v.replace(/\/+$/, '')
}

function headers(extra = {}) {
  const k = KEY()
  return { apikey: k, Authorization: `Bearer ${k}`, ...extra }
}

export async function select(table, query) {
  const res = await fetch(`${URL_()}/rest/v1/${table}?${query}`, { headers: headers() })
  if (!res.ok) throw new Error(`Supabase select ${res.status}: ${(await res.text()).slice(0, 300)}`)
  return res.json()
}

export async function insert(table, row) {
  const res = await fetch(`${URL_()}/rest/v1/${table}`, {
    method: 'POST',
    headers: headers({ 'Content-Type': 'application/json', Prefer: 'return=representation' }),
    body: JSON.stringify(row),
  })
  if (!res.ok) throw new Error(`Supabase insert ${res.status}: ${(await res.text()).slice(0, 300)}`)
  const [created] = await res.json()
  return created
}

/** Sube un fichero al Storage y devuelve su URL pública. */
export async function upload(bucket, path, buf, contentType) {
  const res = await fetch(`${URL_()}/storage/v1/object/${bucket}/${path}`, {
    method: 'POST',
    headers: headers({ 'Content-Type': contentType, 'x-upsert': 'true' }),
    body: buf,
  })
  if (!res.ok) throw new Error(`Supabase upload ${res.status}: ${(await res.text()).slice(0, 300)}`)
  return `${URL_()}/storage/v1/object/public/${bucket}/${path}`
}
