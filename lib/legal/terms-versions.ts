/**
 * Publicación y lectura de versiones del texto legal (tabla
 * terms_versions).
 *
 * La tabla es inmutable: una versión publicada no se edita nunca. Para
 * cambiar el texto se publica otra versión, y las aceptaciones antiguas
 * siguen apuntando a la que el cliente vio de verdad.
 *
 * El hash SHA-256 lo calcula el servidor de base de datos (trigger
 * BEFORE INSERT + función publish_terms_version). Aquí lo recalculamos
 * solo para poder verificar que lo devuelto coincide con el texto que
 * tenemos en el código — si no coincide, alguien tocó algo y lo que
 * hacemos es fallar, no seguir.
 */

import { createHash } from 'crypto'
import { createAdminClient } from '@/lib/supabase'
import {
  TERMS_PAYMENTS_CONTENT,
  TERMS_PAYMENTS_VERSION,
  type LegalDocumentType,
} from '@/lib/legal/clauses'

export type TermsVersion = {
  id: string
  version_label: string
  document_type: LegalDocumentType
  content: string
  content_hash: string
  published_at: string
  is_current: boolean
}

export function sha256Hex(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex')
}

/**
 * Devuelve la versión vigente del documento, publicándola si el texto
 * del código todavía no está en la base de datos. Idempotente: si el
 * contenido ya coincide con la versión vigente, publish_terms_version
 * devuelve esa misma fila sin insertar nada.
 *
 * Se llama en cada checkout. Es una lectura + como mucho una inserción,
 * y garantiza que jamás guardemos un consentimiento apuntando a una
 * versión que no existe.
 */
export async function ensureCurrentTermsVersion(
  documentType: LegalDocumentType = 'terms',
  content: string = TERMS_PAYMENTS_CONTENT,
  versionLabel: string = TERMS_PAYMENTS_VERSION,
): Promise<TermsVersion> {
  const supabase = createAdminClient()

  const { data, error } = await supabase.rpc('publish_terms_version', {
    p_document_type: documentType,
    p_version_label: versionLabel,
    p_content:       content,
  })

  if (error) {
    throw new Error(
      `No se pudo resolver la versión vigente de "${documentType}": ${error.message}. ` +
      '¿Está aplicada la migración migration-anti-chargeback.sql?'
    )
  }

  const row = (Array.isArray(data) ? data[0] : data) as TermsVersion | null
  if (!row?.id) {
    throw new Error(`publish_terms_version no devolvió fila para "${documentType}"`)
  }

  const expected = sha256Hex(content)
  if (row.content_hash !== expected) {
    throw new Error(
      `El hash de la versión ${row.version_label} no cuadra con el texto del código ` +
      `(bd ${row.content_hash}, código ${expected}). No se registra el consentimiento.`
    )
  }

  return row
}

/** Lee una versión concreta por id (para compilar la evidencia). */
export async function getTermsVersion(id: string): Promise<TermsVersion | null> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('terms_versions')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  return (data as TermsVersion) || null
}
