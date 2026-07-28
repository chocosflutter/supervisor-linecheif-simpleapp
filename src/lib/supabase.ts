import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** True when Supabase env is configured. */
export const supabaseConfigured = Boolean(url && anonKey);

/**
 * Typed Supabase client. Safe to import even if env is missing — it only throws
 * when actually used without configuration (the app defaults to the mock repo).
 */
export const supabase = createClient<Database>(
  url ?? "http://localhost:54321",
  anonKey ?? "public-anon-key-placeholder",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);
