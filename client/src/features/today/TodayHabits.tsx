import type { TodayProjection } from "@shared/todayProjection";
import { Check, Circle, RotateCcw, TimerReset } from "lucide-react";
import type { CSSProperties } from "react";

export type TodayHabitsProps = {
  rows: TodayProjection["habits"];
  habits: Array<{ id: string; name: string; color?: string | null }>;
  localDate: string;
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
  localDate,
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
  const habitById = new Map(habits.map(habit => [habit.id, habit]));
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
          <span>Daily practice</span>
          <h2 id="today-habits-heading">Today’s habits</h2>
        </div>
        <button type="button" onClick={onOpenHabits}>
          Open habits
        </button>
      </header>
      <div className="today-habit-list">
        {rows.map(row => {
          const habit = habitById.get(row.recordId);
          const complete = row.state === "completed";
          const skipped = row.state === "skipped";
          const missed = row.state === "missed";
          return (
            <article
              className={`today-habit-row${complete ? " is-complete" : skipped ? " is-skipped" : missed ? " is-missed" : ""}`}
              key={row.recordId}
              data-habit-record-id={row.recordId}
            >
              <span
                className="today-habit-mark"
                style={
                  {
                    "--habit-color": habit?.color ?? "#2f8b6c",
                  } as CSSProperties
                }
                aria-hidden="true"
              >
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
              <div>
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
                    ? `${row.weekProgress.completed} of ${row.weekProgress.target} this week · ${Math.max(0, row.weekProgress.target - row.weekProgress.completed) ? `${Math.max(0, row.weekProgress.target - row.weekProgress.completed)} remaining` : "target met"}${complete ? " · completed today" : skipped ? " · intentionally skipped today" : missed ? " · recorded missed today" : " · flexible opportunity"}`
                    : complete
                      ? "Completed today"
                      : skipped
                        ? "Intentionally skipped today"
                        : missed
                          ? "Recorded missed today · review the record to change it"
                          : "Due · scheduled habit"}
                </small>
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
                      {row.cadence === "weekly_target"
                        ? "Record today"
                        : "Complete"}
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        runConfirmedWrite(() =>
                          onCheckIn(row.recordId, localDate, "skipped")
                        )
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
    </section>
  );
}
