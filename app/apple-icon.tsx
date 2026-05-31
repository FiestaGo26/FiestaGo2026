import { ImageResponse } from 'next/og'

// Apple touch icon — el que iOS usa cuando "Añadir a pantalla de inicio".
// 180×180 es el tamaño recomendado por Apple para todos los dispositivos.
export const size    = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 130,
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
