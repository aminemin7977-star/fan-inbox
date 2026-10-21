import 'server-only'
import { admin, signMap } from './supabase-admin'
import type { AdminMessage, MessageStatus, ThreadReply } from './types'

export const SELECT =
  'id,nickname,body,image_paths,status,archived,created_at,read_at,replied_at,replies(id,body,created_at)'

export interface Row {
  id: string
  nickname: string
  body: string
  image_paths: string[] | null
  status: MessageStatus
  archived: boolean
  created_at: string
  read_at: string | null
  replied_at: string | null
  replies: ThreadReply[] | null
}

export async function toAdminMessages(rows: Row[]): Promise<AdminMessage[]> {
  const urls = await signMap(rows.flatMap((r) => r.image_paths ?? []))
  return rows.map((r) => ({
    id: r.id,
    nickname: r.nickname,
    body: r.body,
    status: r.status,
    archived: r.archived,
    created_at: r.created_at,
    read_at: r.read_at,
    replied_at: r.replied_at,
    images: (r.image_paths ?? []).map((p) => urls.get(p)).filter((u): u is string => !!u),
    replies: [...(r.replies ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at)),
  }))
}

export async function fetchOne(id: string): Promise<AdminMessage | null> {
  const { data } = await admin().from('messages').select(SELECT).eq('id', id).maybeSingle()
  if (!data) return null
  const [msg] = await toAdminMessages([data as unknown as Row])
  return msg
}
