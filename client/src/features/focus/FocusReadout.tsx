// The instrument with its words: state pill, rolling digits, sub line and the minute-level timer
// text. Shared by the Focus stage (lg), the pill popover and phone sheet (md) and the Finish recap.
import { CheckCircle2, Flag, Pause, Timer, WifiOff } from "lucide-react";
import { useBecameTrue } from "@/design/motion";
import { cn } from "@/lib/utils";
import { FocusDial, FocusDigits, type FocusDialSize } from "./FocusDial";
import type { FocusWatchSession } from "./FocusTimeDial";
import {
  focusDialGeometry,
  focusEndsAround,
  focusMeetingNotch,
  focusOvertimeLabel,
  focusPausedLabel,
  focusTimerSentence,
  formatClockTime,
  formatFocusClock,
  formatFocusMinutes,
} from "./focusDisplay";

export type FocusPillState = "idle" | "running" | "paused" | "over" | "offline" | "saved";

export function focusPillState(session: FocusWatchSession | null, elapsedSeconds: number, online: boolean): FocusPillState {
  if (!session) return "idle";
  if (!online) return "offline";
  if (session.state === "paused") return "paused";
  return focusDialGeometry(elapsedSeconds, session.targetMinutes).over ? "over" : "running";
}

/** State in words (colour never stands alone). Running carries the live dot; overtime is neutral. */
export function FocusStatePill({
  state,
  session,
  elapsedSeconds = 0,
  timeZone,
  className,
}: {
  state: FocusPillState;
  session?: FocusWatchSession | null;
  elapsedSeconds?: number;
  timeZone?: string;
  className?: string;
}) {
  const reached = useBecameTrue(state === "over");
  let icon = <Timer size={13} aria-hidden="true" />;
  let label = "Ready";
  if (state === "running") { icon = <span className="pc-live pc-focus-live" aria-hidden="true" />; label = "Focusing"; }
  if (state === "paused") { icon = <Pause size={13} aria-hidden="true" />; label = focusPausedLabel(session?.pausedAt, timeZone); }
  if (state === "over") { icon = <Flag size={13} aria-hidden="true" />; label = `Target reached · ${focusOvertimeLabel(elapsedSeconds, session?.targetMinutes ?? 0) ?? ""}`; }
  if (state === "offline") { icon = <WifiOff size={13} aria-hidden="true" />; label = "Estimated · offline"; }
  if (state === "saved") { icon = <CheckCircle2 size={13} aria-hidden="true" />; label = "Saved"; }
  return (
    <span key={state} className={cn("pc-focus-state", `is-${state}`, reached && "pc-pop", className)}>
      {icon}
      <span>{label}</span>
    </span>
  );
}

/** Sub line: "of 25m · ends ~12:11", or the estimate after the target. */
export function focusSubLine(session: FocusWatchSession, elapsedSeconds: number, online: boolean, nowMs: number, timeZone?: string): string {
  const target = `of ${formatFocusMinutes(session.targetMinutes)}`;
  const ends = online ? focusEndsAround(nowMs, elapsedSeconds, session.targetMinutes, session.state === "active", timeZone) : null;
  return ends ? `${target} · ${ends}` : target;
}

export function FocusInstrument({
  size,
  session,
  elapsedSeconds,
  title,
  online,
  timeZone,
  nowMs,
  nextMeeting,
  idleMinutes,
  className,
}: {
  size: Exclude<FocusDialSize, "xs" | "sm">;
  session: FocusWatchSession | null;
  elapsedSeconds: number;
  title: string;
  online: boolean;
  timeZone?: string;
  nowMs: number;
  nextMeeting?: { startsAt: number; title: string } | null;
  /** Planned length shown in the idle (setup) state. */
  idleMinutes?: number;
  className?: string;
}) {
  const state = focusPillState(session, elapsedSeconds, online);
  const notchFraction = session && session.state === "active" ? focusMeetingNotch(nextMeeting?.startsAt, nowMs, elapsedSeconds, session.targetMinutes) : null;
  const notch = notchFraction != null && nextMeeting ? { fraction: notchFraction, label: `Meeting ${formatClockTime(nextMeeting.startsAt, timeZone)} · ${nextMeeting.title}` } : null;
  const digits = session ? formatFocusClock(elapsedSeconds) : formatFocusClock((idleMinutes ?? 25) * 60);
  return (
    <FocusDial
      size={size}
      state={!session ? "idle" : session.state === "paused" ? "paused" : "running"}
      elapsedSeconds={elapsedSeconds}
      targetMinutes={session?.targetMinutes ?? idleMinutes ?? 25}
      offline={!online}
      notch={notch}
      sessionKey={session?.id}
      className={className}
    >
      <FocusStatePill state={state} session={session} elapsedSeconds={elapsedSeconds} timeZone={timeZone} />
      <FocusDigits text={digits} prefix={session && !online ? "≈" : undefined} className={cn("pc-focus-digits-dial", digits.length > 5 && "is-long")} />
      <span className="pc-focus-sub pc-num">
        {session ? focusSubLine(session, elapsedSeconds, online, nowMs, timeZone) : "planned length"}
      </span>
      {session ? (
        <span role="timer" className="pc-sr-only">{focusTimerSentence(elapsedSeconds, session.targetMinutes, title)}</span>
      ) : null}
    </FocusDial>
  );
}
