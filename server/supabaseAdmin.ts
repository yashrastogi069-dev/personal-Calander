import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let adminClient: SupabaseClient | null = null;
let adminConfiguration = "";

export function getSupabaseAdmin(): SupabaseClient {
  const supabaseUrl = process.env.VITE_SUPABASE_URL ?? "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase server authentication is not configured.");
  }

  const configuration = `${supabaseUrl}\0${serviceRoleKey}`;
  if (!adminClient || adminConfiguration !== configuration) {
    adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    adminConfiguration = configuration;
  }
  return adminClient;
}
