import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { TRPCError } from "@trpc/server";
import { authenticateSupabaseBearer, readBearerToken } from "../supabaseAuth";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  authError?: TRPCError;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;
  let authError: TRPCError | undefined;

  try {
    const token = readBearerToken(opts.req);
    user = token ? await authenticateSupabaseBearer(token) : null;
  } catch (error) {
    // Public health routes remain available; auth failures must not look like sign-out.
    authError = new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Account service unavailable. Check the server configuration and database migration." });
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
    authError,
  };
}
