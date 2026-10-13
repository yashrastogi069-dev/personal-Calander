// Focus screen (D2.5 Surface B and D): a stage with one instrument and a context rail. The stage
// shows setup (idle), the live instrument with Finish / Pause / Full screen, the inline Finish panel
// on desktop, or step 2 "Saved. What next?". Pause, resume, finish and follow-up go through the
// shared session context; only Start stays here (it needs the setup choices).
import { useEffect, useId, useMemo, useRef, useState, type MutableRefObject } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "framer-motion";
import { CircleAlert, ExternalLink, Flag, Maximize2, Minimize2, Minus, MoreHorizontal, Pause, Play, Plus, Square, Timer, X } from "lucide-react";
import { toast } from "sonner";
import { CategoryChip, Pill } from "@/components/premium/Pills";
import { useIsPhone } from "@/components/premium/useMediaQuery";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { resolveCategoryTones, toneClassName } from "@/design/categoryTone";
import { EASE_OUT } from "@/design/motion";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import type { WorkspaceScope } from "@/lib/workspace";
import { FocusDigits } from "./FocusDial";
import { FocusFinishFlow } from "./FocusFinishFlow";
import { FocusFollowUpPanel, focusEstimateSignalLabel } from "./FocusFollowUpPanel";
import { FocusInstrument, FocusStatePill, focusPillState, focusSubLine } from "./FocusReadout";
import { useFocusSession, type FocusHandoff } from "./FocusSessionContext";
import { FocusTaskPicker, NO_TASK } from "./FocusTaskPicker";
import { useFocusElapsedSeconds, useFocusPresentation, useNow, type FocusWatchSession } from "./FocusTimeDial";
import {
  FOCUS_LENGTH_PRESETS,
  FOCUS_MAX_TARGET,
  FOCUS_MIN_TARGET,
  FOCUS_OFFLINE_GUIDANCE,
  clampFocusTarget,
  focusDialGeometry,
  focusTimerSentence,
  formatFocusClock,
  formatFocusMinutes,
  isValidFocusTarget,
  runFocusMutation,
} from "./focusDisplay";

export { formatElapsedDuration, formatFocusTargetGuidance } from "@shared/focusClock";
export { FOCUS_OFFLINE_GUIDANCE, newestFinishedSession, runFocusMutation } from "./focusDisplay";
export { focusEstimateSignalLabel };

type FocusWorkspaceProps = {
  scope: WorkspaceScope;
  snapshot: any;
  today: string;
  initialTaskId?: string | null;
  isOnline?: boolean;
  onOpenTask: (id: string) => void;
  onOpenHabit: (id: string) => void;
  onOpenCalendar: () => void;
  onOpenPlan: () => void;
  onHabitCheckIn: (habitId: string, localDate: string, state: "completed" | "skipped") => void;
  onClearHabitCheckIn: (habitId: string, localDate: string) => void;
};

export function initialFocusTaskSelection(eligibleTasks: Array<{ id: string }>, initialTaskId?: string | null) {
  if (initialTaskId) return eligibleTasks.some(task => task.id === initialTaskId) ? initialTaskId : "none";
  return eligibleTasks[0]?.id ?? "none";
}

const isOpenTask = (task: any) => task.state !== "completed" && task.state !== "archived" && task.outcome !== "wont_do";

/** Screen Wake Lock while full screen is open, where supported; released on exit. */
function useWakeLock(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const nav = navigator as Navigator & { wakeLock?: { request: (type: "screen") => Promise<{ release: () => Promise<void> }> } };
    let lock: { release: () => Promise<void> } | null = null;
    let cancelled = false;
    nav.wakeLock?.request("screen").then(acquired => {
      if (cancelled) void acquired.release().catch(() => undefined);
      else lock = acquired;
    }).catch(() => undefined);
    return () => { cancelled = true; void lock?.release().catch(() => undefined); };
  }, [enabled]);
}

