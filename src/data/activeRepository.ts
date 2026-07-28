/**
 * Chooses the active repository behind the Phase 0 seam. Screens/hooks import
 * `repository` from here and never know which backend is in use.
 *
 * Uses Supabase only when configured AND VITE_DATA_SOURCE === "supabase"
 * (and an auth session exists for RLS). Otherwise falls back to the mock repo,
 * so the app always runs.
 */
import type { Repository } from "@/data/repository";
import { mockRepository } from "@/data/mockRepository";
import { supabaseRepository } from "@/data/supabaseRepository";
import { supabaseConfigured } from "@/lib/supabase";

const useSupabase =
  supabaseConfigured && import.meta.env.VITE_DATA_SOURCE === "supabase";

export const repository: Repository = useSupabase ? supabaseRepository : mockRepository;
export const activeDataSource: "supabase" | "mock" = useSupabase ? "supabase" : "mock";
