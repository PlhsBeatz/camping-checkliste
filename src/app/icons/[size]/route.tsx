import { ImageResponse } from 'next/og'
import { CampingAppIcon } from '@/components/camping-app-icon'

const SIZES = ['48', '72', '96', '128', '192', '384', '512'] as const

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ size: string }> }
) {
  const { size } = await params
  const sizeNum = parseInt(size, 10)
  if (!SIZES.includes(size as (typeof SIZES)[number]) || isNaN(sizeNum) || sizeNum < 48 || sizeNum > 512) {
    return new Response('Invalid size', { status: 400 })
  }

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
          borderRadius: Math.round(sizeNum * 0.1875),
        }}
      >
        <div style={{ width: '75%', height: '75%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CampingAppIcon style={{ width: '100%', height: '100%' }} />
        </div>
      </div>
    ),
    {
      width: sizeNum,
      height: sizeNum,
      headers: {
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    }
  )
}
