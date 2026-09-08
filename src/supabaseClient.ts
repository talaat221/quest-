import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://nagxpuqdurdcogzudblo.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5hZ3hwdXFkdXJkY29nenVkYmxvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg4OTgxNTQsImV4cCI6MjEwNDQ3NDE1NH0.tKlbuXHSYNUd8VymgFbESpGJZYjCCUrRckI05TH-j08";

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
);