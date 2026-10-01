import { trpc } from "@/lib/trpc";
import type { WorkspaceScope } from "@/lib/workspace";
import { habitReturnDecision } from "@shared/habitRecovery";
import {
  habitStartLocalDate,
  habitWeeklyTarget,
  isHabitScheduledOnLocalDate,
  type CalendarHabit,
} from "@shared/habitSchedule";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import "./habit-workspace.css";

type HabitState = "completed" | "skipped" | "missed";
type Habit = CalendarHabit & {
  id: string;
  name: string;
  description?: string | null;
  color?: string | null;
  goalId?: string | null;
  categoryId?: string | null;
  reminderTime?: string | null;
  archivedAt?: Date | string | null;
  version: number;
};
type CheckIn = {
  id: string;
  version: number;
  habitId: string;
  localDate: string;
  state: HabitState;
  note?: string | null;
};
type Named = { id: string; name?: string | null; title?: string | null };
type ExpectedCheckIn = { id: string; version: number };
const expectedOf = (
  record: CheckIn | null | undefined
): ExpectedCheckIn | null =>
  record ? { id: record.id, version: record.version } : null;
export type HabitUpdatePatch = Partial<
  Pick<
    Habit,
    | "name"
    | "description"
    | "goalId"
    | "categoryId"
    | "frequency"
    | "reminderTime"
  >
> & { color?: string; schedule?: Record<string, unknown> };
export type HabitDisciplineWorkspaceProps = {
  scope: WorkspaceScope;
  habits: Habit[];
  checkIns: CheckIn[];
  today: string;
  goals?: Named[];
  categories?: Named[];
  streaks?: Array<{ habitId: string; streak: number }>;
  selectedHabitId?: string | null;
  onSelectedHabitChange?: (id: string | null) => void;
  onCheckIn: (
    habitId: string,
    localDate: string,
    state: HabitState,
    note?: string | null,
    expectedCheckIn?: ExpectedCheckIn | null
  ) => void | Promise<unknown>;
  onClearCheckIn: (
    habitId: string,
    localDate: string,
    expectedCheckIn?: ExpectedCheckIn
  ) => void | Promise<unknown>;
  onCompose?: () => void;
  onOpenTracking?: () => void;
  onOpenGoal?: (goalId: string) => void;
  onUpdateHabit?: (input: {
    id: string;
    expectedVersion: number;
    patch: HabitUpdatePatch;
  }) => Promise<unknown>;
  onArchiveHabit?: (id: string, expectedVersion: number) => Promise<unknown>;
  onRestoreHabit?: (id: string, expectedVersion: number) => Promise<unknown>;
  isOnline?: boolean;
  pending: boolean;
  error?: string | null;
};
type View = "practice" | "history" | "settings";
type Draft = {
  name: string;
  description: string;
  goalId: string;
  categoryId: string;
  color: string;
  frequency: CalendarHabit["frequency"];
  weekdays: number[];
  timesPerWeek: string;
  intervalDays: string;
  startLocalDate: string;
  reminderTime: string;
};
const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const localDay = (day: string) => new Date(day + "T12:00:00.000Z");
const dateLabel = (day: string) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(localDay(day));
const monthLabel = (day: string) =>
  new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(localDay(day));
const monthStart = (day: string) => day.slice(0, 7) + "-01";
function shiftDate(day: string, amount: number) {
  const value = localDay(day);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}
function shiftMonth(day: string, amount: number) {
  const value = localDay(monthStart(day));
  value.setUTCMonth(value.getUTCMonth() + amount, 1);
  return value.toISOString().slice(0, 10);
}
function monthDays(day: string) {
  const start = monthStart(day);
  const count = Number(shiftDate(shiftMonth(start, 1), -1).slice(-2));
  return Array.from({ length: count }, (_, index) => shiftDate(start, index));
}
function scheduleOf(habit: Habit): Record<string, unknown> {
  return habit.schedule &&
    typeof habit.schedule === "object" &&
    !Array.isArray(habit.schedule)
    ? (habit.schedule as Record<string, unknown>)
    : {};
}
function validDate(day: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(day) &&
    !Number.isNaN(localDay(day).getTime()) &&
    localDay(day).toISOString().slice(0, 10) === day
  );
}
function draftOf(habit: Habit): Draft {
  const schedule = scheduleOf(habit);
  return {
    name: habit.name,
    description: habit.description ?? "",
    goalId: habit.goalId ?? "",
    categoryId: habit.categoryId ?? "",
    color:
      habit.color && /^#[0-9a-fA-F]{6}$/.test(habit.color)
        ? habit.color
        : "#286b5e",
    frequency: habit.frequency,
    weekdays: Array.isArray(schedule.weekdays)
      ? schedule.weekdays.filter(
          (value): value is number =>
            typeof value === "number" && value >= 0 && value <= 6
        )
      : [],
    timesPerWeek: String(habitWeeklyTarget(habit) ?? 3),
    intervalDays: String(schedule.intervalDays ?? "2"),
    startLocalDate:
      typeof schedule.startLocalDate === "string"
        ? schedule.startLocalDate
        : "",
    reminderTime: habit.reminderTime ?? "",
  };
}
function availabilityOf(
  habit: Habit,
  day: string,
  today: string
): "fixed" | "flexible" | "none" {
  const schedule = scheduleOf(habit);
  const start = habitStartLocalDate(habit);
  if (start && day < start) return "none";
  const pauseUntil =
    typeof schedule.pauseUntilLocalDate === "string"
      ? schedule.pauseUntilLocalDate
      : null;
  const pauseFrom =
    typeof schedule.pauseStartedLocalDate === "string"
      ? schedule.pauseStartedLocalDate
      : today;
  if (pauseUntil && day >= pauseFrom && day < pauseUntil) return "none";
  if (habit.frequency === "times_per_week") return "flexible";
  return isHabitScheduledOnLocalDate(habit, day) ? "fixed" : "none";
}
function stateOf(
  habit: Habit,
  day: string,
  records: Map<string, CheckIn>,
  today: string
) {
  const recorded = records.get(habit.id + ":" + day);
  if (recorded) return recorded.state;
  const availability = availabilityOf(habit, day, today);
  if (availability === "none") return "not_scheduled";
  if (availability === "flexible") return day > today ? "upcoming" : "flexible";
  return day > today ? "upcoming" : "unrecorded";
}
function stateLabel(state: ReturnType<typeof stateOf> | "not_yet_due" | "due") {
  return {
    completed: "Completed",
    skipped: "Skipped",
    missed: "Recorded missed",
    unrecorded: "Unrecorded",
    upcoming: "Scheduled",
    not_scheduled: "Not scheduled",
    flexible: "Flexible this week",
    not_yet_due: "Not due today",
    due: "Due today",
  }[state];
}
function frequencyLabel(habit: Habit) {
  const schedule = scheduleOf(habit);
  if (habit.frequency === "daily") return "Daily";
  if (habit.frequency === "days_of_week")
    return (
      "Selected weekdays: " +
      (Array.isArray(schedule.weekdays)
        ? schedule.weekdays
            .map(value => weekdays[Number(value)])
            .filter(Boolean)
            .join(", ")
        : "none")
    );
  if (habit.frequency === "times_per_week")
    return String(habitWeeklyTarget(habit) ?? "?") + " times per week";
  return "Every " + String(schedule.intervalDays ?? "?") + " days";
}

