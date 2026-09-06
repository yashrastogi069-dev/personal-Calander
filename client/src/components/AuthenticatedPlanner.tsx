import { useMemo, type ReactNode } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { WorkspaceContext } from "@/contexts/WorkspaceContext";
import { trpc } from "@/lib/trpc";
import { safeTimeZone } from "@/lib/workspace";
import { SupabaseAuthGate } from "./SupabaseAuthGate";
import { Button } from "./ui/button";

export function AuthenticatedPlanner({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const workspace = trpc.auth.workspace.useQuery(undefined, { enabled: auth.isAuthenticated, retry: false });
  const scope = useMemo(() => workspace.data ? {
    workspaceId: workspace.data.id, timezone: safeTimeZone(workspace.data.timezone),
  } : null, [workspace.data]);
  if (auth.loading) return <main className="p-8" role="status">Opening your account…</main>;
  if (auth.error) return <main className="p-8" role="alert">
    <h1>Your account could not load</h1>
    <p>Please try again. Your planning records have not been changed.</p>
    <Button onClick={() => void auth.refresh()}>Try again</Button>
    <Button variant="ghost" onClick={() => void auth.logout()}>Sign out</Button>
  </main>;
  if (!auth.isAuthenticated || !auth.user) return <SupabaseAuthGate />;
  const signOut = <Button variant="ghost" onClick={() => void auth.logout()}>Sign out</Button>;
  if (workspace.error) return <main className="p-8" role="alert">
    <h1>Your workspace could not load</h1><p>Please try again.</p>
    <Button onClick={() => void workspace.refetch()}>Try again</Button>{signOut}
  </main>;
  if (workspace.isLoading) return <main className="p-8" role="status">Opening your workspace…</main>;
  if (!scope) return <main className="p-8">
    <h1>Your workspace is waiting to be connected</h1>
    <p>Sign-in succeeded. The deployment owner must link your existing planner to this account before you can continue.</p>
    <Button onClick={() => void workspace.refetch()}>Check again</Button>{signOut}
  </main>;
  return <WorkspaceContext.Provider key={auth.user.id} value={scope}>
    {children}<div className="px-5 py-3">{signOut}</div>
  </WorkspaceContext.Provider>;
}
