import { ImageResponse } from 'next/og'
import { CampingAppIcon } from '@/components/camping-app-icon'

/** Kein `edge` – OpenNext (Cloudflare/AWS) erlaubt apple-icon nicht als Edge-Route. */
export const dynamic = 'force-dynamic'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgb(45, 79, 30)',
          borderRadius: 24,
        }}
      >
        <div style={{ width: '75%', height: '75%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CampingAppIcon style={{ width: '100%', height: '100%' }} />
        </div>
      </div>
    ),
    { ...size }
  )
}