export function FocusWorkspace({
  scope,
  snapshot,
  today,
  initialTaskId,
  isOnline: isOnlineOverride,
  onOpenTask,
  onOpenHabit,
  onOpenCalendar,
  onOpenPlan,
  onHabitCheckIn,
  onClearHabitCheckIn,
}: FocusWorkspaceProps) {
  const focus = useFocusSession();
  const isOnline = isOnlineOverride ?? focus?.online ?? true;
  const phone = useIsPhone();
  const session = focus?.session ?? null;
  const [inlineFinish, setInlineFinish] = useState(false);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [fullScreen, setFullScreen] = useState(false);
  const { presentation, choosePresentation } = useFocusPresentation();
  const stageRef = useRef<HTMLDivElement | null>(null);
  const finishButton = useRef<HTMLButtonElement | null>(null);

  useEffect(() => { if (!session) setInlineFinish(false); }, [session?.id]);

  const handoff = focus?.handoff ?? null;
  const review: FocusHandoff | null = !session
    ? (reviewId && handoff?.id === reviewId ? handoff : focus?.recentHandoff ?? null)
    : null;
  const lastSession = !session && handoff && !review
    ? { id: handoff.id, taskTitle: handoff.taskTitle, activeSeconds: handoff.activeSeconds, nextStepAction: handoff.nextStepAction }
    : null;

  const openFinish = () => {
    if (!focus) return;
    if (phone) focus.openFinish();
    else { focus.clearFinishError(); setInlineFinish(true); }
  };
  const backFromFinish = () => {
    setInlineFinish(false);
    requestAnimationFrame(() => finishButton.current?.focus());
  };

  return (
    <section className={cn("pc-focus-screen", session && "has-session")} aria-label="Focus" data-focus-screen="">
      {!isOnline ? (
        <p className="pc-focus-banner" role="status">
          <CircleAlert size={16} aria-hidden="true" /> {FOCUS_OFFLINE_GUIDANCE}
        </p>
      ) : null}
      {focus?.error ? (
        <div className="pc-focus-banner is-error" role="alert">
          <CircleAlert size={16} aria-hidden="true" />
          <span>{focus.error}</span>
          <button type="button" className="pc-focus-link pc-focusable" onClick={focus.clearError}>Dismiss</button>
        </div>
      ) : null}

      <div className="pc-focus-layout">
        <div ref={stageRef} className={cn("pc-focus-stage", focus?.toneClass ?? "pc-tone-accent", session ? `is-${session.state}` : review ? "is-review" : "is-idle", inlineFinish && "is-finishing")}>
          {session && focus ? (
            <LiveStage
              session={session}
              snapshot={snapshot}
              timeZone={scope.timezone}
              initialTaskId={initialTaskId}
              presentation={presentation}
              onPresentation={choosePresentation}
              inlineFinish={inlineFinish && !phone}
              onFinish={openFinish}
              onBackFromFinish={backFromFinish}
              onFullScreen={() => setFullScreen(true)}
              onOpenTask={onOpenTask}
              finishButton={finishButton}
              phone={phone}
            />
          ) : review ? (
            <FocusFinishFlow surface="stage" handoff={review} onBack={() => undefined} onClose={() => setReviewId(null)} />
          ) : (
            <SetupStage scope={scope} snapshot={snapshot} today={today} initialTaskId={initialTaskId} isOnline={isOnline} />
          )}
        </div>

        <FocusFollowUpPanel
          snapshot={{ ...snapshot, focusSessions: focus?.sessions ?? snapshot.focusSessions ?? [] }}
          today={today}
          timeZone={scope.timezone}
          activeSession={session}
          isOnline={isOnline}
          lastSession={lastSession}
          onChooseNextStep={lastSession ? () => setReviewId(lastSession.id) : undefined}
          onReturnToTimer={() => {
            const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
            stageRef.current?.scrollIntoView({ behavior: reduce ? "instant" : "smooth", block: "center" });
          }}
          onOpenTask={onOpenTask}
          onOpenHabit={onOpenHabit}
          onOpenCalendar={onOpenCalendar}
          onOpenPlan={onOpenPlan}
          onResumeFocus={() => focus?.resume()}
          onCheckInHabit={onHabitCheckIn}
          onClearHabitCheckIn={onClearHabitCheckIn}
        />
      </div>

      {session && focus ? (
        <FullScreenFocus open={fullScreen} onOpenChange={setFullScreen} session={session} timeZone={scope.timezone} onFinish={() => { setFullScreen(false); openFinish(); }} />
      ) : null}
    </section>
  );
}

