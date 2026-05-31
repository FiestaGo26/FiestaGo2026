import { ImageResponse } from 'next/og'

// Icono PWA 512×512 — usado por splash screen y stores. Servido
// por Next.js en /icon2.
export const size    = { width: 512, height: 512 }
export const contentType = 'image/png'

export default function Icon512() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 380,
          background: 'linear-gradient(135deg, #E8553E 0%, #C8442E 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontWeight: 900,
          fontFamily: 'serif',
        }}
      >
        F
      </div>
    ),
    { ...size }
  )
}
