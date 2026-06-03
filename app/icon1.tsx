import { ImageResponse } from 'next/og'

// Icono PWA 192×192 — usado por Android, Chrome, Edge cuando se
// instala como app. Servido por Next.js en /icon1.
export const size    = { width: 192, height: 192 }
export const contentType = 'image/png'

export default function Icon192() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 140,
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
