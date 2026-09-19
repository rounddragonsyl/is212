import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Fail loudly at startup rather than at the first query, where a missing key would
// surface as a confusing network error in the middle of a user's submission.
if (!url || !anonKey) {
  throw new Error(
    'Missing Supabase configuration. Copy .env.example to .env and fill in ' +
      'VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
  )
}

// One client for the whole app: it holds the auth session and its refresh timer, so a
// second instance would race the first over token refresh.
export const supabase = createClient(url, anonKey)
