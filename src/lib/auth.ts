import { supabase } from "@/lib/supabase";
import type { User } from "@/types";

export function signIn(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password });
}

export function signOut() {
  return supabase.auth.signOut();
}

/**
 * Build the app `User` from the current Supabase session: profile from
 * public.users + the lines the user may act on. RLS scopes every query.
 */
export async function loadProfile(): Promise<User | null> {
  const { data: auth } = await supabase.auth.getUser();
  const authUser = auth.user;
  if (!authUser) return null;

  const { data: profile, error } = await supabase
    .from("users")
    .select("id,name,role,factory_id")
    .eq("auth_user_id", authUser.id)
    .maybeSingle();
  if (error || !profile) return null;

  let lineIds: string[] = [];
  if (profile.role === "ie") {
    const { data } = await supabase.from("lines").select("id").eq("factory_id", profile.factory_id ?? "").is("archived_at", null);
    lineIds = (data ?? []).map((x) => x.id);
  } else if (profile.role === "super_admin") {
    const { data } = await supabase.from("lines").select("id").is("archived_at", null);
    lineIds = (data ?? []).map((x) => x.id);
  } else if (profile.role === "chief") {
    const { data } = await supabase.from("line_chiefs").select("line_id").eq("user_id", profile.id);
    lineIds = (data ?? []).map((x) => x.line_id);
  } else if (profile.role === "supervisor") {
    const { data } = await supabase.from("line_supervisors").select("line_id").eq("user_id", profile.id);
    lineIds = (data ?? []).map((x) => x.line_id);
  }

  return {
    id: profile.id,
    name: profile.name,
    role: profile.role,
    factoryId: profile.factory_id ?? undefined,
    lineIds,
  };
}
