import { createContext, useContext } from "react";
import type { WorkspaceScope } from "@/lib/workspace";

export const WorkspaceContext = createContext<WorkspaceScope | null>(null);

export function useWorkspaceScope() {
  const scope = useContext(WorkspaceContext);
  if (!scope) throw new Error("Sign in before opening your workspace.");
  return scope;
}
