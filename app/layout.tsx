import type { Metadata } from 'next'
import Script from 'next/script'
import { DM_Sans, Fraunces, IBM_Plex_Mono } from 'next/font/google'
import { Toaster } from 'react-hot-toast'
import './globals.css'

const GA_ID = process.env.NEXT_PUBLIC_GA_ID  // Google Analytics 4 Measurement ID (G-XXXXXXXXXX)

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  display: 'swap',
})

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  display: 'swap',
})

const ibmMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-ibm-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: { default: 'FiestaGo — Reserva tu celebración perfecta', template: '%s | FiestaGo' },
  description: 'El marketplace de celebraciones #1 en España. Bodas, cumpleaños, bautizos y más. Los mejores proveedores verificados.',
  keywords: ['bodas', 'celebraciones', 'eventos', 'marketplace', 'proveedores', 'España'],
  authors: [{ name: 'FiestaGo' }],
  creator: 'FiestaGo',
  openGraph: {
    type: 'website',
    locale: 'es_ES',
    url: process.env.NEXT_PUBLIC_APP_URL,
    siteName: 'FiestaGo',
    title: 'FiestaGo — Reserva tu celebración perfecta',
    description: 'El marketplace de celebraciones #1 en España.',
  },
  twitter: { card: 'summary_large_image', title: 'FiestaGo', description: 'El marketplace de celebraciones #1 en España.' },
  robots: { index: true, follow: true },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${dmSans.variable} ${fraunces.variable} ${ibmMono.variable}`}>
      <body className="font-sans bg-cream text-ink antialiased">
        {/* Google Analytics 4 — solo se carga si NEXT_PUBLIC_GA_ID está configurado */}
        {GA_ID && (
          <>
            <Script async src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
            <Script id="ga-init" strategy="afterInteractive">{`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${GA_ID}', { anonymize_ip: true });
            `}</Script>
          </>
        )}
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            duration: 4000,
            style: { background: '#fff', color: '#1C1108', border: '1px solid #E4D9C6', borderRadius: '12px', fontSize: '14px' },
            success: { iconTheme: { primary: '#3D7A52', secondary: '#fff' } },
            error:   { iconTheme: { primary: '#E8553E', secondary: '#fff' } },
          }}
        />
      </body>
    </html>
  )
}
