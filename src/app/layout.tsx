import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin']
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin']
})

export const metadata: Metadata = {
  title: 'Camping Packliste App',
  description: 'Eine intelligente Camping-Packlisten-App mit Offline-Funktionalität und Echtzeit-Kollaboration',
  manifest: '/manifest.json',
  keywords: ['camping', 'packliste', 'offline', 'pwa'],
  authors: [{ name: 'Camping App Team' }],
  openGraph: {
    title: 'Camping Packliste App',
    description: 'Organisieren Sie Ihre Campingausrüstung intelligent',
    type: 'website',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: '#3b82f6',
}

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="de" className="scroll-smooth">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Packliste" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}>
        {children}
      </body>
    </html>
  )
}
