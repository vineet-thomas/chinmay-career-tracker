import { createClient } from '@supabase/supabase-js'

// Publishable key: safe to ship in the browser; data is protected by Row Level Security.
export const SUPABASE_URL = 'https://kthwrqikcpoparckkvvr.supabase.co'
const SUPABASE_KEY = 'sb_publishable_5L4bcsrWFKf2qSSlP81_Ug_3L8vyrX_'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true },
})
