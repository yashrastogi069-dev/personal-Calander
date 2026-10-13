// D2.5 FocusDial: one instrument in four sizes (xs 24, sm 96, md 168, lg up to 360).
// The SVG is decorative (aria-hidden); every surface pairs it with words and a minute-level timer.
// Motion is state-driven: the arc steps each second, ticks light in order, the comet sweeps once a
// minute only while running, and the target-reached burst fires only when it is crossed on screen.
import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useBecameTrue } from "@/design/motion";
import { cn } from "@/lib/utils";
import { focusDialGeometry } from "./focusDisplay";
import "./focus.css";

export type FocusDialSize = "xs" | "sm" | "md" | "lg";
export type FocusDialState = "idle" | "running" | "paused" | "saved";

const C = 120;
const ARC_R = 94;
const LAP_R = 82;
const TICK_OUTER = 116;

function polar(radius: number, fraction: number) {
  const angle = fraction * Math.PI * 2 - Math.PI / 2;
  return { x: C + radius * Math.cos(angle), y: C + radius * Math.sin(angle) };
}

/**
 * Mount choreography: "draw" for the first frames (arc at 0, ticks dark), then "settle" for 700ms
 * while the arc draws to its value and lit ticks sweep in order, then "steady" (240ms steps).
 */
function useMountSweep() {
  const [phase, setPhase] = useState<"draw" | "settle" | "steady">("draw");
  useEffect(() => {
    if (typeof requestAnimationFrame !== "function") { setPhase("steady"); return; }
    let second = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => {
        setPhase("settle");
        timer = setTimeout(() => setPhase("steady"), 700);
      });
    });
    return () => { cancelAnimationFrame(first); cancelAnimationFrame(second); if (timer) clearTimeout(timer); };
  }, []);
  return phase;
}

