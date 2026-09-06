import { createClient, type User as SupabaseUser } from "@supabase/supabase-js";
import type { User } from "../drizzle/schema";
import { upsertUser, getUserBySupabaseUserId } from "./db";

const supabaseUrl = process.env.VITE_SUPABASE_URL ?? "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

const adminClient = supabaseUrl && serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

function toPlannerUser(user: SupabaseUser): Parameters<typeof upsertUser>[0] {
  return {
    supabaseUserId: user.id,
    name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.email ?? null,
    email: user.email ?? null,
    loginMethod: "supabase_email",
  };
}

export async function authenticateSupabaseBearer(token: string): Promise<User | null> {
  if (!token) return null;
  if (!adminClient) throw new Error("Supabase server authentication is not configured.");
  const { data, error } = await adminClient.auth.getUser(token);
  if (error || !data.user) return null;
  const plannerUser = toPlannerUser(data.user);
  await upsertUser(plannerUser);
  const profile = await getUserBySupabaseUserId(plannerUser.supabaseUserId);
  if (!profile) throw new Error("The planner account could not be loaded from PostgreSQL.");
  return profile;
}

export function readBearerToken(request: { headers: { authorization?: string | string[] | undefined } }) {
  const header = request.headers.authorization;
  if (typeof header !== "string") return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}
