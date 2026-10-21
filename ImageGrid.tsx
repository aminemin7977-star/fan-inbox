'use client'

import { cn } from '@/lib/utils'

export function ImageGrid({
  images,
  onOpen,
  className,
}: {
  images: string[]
  onOpen: (src: string) => void
  className?: string
}) {
  if (!images.length) return null
  return (
    <div className={cn('grid gap-1.5', images.length === 1 ? 'grid-cols-1' : 'grid-cols-2', className)}>
      {images.map((src, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onOpen(src)}
          className="overflow-hidden rounded-2xl bg-black/5 transition active:scale-[0.98]"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={`Attachment ${i + 1}`}
            loading="lazy"
            className={cn('w-full object-cover', images.length === 1 ? 'max-h-80' : 'aspect-square')}
          />
        </button>
      ))}
    </div>
  )
}
