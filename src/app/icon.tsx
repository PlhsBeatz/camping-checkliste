import { ImageResponse } from 'next/og'
import { CampingAppIcon } from '@/components/camping-app-icon'

export function generateImageMetadata() {
  return [
    { id: '32', size: { width: 32, height: 32 }, contentType: 'image/png' as const },
    { id: '192', size: { width: 192, height: 192 }, contentType: 'image/png' as const },
    { id: '512', size: { width: 512, height: 512 }, contentType: 'image/png' as const },
  ]
}

export default async function Icon({
  id,
}: {
  id: Promise<string | number>
}) {
  const iconId = await id
  const sizeMap: Record<string, { width: number; height: number }> = {
    '32': { width: 32, height: 32 },
    '192': { width: 192, height: 192 },
    '512': { width: 512, height: 512 },
  }
  const size = sizeMap[String(iconId)] ?? { width: 32, height: 32 }
  const radius = Math.round(size.width * 0.1875)

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
          borderRadius: radius,
        }}
      >
        <div style={{ width: '75%', height: '75%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CampingAppIcon style={{ width: '100%', height: '100%' }} />
        </div>
      </div>
    ),
    size
  )
}
