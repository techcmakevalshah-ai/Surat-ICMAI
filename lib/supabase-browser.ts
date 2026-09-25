import { createClient } from '@supabase/supabase-js'

const defaultUrl = 'https://jdxbgspfwbdpgxolcdsb.supabase.co'
const defaultPublishableKey = 'sb_publishable_yJxqj05l9Q3G3XE5ewYv2g_k14F7uBQ'

export function createBrowserSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || defaultUrl
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    defaultPublishableKey

  return createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  })
}
