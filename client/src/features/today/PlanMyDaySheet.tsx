// "Plan my day" (Q13, Q17): a calm 3-move overlay. Move 1 leftovers keep / move / let go; move 2 pick from a
// tray (Overdue, Due soon, This week) against a live capacity bar where meetings count; move 3 places work
// on free slots with a click (task.reserve). An optional 5-level energy tap records dailyCheckIn energy.
// A bottom sheet on phones, a dialog on larger screens (shared Sheet).
import { ArrowLeft, ArrowRight, Battery, CalendarClock, Check, Inbox, ListPlus } from "lucide-react";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Sheet } from "@/components/premium/Sheet";
import { cn } from "@/lib/utils";
import type { RecoveryEntry } from "@/features/recovery/recoveryModel";
import {
  capacityTime, freeSlots, minuteLabel, todayCapacity, TRAY_LABELS, weekdayLabel,
  type TodayCapacity, type TodayTaskFact, type TrayGroup,
} from "./todayModel";

export type LeftoverChoice = "keep" | "move" | "let_go";
export type Placement = { taskId: string; startsAt: Date; endsAt: Date; label: string };
export type PlaceableItem = { taskId: string; title: string; estimateMinutes: number | null };

export type PlanMyDaySheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  localDate: string;
  timezone: string;
  now: Date;
  leftovers: readonly RecoveryEntry[];
  tray: ReadonlyArray<{ group: TrayGroup; tasks: readonly TodayTaskFact[] }>;
  /** Minutes already planned today (estimates of open items). */
  basePlannedMinutes: number;
  capacityInput: Omit<Parameters<typeof todayCapacity>[0], "plannedMinutes">;
  placeable: readonly PlaceableItem[];
  busy: ReadonlyArray<{ startsAt: Date | string; endsAt: Date | string }>;
  energy: number | null;
  busyWriting: boolean;
  onRecordEnergy: (level: number) => void;
  onLeftovers: (choices: Record<string, LeftoverChoice>) => Promise<boolean>;
  onPicks: (taskIds: string[]) => Promise<boolean>;
  onPlace: (placements: Placement[]) => Promise<boolean>;
  onDone: () => void;
};

const ENERGY = [
  { level: 1, label: "Drained" },
  { level: 2, label: "Low" },
  { level: 3, label: "Okay" },
  { level: 4, label: "Good" },
  { level: 5, label: "Sharp" },
] as const;

