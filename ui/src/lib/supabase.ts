import { createClient } from '@supabase/supabase-js';

// Use placeholder values for test environment
const supabaseUrl = process.env.NEXT_PUBLIC_APP_SUPABASE_URL || 'https://mupadxckjgpekkqyhohg.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_APP_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11cGFkeGNramdwZWtrcXlob2hnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5OTU5MDIsImV4cCI6MjA3NTU3MTkwMn0.VKQWgI4mgL3kBOOeiO8WS0mhhu7cxEuQ-N7GMThihR8';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
