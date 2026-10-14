import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env["VITE_SUPABASE_URL"];
const supabasePublishableKey = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"];

// Legacy reference only: FitLytix production uses self-hosted MySQL + server-side sessions.
// Do not throw at module import time when Supabase env vars are absent.
export const supabase: SupabaseClient | null =
  supabaseUrl && supabasePublishableKey ? createClient(supabaseUrl, supabasePublishableKey) : null;
