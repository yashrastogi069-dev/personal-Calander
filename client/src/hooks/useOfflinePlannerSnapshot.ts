import { useEffect, useMemo, useState } from "react";
import { usePlannerSyncScope } from "@/contexts/WorkspaceContext";
import { getBrowserPlannerSyncStore, plannerScopeKey } from "@/lib/offlineSync";

export function useOfflinePlannerSnapshot<T>(input: {
  rangeStart: string;
  rangeEnd: string;
  onlineSnapshot: T | undefined;
}) {
  const scope = usePlannerSyncScope();
  const store = useMemo(() => getBrowserPlannerSyncStore(), []);
  const identity = `${plannerScopeKey(scope)}::${input.rangeStart}::${input.rangeEnd}`;
  const [cached, setCached] = useState<{ identity: string; value: T } | null>(null);

  useEffect(() => {
    let active = true;
    setCached(current => current?.identity === identity ? current : null);
    if (!store) return () => { active = false; };
    void store.getSnapshot(scope, input.rangeStart, input.rangeEnd).then(record => {
      if (active && record) setCached({ identity, value: record.snapshot as T });
    }).catch(() => {
      // Storage availability is a capability, never a reason to block the online planner.
    });
    return () => { active = false; };
  }, [identity, input.rangeEnd, input.rangeStart, scope.accountId, scope.workspaceId, store]);

  useEffect(() => {
    if (!store || input.onlineSnapshot === undefined) return;
    const onlineSnapshot = input.onlineSnapshot;
    void store.putSnapshot(scope, input.rangeStart, input.rangeEnd, onlineSnapshot).then(() => {
      setCached({ identity, value: onlineSnapshot });
    }).catch(() => {
      // A later sync-status slice reports quota/storage failures before offline writes are enabled.
    });
  }, [identity, input.onlineSnapshot, input.rangeEnd, input.rangeStart, scope.accountId, scope.workspaceId, store]);

  return {
    data: input.onlineSnapshot ?? (cached?.identity === identity ? cached.value : undefined),
    isCached: input.onlineSnapshot === undefined && cached?.identity === identity,
  };
}