export function CapacityBar({ capacity, className }: { capacity: TodayCapacity; className?: string }) {
  const width = Math.min(1, capacity.ratio) * 100;
  return (
    <div className={cn("td-cap", `is-${capacity.state}`, className)} data-capacity-state={capacity.state}>
      <div className="td-cap-row">
        <span className="td-cap-label pc-num" data-capacity-label="">{capacity.label}</span>
        <span className="td-cap-hint pc-num">{capacity.meetingMinutes ? `${capacityTime(capacity.meetingMinutes)} in meetings` : "No meetings"}</span>
      </div>
      <div className="td-cap-track" role="meter" aria-label="Planned time against free time" aria-valuemin={0} aria-valuemax={Math.max(1, capacity.freeMinutes)} aria-valuenow={Math.min(capacity.plannedMinutes, Math.max(1, capacity.freeMinutes))} aria-valuetext={capacity.label}>
        <i style={{ ["--td-fill" as string]: width / 100 } as CSSProperties} />
      </div>
      {capacity.state === "over" ? <p className="td-cap-warn">That is {capacityTime(capacity.plannedMinutes - capacity.freeMinutes)} more than today's free time.</p> : null}
    </div>
  );
}

export function PlanMyDaySheet(props: PlanMyDaySheetProps) {
  const { open, onOpenChange, localDate, timezone, now, leftovers, tray, basePlannedMinutes, capacityInput, placeable, busy, energy, busyWriting } = props;
  const [move, setMove] = useState<1 | 2 | 3>(1);
  const [choices, setChoices] = useState<Record<string, LeftoverChoice>>({});
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [placements, setPlacements] = useState<Record<string, Placement>>({});
  useEffect(() => {
    if (!open) return;
    setMove(1); setChoices({}); setPicked(new Set()); setPlacements({});
  }, [open]);

  const trayTasks = useMemo(() => new Map(tray.flatMap(group => group.tasks.map(task => [task.id, task] as const))), [tray]);
  const leftoverMinutes = leftovers.reduce((total, entry) => {
    const choice = choices[entry.key];
    const task = trayTasks.get(entry.taskId);
    return total + (choice === "keep" ? Math.max(0, task?.estimateMinutes ?? 0) : 0);
  }, 0);
  const pickedMinutes = Array.from(picked).reduce((total, id) => total + Math.max(0, trayTasks.get(id)?.estimateMinutes ?? 0), 0);
  const capacity = todayCapacity({ ...capacityInput, plannedMinutes: basePlannedMinutes + pickedMinutes + leftoverMinutes });
  const decidedLeftovers = leftovers.filter(entry => choices[entry.key]).length;

  const placeList = useMemo(() => {
    const seen = new Set<string>();
    const list: PlaceableItem[] = [];
    for (const item of [...placeable, ...Array.from(picked).map(id => trayTasks.get(id)).filter((task): task is TodayTaskFact => Boolean(task)).map(task => ({ taskId: task.id, title: task.title, estimateMinutes: task.estimateMinutes ?? null }))]) {
      if (seen.has(item.taskId)) continue;
      seen.add(item.taskId);
      list.push(item);
    }
    return list;
  }, [picked, placeable, trayTasks]);

  const slotsFor = (item: PlaceableItem) => {
    const taken = Object.values(placements).filter(placement => placement.taskId !== item.taskId).map(placement => ({ startsAt: placement.startsAt, endsAt: placement.endsAt }));
    return freeSlots({ localDate, timezone, workdayStartsAt: capacityInput.workdayStartsAt, workdayEndsAt: capacityInput.workdayEndsAt, now,
      durationMinutes: item.estimateMinutes ?? 30, busy: [...busy, ...taken], limit: 3 });
  };

  const next = async () => {
    if (move === 1) {
      if (Object.keys(choices).length && !(await props.onLeftovers(choices))) return;
      setMove(2);
    } else if (move === 2) {
      if (picked.size && !(await props.onPicks(Array.from(picked)))) return;
      setMove(3);
    } else {
      const list = Object.values(placements);
      if (list.length && !(await props.onPlace(list))) return;
      props.onDone();
    }
  };

  const title = move === 1 ? "Yesterday's leftovers" : move === 2 ? "Pick today's tasks" : "Place it on the timeline";
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Plan my day" description={`Move ${move} of 3 · ${title}`} contentClassName="td-sheet td-plan" closeLabel="Close">
      <ol className="td-steps" aria-label="Plan my day progress">
        {[1, 2, 3].map(step => <li key={step} className={cn(step === move && "is-current", step < move && "is-done")} aria-current={step === move ? "step" : undefined}><span className="pc-sr-only">Move {step}</span></li>)}
      </ol>
      <div className="td-sheet-scroll" data-plan-move={move}>
        {move === 1 ? (
          <>
            <div className="td-energy" role="group" aria-label="Energy today (optional)">
              <p className="td-energy-label"><Battery size={15} strokeWidth={2} aria-hidden="true" />Energy today <small>optional</small></p>
              <div className="td-energy-row">
                {ENERGY.map(option => (
                  <button key={option.level} type="button" className={cn("td-energy-btn pc-focusable", energy === option.level && "is-on")} aria-pressed={energy === option.level} onClick={() => props.onRecordEnergy(option.level)}>
                    <span className="td-energy-bars" aria-hidden="true">{[1, 2, 3, 4, 5].map(bar => <i key={bar} className={cn(bar <= option.level && "is-lit")} />)}</span>
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <h3 className="td-sheet-h">Leftovers</h3>
            {leftovers.length ? (
              <ul className="td-decide-list">
                {leftovers.map(entry => (
                  <li key={entry.key} className="td-decide" data-leftover={entry.key}>
                    <div className="td-decide-text"><strong>{entry.originalScope}</strong><small>From {weekdayLabel(entry.sourceLocalDate)}</small></div>
                    <div className="td-seg" role="group" aria-label={`Decide ${entry.originalScope}`}>
                      {(["keep", "move", "let_go"] as const).map(choice => (
                        <button key={choice} type="button" className={cn("td-seg-btn pc-focusable", choices[entry.key] === choice && "is-on")} aria-pressed={choices[entry.key] === choice}
                          onClick={() => setChoices(current => ({ ...current, [entry.key]: choice }))}>
                          {choice === "keep" ? "Keep today" : choice === "move" ? "Tomorrow" : "Let go"}
                        </button>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            ) : <p className="td-sheet-empty"><Check size={16} strokeWidth={2} aria-hidden="true" />Nothing left over from earlier days.</p>}
          </>
        ) : null}
        {move === 2 ? (
          <>
            <CapacityBar capacity={capacity} />
            {tray.every(group => !group.tasks.length) ? <p className="td-sheet-empty"><Inbox size={16} strokeWidth={2} aria-hidden="true" />No overdue, due-soon or this-week tasks waiting.</p> : null}
            {tray.map(group => group.tasks.length ? (
              <section key={group.group} className="td-tray" data-tray={group.group}>
                <h3 className="td-sheet-h">{TRAY_LABELS[group.group]} <span className="pc-num">{group.tasks.length}</span></h3>
                <ul>
                  {group.tasks.slice(0, 8).map(task => {
                    const on = picked.has(task.id);
                    return (
                      <li key={task.id}>
                        <button type="button" role="checkbox" aria-checked={on} className={cn("td-pick pc-focusable", on && "is-on")} data-pick-task={task.id}
                          onClick={() => setPicked(current => { const nextSet = new Set(current); if (nextSet.has(task.id)) nextSet.delete(task.id); else nextSet.add(task.id); return nextSet; })}>
                          <span className="td-pick-box" aria-hidden="true"><Check size={12} strokeWidth={3.2} /></span>
                          <span className="td-pick-title">{task.title}</span>
                          <span className="td-pick-meta pc-num">{task.dueLocalDate ? `Due ${weekdayLabel(task.dueLocalDate)}` : task.scheduledLocalDate ? `Plan ${weekdayLabel(task.scheduledLocalDate)}` : ""}{task.estimateMinutes ? ` · ${capacityTime(task.estimateMinutes)}` : ""}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ) : null)}
          </>
        ) : null}
        {move === 3 ? (
          <>
            <p className="td-sheet-lede"><CalendarClock size={16} strokeWidth={2} aria-hidden="true" />Optional. Tap a free slot to protect time for a task, or skip this step.</p>
            {placeList.length ? (
              <ul className="td-place-list">
                {placeList.map(item => {
                  const slots = slotsFor(item);
                  const chosen = placements[item.taskId];
                  return (
                    <li key={item.taskId} className="td-place" data-place-task={item.taskId}>
                      <div className="td-decide-text"><strong>{item.title}</strong><small className="pc-num">{item.estimateMinutes ? capacityTime(item.estimateMinutes) : "No estimate · 30m slot"}</small></div>
                      <div className="td-slots" role="group" aria-label={`Free slots for ${item.title}`}>
                        {slots.length ? slots.map(slot => {
                          const label = `${minuteLabel(slot.startMinute)}–${minuteLabel(slot.endMinute)}`;
                          const on = chosen && chosen.startsAt.getTime() === slot.startsAt.getTime();
                          return (
                            <button key={slot.startMinute} type="button" className={cn("td-slot pc-focusable", on && "is-on")} aria-pressed={Boolean(on)}
                              onClick={() => setPlacements(current => {
                                const nextPlacements = { ...current };
                                if (on) delete nextPlacements[item.taskId];
                                else nextPlacements[item.taskId] = { taskId: item.taskId, startsAt: slot.startsAt, endsAt: slot.endsAt, label };
                                return nextPlacements;
                              })}>
                              {label}
                            </button>
                          );
                        }) : <span className="td-slot-none">No free slot left today</span>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : <p className="td-sheet-empty"><Check size={16} strokeWidth={2} aria-hidden="true" />Everything on today's list already has a time or needs none.</p>}
          </>
        ) : null}
      </div>
      <footer className="td-sheet-foot">
        {move > 1 ? <button type="button" className="tk-btn is-quiet" onClick={() => setMove(current => (current - 1) as 1 | 2)} disabled={busyWriting}><ArrowLeft size={16} strokeWidth={2} aria-hidden="true" />Back</button> : <span />}
        <span className="td-foot-note pc-num">
          {move === 1 && leftovers.length ? `${decidedLeftovers} of ${leftovers.length} decided` : move === 2 ? `${picked.size} picked` : move === 3 ? `${Object.keys(placements).length} placed` : ""}
        </span>
        <button type="button" className="tk-btn is-accent" onClick={() => void next()} disabled={busyWriting} data-plan-next="">
          {move === 3 ? <><Check size={16} strokeWidth={2.4} aria-hidden="true" />{Object.keys(placements).length ? "Finish" : "Skip and finish"}</> : move === 2 ? <><ListPlus size={16} strokeWidth={2} aria-hidden="true" />{picked.size ? `Add ${picked.size}` : "Continue"}</> : <>Continue<ArrowRight size={16} strokeWidth={2} aria-hidden="true" /></>}
        </button>
      </footer>
    </Sheet>
  );
}
