import type { User as SupabaseUser } from "@supabase/supabase-js";
import type { User } from "../drizzle/schema";
import { upsertAuthenticatedUser } from "./db";
import { getSupabaseAdmin } from "./supabaseAdmin";

export type AuthenticatedUserProfile = {
  authUserId: string;
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
  loginMethod: string;
  lastSignedIn: Date;
};

function nullableMetadataString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function toAuthenticatedUserProfile(user: SupabaseUser): AuthenticatedUserProfile {
  const recordedSignIn = user.last_sign_in_at ? new Date(user.last_sign_in_at) : null;
  const provider = nullableMetadataString(user.app_metadata?.provider);
  return {
    authUserId: user.id,
    name: nullableMetadataString(user.user_metadata?.full_name)
      ?? nullableMetadataString(user.user_metadata?.name),
    email: user.email ?? null,
    avatarUrl: nullableMetadataString(user.user_metadata?.avatar_url)
      ?? nullableMetadataString(user.user_metadata?.picture),
    loginMethod: provider ?? "supabase_email",
    lastSignedIn: recordedSignIn && !Number.isNaN(recordedSignIn.getTime()) ? recordedSignIn : new Date(),
  };
}

export async function authenticateSupabaseBearer(token: string): Promise<User | null> {
  if (!token) return null;
  const { data, error } = await getSupabaseAdmin().auth.getUser(token);
  if (error || !data.user) return null;
  return upsertAuthenticatedUser(toAuthenticatedUserProfile(data.user));
}

export function readBearerToken(request: { headers: { authorization?: string | string[] | undefined } }) {
  const header = request.headers.authorization;
  if (typeof header !== "string") return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}
