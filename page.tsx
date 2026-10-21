'use client'

import { Fragment, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, CheckCheck, ChevronLeft, Copy, Loader2, Lock, Reply as ReplyIcon } from 'lucide-react'
import { StatusBadge } from '@/components/StatusBadge'
import { ImageGrid } from '@/components/ImageGrid'
import { Lightbox } from '@/components/Lightbox'
import { CREATOR_NAME } from '@/lib/constants'
import type { FanThread, MessageStatus } from '@/lib/types'
import { cn, fullTime, keepImages } from '@/lib/utils'

const STEPS: { key: MessageStatus; label: string; Icon: typeof Check; done: string }[] = [
  { key: 'received', label: 'Received', Icon: Check, done: 'bg-sky-500 text-white shadow-sky-500/40' },
  { key: 'read', label: 'Read', Icon: CheckCheck, done: 'bg-amber-500 text-white shadow-amber-500/40' },
  { key: 'replied', label: 'Replied', Icon: ReplyIcon, done: 'bg-emerald-500 text-white shadow-emerald-500/40' },
]

function Stepper({ status }: { status: MessageStatus }) {
  const idx = STEPS.findIndex((s) => s.key === status)
  return (
    <div className="flex items-start px-1">
      {STEPS.map((s, i) => {
        const done = i <= idx
        return (
          <Fragment key={s.key}>
            <div className="flex w-16 flex-col items-center gap-1.5">
              <motion.div
                animate={{ scale: i === idx ? 1.1 : 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 18 }}
                className={cn(
                  'grid h-10 w-10 place-items-center rounded-full transition-colors duration-500',
                  done ? cn('shadow-lg', s.done) : 'bg-zinc-500/10 text-zinc-400',
                )}
              >
                <s.Icon className="h-5 w-5" strokeWidth={2.75} />
              </motion.div>
              <span className={cn('text-xs font-semibold', done ? '' : 'text-zinc-400')}>{s.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className="relative mt-[18px] h-1 flex-1 overflow-hidden rounded-full bg-zinc-500/15">
                <motion.div
                  className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-sky-500 to-emerald-500"
                  initial={false}
                  animate={{ width: i < idx ? '100%' : '0%' }}
                  transition={{ duration: 0.7, ease: 'easeOut' }}
                />
              </div>
            )}
          </Fragment>
        )
      })}
    </div>
  )
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1.5 px-1 py-2">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-2 w-2 rounded-full bg-zinc-400"
          animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
          transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.18 }}
        />
      ))}
    </div>
  )
}

export default function TrackPage() {
  const { token } = useParams<{ token: string }>()
  const [thread, setThread] = useState<FanThread | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading')
  const [lightbox, setLightbox] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/thread/${token}`, { cache: 'no-store' })
      if (r.status === 404) return setState('missing')
      if (!r.ok) throw new Error('bad status')
      const next = (await r.json()) as FanThread
      setThread((prev) => ({ ...next, images: keepImages(prev?.images, next.images) }))
      setState('ready')
    } catch {
      setState((s) => (s === 'ready' ? s : 'error'))
    }
  }, [token])

  // Live updates: poll every 4s while the tab is visible + refresh on focus.
  useEffect(() => {
    load()
    const tick = setInterval(() => document.visibilityState === 'visible' && load(), 4000)
    const onVis = () => document.visibilityState === 'visible' && load()
    document.addEventListener('visibilitychange', onVis)
    return () => {
      clearInterval(tick)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [load])

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  return (
    <main className="mx-auto min-h-dvh w-full max-w-md px-4 pb-12 pt-[max(1.25rem,env(safe-area-inset-top))] sm:max-w-lg">
      <Link
        href="/"
        className="mb-4 inline-flex items-center gap-0.5 text-[17px] font-medium text-[#007AFF] transition active:opacity-60"
      >
        <ChevronLeft className="h-6 w-6 -ml-1.5" /> New message
      </Link>

      {state === 'loading' && (
        <div className="grid place-items-center py-32 text-zinc-500">
          <Loader2 className="h-7 w-7 animate-spin" />
        </div>
      )}

      {state === 'missing' && (
        <div className="glass rounded-3xl p-8 text-center">
          <Lock className="mx-auto mb-3 h-8 w-8 text-zinc-400" />
          <h1 className="text-xl font-bold">Message not found</h1>
          <p className="mt-1 text-[15px] text-zinc-500">
            This link may be incomplete, or the message was removed.
          </p>
        </div>
      )}

      {state === 'error' && (
        <div className="glass rounded-3xl p-8 text-center">
          <h1 className="text-xl font-bold">Can’t connect</h1>
          <p className="mt-1 text-[15px] text-zinc-500">Check your connection — retrying automatically…</p>
        </div>
      )}

      {state === 'ready' && thread && (
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="space-y-4"
        >
          {/* Status card */}
          <section className="glass rounded-3xl p-5">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[13px] font-semibold uppercase tracking-wide text-zinc-500">Your message</p>
                <h1 className="truncate text-2xl font-bold tracking-tight">{thread.nickname}</h1>
                <p className="text-sm text-zinc-500">{fullTime(thread.created_at)}</p>
              </div>
              <StatusBadge status={thread.status} size="lg" />
            </div>
            <Stepper status={thread.status} />
          </section>

          {/* Conversation */}
          <section className="space-y-3">
            <div className="flex justify-end">
              <div className="max-w-[88%] space-y-2 rounded-[1.6rem] rounded-br-lg bg-[#007AFF] p-2.5 text-white shadow-lg shadow-blue-500/25">
                <ImageGrid images={thread.images} onOpen={setLightbox} />
                {thread.body && (
                  <p className="whitespace-pre-wrap break-words px-2 py-1 text-[17px] leading-snug">
                    {thread.body}
                  </p>
                )}
              </div>
            </div>

            <AnimatePresence initial={false}>
              {thread.replies.map((r) => (
                <motion.div
                  key={r.id}
                  initial={{ opacity: 0, y: 16, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ type: 'spring', damping: 22, stiffness: 260 }}
                  className="flex justify-start"
                >
                  <div className="glass-solid max-w-[88%] rounded-[1.6rem] rounded-bl-lg px-4 py-3">
                    <p className="mb-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      {CREATOR_NAME} · {fullTime(r.created_at)}
                    </p>
                    <p className="whitespace-pre-wrap break-words text-[17px] leading-snug">{r.body}</p>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {thread.status !== 'replied' && (
              <div className="flex justify-start">
                <div className="glass rounded-[1.6rem] rounded-bl-lg px-4 py-2.5">
                  {thread.status === 'read' ? (
                    <>
                      <TypingDots />
                      <p className="pb-1 text-xs text-zinc-500">{CREATOR_NAME} has read your message</p>
                    </>
                  ) : (
                    <p className="py-1 text-sm text-zinc-500">Delivered — waiting for {CREATOR_NAME} to open it.</p>
                  )}
                </div>
              </div>
            )}
          </section>

          {/* Save the link */}
          <section className="glass rounded-3xl p-4">
            <p className="text-[15px] text-zinc-600 dark:text-zinc-400">
              <Lock className="-mt-0.5 mr-1 inline h-4 w-4" />
              Bookmark this page to check back later. Anyone with the link can see this conversation, so
              keep it to yourself.
            </p>
            <button onClick={copyLink} className="btn-ghost mt-3 w-full">
              {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Link copied' : 'Copy my private link'}
            </button>
          </section>
        </motion.div>
      )}

      <Lightbox src={lightbox} onClose={() => setLightbox(null)} />
    </main>
  )
}
