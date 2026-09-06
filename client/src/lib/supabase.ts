import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

function configuredClient() {
  if (!url || !anonKey) return null;
  try {
    return createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  } catch {
    // A malformed build-time URL must not crash before the app can show recovery.
    console.warn("[Auth] Supabase public configuration is invalid.");
    return null;
  }
}

export const supabase = configuredClient();

export function requireSupabaseClient() {
  if (!supabase) {
    throw new Error("Supabase authentication is not configured for this deployment.");
  }
  return supabase;
}
