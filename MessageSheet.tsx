'use client'

import { useEffect, useState } from 'react'
import { motion, useDragControls } from 'framer-motion'
import {
  Archive,
  ArchiveRestore,
  CheckCheck,
  EyeOff,
  Loader2,
  Send,
  Trash2,
  X,
} from 'lucide-react'
import { StatusBadge } from '@/components/StatusBadge'
import { ImageGrid } from '@/components/ImageGrid'
import { MAX_BODY_CHARS } from '@/lib/constants'
import type { AdminMessage } from '@/lib/types'
import { fullTime } from '@/lib/utils'

async function call<T>(url: string, method: string, body?: unknown): Promise<T> {
  const r = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!r.ok) {
    const j = await r.json().catch(() => null)
    throw new Error(j?.error ?? 'Request failed')
  }
  return r.json() as Promise<T>
}

export function MessageSheet({
  message,
  onClose,
  onChange,
  onDeleted,
  onImage,
}: {
  message: AdminMessage
  onClose: () => void
  onChange: (m: AdminMessage) => void
  onDeleted: (id: string) => void
  onImage: (src: string) => void
}) {
  const controls = useDragControls()
  const [reply, setReply] = useState('')
  const [busy, setBusy] = useState<null | 'reply' | 'read' | 'archive' | 'delete'>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function run<T>(kind: NonNullable<typeof busy>, fn: () => Promise<T>) {
    setBusy(kind)
    setError(null)
    try {
      return await fn()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
      return undefined
    } finally {
      setBusy(null)
    }
  }

  async function sendReply() {
    const text = reply.trim()
    if (!text) return
    const res = await run('reply', () =>
      call<{ message: AdminMessage }>(`/api/admin/messages/${message.id}/reply`, 'POST', { body: text }),
    )
    if (res) {
      onChange(res.message)
      setReply('')
    }
  }

  async function patch(kind: 'read' | 'archive', body: object) {
    const res = await run(kind, () =>
      call<{ message: AdminMessage }>(`/api/admin/messages/${message.id}`, 'PATCH', body),
    )
    return res?.message
  }

  async function toggleRead() {
    const m = await patch('read', { status: message.status === 'read' ? 'received' : 'read' })
    if (m) {
      onChange(m)
      if (m.status === 'received') onClose()
    }
  }

  async function toggleArchive() {
    const m = await patch('archive', { archived: !message.archived })
    if (m) {
      onChange(m)
      onClose()
    }
  }

  async function del() {
    const res = await run('delete', () => call<{ ok: true }>(`/api/admin/messages/${message.id}`, 'DELETE'))
    if (res) onDeleted(message.id)
  }

  return (
    <motion.div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/30 backdrop-blur-sm sm:items-center sm:p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        drag="y"
        dragListener={false}
        dragControls={controls}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.6 }}
        onDragEnd={(_, info) => (info.offset.y > 120 || info.velocity.y > 600) && onClose()}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 32, stiffness: 320 }}
        className="glass-solid flex max-h-[92dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-[2rem] sm:rounded-[2rem]"
      >
        {/* Grab handle (drag down to dismiss) */}
        <div
          onPointerDown={(e) => controls.start(e)}
          className="flex shrink-0 cursor-grab touch-none justify-center pb-1 pt-2.5 active:cursor-grabbing"
        >
          <span className="h-1.5 w-10 rounded-full bg-zinc-400/50" />
        </div>

        {/* Header */}
        <div className="flex shrink-0 items-start justify-between gap-3 px-5 pb-3 pt-1">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-sky-400 to-indigo-500 text-lg font-bold text-white">
              {message.nickname.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-lg font-bold leading-tight">{message.nickname}</h2>
              <p className="text-sm text-zinc-500">{fullTime(message.created_at)}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <StatusBadge status={message.status} variant="admin" />
            <button
              onClick={onClose}
              aria-label="Close"
              className="grid h-9 w-9 place-items-center rounded-full bg-black/5 transition active:scale-90 dark:bg-white/10"
            >
              <X className="h-[18px] w-[18px]" />
            </button>
          </div>
        </div>

        {/* Thread */}
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-5 pb-4">
          <div className="flex justify-start">
            <div className="max-w-[92%] space-y-2 rounded-[1.6rem] rounded-bl-lg bg-black/[0.06] p-2.5 dark:bg-white/10">
              <ImageGrid images={message.images} onOpen={onImage} />
              {message.body && (
                <p className="whitespace-pre-wrap break-words px-2 py-1 text-[17px] leading-snug">
                  {message.body}
                </p>
              )}
            </div>
          </div>

          {message.replies.map((r) => (
            <div key={r.id} className="flex justify-end">
              <div className="max-w-[88%] rounded-[1.6rem] rounded-br-lg bg-[#007AFF] px-4 py-3 text-white shadow-lg shadow-blue-500/25">
                <p className="whitespace-pre-wrap break-words text-[17px] leading-snug">{r.body}</p>
                <p className="mt-1 text-right text-[11px] text-white/70">{fullTime(r.created_at)}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Composer + actions */}
        <div className="safe-bottom shrink-0 space-y-3 border-t border-black/5 bg-white/40 px-4 pt-3 dark:border-white/10 dark:bg-black/20">
          {error && (
            <p className="rounded-xl bg-red-500/10 px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400">
              {error}
            </p>
          )}

          <div className="flex items-end gap-2">
            <textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              maxLength={MAX_BODY_CHARS}
              rows={2}
              placeholder="Write a reply…"
              className="field min-h-[3.25rem] flex-1 resize-none py-3"
            />
            <button
              onClick={sendReply}
              disabled={!reply.trim() || busy !== null}
              aria-label="Send reply"
              className="btn-primary !h-[3.25rem] !w-[3.25rem] !rounded-full !p-0"
            >
              {busy === 'reply' ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {message.status !== 'replied' && (
              <button onClick={toggleRead} disabled={busy !== null} className="btn-ghost">
                {message.status === 'read' ? (
                  <>
                    <EyeOff className="h-4 w-4" /> Mark unread
                  </>
                ) : (
                  <>
                    <CheckCheck className="h-4 w-4" /> Mark read
                  </>
                )}
              </button>
            )}
            <button onClick={toggleArchive} disabled={busy !== null} className="btn-ghost">
              {message.archived ? (
                <>
                  <ArchiveRestore className="h-4 w-4" /> Restore
                </>
              ) : (
                <>
                  <Archive className="h-4 w-4" /> Archive
                </>
              )}
            </button>

            <div className="ml-auto">
              {confirmDelete ? (
                <div className="flex items-center gap-1.5">
                  <button onClick={() => setConfirmDelete(false)} className="btn-ghost">
                    Cancel
                  </button>
                  <button
                    onClick={del}
                    disabled={busy !== null}
                    className="inline-flex items-center gap-1.5 rounded-2xl bg-red-500 px-3.5 py-2.5 text-[15px] font-semibold text-white transition active:scale-[0.97] disabled:opacity-50"
                  >
                    {busy === 'delete' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    Delete forever
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="btn-ghost !text-red-600 dark:!text-red-400"
                  aria-label="Delete message"
                >
                  <Trash2 className="h-4 w-4" /> Delete
                </button>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
