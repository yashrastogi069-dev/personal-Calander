import {
  Archive,
  CalendarRange,
  Check,
  ChevronRight,
  CircleUserRound,
  Clock3,
  Command,
  Crosshair,
  FolderKanban,
  Goal,
  Home,
  Layers3,
  LayoutList,
  Menu,
  Plus,
  Search,
  Settings,
  SlidersHorizontal,
  Sparkles,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, type Dispatch, type ReactNode } from "react";
import {
  phase4PrototypeFixture,
  type PrototypeAction,
  type PrototypeState,
} from "@shared/phase4Prototype";
import PrototypeRoadmap from "./PrototypeRoadmap";
import PrototypeSettings from "./PrototypeSettings";
import PrototypeTasks from "./PrototypeTasks";
import PrototypeToday from "./PrototypeToday";

export type PrototypeVariant = "a" | "b" | "c";
export type PrototypeDensity = "comfortable" | "compact";
export type PrototypeViewport = "phone" | "desktop";
export type PrototypeLane = "todo" | "doing" | "done";

type PrototypeShellProps = {
  state: PrototypeState;
  dispatch: Dispatch<PrototypeAction>;
  variant: PrototypeVariant;
  density: PrototypeDensity;
  viewport: PrototypeViewport;
  recoveryChoice: string | null;
  selectedLane: PrototypeLane;
  onVariantChange: (variant: PrototypeVariant) => void;
  onDensityChange: (density: PrototypeDensity) => void;
  onViewportChange: (viewport: PrototypeViewport) => void;
  onRecoveryChoice: (choice: string | null) => void;
  onSelectedLaneChange: (lane: PrototypeLane) => void;
};

type OverlayProps = {
  title: string;
  description: string;
  labelledBy: string;
  closeTestId: string;
  onClose: () => void;
  children: ReactNode;
  side?: boolean;
};

const desktopDestinations = [
  { label: "Home", icon: Home, view: "today" as const },
  { label: "Tasks", icon: LayoutList, view: "tasks" as const },
  { label: "Plan", icon: CalendarRange, view: "roadmap" as const },
  { label: "Projects & Goals", icon: Goal, view: "roadmap" as const },
  { label: "Habits", icon: Sparkles, view: "today" as const },
  { label: "Review", icon: Archive, view: "today" as const },
];

function PrototypeOverlay({ title, description, labelledBy, closeTestId, onClose, children, side }: OverlayProps) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const surface = surfaceRef.current;
    const focusable = surface?.querySelectorAll<HTMLElement>(
      'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [href], [tabindex]:not([tabindex="-1"])',
    );
    focusable?.[0]?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab" || !focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      returnFocusRef.current?.focus();
    };
  }, [onClose]);

  return (
    <div className="p4-overlay" role="presentation" onMouseDown={event => event.target === event.currentTarget && onClose()}>
      <div
        ref={surfaceRef}
        className={side ? "p4-dialog p4-dialog-side" : "p4-dialog"}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={`${labelledBy}-description`}
      >
        <header className="p4-dialog-header">
          <div>
            <p className="p4-kicker">No-save interaction</p>
            <h2 id={labelledBy}>{title}</h2>
            <p id={`${labelledBy}-description`}>{description}</p>
          </div>
          <button className="p4-icon-button" type="button" data-testid={closeTestId} onClick={onClose} aria-label={`Close ${title}`}>
            <X aria-hidden="true" />
          </button>
        </header>
        <div className="p4-dialog-body">{children}</div>
      </div>
    </div>
  );
}

