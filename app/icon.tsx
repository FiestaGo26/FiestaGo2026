import { ImageResponse } from 'next/og'

// Favicon dinámico generado en build / on-demand.
// 32x32 para la barra del navegador.
export const size    = { width: 32, height: 32 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 24,
          background: '#E8553E',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          borderRadius: 7,
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