export function FocusDial({
  size,
  state,
  elapsedSeconds = 0,
  targetMinutes,
  offline = false,
  notch = null,
  sessionKey,
  className,
  children,
}: {
  size: FocusDialSize;
  state: FocusDialState;
  elapsedSeconds?: number;
  targetMinutes: number;
  offline?: boolean;
  /** Next meeting on the face, as a fraction of the target, with its label. */
  notch?: { fraction: number; label: string } | null;
  /** Changes when a different session is shown, so the comet never spins backwards. */
  sessionKey?: string;
  className?: string;
  children?: ReactNode;
}) {
  const maskId = useId().replace(/:/g, "");
  const phase = useMountSweep();
  const sweeping = phase === "draw";
  const ticks = size === "sm" ? 30 : 60;
  const live = state === "running" || state === "paused" || state === "saved";
  const geometry = live ? focusDialGeometry(elapsedSeconds, targetMinutes, ticks) : { arc: 0, lap: 0, over: false, lit: 0 };
  const shownArc = sweeping ? 0 : geometry.arc;
  const shownLap = sweeping ? 0 : geometry.lap;
  const shownLit = sweeping ? 0 : geometry.lit;
  const flash = useBecameTrue(geometry.over && state === "running", 900);
  const comet = state === "running" && !offline && size !== "xs";
  const headTurn = geometry.over ? 360 + shownLap * 360 : shownArc * 360;
  const headRadius = geometry.over ? LAP_R : ARC_R;

  if (size === "xs") {
    const fraction = live ? Math.max(geometry.arc, 0.02) : 0;
    return (
      <span className={cn("pc-dial pc-dial-xs", `is-${state}`, geometry.over && "is-over", className)} aria-hidden="true">
        <svg viewBox="0 0 24 24" focusable="false">
          <circle className="pc-dial-track" cx="12" cy="12" r="9.5" />
          {live ? (
            <circle className="pc-dial-arc" cx="12" cy="12" r="9.5" pathLength={100} strokeDasharray="100 100" transform="rotate(-90 12 12)" style={{ strokeDashoffset: 100 - fraction * 100 }} />
          ) : null}
        </svg>
        {state === "running" && !offline ? <span className="pc-dial-xs-live" /> : null}
      </span>
    );
  }

  return (
    <div
      className={cn("pc-dial", `pc-dial-${size}`, `is-${state}`, geometry.over && "is-over", offline && "is-offline", sweeping && "is-sweeping", phase === "settle" && "is-settling", flash && "is-flash", className)}
      data-dial-state={state}
    >
      <svg viewBox="0 0 240 240" focusable="false" aria-hidden="true" className="pc-dial-face">
        <defs>
          <mask id={`${maskId}-lap`}>
            <circle cx={C} cy={C} r={LAP_R} fill="none" stroke="#fff" strokeWidth={8} pathLength={100} strokeDasharray="100 100" transform={`rotate(-90 ${C} ${C})`} className="pc-dial-lap-reveal" style={{ strokeDashoffset: 100 - shownLap * 100 }} />
          </mask>
        </defs>
        <g className="pc-dial-ticks">
          {Array.from({ length: ticks }, (_, index) => {
            const major = index % 5 === 0;
            return (
              <line
                key={index}
                x1={C}
                y1={C - TICK_OUTER}
                x2={C}
                y2={C - TICK_OUTER + (major ? 8 : 4)}
                transform={`rotate(${(index * 360) / ticks} ${C} ${C})`}
                className={cn("pc-dial-tick", major && "is-major", index < shownLit && "is-lit")}
                style={{ "--pc-tick-i": index } as CSSProperties}
              />
            );
          })}
        </g>
        {state === "idle" ? (
          <circle className="pc-dial-hatch" cx={C} cy={C} r={ARC_R} />
        ) : (
          <circle className="pc-dial-track" cx={C} cy={C} r={ARC_R} />
        )}
        {live ? (
          <circle
            className="pc-dial-arc"
            cx={C}
            cy={C}
            r={ARC_R}
            pathLength={100}
            strokeDasharray="100 100"
            transform={`rotate(-90 ${C} ${C})`}
            style={{ strokeDashoffset: 100 - Math.max(shownArc, live && elapsedSeconds > 0 ? 0.004 : 0) * 100 }}
          />
        ) : null}
        {live && geometry.over ? (
          <g mask={`url(#${maskId}-lap)`}>
            <circle className="pc-dial-lap" cx={C} cy={C} r={LAP_R} />
          </g>
        ) : null}
        {comet ? (
          <g key={sessionKey} className="pc-comet" style={{ transform: `rotate(${elapsedSeconds * 6}deg)` }}>
            {[0, 1, 2].map(step => (
              <line key={step} x1={C} y1={C - TICK_OUTER - 1} x2={C} y2={C - TICK_OUTER + 9} transform={`rotate(${-step * 6} ${C} ${C})`} style={{ opacity: 1 - step * 0.36 }} />
            ))}
          </g>
        ) : null}
        {(state === "running" || state === "paused") && !sweeping ? (
          <g className="pc-dial-head" style={{ transform: `rotate(${headTurn}deg)` }}>
            <circle className="pc-dial-halo" cx={C} cy={C - headRadius} r={13} />
            <circle className="pc-dial-dot" cx={C} cy={C - headRadius} r={7.5} />
          </g>
        ) : null}
      </svg>
      {notch && state !== "idle" ? <FocusDialNotch fraction={notch.fraction} label={notch.label} /> : null}
      {flash ? (
        <span className="pc-dial-burst" aria-hidden="true">
          <span className="pc-burst-ring" />
          <span className="pc-burst-dots" />
        </span>
      ) : null}
      {children ? <div className="pc-dial-center">{children}</div> : null}
    </div>
  );
}

function FocusDialNotch({ fraction, label }: { fraction: number; label: string }) {
  const point = polar(TICK_OUTER + 2, fraction);
  return (
    <span
      className="pc-dial-notch pc-pop"
      style={{ left: `${(point.x / 240) * 100}%`, top: `${(point.y / 240) * 100}%`, "--pc-notch-turn": `${fraction * 360}deg` } as CSSProperties}
      title={label}
      aria-hidden="true"
    />
  );
}

/**
 * Instrument digits: one fixed-width cell per character, tabular figures, and only the digits that
 * changed roll in (never on first paint). Screen readers get the minute-level timer elsewhere.
 */
export function FocusDigits({ text, prefix, className }: { text: string; prefix?: string; className?: string }) {
  const previous = useRef<string | null>(null);
  const last = previous.current;
  useEffect(() => {
    previous.current = text;
  });
  const offset = last != null ? last.length - text.length : 0;
  return (
    <span className={cn("pc-focus-digits pc-num", className)} aria-hidden="true">
      {prefix ? <span className="pc-focus-digits-prefix">{prefix}</span> : null}
      {Array.from(text).map((char, index) => {
        const separator = char === ":";
        const before = last != null && offset === 0 ? last[index] : undefined;
        const changed = last != null && offset === 0 && before !== char && !separator;
        return (
          <span key={`${index}-${char}`} className={cn("pc-digit", separator && "is-sep", changed && "pc-digit-roll")}>
            {char}
          </span>
        );
      })}
    </span>
  );
}
