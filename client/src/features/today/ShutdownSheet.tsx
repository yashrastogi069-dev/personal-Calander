// "Shut down day" (Q16: calm but strict). Step 1 wins; step 2 every open item gets Tomorrow / Pick day /
// Let go (an explicit "Move all to tomorrow" exists, but items pushed back 3+ times must be decided one by
// one); step 3 a one-line reflection, then Close day. Close day stays disabled until every item is decided.
import { ArrowLeft, ArrowRight, CalendarCheck2, Check, Flame, Moon, Timer, TriangleAlert } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Sheet } from "@/components/premium/Sheet";
import { cn } from "@/lib/utils";
import {
  applyMoveAll, capacityTime, isStrictItem, shutdownState, weekdayLabel,
  type ShutdownDecision, type ShutdownItem,
} from "./todayModel";

export type ShutdownWins = { doneCount: number; focusMinutes: number; habitsDone: number; habitsDue: number };

export type ShutdownSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  localDate: string;
  tomorrow: string;
  wins: ShutdownWins;
  items: readonly ShutdownItem[];
  initialReflection: string;
  busyWriting: boolean;
  onCloseDay: (decisions: Record<string, ShutdownDecision>, reflection: string) => Promise<boolean>;
};

export function ShutdownSheet(props: ShutdownSheetProps) {
  const { open, onOpenChange, localDate, tomorrow, wins, items, busyWriting } = props;
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [decisions, setDecisions] = useState<Record<string, ShutdownDecision | undefined>>({});
  const [reflection, setReflection] = useState("");
  useEffect(() => {
    if (!open) return;
    setStep(1); setDecisions({}); setReflection(props.initialReflection);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const state = useMemo(() => shutdownState(items, decisions), [items, decisions]);
  const strictCount = state.strictKeys.length;
  const closeReason = state.canClose ? null : `Decide ${state.undecidedCount} more ${state.undecidedCount === 1 ? "item" : "items"} first`;

  const set = (key: string, decision: ShutdownDecision | undefined) => setDecisions(current => ({ ...current, [key]: decision }));
  const close = async () => {
    if (!state.canClose) return;
    const final = Object.fromEntries(Object.entries(decisions).filter((entry): entry is [string, ShutdownDecision] => Boolean(entry[1])));
    await props.onCloseDay(final, reflection.trim());
  };

  const title = step === 1 ? "Today's wins" : step === 2 ? "Open items" : "Close the day";
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Shut down day" description={`Step ${step} of 3 · ${title}`} contentClassName="td-sheet td-shutdown" closeLabel="Close">
      <ol className="td-steps" aria-label="Shutdown progress">
        {[1, 2, 3].map(index => <li key={index} className={cn(index === step && "is-current", index < step && "is-done")} aria-current={index === step ? "step" : undefined}><span className="pc-sr-only">Step {index}</span></li>)}
      </ol>
      <div className="td-sheet-scroll" data-shutdown-step={step}>
        {step === 1 ? (
          <div className="td-wins">
            <div className="td-win pc-pop" style={{ ["--pc-i" as string]: 0 }}><span className="pc-icon-tile pc-tone-accent" aria-hidden="true"><CalendarCheck2 size={16} strokeWidth={2} /></span><strong className="pc-num" data-win="done">{wins.doneCount}</strong><small>{wins.doneCount === 1 ? "task done" : "tasks done"}</small></div>
            <div className="td-win pc-pop" style={{ ["--pc-i" as string]: 1 }}><span className="pc-icon-tile pc-tone-learning" aria-hidden="true"><Timer size={16} strokeWidth={2} /></span><strong className="pc-num" data-win="focus">{capacityTime(wins.focusMinutes)}</strong><small>focused</small></div>
            <div className="td-win pc-pop" style={{ ["--pc-i" as string]: 2 }}><span className="pc-icon-tile pc-tone-health" aria-hidden="true"><Flame size={16} strokeWidth={2} /></span><strong className="pc-num" data-win="habits">{wins.habitsDue ? `${wins.habitsDone}/${wins.habitsDue}` : "—"}</strong><small>habits</small></div>
          </div>
        ) : null}
        {step === 2 ? (
          <>
            <div className="td-shut-bar">
              <span className="pc-num" data-decided-count="">{state.decidedCount} of {state.total} decided</span>
              {state.total ? (
                <button type="button" className="tk-btn is-quiet" data-move-all="" disabled={!state.moveAllKeys.length} onClick={() => setDecisions(current => applyMoveAll(items, current))}>
                  Move all to tomorrow
                </button>
              ) : null}
            </div>
            {strictCount ? (
              <p className="td-shut-strict" role="note"><TriangleAlert size={15} strokeWidth={2} aria-hidden="true" />
                {strictCount === 1 ? "One item has" : `${strictCount} items have`} been pushed back {3}+ times. Pick a real day or let it go; Move all skips it.
              </p>
            ) : null}
            {items.length ? (
              <ul className="td-decide-list">
                {items.map(item => {
                  const decision = decisions[item.key];
                  const strict = isStrictItem(item);
                  return (
                    <li key={item.key} className={cn("td-decide", strict && "is-strict", decision && "is-decided")} data-shutdown-item={item.key} data-carry-count={item.carryCount}>
                      <div className="td-decide-text">
                        <strong>{item.title}</strong>
                        <small>
                          {item.fromLocalDate && item.fromLocalDate < localDate ? `From ${weekdayLabel(item.fromLocalDate)}` : "Today"}
                          {item.carryCount ? <span className={cn("td-carry", strict && "is-strict")}> · Pushed back {item.carryCount} {item.carryCount === 1 ? "time" : "times"}</span> : null}
                        </small>
                      </div>
                      <div className="td-seg" role="group" aria-label={`Decide ${item.title}`}>
                        <button type="button" className={cn("td-seg-btn pc-focusable", decision?.kind === "tomorrow" && "is-on")} aria-pressed={decision?.kind === "tomorrow"}
                          disabled={strict} title={strict ? "Pushed back 3+ times: pick a day or let it go" : undefined} data-decision="tomorrow" onClick={() => set(item.key, { kind: "tomorrow" })}>Tomorrow</button>
                        <label className={cn("td-seg-btn td-seg-date pc-focusable", decision?.kind === "pick" && "is-on")} data-decision="pick">
                          <span>{decision?.kind === "pick" && decision.localDate ? weekdayLabel(decision.localDate) + " " + decision.localDate.slice(8) : "Pick day"}</span>
                          <input type="date" min={tomorrow} value={decision?.kind === "pick" ? decision.localDate : ""} aria-label={`Pick a day for ${item.title}`}
                            onChange={event => set(item.key, event.target.value ? { kind: "pick", localDate: event.target.value } : undefined)} />
                        </label>
                        <button type="button" className={cn("td-seg-btn pc-focusable", decision?.kind === "let_go" && "is-on")} aria-pressed={decision?.kind === "let_go"}
                          data-decision="let_go" onClick={() => set(item.key, { kind: "let_go" })}>Let go</button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : <p className="td-sheet-empty"><Check size={16} strokeWidth={2} aria-hidden="true" />Nothing left open. Clean finish.</p>}
          </>
        ) : null}
        {step === 3 ? (
          <div className="td-reflect">
            <label htmlFor="td-reflection">One line about today <small>optional</small></label>
            <input id="td-reflection" className="td-input" maxLength={280} value={reflection} placeholder="What went well, or what to change tomorrow" onChange={event => setReflection(event.target.value)} />
            <p className="td-reflect-note">{state.total ? `${state.decidedCount} of ${state.total} open items decided.` : "No open items to carry."} You can reopen the day from the ⋯ menu.</p>
          </div>
        ) : null}
      </div>
      <footer className="td-sheet-foot">
        {step > 1 ? <button type="button" className="tk-btn is-quiet" onClick={() => setStep(current => (current - 1) as 1 | 2)} disabled={busyWriting}><ArrowLeft size={16} strokeWidth={2} aria-hidden="true" />Back</button> : <span />}
        <span className="td-foot-note pc-num" data-close-reason="">{step === 3 && closeReason ? closeReason : ""}</span>
        {step < 3 ? (
          <button type="button" className="tk-btn is-accent" onClick={() => setStep(current => (current + 1) as 2 | 3)} data-shutdown-next="">Continue<ArrowRight size={16} strokeWidth={2} aria-hidden="true" /></button>
        ) : (
          <button type="button" className="tk-btn is-accent" data-close-day="" disabled={!state.canClose || busyWriting} aria-describedby={closeReason ? undefined : undefined} title={closeReason ?? undefined} onClick={() => void close()}>
            <Moon size={16} strokeWidth={2} aria-hidden="true" />Close day
          </button>
        )}
      </footer>
    </Sheet>
  );
}
