import { createClient, type User as SupabaseUser } from "@supabase/supabase-js";
import type { User } from "../drizzle/schema";
import { upsertUser, getUserByOpenId } from "./db";

const supabaseUrl = process.env.VITE_SUPABASE_URL ?? "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

const adminClient = supabaseUrl && serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

function toPlannerUser(user: SupabaseUser): Parameters<typeof upsertUser>[0] {
  return {
    openId: user.id,
    name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.email ?? null,
    email: user.email ?? null,
    loginMethod: "supabase_email",
  };
}

export async function authenticateSupabaseBearer(token: string): Promise<User | null> {
  if (!adminClient || !token) return null;
  const { data, error } = await adminClient.auth.getUser(token);
  if (error || !data.user) return null;
  const plannerUser = toPlannerUser(data.user);
  await upsertUser(plannerUser);
  return (await getUserByOpenId(plannerUser.openId)) ?? null;
}

export function readBearerToken(request: { headers: { authorization?: string | string[] | undefined } }) {
  const header = request.headers.authorization;
  if (typeof header !== "string") return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}
