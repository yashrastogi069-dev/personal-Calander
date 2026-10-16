// Tasks T2b-2: pull to refresh on the phone Tasks scroll area (spec 2026-10-14 §3 "Pull"). The ring follows
// the pull and the status pill says what happens; the refresh is the existing snapshot refetch (no new write).
// Offline refuses with the reason instead of pretending to refresh.
import { usePullToRefresh } from "@/features/gestures/usePullToRefresh";
import { cn } from "@/lib/utils";
import { motion, useTransform } from "framer-motion";
import { RefreshCw } from "lucide-react";

export function TaskPullRefresh({ enabled, offlineReason, onRefresh }: { enabled: boolean; offlineReason: string | null; onRefresh: () => Promise<void> }) {
  const pull = usePullToRefresh({ enabled, canRefresh: () => offlineReason, onRefresh });
  const dash = useTransform(pull.progress, value => 44 * (1 - Math.min(1, Math.max(0, value))));
  const opacity = useTransform(pull.offset, value => Math.min(1, value / 40));
  if (!enabled) return null;
  const visible = pull.phase !== "idle";
  return (
    <div className={cn("tk-pull", visible && "is-on", `is-${pull.phase}`)} aria-hidden={visible ? undefined : true}>
      <motion.div className="tk-pull-ring" style={{ y: pull.offset, opacity: visible ? opacity : 0 }}>
        <svg viewBox="0 0 18 18" width="28" height="28" aria-hidden="true">
          <circle cx="9" cy="9" r="7" className="tk-pull-track" />
          <motion.circle cx="9" cy="9" r="7" className="tk-pull-arc" strokeDasharray="44" style={{ strokeDashoffset: dash }} />
        </svg>
        <RefreshCw size={13} strokeWidth={2.25} className="tk-pull-icon" aria-hidden="true" />
      </motion.div>
      {pull.message && visible ? <span className="tk-pull-msg" role="status">{pull.message}</span> : null}
    </div>
  );
}
