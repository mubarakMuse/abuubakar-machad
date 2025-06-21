// src/lib/supabase.js
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL
const supabaseKey = process.env.REACT_APP_SUPABASE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase configuration!')
  console.log('REACT_APP_SUPABASE_URL:', supabaseUrl)
  console.log('REACT_APP_SUPABASE_KEY:', supabaseKey ? '***' : 'MISSING')
}

export const supabase = createClient(supabaseUrl, supabaseKey)