function StageMenu({
  presentation,
  onPresentation,
  onFullScreen,
  taskId,
  onOpenTask,
  variant,
}: {
  presentation: "dial" | "digital";
  onPresentation: (value: "dial" | "digital") => void;
  onFullScreen: () => void;
  taskId: string | null;
  onOpenTask: (id: string) => void;
  variant: "icon" | "thumb";
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {variant === "icon" ? (
          <button type="button" className="pc-focus-menu-trigger pc-focusable">
            <MoreHorizontal size={18} aria-hidden="true" />
            <span>More</span>
          </button>
        ) : (
          <button type="button" className="pc-focus-thumb pc-focusable">
            <span className="pc-focus-thumb-icon"><MoreHorizontal size={20} aria-hidden="true" /></span>
            <span>More</span>
          </button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="pc-focus-menu">
        <DropdownMenuLabel>Display</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={presentation} onValueChange={value => onPresentation(value as "dial" | "digital")}>
          <DropdownMenuRadioItem value="dial">Dial</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="digital">Digits</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onFullScreen}><Maximize2 aria-hidden="true" /> Full screen</DropdownMenuItem>
        {taskId ? <DropdownMenuItem onSelect={() => onOpenTask(taskId)}><ExternalLink aria-hidden="true" /> Open task</DropdownMenuItem> : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Digits presentation: the same words without the ring, plus a slim progress rule. */
function DigitsFace({ session, elapsed, title, online, timeZone, nowMs }: { session: FocusWatchSession; elapsed: number; title: string; online: boolean; timeZone?: string; nowMs: number }) {
  const geometry = focusDialGeometry(elapsed, session.targetMinutes);
  const state = focusPillState(session, elapsed, online);
  return (
    <div className={cn("pc-focus-digits-face", `is-${session.state}`, geometry.over && "is-over")}>
      <FocusStatePill state={state} session={session} elapsedSeconds={elapsed} timeZone={timeZone} />
      <FocusDigits text={formatFocusClock(elapsed)} prefix={online ? undefined : "≈"} className="pc-focus-digits-big" />
      <span className="pc-focus-sub pc-num">{focusSubLine(session, elapsed, online, nowMs, timeZone)}</span>
      <span className="pc-focus-rule" aria-hidden="true"><span style={{ transform: `scaleX(${geometry.over ? 1 : geometry.arc})` }} /></span>
      <span role="timer" className="pc-sr-only">{focusTimerSentence(elapsed, session.targetMinutes, title)}</span>
    </div>
  );
}

function LiveStage({
  session,
  snapshot,
  timeZone,
  initialTaskId,
  presentation,
  onPresentation,
  inlineFinish,
  onFinish,
  onBackFromFinish,
  onFullScreen,
  onOpenTask,
  finishButton,
  phone,
}: {
  session: FocusWatchSession;
  snapshot: any;
  timeZone?: string;
  initialTaskId?: string | null;
  presentation: "dial" | "digital";
  onPresentation: (value: "dial" | "digital") => void;
  inlineFinish: boolean;
  onFinish: () => void;
  onBackFromFinish: () => void;
  onFullScreen: () => void;
  onOpenTask: (id: string) => void;
  finishButton: MutableRefObject<HTMLButtonElement | null>;
  phone: boolean;
}) {
  const focus = useFocusSession()!;
  const elapsed = useFocusElapsedSeconds(session);
  const nowMs = useNow(15_000, session.state === "active");
  const task = focus.task;
  const taskRecord = task ? (snapshot.tasks ?? []).find((item: any) => item.id === task.id) : null;
  const category = taskRecord?.categoryId ? (snapshot.categories ?? []).find((item: any) => item.id === taskRecord.categoryId) ?? null : null;
  const over = focusDialGeometry(elapsed, session.targetMinutes).over;
  const recordedSeconds = task
    ? focus.sessions.filter(item => item.taskId === task.id && (item.state === "completed" || item.state === "abandoned")).reduce((sum, item) => sum + Math.max(0, Number(item.activeSeconds) || 0), 0)
    : 0;
  const controlsDisabled = !focus.online || focus.pending;
  const running = session.state === "active";

  return (
    <div className="pc-focus-live">
      <header className="pc-focus-stage-head">
        <div className="pc-focus-stage-title">
          <div className="pc-focus-stage-chips">
            {category ? <CategoryChip category={category} tone={task?.tone} /> : <Pill>{task ? "No category" : "Unlinked"}</Pill>}
            {task?.projectTitle ? <span className="pc-focus-hint">{task.projectTitle}</span> : null}
          </div>
          <h2 className="pc-focus-task-title">{focus.title}</h2>
        </div>
        <StageMenu presentation={presentation} onPresentation={onPresentation} onFullScreen={onFullScreen} taskId={task?.id ?? null} onOpenTask={onOpenTask} variant="icon" />
      </header>
      {initialTaskId && session.taskId !== initialTaskId ? (
        <p className="pc-focus-hint is-notice" role="status">
          Another session is already open. Finish it before focusing on the selected task; nothing has been switched automatically.
        </p>
      ) : null}

      <div className={cn("pc-focus-stage-body", inlineFinish && "is-finishing")}>
        <div className="pc-focus-instrument-wrap">
          {presentation === "digital" && !inlineFinish ? (
            <DigitsFace session={session} elapsed={elapsed} title={focus.title} online={focus.online} timeZone={timeZone} nowMs={nowMs} />
          ) : (
            <FocusInstrument
              size={inlineFinish ? "md" : "lg"}
              session={session}
              elapsedSeconds={elapsed}
              title={focus.title}
              online={focus.online}
              timeZone={timeZone}
              nowMs={nowMs}
              nextMeeting={focus.nextMeeting}
            />
          )}
        </div>

        <AnimatePresence mode="popLayout" initial={false}>
          {inlineFinish ? (
            <motion.div key="finish" className="pc-focus-inline-finish" initial={{ opacity: 0, y: 8, filter: "blur(2px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} exit={{ opacity: 0, transition: { duration: 0.16 } }} transition={{ duration: 0.24, ease: EASE_OUT }}>
              <FocusFinishFlow surface="stage" onBack={onBackFromFinish} onClose={onBackFromFinish} />
            </motion.div>
          ) : (
            <motion.div key="controls" className="pc-focus-controls" role="group" aria-label="Focus controls" initial={{ opacity: 0, filter: "blur(2px)" }} animate={{ opacity: 1, filter: "blur(0px)" }} exit={{ opacity: 0, filter: "blur(2px)", transition: { duration: 0.16 } }} transition={{ duration: 0.24, ease: EASE_OUT }}>
              <button ref={finishButton} type="button" className={cn("pc-focus-thumb pc-focusable", over && "is-invite")} onClick={onFinish} disabled={!focus.online}>
                <span className="pc-focus-thumb-icon"><Square size={16} fill="currentColor" aria-hidden="true" /></span>
                <span>Finish</span>
              </button>
              <motion.button
                layoutId="focus-primary"
                type="button"
                className="pc-focus-primary pc-focusable"
                onClick={running ? focus.pause : focus.resume}
                disabled={controlsDisabled}
                transition={{ duration: 0.24, ease: EASE_OUT }}
              >
                <span key={running ? "pause" : "play"} className="pc-focus-primary-icon pc-pop" aria-hidden="true">
                  {running ? <Pause size={22} fill="currentColor" /> : <Play size={22} fill="currentColor" />}
                </span>
                <span className="pc-focus-primary-label">{!focus.online ? "Reconnect to control" : running ? "Pause" : "Resume"}</span>
              </motion.button>
              {phone ? (
                <StageMenu presentation={presentation} onPresentation={onPresentation} onFullScreen={onFullScreen} taskId={task?.id ?? null} onOpenTask={onOpenTask} variant="thumb" />
              ) : (
                <button type="button" className="pc-focus-thumb pc-focusable" onClick={onFullScreen}>
                  <span className="pc-focus-thumb-icon"><Maximize2 size={18} aria-hidden="true" /></span>
                  <span>Full screen</span>
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <p className="pc-focus-stage-foot pc-num">
        {task?.estimateMinutes ? `${formatFocusMinutes(task.estimateMinutes)} estimate` : task ? "No estimate" : "Unlinked focus"}
        {task ? ` · ${formatFocusMinutes(recordedSeconds / 60)} recorded on this task` : ` · target ${formatFocusMinutes(session.targetMinutes)}`}
      </p>
    </div>
  );
}

function SetupStage({ scope, snapshot, today, initialTaskId, isOnline }: { scope: WorkspaceScope; snapshot: any; today: string; initialTaskId?: string | null; isOnline: boolean }) {
  const utils = trpc.useUtils();
  const tasks = useMemo(() => (snapshot.tasks ?? []).filter(isOpenTask), [snapshot.tasks]);
  const habits = useMemo(() => (snapshot.habits ?? []).filter((habit: any) => !habit.archivedAt), [snapshot.habits]);
  const habitsAvailable = snapshot.focusHabitAttributionAvailable === true;
  const [taskId, setTaskId] = useState(() => initialFocusTaskSelection(tasks, initialTaskId));
  const [length, setLength] = useState<"preset" | "estimate" | "custom">("preset");
  const [minutes, setMinutes] = useState(25);
  const [custom, setCustom] = useState(45);
  const [habitId, setHabitId] = useState("none");
  const [error, setError] = useState<string | null>(null);
  const labelId = useId();
  const lengthId = useId();
  const habitFieldId = useId();
  const customId = useId();

  useEffect(() => { if (taskId !== NO_TASK && !tasks.some((task: any) => task.id === taskId)) setTaskId(NO_TASK); }, [tasks, taskId]);
  useEffect(() => { if (initialTaskId) setTaskId(initialFocusTaskSelection(tasks, initialTaskId)); }, [initialTaskId]);
  useEffect(() => { if (habitId !== "none" && !habits.some((habit: any) => habit.id === habitId)) setHabitId("none"); }, [habits, habitId]);

  const selectedTask = tasks.find((task: any) => task.id === taskId) ?? null;
  const estimate = selectedTask?.estimateMinutes && isValidFocusTarget(selectedTask.estimateMinutes) ? selectedTask.estimateMinutes : null;
  useEffect(() => { if (length === "estimate" && !estimate) setLength("preset"); }, [estimate, length]);
  const target = length === "estimate" && estimate ? estimate : length === "custom" ? custom : minutes;
  const tones = useMemo(() => resolveCategoryTones(snapshot.categories ?? []), [snapshot.categories]);
  const toneClass = selectedTask?.categoryId && tones.get(selectedTask.categoryId) ? toneClassName(tones.get(selectedTask.categoryId)!) : "pc-tone-accent";

  const start = trpc.planner.focus.start.useMutation({
    onSuccess: () => {
      setError(null);
      void utils.planner.workspace.snapshot.invalidate();
      void utils.planner.dashboard.invalidate();
      toast.success("Focus session started.");
    },
    onError: mutationError => {
      setError(mutationError.message || "Focus session could not start.");
      void utils.planner.workspace.snapshot.invalidate();
    },
  });

  const startSession = () => runFocusMutation(isOnline, () => {
    if (start.isPending) return;
    if (!isValidFocusTarget(target)) { setError(`Choose a focus length from ${FOCUS_MIN_TARGET} to ${FOCUS_MAX_TARGET} minutes.`); return; }
    setError(null);
    start.mutate({
      ...scope,
      taskId: taskId === NO_TASK ? null : taskId,
      targetMinutes: target,
      ...(habitsAvailable ? { habitId: habitId === "none" ? null : habitId } : {}),
    });
  }, () => setError(FOCUS_OFFLINE_GUIDANCE));

  const stepCustom = (delta: number) => setCustom(value => clampFocusTarget((Number.isFinite(value) ? value : 25) + delta));

  return (
    <div className={cn("pc-focus-setup", toneClass)}>
      <div className="pc-focus-setup-dial">
        <FocusInstrument size="lg" session={null} elapsedSeconds={0} title="" online={isOnline} nowMs={0} idleMinutes={isValidFocusTarget(target) ? target : 25} />
      </div>
      <div className="pc-focus-setup-form">
        <h2 id={labelId} className="pc-focus-task-title is-question">What are you focusing on?</h2>
        <FocusTaskPicker tasks={tasks} categories={snapshot.categories ?? []} today={today} value={taskId} onChange={setTaskId} disabled={start.isPending} labelId={labelId} />
        <p className="pc-focus-hint">
          {initialTaskId && !tasks.some((task: any) => task.id === initialTaskId)
            ? "That task is no longer available for Focus. Choose another task or start unlinked."
            : "Task links make actual-versus-estimated focus visible later."}
        </p>

        <div className="pc-focus-field">
          <span id={lengthId} className="pc-focus-label">Length</span>
          <div className="pc-focus-chips" role="radiogroup" aria-labelledby={lengthId}>
            {FOCUS_LENGTH_PRESETS.map(value => (
              <button key={value} type="button" role="radio" aria-checked={length === "preset" && minutes === value} className="pc-focus-chip pc-focusable" onClick={() => { setLength("preset"); setMinutes(value); }} disabled={start.isPending}>
                {value}m
              </button>
            ))}
            {estimate ? (
              <button type="button" role="radio" aria-checked={length === "estimate"} className="pc-focus-chip pc-focusable" onClick={() => setLength("estimate")} disabled={start.isPending}>
                Use estimate {formatFocusMinutes(estimate)}
              </button>
            ) : null}
            <button type="button" role="radio" aria-checked={length === "custom"} className="pc-focus-chip pc-focusable" onClick={() => setLength("custom")} disabled={start.isPending}>
              Custom
            </button>
          </div>
          {length === "custom" ? (
            <div className="pc-focus-stepper pc-choice-reveal">
              <label htmlFor={customId}>Custom length, {FOCUS_MIN_TARGET} to {FOCUS_MAX_TARGET} minutes</label>
              <div className="pc-focus-stepper-row">
                <button type="button" className="pc-focus-step pc-focusable" aria-label="5 minutes less" onClick={() => stepCustom(-5)} disabled={custom <= FOCUS_MIN_TARGET}><Minus size={15} aria-hidden="true" /></button>
                <input id={customId} type="number" inputMode="numeric" min={FOCUS_MIN_TARGET} max={FOCUS_MAX_TARGET} step={5} value={Number.isFinite(custom) ? custom : ""} aria-invalid={!isValidFocusTarget(custom)} onChange={event => setCustom(Number.parseInt(event.target.value, 10))} />
                <span aria-hidden="true">min</span>
                <button type="button" className="pc-focus-step pc-focusable" aria-label="5 minutes more" onClick={() => stepCustom(5)} disabled={custom >= FOCUS_MAX_TARGET}><Plus size={15} aria-hidden="true" /></button>
              </div>
            </div>
          ) : null}
        </div>

        {habitsAvailable ? (
          <details className="pc-focus-disclosure">
            <summary className="pc-focusable"><Flag size={14} aria-hidden="true" /> Count time toward a habit</summary>
            <div className="pc-focus-field">
              <label htmlFor={habitFieldId}>Habit (optional)</label>
              <select id={habitFieldId} value={habitId} onChange={event => setHabitId(event.target.value)} disabled={start.isPending}>
                <option value="none">Do not attribute to a habit</option>
                {habits.map((habit: any) => <option key={habit.id} value={habit.id}>{habit.name}</option>)}
              </select>
              <p className="pc-focus-hint">Only saved active time counts toward the habit. Focus time does not check the habit in.</p>
            </div>
          </details>
        ) : null}

        {error ? <p className="pc-focus-alert" role="alert">{error}</p> : null}
        <motion.button layoutId="focus-primary" type="button" className="pc-focus-start pc-focusable" onClick={startSession} disabled={!isOnline || start.isPending} transition={{ duration: 0.24, ease: EASE_OUT }}>
          <Play size={18} fill="currentColor" aria-hidden="true" />
          {start.isPending ? "Starting…" : isOnline ? "Start focus" : "Reconnect to start"}
        </motion.button>
      </div>
    </div>
  );
}

function FullScreenFocus({ open, onOpenChange, session, timeZone, onFinish }: { open: boolean; onOpenChange: (open: boolean) => void; session: FocusWatchSession; timeZone?: string; onFinish: () => void }) {
  const focus = useFocusSession()!;
  const elapsed = useFocusElapsedSeconds(session);
  const nowMs = useNow(15_000, open && session.state === "active");
  useWakeLock(open);
  const running = session.state === "active";
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open ? (
          <DialogPrimitive.Portal forceMount>
            <DialogPrimitive.Content asChild forceMount aria-describedby={undefined}>
              <motion.div
                className={cn("pc-focus-full", focus.toneClass)}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, transition: { duration: 0.16 } }}
                transition={{ duration: 0.24, ease: EASE_OUT }}
              >
                <DialogPrimitive.Title className="pc-sr-only">Focus, full screen</DialogPrimitive.Title>
                <div className="pc-focus-full-head">
                  <span className="pc-focus-full-task"><Timer size={16} aria-hidden="true" /> {focus.title}</span>
                  <DialogPrimitive.Close asChild>
                    <button type="button" className="pc-focus-btn is-ghost pc-focusable">
                      <Minimize2 size={16} aria-hidden="true" /> Done
                    </button>
                  </DialogPrimitive.Close>
                </div>
                <FocusInstrument size="lg" session={session} elapsedSeconds={elapsed} title={focus.title} online={focus.online} timeZone={timeZone} nowMs={nowMs} nextMeeting={focus.nextMeeting} className="pc-dial-full" />
                <div className="pc-focus-controls" role="group" aria-label="Focus controls">
                  <button type="button" className="pc-focus-thumb pc-focusable" onClick={onFinish} disabled={!focus.online}>
                    <span className="pc-focus-thumb-icon"><Square size={16} fill="currentColor" aria-hidden="true" /></span>
                    <span>Finish</span>
                  </button>
                  <button type="button" className="pc-focus-primary pc-focusable" onClick={running ? focus.pause : focus.resume} disabled={!focus.online || focus.pending}>
                    <span key={running ? "pause" : "play"} className="pc-focus-primary-icon pc-pop" aria-hidden="true">{running ? <Pause size={22} fill="currentColor" /> : <Play size={22} fill="currentColor" />}</span>
                    <span className="pc-focus-primary-label">{!focus.online ? "Reconnect to control" : running ? "Pause" : "Resume"}</span>
                  </button>
                  <DialogPrimitive.Close asChild>
                    <button type="button" className="pc-focus-thumb pc-focusable">
                      <span className="pc-focus-thumb-icon"><X size={18} aria-hidden="true" /></span>
                      <span>Exit</span>
                    </button>
                  </DialogPrimitive.Close>
                </div>
              </motion.div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        ) : null}
      </AnimatePresence>
    </DialogPrimitive.Root>
  );
}
