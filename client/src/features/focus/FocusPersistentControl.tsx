import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import type { WorkspaceScope } from "@/lib/workspace";
import { ChevronDown, ChevronUp, Pause, Play, Square, TimerReset } from "lucide-react";
import { useState } from "react";
import { FocusTimeDial, useFocusPresentation, type FocusWatchSession } from "./FocusTimeDial";

const COMPANION_KEY = "personal-calendar-focus-companion-v1";

function initiallyExpanded() {
  if (typeof window === "undefined") return false;
  try { return window.localStorage.getItem(COMPANION_KEY) === "expanded"; } catch { return false; }
}

export function FocusPersistentControl({
  scope,
  session,
  taskTitle,
  confirmedOnline,
  onOpenFocus,
  prominent = false,
}: {
  scope: WorkspaceScope;
  session: FocusWatchSession;
  taskTitle: string;
  confirmedOnline: boolean;
  onOpenFocus: () => void;
  prominent?: boolean;
}) {
  const utils = trpc.useUtils();
  const [expanded, setExpanded] = useState(initiallyExpanded);
  const [confirmStop, setConfirmStop] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { presentation, choosePresentation } = useFocusPresentation();
  const refresh = async () => {
    await Promise.all([
      utils.planner.workspace.snapshot.invalidate(),
      utils.planner.dashboard.invalidate(),
    ]);
  };
  const failed = (mutationError: { message?: string }, fallback: string) => {
    setError(mutationError.message || fallback);
    void refresh();
  };
  const pause = trpc.planner.focus.pause.useMutation({
    onSuccess: async () => { setError(null); await refresh(); },
    onError: mutationError => failed(mutationError, "Focus could not be paused. Refresh and try again."),
  });
  const resume = trpc.planner.focus.resume.useMutation({
    onSuccess: async () => { setError(null); await refresh(); },
    onError: mutationError => failed(mutationError, "Focus could not be resumed. Refresh and try again."),
  });
  const stop = trpc.planner.focus.finish.useMutation({
    onSuccess: async () => { setError(null); setConfirmStop(false); await refresh(); },
    onError: mutationError => failed(mutationError, "Focus could not be stopped. Refresh and try again."),
  });
  const pending = pause.isPending || resume.isPending || stop.isPending;
  const toggleExpanded = () => {
    const next = !expanded;
    setExpanded(next);
    if (!next) setConfirmStop(false);
    try { window.localStorage.setItem(COMPANION_KEY, next ? "expanded" : "compact"); } catch { /* A device without storage can still use the control. */ }
  };
  const onlineAction = (action: () => void) => {
    if (!confirmedOnline || pending) return;
    setError(null);
    action();
  };

  return (
    <section className={`focus-companion ${expanded ? "is-expanded" : ""} ${prominent ? "is-home" : ""}`} aria-label="Current Focus session">
      <div className="focus-companion-main">
        <div className="focus-companion-context">
          <FocusTimeDial session={session} title={taskTitle} presentation={presentation} size="compact" confirmedOnline={confirmedOnline} />
          <div className="focus-companion-task"><span>Now focusing on</span><strong title={taskTitle}>{taskTitle}</strong></div>
        </div>
        <div className="focus-companion-actions">
          {session.state === "active" ? (
            <Button type="button" variant="outline" onClick={() => onlineAction(() => pause.mutate({ ...scope, id: session.id, expectedVersion: session.version }))} disabled={!confirmedOnline || pending} aria-label="Pause current Focus session"><Pause size={15} />{pause.isPending ? "Pausing…" : "Pause"}</Button>
          ) : (
            <Button type="button" variant="outline" onClick={() => onlineAction(() => resume.mutate({ ...scope, id: session.id, expectedVersion: session.version }))} disabled={!confirmedOnline || pending} aria-label="Resume current Focus session"><Play size={15} />{resume.isPending ? "Resuming…" : "Resume"}</Button>
          )}
          <Button type="button" onClick={onOpenFocus} aria-label="Open full Focus view"><TimerReset size={15} />Focus</Button>
          <Button type="button" variant="ghost" onClick={() => { setExpanded(true); setConfirmStop(true); }} disabled={!confirmedOnline || pending} aria-label="Stop current Focus session"><Square size={15} />Stop</Button>
          <Button type="button" variant="ghost" onClick={toggleExpanded} aria-expanded={expanded} aria-label={expanded ? "Collapse Focus companion" : "Expand Focus companion"}>{expanded ? <ChevronDown size={16} /> : <ChevronUp size={16} />}</Button>
        </div>
      </div>
      {!confirmedOnline ? <p className="focus-companion-offline">{session.state === "active" ? "Estimated time · reconnect to confirm and control" : "Last confirmed paused · reconnect to control"}</p> : null}
      {error ? <p className="focus-companion-error" role="alert">{error}</p> : null}
      {expanded ? (
        <div className="focus-companion-extra">
          <p>One session follows you. Your task stays open if you stop.</p>
          <div className="focus-watch-view-options" role="group" aria-label="Watch display style">
            <button type="button" aria-pressed={presentation === "dial"} onClick={() => choosePresentation("dial")}>Dial</button>
            <button type="button" aria-pressed={presentation === "digital"} onClick={() => choosePresentation("digital")}>Digital</button>
          </div>
          {confirmStop ? (
            <div className="focus-stop-confirm" role="group" aria-label="Confirm stopping Focus">
              <p>Stop and save elapsed time? The task will not be completed.</p>
              <Button type="button" variant="ghost" onClick={() => setConfirmStop(false)}>Cancel</Button>
              <Button type="button" onClick={() => onlineAction(() => stop.mutate({ ...scope, id: session.id, expectedVersion: session.version, outcome: "stopped", note: null, adjustedEstimateMinutes: null }))} disabled={!confirmedOnline || pending}>{stop.isPending ? "Stopping…" : "Stop session"}</Button>
            </div>
          ) : (
            <Button type="button" variant="ghost" onClick={() => setConfirmStop(true)} disabled={!confirmedOnline || pending}><Square size={15} /> Stop Focus</Button>
          )}
        </div>
      ) : null}
    </section>
  );
}
