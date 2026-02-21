import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { PwaUpdatePrompt } from '@/components/pwa-update-prompt'
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
  icons: {
    icon: [{ url: '/icon?id=32', sizes: '32x32', type: 'image/png' }],
    apple: '/apple-icon',
  },
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
  themeColor: '#2d4f1e',
}

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="de" className="scroll-smooth overflow-x-clip">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Packliste" />
        <link
          href="https://fonts.googleapis.com/icon?family=Material+Icons"
          rel="stylesheet"
        />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased bg-background text-foreground overflow-x-clip`}>
        <div className="w-full max-w-full overflow-x-clip">
          {children}
        </div>
        <PwaUpdatePrompt />
      </body>
    </html>
  )
}
