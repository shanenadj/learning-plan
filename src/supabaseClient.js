import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://koervonzcjptsnmqnvmg.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtvZXJ2b256Y2pwdHNubXFudm1nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcyNjYyNzYsImV4cCI6MjA2Mjg0MjI3Nn0.hcDP3H9oX7faGjn2a8PrkCV1pCmzMsRdoF72II_Xq4I'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
