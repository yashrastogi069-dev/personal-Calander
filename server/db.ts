import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { users, type User } from "../drizzle/schema";
import type { AuthenticatedUserProfile } from "./supabaseAuth";

let _db: ReturnType<typeof drizzle> | null = null;
let _pool: Pool | null = null;

function poolConnectionString(value: string): string {
  const parsed = new URL(value);
  // pg v8 treats sslmode=require in a connection string as verify-full and
  // overrides the explicit TLS object. The Session Pooler URI remains the
  // source of truth; removing only this client-library mode lets the pool use
  // encrypted transport with its explicit certificate policy.
  parsed.searchParams.delete("sslmode");
  parsed.searchParams.delete("uselibpqcompat");
  return parsed.toString();
}

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  const connectionString = process.env.SUPABASE_DB_URL;
  if (!_db && connectionString) {
    try {
      _pool = new Pool({
        connectionString: poolConnectionString(connectionString),
        max: 3,
        connectionTimeoutMillis: 10_000,
        idleTimeoutMillis: 10_000,
        ssl: { rejectUnauthorized: false },
      });
      _db = drizzle(_pool);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertAuthenticatedUser(profile: AuthenticatedUserProfile): Promise<User> {
  const db = await getDb();
  if (!db) {
    throw new Error("The planner database is not configured.");
  }

  const [persisted] = await db.insert(users).values(profile).onConflictDoUpdate({
    target: users.authUserId,
    set: {
      name: profile.name,
      email: profile.email,
      avatarUrl: profile.avatarUrl,
      loginMethod: profile.loginMethod,
      lastSignedIn: profile.lastSignedIn,
      updatedAt: new Date(),
    },
  }).returning();
  if (!persisted) throw new Error("The planner account could not be persisted.");
  return persisted;
}

export async function getUserByAuthUserId(authUserId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.authUserId, authUserId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// TODO: add feature queries here as your schema grows.
