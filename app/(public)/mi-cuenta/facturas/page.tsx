'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

type Invoice = {
  id: string
  full_number: string
  issue_date: string
  invoice_type: 'commission_fiestago' | 'delegated_provider'
  issuer_tax_name: string
  concept: string
  base_amount: number
  tax_amount: number
  total_amount: number
  booking_id: string | null
}

const EUR = (n: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }).format(n)

const dateEs = (d: string) =>
  new Date(d).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })

export default function MisFacturasPage() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState<string | null>(null)
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/login'); return }
      setEmail(user.email!)
      fetch(`/api/mis-facturas?email=${encodeURIComponent(user.email!)}`)
        .then(r => r.json())
        .then(d => setInvoices(d.invoices || []))
        .finally(() => setLoading(false))
    })
  }, [supabase, router])

  const totalComision = invoices
    .filter(i => i.invoice_type === 'commission_fiestago')
    .reduce((s, i) => s + Number(i.total_amount || 0), 0)
  const totalServicios = invoices
    .filter(i => i.invoice_type === 'delegated_provider')
    .reduce((s, i) => s + Number(i.total_amount || 0), 0)

  return (
    <main className="min-h-screen bg-cream py-10 px-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-baseline justify-between gap-2 mb-2 flex-wrap">
          <div>
            <div className="text-xs font-bold tracking-widest uppercase text-coral mb-1">Mis facturas</div>
            <h1 className="font-serif text-3xl font-black text-ink">Facturas emitidas</h1>
          </div>
          <Link href="/mi-cuenta" className="text-xs text-coral hover:underline">← Volver a Mi cuenta</Link>
        </div>
        <p className="text-ink/55 text-sm mb-8 leading-relaxed">
          Todas las facturas legales emitidas a tu nombre por FiestaGo. Cumplen Verifactu (RD 1007/2023)
          con hash SHA-256 encadenado y código QR verificable en la Agencia Tributaria.
        </p>

        {loading ? (
          <div className="text-center text-ink/40 py-12">Cargando facturas…</div>
        ) : invoices.length === 0 ? (
          <div className="bg-white border border-stone-200 rounded-2xl p-10 text-center">
            <div className="text-4xl mb-3">📄</div>
            <p className="text-ink/55 text-sm">
              Aún no tienes facturas. Cuando confirmes una reserva, aparecerán aquí.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
              <Stat label="Total facturas" value={String(invoices.length)} />
              <Stat label="Comisión FiestaGo" value={EUR(totalComision)} accent="text-coral" />
              <Stat label="Servicios proveedores" value={EUR(totalServicios)} accent="text-emerald-700" />
            </div>

            <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-stone-50 border-b border-stone-200">
                      <th className="text-left px-4 py-3 text-[10px] font-bold text-ink/45 uppercase tracking-widest">Nº</th>
                      <th className="text-left px-4 py-3 text-[10px] font-bold text-ink/45 uppercase tracking-widest">Fecha</th>
                      <th className="text-left px-4 py-3 text-[10px] font-bold text-ink/45 uppercase tracking-widest">Emisor</th>
                      <th className="text-left px-4 py-3 text-[10px] font-bold text-ink/45 uppercase tracking-widest">Concepto</th>
                      <th className="text-right px-4 py-3 text-[10px] font-bold text-ink/45 uppercase tracking-widest">Total</th>
                      <th className="text-right px-4 py-3 text-[10px] font-bold text-ink/45 uppercase tracking-widest">PDF</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map(inv => (
                      <tr key={inv.id} className="border-b border-stone-100 last:border-0">
                        <td className="px-4 py-3 font-mono text-xs text-ink font-semibold whitespace-nowrap">{inv.full_number}</td>
                        <td className="px-4 py-3 text-xs text-ink/65 whitespace-nowrap">{dateEs(inv.issue_date)}</td>
                        <td className="px-4 py-3 text-xs">
                          <div className="text-ink">{inv.issuer_tax_name}</div>
                          <div className="text-ink/40 text-[10px] mt-0.5">
                            {inv.invoice_type === 'commission_fiestago' ? 'Comisión FiestaGo' : 'Servicio delegado'}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-ink/70 max-w-[280px]">{inv.concept}</td>
                        <td className="px-4 py-3 text-ink font-semibold tabular-nums text-right whitespace-nowrap">
                          {EUR(Number(inv.total_amount))}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <a
                            href={`/api/invoices/${inv.id}/pdf?email=${encodeURIComponent(email || '')}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs font-semibold text-coral hover:underline">
                            Abrir ↗
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <p className="text-[11px] text-ink/45 mt-4 leading-relaxed">
              Cada factura viene con un código QR en la esquina inferior derecha. Puedes escanearlo con la app
              oficial de la Agencia Tributaria para verificar su validez.
            </p>
          </>
        )}
      </div>
    </main>
  )
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="bg-white border border-stone-200 rounded-2xl p-4">
      <div className="text-[10px] font-bold text-ink/45 uppercase tracking-widest">{label}</div>
      <div className={`font-serif text-xl md:text-2xl font-bold mt-1 ${accent || 'text-ink'}`}>{value}</div>
    </div>
  )
}
