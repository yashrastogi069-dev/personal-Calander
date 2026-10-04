import type { TodayProjection } from "@shared/todayProjection";
import { Check, Circle, RotateCcw, TimerReset } from "lucide-react";
import { todayHabitActivity, todayHabitTrace, type TodayHabitCheckInFact } from "./todayContext";

export type TodayHabitsProps = {
  rows: TodayProjection["habits"];
  habits: Array<{ id: string; name: string; color?: string | null }>;
  checkIns?: TodayHabitCheckInFact[];
  localDate: string;
  timezone?: string;
  isOnline: boolean;
  pending: boolean;
  error: string | null;
  onCheckIn: (
    habitId: string,
    localDate: string,
    state: "completed" | "skipped"
  ) => void;
  onClearCheckIn: (habitId: string, localDate: string) => void;
  onRetry: () => void;
  onOpenHabits: () => void;
  onOpenHabit?: (habitId: string) => void;
  onUnsupportedOffline: (message: string) => void;
};

export function TodayHabits({
  rows,
  habits,
  checkIns = [],
  localDate,
  timezone = "UTC",
  isOnline,
  pending,
  error,
  onCheckIn,
  onClearCheckIn,
  onRetry,
  onOpenHabits,
  onOpenHabit,
  onUnsupportedOffline,
}: TodayHabitsProps) {
  const activity = todayHabitActivity(localDate, habits.map(habit => habit.id), checkIns);
  const totals = activity.reduce((sum, day) => ({ completed: sum.completed + day.completed, missed: sum.missed + day.missed, skipped: sum.skipped + day.skipped }), { completed: 0, missed: 0, skipped: 0 });
  const runConfirmedWrite = (action: () => void) => {
    if (!isOnline) {
      onUnsupportedOffline(
        "Reconnect to update a habit. Its last confirmed check-in is still shown."
      );
      return;
    }
    action();
  };

  return (
    <section
      className="today-habits"
      data-today-section="habits"
      aria-labelledby="today-habits-heading"
    >
      <header className="today-section-heading">
        <div>
          <h2 id="today-habits-heading">Habits today</h2>
        </div>
        <button type="button" onClick={onOpenHabits}>
          Open habits
        </button>
      </header>
      <div className="today-habit-list">
        {rows.map(row => {
          const complete = row.state === "completed";
          const skipped = row.state === "skipped";
          const missed = row.state === "missed";
          const trace = todayHabitTrace(row.recordId, localDate, checkIns, row.state);
          return (
            <article
              className={`today-habit-row${complete ? " is-complete" : skipped ? " is-skipped" : missed ? " is-missed" : ""}`}
              key={row.recordId}
              data-habit-record-id={row.recordId}
            >
              <span className="today-habit-mark" aria-hidden="true">
                {complete ? (
                  <Check size={17} />
                ) : skipped ? (
                  <RotateCcw size={16} />
                ) : missed ? (
                  "!"
                ) : (
                  <Circle size={17} />
                )}
              </span>
              <div className="today-habit-copy">
                {onOpenHabit ? (
                  <button
                    className="today-habit-title"
                    type="button"
                    onClick={() => onOpenHabit(row.recordId)}
                  >
                    {row.title}
                  </button>
                ) : (
                  <strong>{row.title}</strong>
                )}
                <small>
                  {row.cadence === "weekly_target" && row.weekProgress
                    ? `${row.weekProgress.completed}/${row.weekProgress.target} this week · ${Math.max(0, row.weekProgress.target - row.weekProgress.completed) ? `${Math.max(0, row.weekProgress.target - row.weekProgress.completed)} remaining` : "target met"}${complete ? " · completed today" : skipped ? " · skipped today" : missed ? " · recorded missed today" : ""}`
                    : complete
                      ? "Completed today"
                      : skipped
                        ? "Intentionally skipped today"
                        : missed
                          ? "Recorded missed today · review the record to change it"
                          : "Due today"}
                </small>
              </div>
              <div className="today-habit-trace" aria-label={`Recorded practice for ${row.title}, last seven days`}>
                {trace.map(day => <span key={day.localDate} role="img" className={`today-habit-trace-day is-${day.state}`} title={`${day.localDate}: ${day.state}`} aria-label={`${day.localDate}: ${day.state}`}>
                  <small aria-hidden="true">{day.weekday}</small>
                  <span aria-hidden="true">{day.state === "completed" ? "✓" : day.state === "missed" ? "×" : day.state === "skipped" ? "–" : ""}</span>
                </span>)}
              </div>
              <div className="today-habit-actions">
                {missed ? (
                  <button
                    type="button"
                    onClick={() =>
                      onOpenHabit ? onOpenHabit(row.recordId) : onOpenHabits()
                    }
                  >
                    Open habit to review
                  </button>
                ) : complete || skipped ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      runConfirmedWrite(() =>
                        onClearCheckIn(row.recordId, localDate)
                      )
                    }
                  >
                    Undo
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        runConfirmedWrite(() =>
                          onCheckIn(row.recordId, localDate, "completed")
                        )
                      }
                    >
                      {row.cadence === "weekly_target" ? "Record today" : "Check in"}
                    </button>
                    <details className="today-habit-more">
                      <summary>Options</summary>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => runConfirmedWrite(() => onCheckIn(row.recordId, localDate, "skipped"))}
                      >Skip today</button>
                    </details>
                  </>
                )}
              </div>
            </article>
          );
        })}
        {!rows.length ? (
          <div className="today-habits-empty">
            <TimerReset aria-hidden="true" size={20} />
            <span>
              No habit needs action today. Open Habits for your full rhythm.
            </span>
          </div>
        ) : null}
      </div>
      {error ? (
        <p className="today-inline-error" role="alert">
          <span>{error} The last confirmed habit state remains visible.</span>
          <button type="button" onClick={() => runConfirmedWrite(onRetry)}>
            Retry
          </button>
        </p>
      ) : null}
      <section className="today-habit-activity" aria-labelledby="today-habit-activity-heading">
        <div className="today-habit-activity-intro">
          <div>
            <h3 id="today-habit-activity-heading">Recorded practice</h3>
            <p>Last 28 days · saved check-ins in this snapshot</p>
            <p><time dateTime={activity[0].localDate}>{activity[0].localDate}</time>–<time dateTime={localDate}>{localDate}</time> · {timezone} workspace dates</p>
          </div>
          <span aria-hidden="true">28 days</span>
        </div>
        <p className="today-habit-activity-note">{totals.completed} completed · {totals.missed} missed · {totals.skipped} skipped check-ins recorded in this period.</p>
        <div className="today-habit-activity-grid" aria-label="Habit check-ins by day">
          {activity.map(day => {
            const count = day.completed + day.missed + day.skipped;
            const categories = Number(day.completed > 0) + Number(day.missed > 0) + Number(day.skipped > 0);
            const tone = categories > 1 ? "mixed" : day.completed ? "completed" : day.missed ? "missed" : day.skipped ? "skipped" : "unrecorded";
            const label = `${day.localDate}: ${day.completed} completed, ${day.missed} missed, ${day.skipped} skipped${count ? "" : "; no record in loaded snapshot"}`;
            return <span key={day.localDate} role="img" className={`today-habit-activity-day is-${tone}`} aria-label={label} title={label} data-date={day.localDate} data-record-count={count} />;
          })}
        </div>
        <div className="today-habit-activity-key" aria-hidden="true"><span className="is-completed">Completed</span><span className="is-missed">Missed</span><span className="is-skipped">Skipped</span><span className="is-unrecorded">No record</span></div>
        <p className="today-habit-activity-note">Color follows recorded state. Blank means no record in the loaded snapshot.</p>
      </section>
    </section>
  );
}
