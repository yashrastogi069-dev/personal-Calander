// The persistent Focus pill (D2.5 Surface C): a calm dark capsule in the header on desktop and
// docked above the bottom bar on phones. The body opens the controls (popover on desktop, sheet on
// phones); Pause/Resume stays one tap away. It reads the shared session context, so Finish can record
// any outcome through the same Finish panel. It announces nothing itself (the provider owns that).
import { useState } from "react";
import { ArrowUpRight, Check, Pause, Play, Square, WifiOff } from "lucide-react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { AnimatePresence, motion } from "framer-motion";
import { Sheet } from "@/components/premium/Sheet";
import { useIsPhone } from "@/components/premium/useMediaQuery";
import { EASE_OUT } from "@/design/motion";
import { cn } from "@/lib/utils";
import { FocusDial, FocusDigits } from "./FocusDial";
import { FocusInstrument } from "./FocusReadout";
import { useFocusSession } from "./FocusSessionContext";
import { useFocusElapsedSeconds, useNow } from "./FocusTimeDial";
import { focusDialGeometry, focusOvertimeLabel, formatFocusClock } from "./focusDisplay";

function FocusControlsBody({ onAfterFinish }: { onAfterFinish: () => void }) {
  const focus = useFocusSession()!;
  const session = focus.session!;
  const elapsed = useFocusElapsedSeconds(session);
  const nowMs = useNow(15_000, session.state === "active");
  const running = session.state === "active";
  return (
    <div className="pc-focus-pop-body">
      <FocusInstrument size="md" session={session} elapsedSeconds={elapsed} title={focus.title} online={focus.online} timeZone={focus.scope.timezone} nowMs={nowMs} nextMeeting={focus.nextMeeting} />
      <p className="pc-focus-pop-task">
        <span className="pc-focus-pop-title">{focus.title}</span>
        {focus.task?.categoryName ? <span className="pc-focus-hint"> · {focus.task.categoryName}</span> : null}
      </p>
      {focus.error ? <p className="pc-focus-alert" role="alert">{focus.error}</p> : null}
      <div className="pc-focus-pop-actions">
        <button type="button" className="pc-focus-btn is-ghost pc-focusable" onClick={running ? focus.pause : focus.resume} disabled={!focus.online || focus.pending}>
          {running ? <Pause size={16} fill="currentColor" aria-hidden="true" /> : <Play size={16} fill="currentColor" aria-hidden="true" />}
          {!focus.online ? "Offline" : running ? "Pause" : "Resume"}
        </button>
        <button type="button" className="pc-focus-btn is-ghost pc-focusable" onClick={() => { onAfterFinish(); focus.openFinish(); }} disabled={!focus.online}>
          <Square size={14} fill="currentColor" aria-hidden="true" /> Finish
        </button>
      </div>
      <button type="button" className="pc-focus-btn is-text pc-focusable" onClick={() => { onAfterFinish(); focus.onOpenFocus(); }}>
        Open Focus <ArrowUpRight size={15} aria-hidden="true" />
      </button>
    </div>
  );
}

export function FocusPersistentControl({ className }: { className?: string }) {
  const focus = useFocusSession();
  const phone = useIsPhone();
  const [open, setOpen] = useState(false);
  const session = focus?.session ?? null;
  const elapsed = useFocusElapsedSeconds(session);
  if (!focus) return null;

  if (!session) {
    return (
      <AnimatePresence>
        {focus.savedFlash ? (
          <motion.div
            key="saved"
            className={cn("pc-focus-pill pc-on-night is-saved", className)}
            role="status"
            initial={{ opacity: 1, scaleX: 1 }}
            exit={{ opacity: 0, scaleX: 0.6, transition: { duration: 0.16, ease: EASE_OUT } }}
          >
            <span className="pc-focus-pill-check pc-spring-pop" aria-hidden="true"><Check size={14} strokeWidth={3} /></span>
            <span>Saved</span>
          </motion.div>
        ) : null}
      </AnimatePresence>
    );
  }

  const running = session.state === "active";
  const geometry = focusDialGeometry(elapsed, session.targetMinutes);
  const overtime = geometry.over ? focusOvertimeLabel(elapsed, session.targetMinutes) : null;
  const minutes = Math.floor(elapsed / 60);
  const stateClass = !focus.online ? "is-offline" : running ? "is-running" : "is-paused";

  const body = (
    <button
      type="button"
      className="pc-focus-pill-body pc-focusable"
      aria-expanded={open}
      aria-haspopup="dialog"
      aria-label={`Show focus controls, ${minutes} ${minutes === 1 ? "minute" : "minutes"}, ${focus.title}`}
      onClick={phone ? () => setOpen(true) : undefined}
    >
      <FocusDial size="xs" state={running ? "running" : "paused"} elapsedSeconds={elapsed} targetMinutes={session.targetMinutes} offline={!focus.online} sessionKey={session.id} />
      <FocusDigits text={formatFocusClock(elapsed)} prefix={focus.online ? undefined : "≈"} className="pc-focus-pill-digits" />
      {overtime ? <span className="pc-focus-pill-over pc-num" aria-hidden="true">{overtime}</span> : null}
      <span className="pc-focus-pill-task" aria-hidden="true">{focus.title}</span>
    </button>
  );

  return (
    <section className={cn("pc-focus-pill", focus.toneClass, stateClass, stateClass !== "is-paused" && "pc-on-night", className)} aria-label="Current focus session" data-focus-pill="">
      {phone ? (
        <>
          {body}
          <Sheet open={open} onOpenChange={setOpen} title="Focus" className="pc-focus-pill-sheet" contentClassName={focus.toneClass}>
            <FocusControlsBody onAfterFinish={() => setOpen(false)} />
          </Sheet>
        </>
      ) : (
        <PopoverPrimitive.Root open={open} onOpenChange={setOpen} modal={false}>
          <PopoverPrimitive.Trigger asChild>{body}</PopoverPrimitive.Trigger>
          <PopoverPrimitive.Portal>
            <PopoverPrimitive.Content
              align="end"
              sideOffset={10}
              collisionPadding={12}
              className={cn("pc-focus-pop", focus.toneClass)}
              aria-label="Focus controls"
            >
              <FocusControlsBody onAfterFinish={() => setOpen(false)} />
            </PopoverPrimitive.Content>
          </PopoverPrimitive.Portal>
        </PopoverPrimitive.Root>
      )}
      <button
        type="button"
        className="pc-focus-pill-action pc-focusable"
        onClick={running ? focus.pause : focus.resume}
        disabled={!focus.online || focus.pending}
        aria-label={!focus.online ? "Offline, reconnect to control focus" : running ? "Pause focus" : "Resume focus"}
      >
        <span key={!focus.online ? "off" : running ? "pause" : "play"} className="pc-focus-pill-icon pc-pop" aria-hidden="true">
          {!focus.online ? <WifiOff size={14} /> : running ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
        </span>
        <span className="pc-focus-pill-label">{!focus.online ? "Offline" : running ? "Pause" : "Resume"}</span>
      </button>
    </section>
  );
}
