import type { ReactNode } from 'react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Admin Panel | FiestaGo',
  robots: { index: false, follow: false },
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  // Admin has its own full layout — no public navbar/footer
  return <>{children}</>
}
