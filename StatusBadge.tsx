import { Check, CheckCheck, Reply as ReplyIcon } from 'lucide-react'
import type { MessageStatus } from '@/lib/types'
import { cn } from '@/lib/utils'

const META: Record<
  MessageStatus,
  { fan: string; admin: string; Icon: typeof Check; cls: string }
> = {
  received: {
    fan: 'Received',
    admin: 'Unread',
    Icon: Check,
    cls: 'bg-sky-500/15 text-sky-700 ring-sky-500/25 dark:text-sky-300',
  },
  read: {
    fan: 'Read',
    admin: 'Needs reply',
    Icon: CheckCheck,
    cls: 'bg-amber-500/15 text-amber-700 ring-amber-500/25 dark:text-amber-300',
  },
  replied: {
    fan: 'Replied',
    admin: 'Replied',
    Icon: ReplyIcon,
    cls: 'bg-emerald-500/15 text-emerald-700 ring-emerald-500/25 dark:text-emerald-300',
  },
}

export function StatusBadge({
  status,
  variant = 'fan',
  size = 'sm',
}: {
  status: MessageStatus
  variant?: 'fan' | 'admin'
  size?: 'sm' | 'lg'
}) {
  const { Icon, cls, ...labels } = META[status]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-semibold ring-1 ring-inset backdrop-blur',
        size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-1.5 text-sm',
        cls,
      )}
    >
      <Icon className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} strokeWidth={2.75} />
      {labels[variant]}
    </span>
  )
}
