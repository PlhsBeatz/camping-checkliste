import Image from 'next/image'
import { cn } from '@/lib/utils'

const SIZE = {
  sm: { box: 'h-12 w-12', px: 48 },
  md: { box: 'h-14 w-14', px: 56 },
} as const

export type EntityThumbSize = keyof typeof SIZE

type EntityThumbProps = {
  src: string | null | undefined
  /** Default `sm` (48). `md` = 56. */
  size?: EntityThumbSize
  /** Material-Icon ohne Foto. Default `place`. */
  fallbackIcon?: string
  className?: string
  alt?: string
}

/**
 * Einheitliches Entity-Vorschaubild für Listen/Zeilen.
 * Mit Foto: object-cover. Ohne: Brand-Well + Icon (kein „Kein Bild“-Text).
 */
export function EntityThumb({
  src,
  size = 'sm',
  fallbackIcon = 'place',
  className,
  alt = '',
}: EntityThumbProps) {
  const { box, px } = SIZE[size]
  const hasSrc = Boolean(src)

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden rounded-lg',
        box,
        hasSrc ? 'bg-muted' : 'bg-brand-muted text-brand-heading',
        className
      )}
    >
      {hasSrc && src ? (
        <Image
          src={src}
          alt={alt}
          width={px}
          height={px}
          unoptimized
          className="h-full w-full object-cover"
        />
      ) : (
        <span className="material-icons text-xl leading-none" aria-hidden>
          {fallbackIcon}
        </span>
      )}
    </div>
  )
}
