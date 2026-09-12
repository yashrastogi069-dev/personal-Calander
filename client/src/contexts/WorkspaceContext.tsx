import { createContext, useContext } from "react";
import type { WorkspaceScope } from "@/lib/workspace";
import type { PlannerSyncScope } from "@/lib/offlineSync";

export const WorkspaceContext = createContext<WorkspaceScope | null>(null);
export const PlannerSyncScopeContext = createContext<PlannerSyncScope | null>(null);

export function useWorkspaceScope() {
  const scope = useContext(WorkspaceContext);
  if (!scope) throw new Error("Sign in before opening your workspace.");
  return scope;
}

export function usePlannerSyncScope() {
  const scope = useContext(PlannerSyncScopeContext);
  if (!scope) throw new Error("Sign in before opening offline planner data.");
  return scope;
}
