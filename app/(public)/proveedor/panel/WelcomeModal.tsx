'use client'

import { useEffect, useState } from 'react'
import { VALUE_SECTIONS, VALUE_SAVINGS } from '@/lib/provider-value'

// ─── Modal de bienvenida del panel ─────────────────────────────────────
// Se muestra UNA sola vez por proveedor (gate por localStorage con su id).
// Resalta las 3 herramientas IA del panel + la suma total que se ahorra.
// Cada herramienta tiene un botón "Probarla ahora" que dispara onGoTab
// para llevarle a la pestaña correspondiente sin tener que buscarla.

export default function WelcomeModal({
  providerId, providerName, onGoTab,
}: {
  providerId: string
  providerName?: string | null
  onGoTab: (tab: string) => void
}) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!providerId) return
    const key = `fg-welcome-seen-${providerId}`
    if (!localStorage.getItem(key)) {
      // Esperamos un tick para no chocar con el render inicial
      setTimeout(() => setOpen(true), 350)
    }
  }, [providerId])

  function dismiss() {
    if (providerId) {
      localStorage.setItem(`fg-welcome-seen-${providerId}`, '1')
    }
    setOpen(false)
  }

  function go(tab: string) {
    onGoTab(tab)
    dismiss()
  }

  if (!open) return null

  // Solo la primera sección (las 3 herramientas IA) — el resto del valor
  // está documentado en /proveedor/valor (link al final del modal).
  const tools = VALUE_SECTIONS[0].tools

  return (
    <div onClick={dismiss} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 200,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#FBF7F0', borderRadius: 16, padding: 0, maxWidth: 680, width: '100%',
        maxHeight: '92vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
      }}>
        {/* HEADER */}
        <div style={{
          background: 'linear-gradient(135deg, #C0392B 0%, #E8553E 100%)',
          color: '#fff', padding: '28px 28px 24px', borderRadius: '16px 16px 0 0',
          textAlign: 'center', position: 'relative',
        }}>
          <button onClick={dismiss} style={{
            position: 'absolute', top: 14, right: 14, background: 'rgba(255,255,255,0.2)',
            border: 'none', color: '#fff', width: 30, height: 30, borderRadius: '50%',
            cursor: 'pointer', fontSize: 16, lineHeight: 1,
          }}>✕</button>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em',
            textTransform: 'uppercase', opacity: 0.9, marginBottom: 6 }}>
            🎉 Bienvenido a FiestaGo
          </div>
          <h2 style={{ margin: 0, fontFamily: 'Georgia, serif', fontSize: 26,
            fontWeight: 500, lineHeight: 1.2 }}>
            {providerName ? `${providerName}, ` : ''}esto es lo que ya tienes <em>gratis</em>
          </h2>
          <p style={{ margin: '10px 0 0', fontSize: 13, opacity: 0.92, lineHeight: 1.5 }}>
            Tres herramientas IA que si las pagases sueltas te costarían entre <strong>{VALUE_SAVINGS.monthlyMin}€ y {VALUE_SAVINGS.monthlyMax}€ al mes</strong>.
            Tuyas el día 1 — aunque todavía no haya llegado ninguna reserva.
          </p>
        </div>

        {/* CARDS */}
        <div style={{ padding: '24px 24px 16px', display: 'grid', gap: 12 }}>
          {tools.map(tool => (
            <div key={tool.title} style={{
              background: '#fff', border: '1px solid #ECE3D2', borderRadius: 12, padding: 16,
              display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 14, alignItems: 'center',
            }}>
              <div style={{ fontSize: 28 }}>{tool.emoji}</div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#1A1612', marginBottom: 2 }}>
                  {tool.title}
                </div>
                <div style={{ fontSize: 12, color: '#5C534A', lineHeight: 1.5 }}>
                  {tool.pitch}
                </div>
                <div style={{ fontSize: 11, color: '#10B981', fontWeight: 700, marginTop: 4 }}>
                  Ahorras {tool.saveTime} · ~{tool.saveMoney} vs {tool.comparedTo}
                </div>
              </div>
              <button onClick={() => go(tool.panelTab)} style={{
                padding: '8px 14px', borderRadius: 8, border: 'none',
                background: '#C0392B', color: '#fff', fontSize: 12, fontWeight: 700,
                cursor: 'pointer', whiteSpace: 'nowrap',
              }}>
                Probarla →
              </button>
            </div>
          ))}
        </div>

        {/* FOOTER */}
        <div style={{
          padding: '16px 24px 24px', textAlign: 'center', borderTop: '1px solid #ECE3D2',
          background: '#fff', borderRadius: '0 0 16px 16px',
        }}>
          <a href="/proveedor/valor" target="_blank" rel="noreferrer" style={{
            fontSize: 12, color: '#C0392B', fontWeight: 600, textDecoration: 'none',
          }}>
            Ver todo lo que se incluye →
          </a>
          <div style={{ marginTop: 10 }}>
            <button onClick={dismiss} style={{
              padding: '8px 18px', borderRadius: 8, border: '1px solid #ECE3D2',
              background: 'transparent', color: '#5C534A', fontSize: 12, fontWeight: 600,
              cursor: 'pointer',
            }}>
              Más tarde
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