export default function PrototypeShell({
  state,
  dispatch,
  variant,
  density,
  viewport,
  recoveryChoice,
  selectedLane,
  onVariantChange,
  onDensityChange,
  onViewportChange,
  onRecoveryChoice,
  onSelectedLaneChange,
}: PrototypeShellProps) {
  const closeSheet = useCallback(() => dispatch({ type: "close-sheet" }), [dispatch]);
  const closeRecovery = useCallback(() => dispatch({ type: "close-recovery" }), [dispatch]);
  const showToday = () => dispatch({ type: "set-view", view: "today" });
  const showTasks = () => dispatch({ type: "set-view", view: "tasks" });
  const showRoadmap = () => dispatch({ type: "set-view", view: "roadmap" });
  const showSettings = () => dispatch({ type: "set-view", view: "settings" });
  const title = { today: "Today", tasks: "Tasks", roadmap: "Roadmap", settings: "Settings" }[state.view];

  return (
    <div
      className="p4-prototype"
      data-testid="prototype-shell"
      data-prototype-variant={variant}
      data-prototype-density={density}
      data-prototype-viewport={viewport}
    >
      <aside className="p4-rail" aria-label="Primary navigation">
        <div className="p4-brand">
          <span aria-hidden="true"><span /></span>
          <div><strong>Daymark</strong><small>personal planner</small></div>
        </div>
        <nav className="p4-primary-nav">
          {desktopDestinations.map(({ label, icon: Icon, view }) => (
            <button
              key={label}
              type="button"
              className={state.view === view && (label === "Home" || label === "Tasks" || label === "Plan") ? "is-active" : ""}
              onClick={() => dispatch({ type: "set-view", view })}
            >
              <Icon aria-hidden="true" />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="p4-global-actions" aria-label="Global actions">
          <p>Global</p>
          <button type="button" data-testid="open-capture" onClick={() => dispatch({ type: "open-sheet", sheet: "capture" })}>
            <Plus aria-hidden="true" /><span>Capture</span><kbd>C</kbd>
          </button>
          <button type="button" aria-disabled="true" title="Represented for visual review">
            <Search aria-hidden="true" /><span>Search</span><kbd>/</kbd>
          </button>
          <button type="button" aria-disabled="true" title="Represented for visual review">
            <Crosshair aria-hidden="true" /><span>Focus</span><kbd>F</kbd>
          </button>
        </div>
        <button className={state.view === "settings" ? "p4-account is-active" : "p4-account"} type="button" onClick={showSettings}>
          <CircleUserRound aria-hidden="true" /><span><strong>Maya</strong><small>Settings</small></span><ChevronRight aria-hidden="true" />
        </button>
      </aside>

      <div className="p4-workspace">
        <header className="p4-topbar">
          <div className="p4-mobile-brand" aria-hidden="true"><span>Daymark</span></div>
          <div className="p4-view-title">
            <p>Monday · 14 September</p>
            <h1>{title}</h1>
          </div>
          <div className="p4-control-deck" aria-label="Prototype controls">
            <div className="p4-segment p4-variant-switch" aria-label="Visual variant">
              <button type="button" data-testid="variant-a" aria-pressed={variant === "a"} onClick={() => onVariantChange("a")}>A</button>
              <button type="button" data-testid="variant-b" aria-pressed={variant === "b"} onClick={() => onVariantChange("b")}>B</button>
              <button type="button" data-testid="variant-c" aria-pressed={variant === "c"} onClick={() => onVariantChange("c")}>C</button>
            </div>
            <div className="p4-segment p4-density-switch" aria-label="Density">
              <button type="button" data-testid="density-comfortable" aria-pressed={density === "comfortable"} onClick={() => onDensityChange("comfortable")}><Layers3 aria-hidden="true" /><span>Comfortable</span></button>
              <button type="button" data-testid="density-compact" aria-pressed={density === "compact"} onClick={() => onDensityChange("compact")}><SlidersHorizontal aria-hidden="true" /><span>Compact</span></button>
            </div>
            <div className="p4-segment p4-viewport-switch" aria-label="Preview viewport">
              <button type="button" aria-pressed={viewport === "desktop"} onClick={() => onViewportChange("desktop")}>Desktop</button>
              <button type="button" aria-pressed={viewport === "phone"} onClick={() => onViewportChange("phone")}>Phone</button>
            </div>
            <button className="p4-capture-top" type="button" onClick={() => dispatch({ type: "open-sheet", sheet: "capture" })}>
              <Plus aria-hidden="true" /> Capture
            </button>
          </div>
        </header>

        <div className="p4-notice" data-testid="prototype-notice" role="note">
          <Command aria-hidden="true" />
          <span>Prototype data — nothing here is saved</span>
          <span>Shared fixture · visual review</span>
        </div>

        <main className="p4-main" id="phase4-main">
          {state.view === "today" && (
            <PrototypeToday
              state={state}
              dispatch={dispatch}
              recoveryChoice={recoveryChoice}
            />
          )}
          {state.view === "tasks" && (
            <PrototypeTasks
              state={state}
              dispatch={dispatch}
              selectedLane={selectedLane}
              onSelectedLaneChange={onSelectedLaneChange}
            />
          )}
          {state.view === "roadmap" && <PrototypeRoadmap state={state} dispatch={dispatch} />}
          {state.view === "settings" && <PrototypeSettings density={density} onDensityChange={onDensityChange} />}
        </main>
      </div>

      <nav className="p4-bottom-nav" aria-label="Phone navigation">
        <button type="button" data-testid="view-today" className={state.view === "today" ? "is-active" : ""} onClick={showToday}><Home aria-hidden="true" /><span>Home</span></button>
        <button type="button" data-testid="view-tasks" className={state.view === "tasks" ? "is-active" : ""} onClick={showTasks}><LayoutList aria-hidden="true" /><span>Tasks</span></button>
        <button type="button" data-testid="view-roadmap" className={state.view === "roadmap" ? "is-active" : ""} onClick={showRoadmap}><CalendarRange aria-hidden="true" /><span>Plan</span></button>
        <button type="button" className={state.view === "roadmap" ? "is-active" : ""} onClick={showRoadmap}><FolderKanban aria-hidden="true" /><span>Projects</span></button>
        <button type="button" onClick={() => dispatch({ type: "open-sheet", sheet: "settings" })}><Menu aria-hidden="true" /><span>More</span></button>
      </nav>

      {state.sheet === "capture" && (
        <PrototypeOverlay title="Capture" description="Add a thought without sorting every field." labelledBy="p4-capture-title" closeTestId="close-capture" onClose={closeSheet}>
          <form className="p4-capture-form" onSubmit={event => event.preventDefault()}>
            <label htmlFor="p4-capture-input">What needs your attention?</label>
            <textarea id="p4-capture-input" rows={4} defaultValue="Call the moving company about the late estimate" />
            <div className="p4-chip-row" aria-label="Interpretation preview"><span>Inbox</span><span>Date not set</span><span>15 min?</span></div>
            <p className="p4-inline-note">Preview only. The draft stays in this dialog and is never submitted.</p>
            <button className="p4-primary-button" type="button" disabled>Save task · unavailable in prototype</button>
          </form>
        </PrototypeOverlay>
      )}

      {state.sheet === "task" && (
        <PrototypeOverlay title="Task detail" description="All advanced fields stay available away from the scan-friendly row." labelledBy="p4-task-detail-title" closeTestId="close-task-detail" onClose={closeSheet} side>
          <div className="p4-task-detail">
            <div className="p4-detail-title"><span>Document reading</span><h3>{phase4PrototypeFixture.tasks[1].title}</h3></div>
            <dl>
              <div><dt>Lifecycle</dt><dd>Open · To do</dd></div>
              <div><dt>Priority / horizon</dt><dd>Medium · This week</dd></div>
              <div><dt>Due by</dt><dd>Not set</dd></div>
              <div><dt>Plan for</dt><dd>14 Sep 2026</dd></div>
              <div><dt>Reserved time</dt><dd>Not reserved</dd></div>
              <div><dt>Estimate</dt><dd>Unknown — not counted as zero</dd></div>
              <div><dt>Schedule mode / order</dt><dd>Flexible · 02</dd></div>
              <div><dt>Recurrence / occurrence</dt><dd>None · single task</dd></div>
              <div><dt>Parent / subtasks</dt><dd>No parent · 2 subtasks</dd></div>
              <div><dt>Project / goal / category</dt><dd>Home move · Settle into the new home · Admin</dd></div>
              <div><dt>Outcome / dependencies</dt><dd>Questions marked · waiting on landlord</dd></div>
              <div><dt>Template / version</dt><dd>Document review · v7</dd></div>
            </dl>
            <div className="p4-detail-warning"><Archive aria-hidden="true" /><span>Archive keeps history and linked evidence. Conflict review preserves both versions.</span></div>
            <button className="p4-secondary-button" type="button" onClick={closeSheet}>Done reviewing</button>
          </div>
        </PrototypeOverlay>
      )}

      {state.sheet === "settings" && (
        <PrototypeOverlay title="More" description="Every destination remains reachable on a phone." labelledBy="p4-more-title" closeTestId="close-more" onClose={closeSheet}>
          <nav className="p4-more-directory" aria-label="Additional destinations">
            <button type="button" onClick={showToday}><Sparkles aria-hidden="true" /><span>Habits</span><ChevronRight aria-hidden="true" /></button>
            <button type="button" onClick={showToday}><Archive aria-hidden="true" /><span>Review</span><ChevronRight aria-hidden="true" /></button>
            <button type="button" data-testid="view-settings" onClick={() => { showSettings(); closeSheet(); }}><Settings aria-hidden="true" /><span>Settings</span><ChevronRight aria-hidden="true" /></button>
          </nav>
        </PrototypeOverlay>
      )}

      {state.recoveryCommitmentId !== null && (
        <PrototypeOverlay title="Recovery" description="Resolve this commitment intentionally. Every choice below is a no-save preview." labelledBy="p4-recovery-title" closeTestId="close-recovery" onClose={closeRecovery}>
          <div className="p4-recovery">
            <div className="p4-recovery-context"><Clock3 aria-hidden="true" /><span><strong>The dentist ran 45 minutes long.</strong>{phase4PrototypeFixture.interruptedAfternoon.message}</span></div>
            <p>What should happen to <strong>{phase4PrototypeFixture.commitments[0].title}</strong>?</p>
            <div className="p4-recovery-actions">
              <button type="button" data-testid="recovery-done" aria-pressed={recoveryChoice === "Done"} onClick={() => onRecoveryChoice("Done")}><Check aria-hidden="true" />Done</button>
              <button type="button" data-testid="recovery-reschedule" aria-pressed={recoveryChoice === "Reschedule"} onClick={() => onRecoveryChoice("Reschedule")}>Reschedule</button>
              <button type="button" data-testid="recovery-reduce" aria-pressed={recoveryChoice === "Reduce"} onClick={() => onRecoveryChoice("Reduce")}>Reduce</button>
              <button type="button" data-testid="recovery-pause" aria-pressed={recoveryChoice === "Pause"} onClick={() => onRecoveryChoice("Pause")}>Pause</button>
              <button type="button" data-testid="recovery-abandon" aria-pressed={recoveryChoice === "Abandon"} onClick={() => onRecoveryChoice("Abandon")}>Abandon</button>
            </div>
            <div className="p4-preview-result" aria-live="polite">
              {recoveryChoice ? <><strong>{recoveryChoice} preview</strong><span>No record changed. Closing preserves this flow for later.</span></> : <span>Choose an outcome to preview its placement.</span>}
            </div>
            <button className="p4-primary-button" type="button" onClick={closeRecovery}>Keep preview and close</button>
          </div>
        </PrototypeOverlay>
      )}
    </div>
  );
}
