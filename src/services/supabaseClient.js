import { createClient } from '@supabase/supabase-js'

// Pegue essas informações do seu painel do Supabase em Project Settings > API
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
