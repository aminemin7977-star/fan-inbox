import { isAdmin } from '@/lib/auth'
import { admin } from '@/lib/supabase-admin'
import { fetchOne } from '@/lib/messages'
import { MAX_BODY_CHARS } from '@/lib/constants'
import { err, json, UUID_RE } from '@/lib/http'

export const dynamic = 'force-dynamic'

/** Creator replies → fan's status flips to "replied". */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return err('Unauthorized', 401)
  const { id } = await ctx.params
  if (!UUID_RE.test(id)) return err('Invalid id')

  const b = (await req.json().catch(() => null)) as { body?: unknown } | null
  const text = typeof b?.body === 'string' ? b.body.trim() : ''
  if (!text) return err('Write a reply first.')
  if (text.length > MAX_BODY_CHARS) return err(`Reply is too long (max ${MAX_BODY_CHARS} characters).`)

  const sb = admin()
  const { data: cur } = await sb.from('messages').select('read_at').eq('id', id).maybeSingle()
  if (!cur) return err('Not found', 404)

  const { error: e1 } = await sb.from('replies').insert({ message_id: id, body: text })
  if (e1) return err('Could not save the reply.', 500)

  const now = new Date().toISOString()
  const { error: e2 } = await sb
    .from('messages')
    .update({ status: 'replied', replied_at: now, read_at: cur.read_at ?? now })
    .eq('id', id)
  if (e2) return err('Could not update the status.', 500)

  return json({ message: await fetchOne(id) })
}
