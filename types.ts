export type MessageStatus = 'received' | 'read' | 'replied'

export interface ThreadReply {
  id: string
  body: string
  created_at: string
}

/** What a fan is allowed to see about their own submission. */
export interface FanThread {
  nickname: string
  body: string
  status: MessageStatus
  created_at: string
  read_at: string | null
  replied_at: string | null
  images: string[]
  replies: ThreadReply[]
}

/** Full record for the creator dashboard. */
export interface AdminMessage extends FanThread {
  id: string
  archived: boolean
}
