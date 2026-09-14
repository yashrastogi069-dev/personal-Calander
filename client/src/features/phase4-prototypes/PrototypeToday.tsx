import { Activity, AlertTriangle, CalendarClock, Check, ChevronRight, Circle, Clock3, Feather, RotateCcw, Sparkles } from "lucide-react";
import { phase4PrototypeFixture, type PrototypeAction, type PrototypeState } from "@shared/phase4Prototype";
import type { Dispatch } from "react";

type PrototypeTodayProps = {
  state: PrototypeState;
  dispatch: Dispatch<PrototypeAction>;
  recoveryChoice: string | null;
};

export default function PrototypeToday({ state, dispatch, recoveryChoice }: PrototypeTodayProps) {
  const taskId = "read-lease";
  const isComplete = state.completedTaskIds.includes(taskId);
  const openRecovery = () => dispatch({ type: "open-recovery", commitmentId: "commitment-reply" });

  return (
    <div className="p4-today">
      <header className="p4-page-intro">
        <div>
          <p className="p4-kicker">Home / Today</p>
          <h2>A workable Monday,<br /><em>after the plan changed.</em></h2>
          <p>Fixed time first, flexible work second. Nothing unresolved is moved silently.</p>
        </div>
        <div className="p4-day-stamp" aria-label="Monday 14 September 2026">
          <span>MON</span><strong>14</strong><small>SEP · 2026</small>
        </div>
      </header>

      <section className="p4-day-strip" aria-label="Day capacity summary">
        <div><span>Capacity</span><strong>Low · 90 min</strong><small>1 estimate unknown</small></div>
        <div><span>Commitments</span><strong>2 chosen</strong><small>1 needs recovery</small></div>
        <div><span>Reserved</span><strong>1 hr 45 min</strong><small>includes actual overrun</small></div>
        <div className="p4-capacity-mark" aria-hidden="true"><i /><i /><i /><i /><i /></div>
      </section>

      <section className="p4-recovery-entry" aria-labelledby="p4-recovery-entry-title">
        <div className="p4-recovery-number">01</div>
        <div>
          <span className="p4-status p4-status-warning"><AlertTriangle aria-hidden="true" />Needs a decision</span>
          <h3 id="p4-recovery-entry-title">The afternoon no longer fits</h3>
          <p>{phase4PrototypeFixture.interruptedAfternoon.message}</p>
        </div>
        {recoveryChoice ? (
          <button type="button" data-testid="resume-recovery" onClick={openRecovery}>Resume {recoveryChoice} preview <ChevronRight aria-hidden="true" /></button>
        ) : (
          <button type="button" data-testid="open-recovery" onClick={openRecovery}>Resolve remaining work <ChevronRight aria-hidden="true" /></button>
        )}
      </section>

      <div className="p4-today-composition">
        <section className="p4-agenda" aria-labelledby="p4-agenda-title">
          <header className="p4-section-heading">
            <div><p className="p4-kicker">Chronology</p><h3 id="p4-agenda-title">Reservations & appointments</h3></div>
            <span>Workspace time · IST</span>
          </header>
          <div className="p4-time-rule" aria-hidden="true"><span>12</span><span>14</span><span>16</span><span>18</span></div>
          <ol className="p4-agenda-list">
            <li className="is-overrun">
              <time dateTime="2026-09-14T13:00:00+05:30">13:00</time>
              <div className="p4-agenda-line"><i /></div>
              <article>
                <span className="p4-status p4-status-warning">Appointment · ran 45 min over</span>
                <h4>Dentist appointment</h4>
                <p>13:00–14:45 actual · fixed context</p>
              </article>
            </li>
            <li>
              <time dateTime="2026-09-14T17:30:00+05:30">17:30</time>
              <div className="p4-agenda-line"><i /></div>
              <article>
                <span className="p4-status"><CalendarClock aria-hidden="true" />Reserved</span>
                <h4>Quarterly project review</h4>
                <p>17:30–18:15 · scheduled</p>
              </article>
            </li>
          </ol>
        </section>

        <aside className="p4-flexible" aria-labelledby="p4-flexible-title">
          <header className="p4-section-heading">
            <div><p className="p4-kicker">Flexible work</p><h3 id="p4-flexible-title">Choose what fits</h3></div>
            <span>3 items</span>
          </header>
          <div className={isComplete ? "p4-action-row is-complete" : "p4-action-row"}>
            <button
              type="button"
              className="p4-task-check"
              data-testid="task-toggle-read-lease"
              aria-label={isComplete ? "Reopen lease review" : "Complete lease review"}
              aria-pressed={isComplete}
              onClick={() => dispatch({ type: isComplete ? "reopen-task" : "complete-task", taskId })}
            >
              {isComplete ? <Check aria-hidden="true" /> : <Circle aria-hidden="true" />}
            </button>
            <button className="p4-row-main" type="button" data-testid="open-task-detail" onClick={() => dispatch({ type: "open-sheet", sheet: "task" })}>
              <span>{phase4PrototypeFixture.tasks[1].title}</span>
              <small>Unknown estimate · planned today</small>
            </button>
            <ChevronRight aria-hidden="true" />
          </div>
          <div className="p4-action-row">
            <span className="p4-task-check" aria-hidden="true"><Circle /></span>
            <div className="p4-row-main"><span>Buy groceries for the week</span><small>35 min · errand</small></div>
            <ChevronRight aria-hidden="true" />
          </div>
          <div className="p4-action-row p4-goal-action">
            <span className="p4-task-check" aria-hidden="true"><Circle /></span>
            <div className="p4-row-main"><span>Book the first preventative health screening</span><small><Feather aria-hidden="true" /> Goal next action · 20 min</small></div>
            <ChevronRight aria-hidden="true" />
          </div>
        </aside>
      </div>

      <section className="p4-habits" aria-labelledby="p4-habits-title">
        <header className="p4-section-heading"><div><p className="p4-kicker">Due practices</p><h3 id="p4-habits-title">Habits stay habits</h3></div><span>1 of 2 done</span></header>
        <div className="p4-habit-row"><span><Check aria-hidden="true" /></span><strong>Morning walk</strong><small>Done · next opportunity tomorrow</small></div>
        <div className="p4-habit-row"><span><Activity aria-hidden="true" /></span><strong>Take medicine</strong><small>Due · daily schedule</small></div>
      </section>

      <details className="p4-evidence">
        <summary><span><Sparkles aria-hidden="true" />Completed today</span><span>2 evidence records</span></summary>
        <div><RotateCcw aria-hidden="true" /><p><strong>Plan evidence is collapsed by default.</strong> Earlier completion remains inspectable without competing with the next decision.</p></div>
      </details>
    </div>
  );
}
