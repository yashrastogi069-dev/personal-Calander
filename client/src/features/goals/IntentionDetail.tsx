import { intentionPresentation, type GoalIntentionRecord } from "@shared/goalIntentions";

export function IntentionDetail({ goal }: { goal: GoalIntentionRecord }) {
  const presentation = intentionPresentation(goal);
  return <aside className="intention-detail" aria-label={`${presentation.label} detail`}><span>{presentation.label}</span><h3>{goal.title}</h3><p>{presentation.summary}</p>{presentation.details.map(detail => <div key={detail.label}><b>{detail.label}</b><span>{detail.value}</span></div>)}</aside>;
}
