import Image from 'next/image'
import { cn } from '@/lib/cn'

/**
 * Official Syndicate Logo Mark — Association for Owners of Land Survey Offices.
 */
export function StationMark({ className, alt = '' }: { className?: string; alt?: string }) {
  return (
    <span
      className={cn(
        'relative inline-flex items-center justify-center overflow-hidden rounded-full bg-white p-0.5 shadow-sm ring-1 ring-white/20 shrink-0',
        className,
      )}
    >
      <Image
        src="/images/Main Logo.png"
        alt={alt}
        width={80}
        height={80}
        className="size-full object-contain"
        priority
      />
    </span>
  )
}
