'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { Inbox, LogOut, MessageSquareReply, RefreshCw } from 'lucide-react'
import { StatusBadge } from '@/components/StatusBadge'
import { MessageSheet } from '@/components/MessageSheet'
import { Lightbox } from '@/components/Lightbox'
import type { AdminMessage } from '@/lib/types'
import { cn, keepImages, timeAgo } from '@/lib/utils'

type Filter = 'all' | 'unread' | 'pending' | 'replied' | 'archived'

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'pending', label: 'Pending reply' },
  { key: 'replied', label: 'Replied' },
  { key: 'archived', label: 'Archived' },
]

function matches(m: AdminMessage, f: Filter) {
  if (f === 'archived') return m.archived
  if (m.archived) return false
  if (f === 'unread') return m.status === 'received'
  if (f === 'pending') return m.status === 'read'
  if (f === 'replied') return m.status === 'replied'
  return true
}

export default function Dashboard() {
  const router = useRouter()
  const [messages, setMessages] = useState<AdminMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [offline, setOffline] = useState(false)
  const [filter, setFilter] = useState<Filter>('all')
  const [openId, setOpenId] = useState<string | null>(null)
  const [lightbox, setLightbox] = useState<string | null>(null)
  const autoRead = useRef(new Set<string>())

  const load = useCallback(
    async (manual = false) => {
      if (manual) setRefreshing(true)
      try {
        const r = await fetch('/api/admin/messages', { cache: 'no-store' })
        if (r.status === 401) {
          router.replace('/admin/login')
          return
        }
        if (!r.ok) throw new Error('bad status')
        const { messages: next } = (await r.json()) as { messages: AdminMessage[] }
        setMessages((prev) => {
          const old = new Map(prev.map((m) => [m.id, m]))
          return next.map((m) => ({ ...m, images: keepImages(old.get(m.id)?.images, m.images) }))
        })
        setOffline(false)
      } catch {
        setOffline(true)
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [router],
  )

  // Near-real-time: refresh every 8s while the tab is visible.
  useEffect(() => {
    load()
    const tick = setInterval(() => document.visibilityState === 'visible' && load(), 8000)
    const onVis = () => document.visibilityState === 'visible' && load()
    document.addEventListener('visibilitychange', onVis)
    return () => {
      clearInterval(tick)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [load])

  const upsert = useCallback((m: AdminMessage) => {
    setMessages((prev) =>
      prev.map((x) => (x.id === m.id ? { ...m, images: keepImages(x.images, m.images) } : x)),
    )
  }, [])

  const opened = messages.find((m) => m.id === openId) ?? null

  // Opening a message marks it as read automatically.
  useEffect(() => {
    if (!opened || opened.status !== 'received' || autoRead.current.has(opened.id)) return
    autoRead.current.add(opened.id)
    fetch(`/api/admin/messages/${opened.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'read' }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: { message: AdminMessage }) => upsert(d.message))
      .catch(() => autoRead.current.delete(opened.id))
  }, [opened, upsert])

  function closeSheet() {
    if (openId) autoRead.current.delete(openId)
    setOpenId(null)
  }

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: 0, unread: 0, pending: 0, replied: 0, archived: 0 }
    for (const m of messages) for (const f of FILTERS) if (matches(m, f.key)) c[f.key]++
    return c
  }, [messages])

  const visible = useMemo(() => messages.filter((m) => matches(m, filter)), [messages, filter])

  async function logout() {
    await fetch('/api/admin/logout', { method: 'POST' })
    router.replace('/admin/login')
    router.refresh()
  }

  return (
    <main className="mx-auto min-h-dvh w-full max-w-6xl px-4 pb-16 pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-6">
      {/* Header */}
      <header className="mb-5 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-[34px] font-bold leading-none tracking-tight">Inbox</h1>
          <p className="mt-1.5 text-[15px] text-zinc-500">
            {counts.unread > 0 ? (
              <>
                <span className="font-semibold text-[#007AFF]">{counts.unread} unread</span> ·{' '}
                {counts.pending} waiting for a reply
              </>
            ) : (
              <>You’re all caught up · {counts.pending} waiting for a reply</>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => load(true)}
            aria-label="Refresh"
            className="btn-ghost !h-11 !w-11 !rounded-full !p-0"
          >
            <RefreshCw className={cn('h-[18px] w-[18px]', refreshing && 'animate-spin')} />
          </button>
          <button onClick={logout} aria-label="Sign out" className="btn-ghost !h-11 !w-11 !rounded-full !p-0">
            <LogOut className="h-[18px] w-[18px]" />
          </button>
        </div>
      </header>

      {/* iOS segmented control */}
      <div className="no-scrollbar -mx-4 mb-5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="glass inline-flex min-w-full gap-1 rounded-2xl p-1 sm:min-w-0">
          {FILTERS.map((f) => {
            const active = filter === f.key
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={cn(
                  'relative flex-1 whitespace-nowrap rounded-xl px-3.5 py-2 text-[14px] font-semibold transition-colors',
                  active ? 'text-zinc-900 dark:text-white' : 'text-zinc-500',
                )}
              >
                {active && (
                  <motion.span
                    layoutId="segment"
                    transition={{ type: 'spring', damping: 30, stiffness: 400 }}
                    className="absolute inset-0 rounded-xl bg-white shadow-soft dark:bg-white/15"
                  />
                )}
                <span className="relative flex items-center justify-center gap-1.5">
                  {f.label}
                  {counts[f.key] > 0 && (
                    <span
                      className={cn(
                        'rounded-full px-1.5 text-[11px] font-bold tabular-nums',
                        f.key === 'unread' ? 'bg-[#007AFF] text-white' : 'bg-zinc-500/15 text-zinc-500',
                      )}
                    >
                      {counts[f.key]}
                    </span>
                  )}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {offline && (
        <p className="mb-4 rounded-2xl bg-amber-500/15 px-4 py-2.5 text-sm font-medium text-amber-700 dark:text-amber-300">
          Can’t reach the server — retrying…
        </p>
      )}

      {/* Cards */}
      {loading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="glass h-40 animate-pulse rounded-3xl" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="glass mx-auto mt-10 max-w-sm rounded-3xl p-10 text-center">
          <Inbox className="mx-auto mb-3 h-10 w-10 text-zinc-400" />
          <h2 className="text-lg font-bold">Nothing here</h2>
          <p className="mt-1 text-[15px] text-zinc-500">Messages that match this filter will appear here.</p>
        </div>
      ) : (
        <motion.div layout className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence mode="popLayout" initial={false}>
            {visible.map((m) => {
              const unread = m.status === 'received'
              return (
                <motion.button
                  key={m.id}
                  layout
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ type: 'spring', damping: 26, stiffness: 320 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setOpenId(m.id)}
                  className={cn(
                    'glass flex flex-col gap-3 rounded-3xl p-4 text-left',
                    unread && 'ring-2 ring-[#007AFF]/40',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <div className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-sky-400 to-indigo-500 font-bold text-white">
                        {m.nickname.charAt(0).toUpperCase()}
                        {unread && (
                          <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white bg-[#007AFF] dark:border-zinc-800" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className={cn('truncate text-[16px] leading-tight', unread ? 'font-bold' : 'font-semibold')}>
                          {m.nickname}
                        </p>
                        <p className="text-xs text-zinc-500">{timeAgo(m.created_at)}</p>
                      </div>
                    </div>
                    <StatusBadge status={m.status} variant="admin" />
                  </div>

                  {m.body && (
                    <p className="line-clamp-3 whitespace-pre-wrap break-words text-[15px] leading-snug text-zinc-700 dark:text-zinc-300">
                      {m.body}
                    </p>
                  )}

                  {m.images.length > 0 && (
                    <div className="flex gap-1.5">
                      {m.images.slice(0, 3).map((src, i) => (
                        <div key={i} className="relative h-16 w-16 overflow-hidden rounded-xl bg-black/5">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
                          {i === 2 && m.images.length > 3 && (
                            <span className="absolute inset-0 grid place-items-center bg-black/50 text-sm font-bold text-white">
                              +{m.images.length - 3}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {m.replies.length > 0 && (
                    <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                      <MessageSquareReply className="h-3.5 w-3.5" />
                      {m.replies.length} {m.replies.length === 1 ? 'reply' : 'replies'} sent
                    </p>
                  )}
                </motion.button>
              )
            })}
          </AnimatePresence>
        </motion.div>
      )}

      <AnimatePresence>
        {opened && (
          <MessageSheet
            key={opened.id}
            message={opened}
            onClose={closeSheet}
            onChange={upsert}
            onDeleted={(id) => {
              setMessages((prev) => prev.filter((x) => x.id !== id))
              setOpenId(null)
            }}
            onImage={setLightbox}
          />
        )}
      </AnimatePresence>

      <Lightbox src={lightbox} onClose={() => setLightbox(null)} />
    </main>
  )
}