export function HabitDisciplineWorkspace(props: HabitDisciplineWorkspaceProps) {
  const {
    scope,
    habits,
    checkIns,
    today,
    goals = [],
    categories = [],
    isOnline = true,
    pending,
  } = props;
  const [view, setView] = useState<View>("practice");
  const [localHabitId, setLocalHabitId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(today);
  const [anchor, setAnchor] = useState(monthStart(today));
  const [draftHabitId, setDraftHabitId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [noteKey, setNoteKey] = useState("");
  const [note, setNote] = useState("");
  const [pauseDate, setPauseDate] = useState(shiftDate(today, 7));
  const [feedback, setFeedback] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const active = habits.filter(habit => !habit.archivedAt);
  const archived = habits.filter(habit => Boolean(habit.archivedAt));
  const selected =
    habits.find(
      habit => habit.id === (props.selectedHabitId ?? localHabitId)
    ) ??
    active[0] ??
    archived[0] ??
    null;
  const selectHabit = (id: string) => {
    setLocalHabitId(id);
    props.onSelectedHabitChange?.(id);
    setFeedback(null);
  };
  const evidence = trpc.planner.habit.practiceEvidence.useQuery(
    { ...scope, endLocalDate: today },
    { enabled: habits.length > 0 }
  );
  const olderEndLocalDate = shiftDate(shiftMonth(anchor, 1), -1);
  const olderNeeded =
    anchor < (evidence.data?.startLocalDate ?? shiftDate(today, -396));
  const olderEvidence = trpc.planner.habit.practiceEvidence.useQuery(
    { ...scope, endLocalDate: olderEndLocalDate },
    { enabled: habits.length > 0 && olderNeeded }
  );
  const olderHistoryUnavailable = olderNeeded && !olderEvidence.data;
  const facts = useMemo(
    () => [
      ...(olderEvidence.data?.checkIns ?? []),
      ...(evidence.data?.checkIns ?? []),
      ...checkIns,
    ],
    [checkIns, evidence.data?.checkIns, olderEvidence.data?.checkIns]
  );
  const records = useMemo(
    () =>
      new Map(facts.map(item => [item.habitId + ":" + item.localDate, item])),
    [facts]
  );
  const decision =
    selected && !selected.archivedAt
      ? habitReturnDecision(selected, facts, today)
      : null;
  const currentDraft = selected
    ? draftHabitId === selected.id && draft
      ? draft
      : draftOf(selected)
    : null;
  const draftStorageKey = selected
    ? "habit-settings-draft:" + scope.workspaceId + ":" + selected.id
    : null;
  useEffect(() => {
    if (!draftStorageKey || !selected) return;
    try {
      const saved = window.sessionStorage.getItem(draftStorageKey);
      if (!saved) {
        setDraft(null);
        setDraftHabitId(null);
        return;
      }
      const parsed: unknown = JSON.parse(saved);
      if (
        parsed &&
        typeof parsed === "object" &&
        "name" in parsed &&
        typeof parsed.name === "string"
      ) {
        setDraft({ ...draftOf(selected), ...(parsed as Draft) });
        setDraftHabitId(selected.id);
      }
    } catch {
      /* Session storage may be unavailable; the in-memory draft still works. */
    }
  }, [draftStorageKey, selected?.id]);
  const updateDraft = (patch: Partial<Draft>) => {
    if (!selected || !currentDraft) return;
    const next = { ...currentDraft, ...patch };
    setDraftHabitId(selected.id);
    setDraft(next);
    if (draftStorageKey) {
      try {
        window.sessionStorage.setItem(draftStorageKey, JSON.stringify(next));
      } catch {
        /* Keep the in-memory draft. */
      }
    }
    setFeedback(null);
  };
  const canWrite = isOnline && !pending && !saving;
  const selectedRecord = selected
    ? records.get(selected.id + ":" + selectedDate)
    : null;
  const selectedState = selected
    ? stateOf(selected, selectedDate, records, today)
    : null;
  const currentNote = selected
    ? noteKey === selected.id + ":" + selectedDate
      ? note
      : (selectedRecord?.note ?? "")
    : "";
  const selectedGoal = goals.find(item => item.id === selected?.goalId);
  const selectedCategory = categories.find(
    item => item.id === selected?.categoryId
  );
  const selectedStreak = props.streaks?.find(
    item => item.habitId === selected?.id
  )?.streak;
  const days = useMemo(() => monthDays(anchor), [anchor]);
  const recentDays = useMemo(
    () => Array.from({ length: 7 }, (_, index) => shiftDate(today, index - 6)),
    [today]
  );
  const scheduledToday = active.filter(
    habit => availabilityOf(habit, today, today) === "fixed"
  );
  const completedToday = scheduledToday.filter(
    habit => records.get(habit.id + ":" + today)?.state === "completed"
  ).length;
  const skippedToday = scheduledToday.filter(
    habit => records.get(habit.id + ":" + today)?.state === "skipped"
  ).length;
  const weekStart = shiftDate(today, -((localDay(today).getUTCDay() + 6) % 7));
  const groups = [
    { key: "due", title: "Due today", items: [] as Habit[] },
    { key: "flexible", title: "Flexible this week", items: [] as Habit[] },
    {
      key: "done",
      title: "Recorded today or target met",
      items: [] as Habit[],
    },
    { key: "paused", title: "Paused", items: [] as Habit[] },
    { key: "later", title: "Later", items: [] as Habit[] },
  ];
  const weeklyProgress = (habit: Habit) => {
    const target = habitWeeklyTarget(habit) ?? 1;
    const completed = Array.from(records.values()).filter(
      record =>
        record.habitId === habit.id &&
        record.localDate >= weekStart &&
        record.localDate <= today &&
        record.state === "completed"
    ).length;
    return { target, completed, remaining: Math.max(0, target - completed) };
  };
  for (const habit of active) {
    const recorded = records.get(habit.id + ":" + today);
    const schedule = scheduleOf(habit);
    const paused =
      typeof schedule.pauseUntilLocalDate === "string" &&
      schedule.pauseUntilLocalDate > today &&
      (typeof schedule.pauseStartedLocalDate !== "string" ||
        schedule.pauseStartedLocalDate <= today);
    const key = paused
      ? "paused"
      : habit.frequency === "times_per_week" &&
          weeklyProgress(habit).remaining === 0
        ? "done"
        : recorded
          ? "done"
          : habit.frequency === "times_per_week"
            ? "flexible"
            : habitReturnDecision(habit, facts, today).todayState === "due"
              ? "due"
              : "later";
    groups.find(group => group.key === key)!.items.push(habit);
  }
  const selectCorrection = (id: string, day: string) => {
    selectHabit(id);
    setSelectedDate(day);
    setView("history");
    setNoteKey(id + ":" + day);
    setNote(records.get(id + ":" + day)?.note ?? "");
  };
  const savePatch = async (patch: HabitUpdatePatch, success: string) => {
    if (!selected || !props.onUpdateHabit || !canWrite) return false;
    setSaving(true);
    setFeedback(null);
    try {
      await props.onUpdateHabit({
        id: selected.id,
        expectedVersion: selected.version,
        patch,
      });
      setFeedback(success);
      return true;
    } catch (cause) {
      setFeedback(
        cause instanceof Error
          ? cause.message
          : "Habit change failed. Refresh and retry."
      );
      return false;
    } finally {
      setSaving(false);
    }
  };
  const saveSettings = async () => {
    if (!selected || !currentDraft) return;
    const name = currentDraft.name.trim();
    if (!name || name.length > 160) {
      setFeedback("Name the habit in 160 characters or fewer.");
      return;
    }
    if (
      currentDraft.startLocalDate &&
      !validDate(currentDraft.startLocalDate)
    ) {
      setFeedback("Choose a valid start date.");
      return;
    }
    if (
      currentDraft.frequency === "days_of_week" &&
      !currentDraft.weekdays.length
    ) {
      setFeedback("Choose at least one weekday.");
      return;
    }
    const times = Number(currentDraft.timesPerWeek);
    if (
      currentDraft.frequency === "times_per_week" &&
      (!Number.isInteger(times) || times < 1 || times > 7)
    ) {
      setFeedback("Choose 1 to 7 times per week.");
      return;
    }
    const interval = Number(currentDraft.intervalDays);
    if (
      currentDraft.frequency === "interval" &&
      (!Number.isInteger(interval) || interval < 1 || interval > 365)
    ) {
      setFeedback("Choose an interval from 1 to 365 days.");
      return;
    }
    if (currentDraft.frequency === "interval" && !currentDraft.startLocalDate) {
      setFeedback("Choose a start date for the interval.");
      return;
    }
    const schedule = { ...scheduleOf(selected) };
    if (currentDraft.startLocalDate)
      schedule.startLocalDate = currentDraft.startLocalDate;
    else delete schedule.startLocalDate;
    if (currentDraft.frequency === "days_of_week")
      schedule.weekdays = currentDraft.weekdays;
    if (currentDraft.frequency === "times_per_week")
      schedule.timesPerWeek = times;
    if (currentDraft.frequency === "interval") schedule.intervalDays = interval;
    const saved = await savePatch(
      {
        name,
        description: currentDraft.description || null,
        goalId: currentDraft.goalId || null,
        categoryId: currentDraft.categoryId || null,
        color: currentDraft.color,
        frequency: currentDraft.frequency,
        schedule,
        reminderTime: currentDraft.reminderTime || null,
      },
      "Settings saved. Existing check-ins remain in history."
    );
    if (saved) {
      if (draftStorageKey) {
        try {
          window.sessionStorage.removeItem(draftStorageKey);
        } catch {
          /* The saved server state is authoritative. */
        }
      }
      setDraft(null);
      setDraftHabitId(null);
    }
  };
  const resume = () => {
    if (selected)
      void savePatch(
        {
          schedule: {
            ...scheduleOf(selected),
            returnAcknowledgedAtLocalDate: today,
            pauseStartedLocalDate: null,
            pauseUntilLocalDate: null,
          },
        },
        "Current schedule resumed. Earlier records remain unchanged."
      );
  };
  const pause = () => {
    if (!selected) return;
    if (!validDate(pauseDate) || pauseDate <= today) {
      setFeedback("Choose a review date after today.");
      return;
    }
    void savePatch(
      {
        schedule: {
          ...scheduleOf(selected),
          pauseStartedLocalDate: today,
          pauseUntilLocalDate: pauseDate,
        },
      },
      "Paused until " +
        dateLabel(pauseDate) +
        ". Earlier records remain unchanged."
    );
  };
  const writeRecord = (state: HabitState) => {
    if (!selected || selected.archivedAt || !canWrite || selectedDate > today)
      return;
    void props.onCheckIn(
      selected.id,
      selectedDate,
      state,
      currentNote.trim() || null,
      expectedOf(selectedRecord)
    );
  };
  const clearRecord = () => {
    if (!selected || selected.archivedAt || !canWrite || selectedDate > today)
      return;
    void props.onClearCheckIn(
      selected.id,
      selectedDate,
      expectedOf(selectedRecord) ?? undefined
    );
  };
  const quickCheckIn = (habitId: string, state: "completed" | "skipped") => {
    if (!canWrite) return;
    void props.onCheckIn(
      habitId,
      today,
      state,
      undefined,
      expectedOf(records.get(habitId + ":" + today))
    );
  };
  const archiveAction = async (restore: boolean) => {
    if (!selected || !canWrite) return;
    const action = restore ? props.onRestoreHabit : props.onArchiveHabit;
    if (!action) return;
    setSaving(true);
    setFeedback(null);
    try {
      await action(selected.id, selected.version);
      setFeedback(
        restore
          ? "Habit restored."
          : "Habit archived. Its history stays available."
      );
    } catch (cause) {
      setFeedback(
        cause instanceof Error
          ? cause.message
          : "The habit could not be changed. Refresh and retry."
      );
    } finally {
      setSaving(false);
    }
  };
  return (
    <section className="habit-workspace" aria-labelledby="habits-heading">
      <header className="habit-workspace-header">
        <div>
          <h2 id="habits-heading">Habits</h2>
          <p>
            Practice today, return after a gap, and correct recorded history.
          </p>
        </div>
        <div className="habit-header-actions">
          {props.onOpenTracking && (
            <button
              className="habit-secondary"
              type="button"
              onClick={props.onOpenTracking}
            >
              Task insights
            </button>
          )}
          {props.onCompose && (
            <button
              className="habit-primary"
              type="button"
              onClick={props.onCompose}
            >
              <Plus size={18} aria-hidden="true" /> Add habit
            </button>
          )}
        </div>
      </header>
      {!isOnline && (
        <p className="habit-banner" role="status">
          You are offline. Review saved records here; reconnect to change
          check-ins or settings.
        </p>
      )}
      {props.error && (
        <p className="habit-banner is-error" role="alert">
          {props.error}
        </p>
      )}
      {feedback && (
        <p className="habit-banner" role="status">
          {feedback}
        </p>
      )}
      {evidence.isError && (
        <p className="habit-banner is-error" role="alert">
          Long-term evidence could not load. Showing available workspace
          records.{" "}
          <button type="button" onClick={() => void evidence.refetch()}>
            Retry history
          </button>
        </p>
      )}
      {!habits.length ? (
        <div className="habit-empty">
          <h3>No habits yet</h3>
          <p>
            Add a practice to keep its schedule, check-ins, and corrections in
            one place.
          </p>
          {props.onCompose && (
            <button type="button" onClick={props.onCompose}>
              Add habit
            </button>
          )}
        </div>
      ) : (
        <>
          <nav className="habit-views" aria-label="Habit views">
            {(["practice", "history", "settings"] as const).map(item => (
              <button
                key={item}
                type="button"
                aria-current={view === item ? "page" : undefined}
                className={view === item ? "is-active" : ""}
                onClick={() => setView(item)}
              >
                {item === "practice"
                  ? "Practice"
                  : item === "history"
                    ? "History"
                    : "Settings"}
              </button>
            ))}
          </nav>
          <div className="habit-workspace-grid">
            <aside className="habit-list" aria-labelledby="habit-list-heading">
              <div className="habit-section-heading">
                <h3 id="habit-list-heading">All active habits</h3>
                <span>{active.length}</span>
              </div>
              {active.length ? (
                <div className="habit-list-groups">
                  {groups
                    .filter(group => group.items.length)
                    .map(group => (
                      <section
                        className="habit-list-group"
                        key={group.key}
                        aria-label={group.title}
                      >
                        <h4>
                          {group.title} <span>{group.items.length}</span>
                        </h4>
                        <div className="habit-list-items">
                          {group.items.map(habit => {
                            const result = habitReturnDecision(
                              habit,
                              facts,
                              today
                            );
                            const todayRecord = records.get(
                              habit.id + ":" + today
                            );
                            const week =
                              habit.frequency === "times_per_week"
                                ? weeklyProgress(habit)
                                : null;
                            const pausedUntil =
                              scheduleOf(habit).pauseUntilLocalDate;
                            return (
                              <article
                                className={
                                  "habit-list-item" +
                                  (selected?.id === habit.id
                                    ? " is-selected"
                                    : "")
                                }
                                style={{
                                  borderLeftColor:
                                    habit.color ?? "var(--accent)",
                                }}
                                key={habit.id}
                              >
                                <button
                                  type="button"
                                  className="habit-list-select"
                                  aria-current={
                                    selected?.id === habit.id
                                      ? "true"
                                      : undefined
                                  }
                                  onClick={() => selectHabit(habit.id)}
                                >
                                  <strong>{habit.name}</strong>
                                  <span>
                                    {group.key === "paused" &&
                                    typeof pausedUntil === "string"
                                      ? "Paused until " + dateLabel(pausedUntil)
                                      : week
                                        ? `${week.completed} of ${week.target} this week · ${week.remaining ? `${week.remaining} remaining` : "target met"}`
                                        : result.todayState === "due"
                                          ? "Due today"
                                          : result.todayState === "not_yet_due"
                                            ? "Next " +
                                              (result.nextOpportunityLocalDate
                                                ? dateLabel(
                                                    result.nextOpportunityLocalDate
                                                  )
                                                : "not set")
                                            : stateLabel(result.todayState)}
                                  </span>
                                </button>
                                <div className="habit-list-actions">
                                  {todayRecord ? (
                                    <button
                                      type="button"
                                      disabled={!canWrite}
                                      onClick={() =>
                                        todayRecord.note
                                          ? selectCorrection(habit.id, today)
                                          : void props.onClearCheckIn(
                                              habit.id,
                                              today,
                                              expectedOf(todayRecord) ??
                                                undefined
                                            )
                                      }
                                    >
                                      Undo{" "}
                                      {stateLabel(
                                        todayRecord.state
                                      ).toLowerCase()}
                                    </button>
                                  ) : (
                                    <>
                                      <button
                                        type="button"
                                        disabled={
                                          !canWrite || group.key === "paused"
                                        }
                                        onClick={() =>
                                          quickCheckIn(habit.id, "completed")
                                        }
                                      >
                                        Complete
                                      </button>
                                      <button
                                        type="button"
                                        disabled={
                                          !canWrite || group.key === "paused"
                                        }
                                        onClick={() =>
                                          quickCheckIn(habit.id, "skipped")
                                        }
                                      >
                                        Skip
                                      </button>
                                    </>
                                  )}
                                </div>
                              </article>
                            );
                          })}
                        </div>
                      </section>
                    ))}
                </div>
              ) : (
                <p className="habit-muted">
                  All habits are archived. Their recorded history remains
                  available below.
                </p>
              )}
              {archived.length > 0 && (
                <details className="habit-archived">
                  <summary>Archived habits ({archived.length})</summary>
                  <div className="habit-list-items">
                    {archived.map(habit => (
                      <button
                        type="button"
                        className="habit-archived-row"
                        key={habit.id}
                        onClick={() => {
                          selectHabit(habit.id);
                          setView("history");
                        }}
                      >
                        {habit.name}
                        <span>View history</span>
                      </button>
                    ))}
                  </div>
                </details>
              )}
            </aside>
            <div className="habit-main">
              {selected && (
                <>
                  <section
                    className="habit-selected"
                    aria-labelledby="habit-selected-heading"
                  >
                    <div className="habit-selected-top">
                      <div>
                        <h3 id="habit-selected-heading">{selected.name}</h3>
                        <p>
                          {selected.description || frequencyLabel(selected)}
                        </p>
                      </div>
                      <span className="habit-status">
                        {selected.archivedAt
                          ? "Archived"
                          : decision?.todayState === "due"
                            ? "Due today"
                            : decision
                              ? stateLabel(decision.todayState)
                              : ""}
                      </span>
                    </div>
                    <div className="habit-context">
                      <span>{frequencyLabel(selected)}</span>
                      {selected.reminderTime && (
                        <span>
                          Preferred reminder time {selected.reminderTime}{" "}
                          (delivery not connected)
                        </span>
                      )}
                      {selectedCategory && (
                        <span>
                          Category:{" "}
                          {selectedCategory.name ?? selectedCategory.title}
                        </span>
                      )}
                      {typeof selectedStreak === "number" &&
                        selectedStreak > 0 && (
                          <span>
                            {selectedStreak} completed-date run; skips are
                            neutral
                          </span>
                        )}
                      {selectedGoal &&
                        (props.onOpenGoal ? (
                          <button
                            type="button"
                            onClick={() => props.onOpenGoal?.(selectedGoal.id)}
                          >
                            Goal: {selectedGoal.title ?? selectedGoal.name}
                          </button>
                        ) : (
                          <span>
                            Goal: {selectedGoal.title ?? selectedGoal.name}
                          </span>
                        ))}
                    </div>
                    {decision && (
                      <div className="habit-next">
                        <strong>Next opportunity</strong>
                        <span>
                          {decision.nextOpportunityLocalDate
                            ? dateLabel(decision.nextOpportunityLocalDate) +
                              (decision.nextOpportunityKind === "flexible_week"
                                ? " · flexible this week"
                                : "")
                            : "No upcoming date in this schedule"}
                        </span>
                        <small>
                          Recent{" "}
                          {dateLabel(
                            decision.recentConsistency.windowStartLocalDate
                          )}
                          –
                          {dateLabel(
                            decision.recentConsistency.windowEndLocalDate
                          )}
                          : {decision.recentConsistency.completed} completed,{" "}
                          {decision.recentConsistency.skipped} skipped,{" "}
                          {decision.recentConsistency.missed} recorded missed,{" "}
                          {decision.recentConsistency.unrecorded} unrecorded
                          scheduled opportunities.
                        </small>
                      </div>
                    )}
                    {decision?.interrupted && (
                      <div className="habit-return">
                        <div>
                          <strong>Ready to return?</strong>
                          <p>
                            Your recent schedule has a gap. Earlier days stay as
                            recorded; choose what fits next.
                          </p>
                        </div>
                        <div className="habit-return-actions">
                          <button
                            type="button"
                            disabled={!canWrite || !props.onUpdateHabit}
                            onClick={resume}
                          >
                            Resume
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setView("settings");
                              setFeedback(
                                "Revise the schedule below, then save when ready."
                              );
                            }}
                          >
                            Revise
                          </button>
                          <label>
                            Review date
                            <input
                              type="date"
                              min={shiftDate(today, 1)}
                              value={pauseDate}
                              onChange={event =>
                                setPauseDate(event.target.value)
                              }
                            />
                          </label>
                          <button
                            type="button"
                            disabled={!canWrite || !props.onUpdateHabit}
                            onClick={pause}
                          >
                            Pause until date
                          </button>
                        </div>
                      </div>
                    )}
                  </section>
                  {view === "practice" && (
                    <section
                      className="habit-practice"
                      aria-labelledby="habit-practice-heading"
                    >
                      <div className="habit-section-heading">
                        <h3 id="habit-practice-heading">
                          Today · {dateLabel(today)}
                        </h3>
                      </div>
                      <p className="habit-muted">
                        Complete or Skip any active habit from the list. History
                        holds notes and date corrections.
                      </p>
                      <div className="habit-today-summary" role="status">
                        <strong>
                          {completedToday}/{scheduledToday.length} scheduled
                          practices complete today
                        </strong>
                        <span>
                          {skippedToday
                            ? `${skippedToday} intentionally skipped. `
                            : ""}
                          Flexible weekly targets are tracked separately, not
                          counted as daily misses.
                        </span>
                      </div>
                      {selected.archivedAt ? (
                        <p className="habit-muted">
                          Archived habits are read-only. Their records remain in
                          History.
                        </p>
                      ) : (
                        <div className="habit-practice-actions">
                          {records.get(selected.id + ":" + today) ? (
                            <button
                              type="button"
                              disabled={!canWrite}
                              onClick={() =>
                                records.get(selected.id + ":" + today)?.note
                                  ? selectCorrection(selected.id, today)
                                  : void props.onClearCheckIn(
                                      selected.id,
                                      today,
                                      expectedOf(
                                        records.get(selected.id + ":" + today)
                                      ) ?? undefined
                                    )
                              }
                            >
                              Undo{" "}
                              {stateLabel(
                                records.get(selected.id + ":" + today)!.state
                              ).toLowerCase()}
                            </button>
                          ) : (
                            <>
                              <button
                                type="button"
                                className="habit-primary"
                                disabled={!canWrite}
                                onClick={() =>
                                  quickCheckIn(selected.id, "completed")
                                }
                              >
                                Complete today
                              </button>
                              <button
                                type="button"
                                disabled={!canWrite}
                                onClick={() =>
                                  quickCheckIn(selected.id, "skipped")
                                }
                              >
                                Skip today
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            onClick={() => selectCorrection(selected.id, today)}
                          >
                            {records.get(selected.id + ":" + today)
                              ? "Add note or correct"
                              : "Review today’s record"}
                          </button>
                        </div>
                      )}
                      {active.length > 0 && (
                        <div
                          className="habit-trace"
                          aria-labelledby="habit-trace-heading"
                        >
                          <div className="habit-section-heading">
                            <div>
                              <h4 id="habit-trace-heading">Seven-day trace</h4>
                              <p>
                                Tap a square to complete or undo. Open History
                                to skip, add notes, or correct a date.
                              </p>
                            </div>
                          </div>
                          <div
                            className="habit-trace-scroll"
                            role="region"
                            aria-label="Seven-day habit trace"
                            tabIndex={0}
                          >
                            <div className="habit-trace-grid">
                              <span aria-hidden="true" />
                              {recentDays.map(day => (
                                <span className="habit-trace-day" key={day}>
                                  {new Intl.DateTimeFormat("en-US", {
                                    weekday: "short",
                                    timeZone: "UTC",
                                  }).format(localDay(day))}
                                  <small>{Number(day.slice(-2))}</small>
                                </span>
                              ))}
                              {active.map(habit => (
                                <div className="habit-trace-row" key={habit.id}>
                                  <strong>{habit.name}</strong>
                                  {recentDays.map(day => {
                                    const record = records.get(
                                      habit.id + ":" + day
                                    );
                                    const available =
                                      availabilityOf(habit, day, today) !==
                                      "none";
                                    const editRecord = Boolean(
                                      record && (day < today || record.note)
                                    );
                                    return (
                                      <button
                                        type="button"
                                        key={day}
                                        className={
                                          record
                                            ? "is-" + record.state
                                            : available
                                              ? "is-open"
                                              : "is-rest"
                                        }
                                        aria-label={`${habit.name}, ${dateLabel(day)}: ${record ? stateLabel(record.state) + (editRecord ? "; review record" : "; undo") : available ? "unrecorded; complete" : "not scheduled"}`}
                                        aria-pressed={
                                          record?.state === "completed"
                                        }
                                        disabled={
                                          !canWrite || (!available && !record)
                                        }
                                        onClick={() =>
                                          editRecord
                                            ? selectCorrection(habit.id, day)
                                            : record
                                              ? void props.onClearCheckIn(
                                                  habit.id,
                                                  day,
                                                  expectedOf(record) ??
                                                    undefined
                                                )
                                              : void props.onCheckIn(
                                                  habit.id,
                                                  day,
                                                  "completed",
                                                  undefined,
                                                  null
                                                )
                                        }
                                      >
                                        {record?.state === "completed"
                                          ? "✓"
                                          : record?.state === "skipped"
                                            ? "−"
                                            : record?.state === "missed"
                                              ? "!"
                                              : available
                                                ? "+"
                                                : ""}
                                      </button>
                                    );
                                  })}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </section>
                  )}
                  {view !== "settings" && (
                    <section
                      className={
                        "habit-history" +
                        (view === "history" ? " is-reviewing" : "") +
                        (olderHistoryUnavailable ? " is-loading" : "")
                      }
                      aria-labelledby="habit-history-heading"
                      aria-busy={olderNeeded && olderEvidence.isFetching}
                    >
                      <div className="habit-section-heading">
                        <div>
                          <h3 id="habit-history-heading">
                            {view === "history"
                              ? "History and corrections"
                              : "Habit calendar"}
                          </h3>
                          <p>
                            Recorded missed and unrecorded days are different
                            facts. Dates use the workspace timezone (
                            {scope.timezone}).
                          </p>
                        </div>
                      </div>
                      <div className="habit-month-controls">
                        <button
                          type="button"
                          aria-label="Previous month"
                          onClick={() =>
                            setAnchor(value => shiftMonth(value, -1))
                          }
                        >
                          <ChevronLeft size={18} />
                        </button>
                        <strong>{monthLabel(anchor)}</strong>
                        <button
                          type="button"
                          aria-label="Next month"
                          disabled={anchor >= monthStart(today)}
                          onClick={() =>
                            setAnchor(value => shiftMonth(value, 1))
                          }
                        >
                          <ChevronRight size={18} />
                        </button>
                      </div>
                      {olderHistoryUnavailable && (
                        <p
                          className="habit-banner"
                          role={olderEvidence.isError ? "alert" : "status"}
                        >
                          {olderEvidence.isError
                            ? "Earlier history could not load. The calendar is paused rather than showing incomplete facts."
                            : "Loading earlier habit history…"}
                          {olderEvidence.isError && (
                            <button
                              type="button"
                              onClick={() => void olderEvidence.refetch()}
                            >
                              Retry history
                            </button>
                          )}
                        </p>
                      )}
                      <div className="habit-calendar-labels" aria-hidden="true">
                        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(
                          day => (
                            <span key={day}>{day}</span>
                          )
                        )}
                      </div>
                      <div className="habit-calendar">
                        {Array.from(
                          { length: (localDay(anchor).getUTCDay() + 6) % 7 },
                          (_, index) => (
                            <span key={"offset-" + index} />
                          )
                        )}
                        {days.map(day => {
                          const scheduled = active.filter(
                            habit =>
                              availabilityOf(habit, day, today) === "fixed"
                          );
                          const flexibleRecords = active.filter(
                            habit =>
                              habit.frequency === "times_per_week" &&
                              records.has(habit.id + ":" + day)
                          ).length;
                          const archivedRecords = archived.filter(habit =>
                            records.has(habit.id + ":" + day)
                          ).length;
                          const completed = scheduled.filter(
                            habit =>
                              records.get(habit.id + ":" + day)?.state ===
                              "completed"
                          ).length;
                          const skipped = scheduled.filter(
                            habit =>
                              records.get(habit.id + ":" + day)?.state ===
                              "skipped"
                          ).length;
                          return (
                            <button
                              type="button"
                              key={day}
                              className={
                                selectedDate === day ? "is-selected" : ""
                              }
                              aria-pressed={selectedDate === day}
                              aria-label={
                                dateLabel(day) +
                                ": " +
                                completed +
                                " completed, " +
                                skipped +
                                " skipped, " +
                                scheduled.length +
                                " scheduled, " +
                                flexibleRecords +
                                " flexible records, " +
                                archivedRecords +
                                " archived records"
                              }
                              onClick={() => {
                                setSelectedDate(day);
                                setNoteKey("");
                              }}
                            >
                              <time dateTime={day}>
                                {Number(day.slice(-2))}
                              </time>
                              <small>
                                {scheduled.length
                                  ? completed + "/" + scheduled.length
                                  : "—"}
                              </small>
                              {flexibleRecords > 0 && (
                                <small className="habit-calendar-extra">
                                  +{flexibleRecords}f
                                </small>
                              )}
                              {archivedRecords > 0 && (
                                <small className="habit-calendar-extra">
                                  +{archivedRecords}a
                                </small>
                              )}
                            </button>
                          );
                        })}
                      </div>
                      <p className="habit-calendar-legend">
                        Daily count shows completed / scheduled. f = flexible
                        weekly records; a = archived history.
                      </p>
                      <div className="habit-day-review">
                        <div className="habit-section-heading">
                          <h4>{dateLabel(selectedDate)}</h4>
                          <span>
                            {selectedDate > today ? "Future" : "Recorded facts"}
                          </span>
                        </div>
                        {selectedDate > today && (
                          <p className="habit-muted">
                            Future habits are visible for planning; check-ins
                            open on the day.
                          </p>
                        )}
                        {(() => {
                          const rows = habits.filter(
                            habit =>
                              (availabilityOf(habit, selectedDate, today) !==
                                "none" &&
                                !habit.archivedAt) ||
                              records.has(habit.id + ":" + selectedDate)
                          );
                          return rows.length ? (
                            <div className="habit-day-list">
                              {rows.map(habit => {
                                const record = records.get(
                                  habit.id + ":" + selectedDate
                                );
                                const writable =
                                  canWrite &&
                                  selectedDate <= today &&
                                  !habit.archivedAt;
                                return (
                                  <div className="habit-day-row" key={habit.id}>
                                    <button
                                      type="button"
                                      className={
                                        selected.id === habit.id
                                          ? "is-selected"
                                          : ""
                                      }
                                      onClick={() =>
                                        selectCorrection(habit.id, selectedDate)
                                      }
                                    >
                                      <strong>{habit.name}</strong>
                                      <span>
                                        {stateLabel(
                                          stateOf(
                                            habit,
                                            selectedDate,
                                            records,
                                            today
                                          )
                                        )}
                                      </span>
                                    </button>
                                    <div className="habit-day-actions">
                                      {record ? (
                                        <button
                                          type="button"
                                          aria-label={`Review ${record.state} for ${habit.name} on ${dateLabel(selectedDate)}`}
                                          onClick={() =>
                                            selectCorrection(
                                              habit.id,
                                              selectedDate
                                            )
                                          }
                                        >
                                          Edit record
                                        </button>
                                      ) : (
                                        <>
                                          <button
                                            type="button"
                                            disabled={!writable}
                                            aria-label={`Complete ${habit.name} on ${dateLabel(selectedDate)}`}
                                            onClick={() =>
                                              void props.onCheckIn(
                                                habit.id,
                                                selectedDate,
                                                "completed",
                                                undefined,
                                                null
                                              )
                                            }
                                          >
                                            Complete
                                          </button>
                                          <button
                                            type="button"
                                            disabled={!writable}
                                            aria-label={`Skip ${habit.name} on ${dateLabel(selectedDate)}`}
                                            onClick={() =>
                                              void props.onCheckIn(
                                                habit.id,
                                                selectedDate,
                                                "skipped",
                                                undefined,
                                                null
                                              )
                                            }
                                          >
                                            Skip
                                          </button>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="habit-muted">
                              No active habits are scheduled or recorded for
                              this date.
                            </p>
                          );
                        })()}
                      </div>
                      <div className="habit-correction">
                        <h4>Selected record · {selected.name}</h4>
                        <p>
                          {selectedState
                            ? stateLabel(selectedState)
                            : "No record"}
                          {selectedRecord?.note
                            ? " · Note: " + selectedRecord.note
                            : ""}
                        </p>
                        <label htmlFor="habit-correction-note">
                          Note for this date
                        </label>
                        <textarea
                          id="habit-correction-note"
                          maxLength={1000}
                          rows={3}
                          value={currentNote}
                          disabled={
                            selectedDate > today || Boolean(selected.archivedAt)
                          }
                          onChange={event => {
                            setNoteKey(selected.id + ":" + selectedDate);
                            setNote(event.target.value);
                          }}
                        />
                        <div className="habit-correction-actions">
                          <button
                            type="button"
                            disabled={
                              !canWrite ||
                              selectedDate > today ||
                              Boolean(selected.archivedAt)
                            }
                            onClick={() => writeRecord("completed")}
                          >
                            Complete
                          </button>
                          <button
                            type="button"
                            disabled={
                              !canWrite ||
                              selectedDate > today ||
                              Boolean(selected.archivedAt)
                            }
                            onClick={() => writeRecord("skipped")}
                          >
                            Skip
                          </button>
                          <button
                            type="button"
                            disabled={
                              !canWrite ||
                              selectedDate > today ||
                              Boolean(selected.archivedAt)
                            }
                            onClick={() => writeRecord("missed")}
                          >
                            Record missed
                          </button>
                          <button
                            type="button"
                            disabled={
                              !canWrite ||
                              selectedDate > today ||
                              Boolean(selected.archivedAt) ||
                              !selectedRecord
                            }
                            onClick={clearRecord}
                          >
                            Clear record
                          </button>
                        </div>
                        <p className="habit-muted">
                          A correction updates this date’s record. Clear removes
                          its state and note; the schedule stays unchanged.
                        </p>
                      </div>
                      <SelectedMonth
                        habit={selected}
                        days={days}
                        today={today}
                        records={records}
                        selectedDate={selectedDate}
                        onSelect={day => selectCorrection(selected.id, day)}
                      />
                      <details className="habit-year">
                        <summary>Twelve-month factual evidence</summary>
                        <p>
                          Counts use dated records and the current schedule.
                          Unrecorded scheduled days stay separate from recorded
                          missed days. Available history starts{" "}
                          {evidence.data?.startLocalDate ??
                            "with the loaded workspace snapshot"}
                          .
                        </p>
                        <div>
                          {Array.from({ length: 12 }, (_, index) =>
                            shiftMonth(today, index - 11)
                          ).map(start => {
                            const period = monthDays(start).filter(
                              day =>
                                day <= today &&
                                (availabilityOf(selected, day, today) ===
                                  "fixed" ||
                                  records.has(selected.id + ":" + day))
                            );
                            const counts = period.reduce(
                              (total, day) => {
                                const state = stateOf(
                                  selected,
                                  day,
                                  records,
                                  today
                                );
                                if (state === "completed") total.completed++;
                                if (state === "skipped") total.skipped++;
                                if (state === "missed") total.missed++;
                                if (state === "unrecorded") total.unrecorded++;
                                return total;
                              },
                              {
                                completed: 0,
                                skipped: 0,
                                missed: 0,
                                unrecorded: 0,
                              }
                            );
                            return (
                              <div key={start}>
                                <strong>{monthLabel(start)}</strong>
                                <span>
                                  {counts.completed} complete · {counts.skipped}{" "}
                                  skipped · {counts.missed} missed ·{" "}
                                  {counts.unrecorded} unrecorded
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </details>
                    </section>
                  )}
                  {view === "settings" && (
                    <section
                      className="habit-settings"
                      aria-labelledby="habit-settings-heading"
                    >
                      <div className="habit-section-heading">
                        <div>
                          <h3 id="habit-settings-heading">Habit settings</h3>
                          <p>
                            Changes affect the current schedule. Existing
                            check-ins keep their dates and states.
                          </p>
                        </div>
                      </div>
                      {selected.archivedAt ? (
                        <>
                          <p className="habit-muted">
                            This habit is archived. Its settings and history are
                            preserved.
                          </p>
                          {props.onRestoreHabit && (
                            <button
                              type="button"
                              disabled={!canWrite}
                              onClick={() => void archiveAction(true)}
                            >
                              Restore habit
                            </button>
                          )}
                        </>
                      ) : (
                        currentDraft && (
                          <form
                            onSubmit={event => {
                              event.preventDefault();
                              saveSettings();
                            }}
                          >
                            <div className="habit-fields">
                              <label>
                                Name
                                <input
                                  value={currentDraft.name}
                                  maxLength={160}
                                  onChange={event =>
                                    updateDraft({ name: event.target.value })
                                  }
                                />
                              </label>
                              <label>
                                Description
                                <textarea
                                  rows={3}
                                  maxLength={10000}
                                  value={currentDraft.description}
                                  onChange={event =>
                                    updateDraft({
                                      description: event.target.value,
                                    })
                                  }
                                />
                              </label>
                              <label>
                                Goal
                                <select
                                  value={currentDraft.goalId}
                                  onChange={event =>
                                    updateDraft({ goalId: event.target.value })
                                  }
                                >
                                  <option value="">No linked goal</option>
                                  {goals.map(goal => (
                                    <option key={goal.id} value={goal.id}>
                                      {goal.title ?? goal.name ?? goal.id}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label>
                                Category
                                <select
                                  value={currentDraft.categoryId}
                                  onChange={event =>
                                    updateDraft({
                                      categoryId: event.target.value,
                                    })
                                  }
                                >
                                  <option value="">No category</option>
                                  {categories.map(category => (
                                    <option
                                      key={category.id}
                                      value={category.id}
                                    >
                                      {category.name ??
                                        category.title ??
                                        category.id}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label>
                                Frequency
                                <select
                                  value={currentDraft.frequency}
                                  onChange={event =>
                                    updateDraft({
                                      frequency: event.target
                                        .value as CalendarHabit["frequency"],
                                    })
                                  }
                                >
                                  <option value="daily">Daily</option>
                                  <option value="days_of_week">
                                    Selected weekdays
                                  </option>
                                  <option value="times_per_week">
                                    Times per week
                                  </option>
                                  <option value="interval">
                                    Every interval
                                  </option>
                                </select>
                              </label>
                              {currentDraft.frequency === "days_of_week" && (
                                <fieldset className="habit-weekdays">
                                  <legend>Weekdays</legend>
                                  {weekdays.map((day, index) => (
                                    <label key={day}>
                                      <input
                                        type="checkbox"
                                        checked={currentDraft.weekdays.includes(
                                          index
                                        )}
                                        onChange={() =>
                                          updateDraft({
                                            weekdays:
                                              currentDraft.weekdays.includes(
                                                index
                                              )
                                                ? currentDraft.weekdays.filter(
                                                    value => value !== index
                                                  )
                                                : [
                                                    ...currentDraft.weekdays,
                                                    index,
                                                  ].sort(),
                                          })
                                        }
                                      />
                                      {day}
                                    </label>
                                  ))}
                                </fieldset>
                              )}
                              {currentDraft.frequency === "times_per_week" && (
                                <label>
                                  Times per week
                                  <input
                                    type="number"
                                    min="1"
                                    max="7"
                                    value={currentDraft.timesPerWeek}
                                    onChange={event =>
                                      updateDraft({
                                        timesPerWeek: event.target.value,
                                      })
                                    }
                                  />
                                </label>
                              )}
                              {currentDraft.frequency === "interval" && (
                                <label>
                                  Repeat every (days)
                                  <input
                                    type="number"
                                    min="1"
                                    max="365"
                                    value={currentDraft.intervalDays}
                                    onChange={event =>
                                      updateDraft({
                                        intervalDays: event.target.value,
                                      })
                                    }
                                  />
                                </label>
                              )}
                              <label>
                                Schedule starts
                                <input
                                  type="date"
                                  value={currentDraft.startLocalDate}
                                  onChange={event =>
                                    updateDraft({
                                      startLocalDate: event.target.value,
                                    })
                                  }
                                />
                              </label>
                              <label>
                                Preferred reminder time (delivery not connected
                                yet)
                                <input
                                  type="time"
                                  value={currentDraft.reminderTime}
                                  onChange={event =>
                                    updateDraft({
                                      reminderTime: event.target.value,
                                    })
                                  }
                                />
                              </label>
                              <label>
                                Color
                                <input
                                  type="color"
                                  value={currentDraft.color}
                                  onChange={event =>
                                    updateDraft({ color: event.target.value })
                                  }
                                />
                              </label>
                            </div>
                            <div className="habit-settings-actions">
                              <button
                                type="submit"
                                className="habit-primary"
                                disabled={!canWrite || !props.onUpdateHabit}
                              >
                                Save settings
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (draftStorageKey) {
                                    try {
                                      window.sessionStorage.removeItem(
                                        draftStorageKey
                                      );
                                    } catch {
                                      /* Keep in-memory discard. */
                                    }
                                  }
                                  setDraft(null);
                                  setDraftHabitId(null);
                                  setFeedback(null);
                                }}
                              >
                                Discard edits
                              </button>
                            </div>
                            {!isOnline && (
                              <p className="habit-muted">
                                Your draft stays here until you reconnect and
                                save.
                              </p>
                            )}
                          </form>
                        )
                      )}
                      {!selected.archivedAt && (
                        <div className="habit-pause-settings">
                          <h4>Practice pause</h4>
                          {typeof scheduleOf(selected).pauseUntilLocalDate ===
                            "string" &&
                          String(scheduleOf(selected).pauseUntilLocalDate) >
                            today ? (
                            <>
                              <p>
                                Paused until{" "}
                                {dateLabel(
                                  String(
                                    scheduleOf(selected).pauseUntilLocalDate
                                  )
                                )}
                                . The habit will return for review on that date.
                              </p>
                              <button
                                type="button"
                                disabled={!canWrite || !props.onUpdateHabit}
                                onClick={resume}
                              >
                                Resume current schedule
                              </button>
                            </>
                          ) : (
                            <>
                              <p>
                                Choose a review date if you need time away from
                                this practice.
                              </p>
                              <label>
                                Review date
                                <input
                                  type="date"
                                  min={shiftDate(today, 1)}
                                  value={pauseDate}
                                  onChange={event =>
                                    setPauseDate(event.target.value)
                                  }
                                />
                              </label>
                              <button
                                type="button"
                                disabled={!canWrite || !props.onUpdateHabit}
                                onClick={pause}
                              >
                                Pause until date
                              </button>
                            </>
                          )}
                        </div>
                      )}
                      {props.onArchiveHabit && !selected.archivedAt && (
                        <div className="habit-archive-action">
                          <p>
                            Archive removes this habit from daily practice while
                            keeping its history.
                          </p>
                          <button
                            type="button"
                            disabled={!canWrite}
                            onClick={() => void archiveAction(false)}
                          >
                            Archive habit
                          </button>
                        </div>
                      )}
                    </section>
                  )}
                </>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function SelectedMonth({
  habit,
  days,
  today,
  records,
  selectedDate,
  onSelect,
}: {
  habit: Habit;
  days: string[];
  today: string;
  records: Map<string, CheckIn>;
  selectedDate: string;
  onSelect: (day: string) => void;
}) {
  const scheduled = days.filter(
    day => day <= today && availabilityOf(habit, day, today) === "fixed"
  );
  const relevant = days.filter(
    day =>
      day <= today &&
      (availabilityOf(habit, day, today) === "fixed" ||
        records.has(habit.id + ":" + day))
  );
  const states = relevant.map(day => stateOf(habit, day, records, today));
  return (
    <div className="habit-month-summary">
      <strong>
        {habit.name} · {monthLabel(days[0])}
      </strong>
      <p>
        {habit.frequency === "times_per_week"
          ? relevant.length + " recorded days"
          : scheduled.length + " scheduled"}{" "}
        · {states.filter(state => state === "completed").length} completed ·{" "}
        {states.filter(state => state === "skipped").length} skipped ·{" "}
        {states.filter(state => state === "missed").length} recorded missed ·{" "}
        {states.filter(state => state === "unrecorded").length} unrecorded
      </p>
      <div
        className="habit-selected-month"
        aria-label={habit.name + " daily history"}
      >
        {days.map(day => {
          const state = stateOf(habit, day, records, today);
          return (
            <button
              type="button"
              key={day}
              className={"is-" + state}
              aria-label={dateLabel(day) + ": " + stateLabel(state)}
              aria-pressed={selectedDate === day}
              onClick={() => onSelect(day)}
            >
              {Number(day.slice(-2))}
            </button>
          );
        })}
      </div>
    </div>
  );
}
