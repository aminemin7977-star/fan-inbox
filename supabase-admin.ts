import 'server-only'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { BUCKET } from './constants'

/** Signed image URLs stay valid for 6 hours. */
export const SIGN_TTL = 60 * 60 * 6

let client: SupabaseClient | undefined

/** Service-role client (bypasses RLS). Server-only — never import in client code. */
export function admin(): SupabaseClient {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) {
      throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    }
    client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }
  return client
}

/** Batch-sign storage paths → Map(path → signed URL). */
export async function signMap(paths: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  const unique = [...new Set(paths)]
  if (!unique.length) return map
  const { data } = await admin().storage.from(BUCKET).createSignedUrls(unique, SIGN_TTL)
  for (const d of data ?? []) {
    if (d.path && d.signedUrl && !d.error) map.set(d.path, d.signedUrl)
  }
  return map
}
