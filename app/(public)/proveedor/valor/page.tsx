import Link from 'next/link'
import type { Metadata } from 'next'
import { VALUE_SECTIONS, VALUE_SAVINGS, VALUE_SAVINGS_TABLE } from '@/lib/provider-value'

export const metadata: Metadata = {
  title: 'Lo que te llevas gratis al darte de alta · FiestaGo para proveedores',
  description: `Pack de herramientas IA y de gestión que si las pagases sueltas te costarían entre ${VALUE_SAVINGS.monthlyMin}€ y ${VALUE_SAVINGS.monthlyMax}€ al mes. Gratis para siempre con el alta en FiestaGo.`,
}

export const dynamic = 'force-static'
export const revalidate = 3600

export default function ValuePage() {
  return (
    <main style={{ background: '#FBF7F0', color: '#1A1612', minHeight: '100vh', paddingBottom: 80 }}>

      {/* HERO */}
      <section style={{
        background: 'linear-gradient(180deg, #FFF7ED 0%, #FBF7F0 100%)',
        padding: '64px 24px 56px', textAlign: 'center',
      }}>
        <div style={{ maxWidth: 820, margin: '0 auto' }}>
          <div style={{
            display: 'inline-block', padding: '6px 14px', borderRadius: 99,
            background: '#FFE1CC', color: '#C0392B', fontSize: 11, fontWeight: 700,
            letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 18,
          }}>
            🎁 Gratis · Para siempre · Sin tarjeta
          </div>
          <h1 style={{
            fontFamily: 'Georgia, serif', fontSize: 'clamp(32px, 5vw, 52px)',
            fontWeight: 500, lineHeight: 1.1, margin: 0, marginBottom: 18,
            letterSpacing: '-0.02em',
          }}>
            Lo que te llevas el día que te das <em style={{ color: '#C0392B', fontWeight: 400 }}>de alta</em>
          </h1>
          <p style={{
            fontSize: 19, lineHeight: 1.55, color: '#5C534A', margin: 0,
            maxWidth: 640, marginInline: 'auto', marginBottom: 28,
          }}>
            Un pack de herramientas que si las pagases sueltas te costarían entre{' '}
            <strong style={{ color: '#1A1612' }}>{VALUE_SAVINGS.monthlyMin}€ y {VALUE_SAVINGS.monthlyMax}€ al mes</strong>.
            Tuyas el día 1, aunque todavía no te haya llegado ninguna reserva.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/registro-proveedor" style={{
              padding: '14px 28px', borderRadius: 10, background: '#C0392B',
              color: '#fff', fontSize: 15, fontWeight: 700, textDecoration: 'none',
              boxShadow: '0 4px 14px rgba(192,57,43,0.3)',
            }}>
              ✨ Darme de alta gratis
            </Link>
            <a href="#tabla" style={{
              padding: '14px 24px', borderRadius: 10, background: '#fff',
              color: '#1A1612', fontSize: 15, fontWeight: 600,
              textDecoration: 'none', border: '1px solid #ECE3D2',
            }}>
              Ver cuánto te ahorras ↓
            </a>
          </div>
        </div>
      </section>

      {/* SECCIONES DE VALOR */}
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '0 24px' }}>
        {VALUE_SECTIONS.map(section => (
          <section key={section.id} style={{ marginTop: 56 }}>
            <div style={{ textAlign: 'center', marginBottom: 28 }}>
              <div style={{
                fontSize: 11, fontWeight: 700, color: '#C0392B', letterSpacing: '0.18em',
                textTransform: 'uppercase', marginBottom: 8,
              }}>
                {section.tagline}
              </div>
              <h2 style={{
                fontFamily: 'Georgia, serif', fontSize: 32, fontWeight: 500,
                margin: 0, letterSpacing: '-0.01em',
              }}>
                {section.emoji} {section.title}
              </h2>
            </div>

            <div style={{
              display: 'grid', gap: 16,
              gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))',
            }}>
              {section.tools.map(tool => (
                <article key={tool.title} style={{
                  background: '#fff', border: '1px solid #ECE3D2', borderRadius: 14,
                  padding: 22, display: 'flex', flexDirection: 'column',
                }}>
                  <div style={{ fontSize: 32, marginBottom: 10 }}>{tool.emoji}</div>
                  <h3 style={{
                    fontSize: 17, fontWeight: 700, margin: 0, marginBottom: 6,
                    color: '#1A1612', lineHeight: 1.3,
                  }}>
                    {tool.title}
                  </h3>
                  <div style={{ fontSize: 13, color: '#C0392B', fontWeight: 600, marginBottom: 10 }}>
                    {tool.pitch}
                  </div>
                  <p style={{
                    fontSize: 13, lineHeight: 1.55, color: '#5C534A', margin: 0,
                    marginBottom: 16, flexGrow: 1,
                  }}>
                    {tool.details}
                  </p>
                  <div style={{
                    paddingTop: 14, borderTop: '1px dashed #ECE3D2',
                    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8,
                    fontSize: 11,
                  }}>
                    {tool.saveTime !== '—' && (
                      <div>
                        <div style={{ color: '#9CA3AF', fontWeight: 600, marginBottom: 2 }}>⏱ AHORRO</div>
                        <div style={{ color: '#1A1612', fontWeight: 600 }}>{tool.saveTime}</div>
                      </div>
                    )}
                    {tool.saveMoney !== 'incluido' && tool.saveMoney !== '—' && (
                      <div>
                        <div style={{ color: '#9CA3AF', fontWeight: 600, marginBottom: 2 }}>💰 VS PAGARLO FUERA</div>
                        <div style={{ color: '#10B981', fontWeight: 700 }}>{tool.saveMoney}</div>
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}

        {/* TABLA DE AHORRO TOTAL */}
        <section id="tabla" style={{
          marginTop: 72, scrollMarginTop: 40,
          background: 'linear-gradient(135deg, #1A1612 0%, #2D2823 100%)',
          color: '#fff', borderRadius: 18, padding: '40px 36px',
        }}>
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{
              fontSize: 11, fontWeight: 700, color: '#FFB59A', letterSpacing: '0.2em',
              textTransform: 'uppercase', marginBottom: 8,
            }}>
              Suma total
            </div>
            <h2 style={{
              fontFamily: 'Georgia, serif', fontSize: 32, fontWeight: 500, margin: 0,
              color: '#fff',
            }}>
              💰 Cuánto valdría si lo pagaras suelto
            </h2>
          </div>

          <div style={{ maxWidth: 600, margin: '0 auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <tbody>
                {VALUE_SAVINGS_TABLE.map(row => (
                  <tr key={row.item}>
                    <td style={{ padding: '12px 0', borderBottom: '1px solid #3A332C', color: '#E5DDD3' }}>
                      {row.item}
                    </td>
                    <td style={{
                      padding: '12px 0', borderBottom: '1px solid #3A332C',
                      textAlign: 'right', color: '#fff', fontWeight: 600, whiteSpace: 'nowrap',
                    }}>
                      {row.range}
                    </td>
                  </tr>
                ))}
                <tr>
                  <td style={{ padding: '20px 0 6px', color: '#FFB59A', fontWeight: 700,
                    fontSize: 15, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Total al mes
                  </td>
                  <td style={{ padding: '20px 0 6px', textAlign: 'right',
                    color: '#C0392B', fontSize: 28, fontWeight: 800, fontFamily: 'Georgia, serif' }}>
                    {VALUE_SAVINGS.monthlyMin}-{VALUE_SAVINGS.monthlyMax} €
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: '0 0 14px', color: '#9CA3AF', fontSize: 12 }}>
                    Al año
                  </td>
                  <td style={{ padding: '0 0 14px', textAlign: 'right',
                    color: '#E5DDD3', fontSize: 14, fontWeight: 600 }}>
                    {VALUE_SAVINGS.yearlyMin.toLocaleString('es-ES')}-{VALUE_SAVINGS.yearlyMax.toLocaleString('es-ES')} €
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div style={{ textAlign: 'center', marginTop: 32 }}>
            <Link href="/registro-proveedor" style={{
              display: 'inline-block', padding: '15px 32px', borderRadius: 10,
              background: '#C0392B', color: '#fff', fontSize: 15, fontWeight: 700,
              textDecoration: 'none', boxShadow: '0 4px 14px rgba(192,57,43,0.4)',
            }}>
              ✨ Quiero todo esto gratis
            </Link>
            <div style={{ marginTop: 14, fontSize: 12, color: '#9CA3AF' }}>
              Alta en 5 minutos · Sin tarjeta · Sin permanencia · Cancelable cuando quieras
            </div>
          </div>
        </section>

        {/* CLOSING */}
        <section style={{ marginTop: 56, textAlign: 'center', padding: '0 16px' }}>
          <h2 style={{
            fontFamily: 'Georgia, serif', fontSize: 28, fontWeight: 500,
            margin: 0, marginBottom: 14, color: '#1A1612',
          }}>
            ¿Y las reservas?
          </h2>
          <p style={{
            fontSize: 16, lineHeight: 1.6, color: '#5C534A', margin: 0,
            maxWidth: 620, marginInline: 'auto',
          }}>
            Sí, te llegarán. FiestaGo es un marketplace activo con parejas, familias y empresas buscando
            proveedores en su ciudad. Pero queremos que veas valor el día 1 — no que esperes meses cruzando
            los dedos. Las herramientas son tuyas desde el primer login. Las reservas son el extra.
          </p>
        </section>
      </div>
    </main>
  )
}
