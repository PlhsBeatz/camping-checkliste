import { ImageResponse } from 'next/og'
import { CampingAppIcon } from '@/components/camping-app-icon'

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
        <CampingAppIcon width={112} height={112} />
      </div>
    ),
    { ...size }
  )
}

