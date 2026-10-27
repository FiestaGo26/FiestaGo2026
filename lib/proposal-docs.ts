// Documentos que el proveedor adjunta a su propuesta (se usa también en el panel, en el navegador).
export const PROPOSAL_DOC_LABELS = {
  menu: 'Menú',
  detalle: 'Detalle de lo que incluye',
  boceto: 'Boceto o diseño',
  montaje: 'Plano o montaje',
  poliza: 'Póliza de seguro',
  certificado: 'Certificado (homologación, sanidad…)',
  otro: 'Otro documento',
} as const
export type ProposalDocument = { id: string; label: keyof typeof PROPOSAL_DOC_LABELS; name: string; path: string; uploaded_at: string }
