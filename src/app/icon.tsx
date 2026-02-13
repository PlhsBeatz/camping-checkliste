import { ImageResponse } from 'next/og'

const tentSvg = (
  <svg
    width="100%"
    height="100%"
    viewBox="0 0 24 24"
    fill="none"
    stroke="white"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ padding: '15%' }}
  >
    <path d="M3.5 21 12 3l8.5 18H3.5Z" />
    <path d="M12 3v18" />
  </svg>
)

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
        {tentSvg}
      </div>
    ),
    size
  )
}
