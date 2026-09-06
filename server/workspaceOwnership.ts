import { and, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { workspaces } from "../drizzle/schema";
import { getDb } from "./db";

export async function getAccountWorkspace(userId: number) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "The planner database is not configured." });
  const [workspace] = await db.select().from(workspaces)
    .where(eq(workspaces.ownerUserId, userId)).limit(1);
  return workspace ?? null;
}

export async function requireWorkspaceOwner(userId: number, workspaceId: string) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "The planner database is not configured." });
  const [workspace] = await db.select({ id: workspaces.id }).from(workspaces)
    .where(and(eq(workspaces.id, workspaceId), eq(workspaces.ownerUserId, userId))).limit(1);
  if (!workspace) throw new TRPCError({ code: "FORBIDDEN", message: "This workspace is not linked to your account." });
}
