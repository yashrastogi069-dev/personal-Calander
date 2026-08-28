import { trpc } from "@/lib/trpc";
import { getWorkspaceScope } from "@/lib/workspace";
import { reviewChecklistFromSnapshot, weeklyReviewChecklistItems, weeklyReviewChecklistProgress, type WeeklyReviewChecklist } from "@shared/reviewChecklist";
import { CheckCircle2, Circle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import "./review-checklist.css";

export function ReviewChecklist({ review, onUpdated }: { review: any; onUpdated: (review: any) => void }) {
  const scope = useMemo(() => getWorkspaceScope(), []);
  const utils = trpc.useUtils();
  const [checklist, setChecklist] = useState<WeeklyReviewChecklist>(() => reviewChecklistFromSnapshot(review.snapshot));
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { setChecklist(reviewChecklistFromSnapshot(review.snapshot)); setError(null); }, [review.id, review.version, review.snapshot]);
  const update = trpc.planner.review.updateChecklist.useMutation({
    onSuccess: updated => { setError(null); onUpdated(updated); utils.planner.workspace.snapshot.invalidate(); utils.planner.dashboard.invalidate(); },
    onError: mutationError => { setChecklist(reviewChecklistFromSnapshot(review.snapshot)); setError(mutationError.message || "The review checklist was not saved. Your stored checklist was restored; try again."); },
  });
  const progress = weeklyReviewChecklistProgress(checklist);
  const groups = ["Get clear", "Get current", "Set direction"] as const;
  const toggle = (id: keyof WeeklyReviewChecklist) => {
    if (update.isPending) return;
    const next = { ...checklist, [id]: !checklist[id] };
    setChecklist(next);
    setError(null);
    update.mutate({ ...scope, id: review.id, expectedVersion: review.version, checklist: next });
  };
  return <section className="review-checklist" aria-labelledby="review-checklist-heading">
    <header><div><span>Weekly review path</span><h3 id="review-checklist-heading">Get clear. Get current. Set direction.</h3><p>Five small checks make the reflection useful without creating tasks or changing your plan automatically.</p></div><strong aria-label={`${progress.completed} of ${progress.total} review checks complete`}>{progress.completed}<small>/{progress.total}</small></strong></header>
    <div className="review-checklist-groups">{groups.map(stage => <div className="review-checklist-group" key={stage}><h4>{stage}</h4>{weeklyReviewChecklistItems.filter(item => item.stage === stage).map(item => <label key={item.id} className="review-checklist-item"><input type="checkbox" checked={checklist[item.id]} onChange={() => toggle(item.id)} disabled={update.isPending} /><span aria-hidden="true">{checklist[item.id] ? <CheckCircle2 size={17} /> : <Circle size={17} />}</span><span><b>{item.label}</b><small>{item.detail}</small></span></label>)}</div>)}</div>
    <p className="review-checklist-status" aria-live="polite">{update.isPending ? "Saving checklist…" : error ?? (progress.completed === progress.total ? "Review path complete. Capture the useful insight below." : `${progress.total - progress.completed} check${progress.total - progress.completed === 1 ? "" : "s"} remain before closing this review.`)}</p>
  </section>;
}
