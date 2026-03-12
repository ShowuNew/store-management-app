import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://xssntfxtknziqpyrvgwr.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhzc250Znh0a256aXFweXJ2Z3dyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzMjM2OTIsImV4cCI6MjA4ODg5OTY5Mn0.jO7MQ8j3umWelMgvhmAkB-1wiZWHPH8rI10qRCWxoMQ'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
