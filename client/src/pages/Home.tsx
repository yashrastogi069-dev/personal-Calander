import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { displayLocalDate, getWorkspaceScope, localDateInTimezone, shiftLocalDate, type WorkspaceScope } from "@/lib/workspace";
import { trpc } from "@/lib/trpc";
import { isHabitScheduledOnLocalDate } from "@shared/habitSchedule";
import {
  ArrowDownUp,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Clock3,
  Command,
  Flag,
  Goal,
  Grid2X2,
  Inbox,
  ListFilter,
  Loader2,
  MoreHorizontal,
  Plus,
  Search,
  Sparkles,
  Target,
  TimerReset,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis } from "recharts";

type Surface = "today" | "tasks" | "calendar" | "goals" | "habits" | "review";
type ComposerKind = "task" | "goal" | "project" | "habit";
type CalendarMode = "Day" | "Week" | "Month" | "Quarter" | "Year";

const navItems: { id: Surface; label: string; icon: typeof Grid2X2 }[] = [
  { id: "today", label: "Today", icon: Grid2X2 },
  { id: "tasks", label: "Tasks", icon: Inbox },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
  { id: "goals", label: "Goals", icon: Target },
  { id: "habits", label: "Habits", icon: TimerReset },
  { id: "review", label: "Review", icon: Sparkles },
];

const priorityMeta = {
  none: { label: "No priority", className: "text-stone-400" },
  low: { label: "Low", className: "text-sky-300" },
  medium: { label: "Medium", className: "text-amber-300" },
  high: { label: "High", className: "text-orange-300" },
  critical: { label: "Critical", className: "text-rose-300" },
} as const;

function isoRange(today: string) {
  return { start: shiftLocalDate(today, -27), end: shiftLocalDate(today, 28) };
}

function shortTime(date: Date | null) {
  if (!date) return null;
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(date));
}

function EmptyState({ title, detail, action, actionLabel = "Create" }: { title: string; detail: string; action?: () => void; actionLabel?: string }) {
  const content = <><span className="empty-state-mark" aria-hidden="true"><Plus size={18} strokeWidth={1.7} /></span><span><span className="empty-state-title">{title}</span><span className="empty-state-copy">{detail}</span></span>{action ? <span className="empty-state-action">{actionLabel}</span> : null}</>;
  return action ? <button type="button" className="empty-state empty-state-trigger" onClick={action} aria-label={`${actionLabel}: ${title}`}>{content}</button> : <div className="empty-state">{content}</div>;
}

function LoadingBoard() {
  return (
    <div className="planner-loading" aria-busy="true" aria-label="Loading planning workspace">
      <div className="loading-rail" />
      <main className="loading-main"><div className="loading-top" /><div className="loading-columns"><div /><div /></div></main>
    </div>
  );
}

function TaskCheck({ checked, onClick, label }: { checked: boolean; onClick: () => void; label: string }) {
  return <button className={cn("task-check", checked && "is-checked")} onClick={onClick} aria-label={`${checked ? "Reopen" : "Complete"} ${label}`}><Check size={12} strokeWidth={3} /></button>;
}

function TaskRow({ task, categoryColor, onToggle, onSchedule }: { task: any; categoryColor?: string; onToggle: (task: any) => void; onSchedule?: (task: any, date: string) => void }) {
  const completed = task.state === "completed";
  const priority = priorityMeta[task.priority as keyof typeof priorityMeta] ?? priorityMeta.none;
  const [editorOpen, setEditorOpen] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [dueLocalDate, setDueLocalDate] = useState(task.dueLocalDate ?? "");
  const [scheduledLocalDate, setScheduledLocalDate] = useState(task.scheduledLocalDate ?? "");
  const [estimateMinutes, setEstimateMinutes] = useState(task.estimateMinutes?.toString() ?? "");
  const [state, setState] = useState(task.state);
  const [recurrenceFrequency, setRecurrenceFrequency] = useState("none");
  const [recurrenceInterval, setRecurrenceInterval] = useState("1");
  const [recurrenceUntil, setRecurrenceUntil] = useState("");
  const scope = useMemo(() => getWorkspaceScope(), []);
  const utils = trpc.useUtils();
  const saveTask = trpc.planner.task.update.useMutation({ onSuccess: () => { utils.planner.workspace.snapshot.invalidate(); utils.planner.dashboard.invalidate(); setEditorOpen(false); } });
  const createSubtask = trpc.planner.task.create.useMutation({ onSuccess: () => { utils.planner.workspace.snapshot.invalidate(); utils.planner.dashboard.invalidate(); } });

  useEffect(() => { const rule = task.recurrenceRule as Record<string, unknown> | null; const frequency = rule?.frequency; setTitle(task.title); setDueLocalDate(task.dueLocalDate ?? ""); setScheduledLocalDate(task.scheduledLocalDate ?? ""); setEstimateMinutes(task.estimateMinutes?.toString() ?? ""); setState(task.state); setRecurrenceFrequency(frequency === "daily" || frequency === "weekly" || frequency === "monthly" ? frequency : "none"); setRecurrenceInterval(String(Math.max(1, Number(rule?.interval) || 1))); setRecurrenceUntil(task.recurrenceUntilLocalDate ?? ""); }, [task]);
  const submit = (event: FormEvent) => { event.preventDefault(); if (!title.trim()) return; const recurrenceRule = recurrenceFrequency === "none" ? null : { frequency: recurrenceFrequency, interval: Math.max(1, Number(recurrenceInterval) || 1) }; saveTask.mutate({ ...scope, id: task.id, expectedVersion: task.version, patch: { title: title.trim(), dueLocalDate: dueLocalDate || null, scheduledLocalDate: scheduledLocalDate || null, estimateMinutes: estimateMinutes ? Number(estimateMinutes) : null, state, recurrenceRule, recurrenceAnchor: recurrenceRule ? "scheduled" : null, recurrenceUntilLocalDate: recurrenceRule ? recurrenceUntil || null : null } }); };
  const addSubtask = () => { const subtaskTitle = window.prompt(`Add a subtask beneath “${task.title}”`); if (!subtaskTitle?.trim()) return; createSubtask.mutate({ ...scope, title: subtaskTitle.trim(), parentTaskId: task.id, goalId: task.goalId, projectId: task.projectId, categoryId: task.categoryId, state: "not_started", priority: task.priority, horizon: task.horizon, sortOrder: task.sortOrder + 1 }); };

  return <><article className={cn("task-row", completed && "is-complete")} draggable={!completed && Boolean(onSchedule)} onDragStart={event => event.dataTransfer.setData("text/plain", task.id)}>
    <TaskCheck checked={completed} label={task.title} onClick={() => onToggle(task)} />
    <div className="task-row-main"><p className="task-row-title">{task.title}</p><div className="task-row-meta">{categoryColor ? <span className="category-dot" style={{ backgroundColor: categoryColor }} /> : null}{task.dueLocalDate ? <span>{task.dueLocalDate}</span> : <span>Unscheduled</span>}{task.estimateMinutes ? <span>{task.estimateMinutes}m</span> : null}{task.state === "blocked" ? <span className="blocked-mark">Blocked</span> : null}</div></div>
    <Tooltip><TooltipTrigger asChild><button className="task-priority" aria-label={`${priority.label} priority`}><Flag size={14} className={priority.className} /></button></TooltipTrigger><TooltipContent>{priority.label} priority</TooltipContent></Tooltip>
    <div className="task-row-actions"><button className="icon-quiet" aria-label={`Add a subtask to ${task.title}`} onClick={addSubtask}><Plus size={15} /></button><button className="icon-quiet" aria-label={`Edit ${task.title}`} onClick={() => setEditorOpen(true)}><MoreHorizontal size={17} /></button></div>
  </article><Dialog open={editorOpen} onOpenChange={setEditorOpen}><DialogContent className="composer-dialog small-dialog"><DialogHeader><DialogTitle>Refine the commitment</DialogTitle><DialogDescription>Dates, time intent, and recurrence each carry a different planning meaning.</DialogDescription></DialogHeader><form className="composer-form" onSubmit={submit}><div className="field"><Label htmlFor={`task-title-${task.id}`}>Task</Label><Input id={`task-title-${task.id}`} value={title} onChange={event => setTitle(event.target.value)} /></div><div className="field"><Label>State</Label><Select value={state} onValueChange={setState}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["not_started", "in_progress", "blocked", "completed", "archived"].map(value => <SelectItem key={value} value={value}>{value.replace("_", " ")}</SelectItem>)}</SelectContent></Select></div><div className="field-grid"><div className="field"><Label htmlFor={`task-due-${task.id}`}>Due date</Label><Input id={`task-due-${task.id}`} type="date" value={dueLocalDate} onChange={event => setDueLocalDate(event.target.value)} /></div><div className="field"><Label htmlFor={`task-plan-${task.id}`}>Planned date</Label><Input id={`task-plan-${task.id}`} type="date" value={scheduledLocalDate} onChange={event => setScheduledLocalDate(event.target.value)} /></div></div><div className="field"><Label htmlFor={`task-estimate-${task.id}`}>Estimate in minutes</Label><Input id={`task-estimate-${task.id}`} type="number" min="0" max="1440" value={estimateMinutes} onChange={event => setEstimateMinutes(event.target.value)} /></div><div className="recurrence-fields"><div className="field"><Label>Repeat</Label><Select value={recurrenceFrequency} onValueChange={setRecurrenceFrequency}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Does not repeat</SelectItem><SelectItem value="daily">Daily</SelectItem><SelectItem value="weekly">Weekly</SelectItem><SelectItem value="monthly">Monthly</SelectItem></SelectContent></Select></div>{recurrenceFrequency !== "none" ? <><div className="field"><Label htmlFor={`task-recurrence-interval-${task.id}`}>Every</Label><Input id={`task-recurrence-interval-${task.id}`} type="number" min="1" max="365" value={recurrenceInterval} onChange={event => setRecurrenceInterval(event.target.value)} /></div><div className="field"><Label htmlFor={`task-recurrence-until-${task.id}`}>Stop after</Label><Input id={`task-recurrence-until-${task.id}`} type="date" value={recurrenceUntil} onChange={event => setRecurrenceUntil(event.target.value)} /></div><p className="recurrence-help">Occurrences use the planned date when set; otherwise, they follow the due date.</p></> : null}</div><div className="composer-submit"><Button type="button" variant="ghost" onClick={() => setEditorOpen(false)}>Cancel</Button><Button type="submit" className="primary-action" disabled={saveTask.isPending}>{saveTask.isPending ? "Saving…" : "Save changes"}</Button></div></form></DialogContent></Dialog></>;
}

function DailyCompass() {
  const scope = useMemo(() => getWorkspaceScope(), []);
  const [today] = useState(() => localDateInTimezone(scope.timezone));
  const [intention, setIntention] = useState("");
  const [energy, setEnergy] = useState("3");
  const [mood, setMood] = useState("3");
  const checkIn = trpc.planner.dailyCheckIn.upsert.useMutation();
  const submit = (event: FormEvent) => { event.preventDefault(); checkIn.mutate({ ...scope, localDate: today, intention: intention.trim() || null, energy: Number(energy), mood: Number(mood) }); };
  return <form className="daily-compass" onSubmit={submit}><div className="daily-compass-copy"><span>Daily signal</span><p>Set the conditions, not just the list.</p></div><Input value={intention} onChange={event => setIntention(event.target.value)} placeholder="One sentence for today" aria-label="Daily intention" /><div className="daily-compass-controls"><label>Energy<Select value={energy} onValueChange={setEnergy}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{[1, 2, 3, 4, 5].map(value => <SelectItem key={value} value={String(value)}>{value}/5</SelectItem>)}</SelectContent></Select></label><label>Mood<Select value={mood} onValueChange={setMood}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{[1, 2, 3, 4, 5].map(value => <SelectItem key={value} value={String(value)}>{value}/5</SelectItem>)}</SelectContent></Select></label><Button type="submit" variant="ghost" disabled={checkIn.isPending}>{checkIn.isPending ? "Saving" : "Check in"}</Button></div></form>;
}

function RecurringWorkControl() {
  const scope = useMemo(() => getWorkspaceScope(), []);
  const [today] = useState(() => localDateInTimezone(scope.timezone));
  const utils = trpc.useUtils();
  const materialize = trpc.planner.occurrence.materialize.useMutation({ onSuccess: () => { utils.planner.workspace.snapshot.invalidate(); utils.planner.dashboard.invalidate(); } });
  const end = shiftLocalDate(today, 28);
  return <div className="recurrence-control"><span>Recurring work</span><p>{materialize.data ? `${materialize.data.length} dated occurrences are ready through ${end}.` : "Generate the next four weeks of scheduled repetitions."}</p><Button type="button" variant="ghost" onClick={() => materialize.mutate({ ...scope, start: today, end })} disabled={materialize.isPending}>{materialize.isPending ? "Refreshing…" : "Refresh series"}</Button></div>;
}

function ReviewRitual({ sessions }: { sessions: any[] }) {
  const scope = useMemo(() => getWorkspaceScope(), []);
  const [today] = useState(() => localDateInTimezone(scope.timezone));
  const [localReview, setLocalReview] = useState<any>(null);
  const [reflection, setReflection] = useState("");
  const utils = trpc.useUtils();
  const activeFromSnapshot = sessions.find(session => session.kind === "weekly" && session.state === "in_progress") ?? null;
  const review = localReview ?? activeFromSnapshot;
  const completedReviews = sessions.filter(session => session.kind === "weekly" && session.state === "completed").slice(0, 3);
  const refresh = () => utils.planner.workspace.snapshot.invalidate();
  const start = trpc.planner.review.start.useMutation({ onSuccess: session => { setLocalReview(session); refresh(); } });
  const complete = trpc.planner.review.complete.useMutation({ onSuccess: session => { setLocalReview(session); refresh(); } });
  const periodStartLocalDate = shiftLocalDate(today, -6);
  const history = completedReviews.length ? <div className="review-history" aria-label="Recent completed weekly reviews"><span>Recent completed reviews</span>{completedReviews.map(session => <div key={session.id}><strong>{session.periodStartLocalDate} → {session.periodEndLocalDate}</strong><p>{session.reflection || "Completed without a written reflection."}</p></div>)}</div> : null;
  if (!review) return <div className="review-ritual"><div><span>Weekly review</span><p>Clear the week, name what changed, and choose one honest next move.</p></div><Button type="button" variant="ghost" onClick={() => start.mutate({ ...scope, kind: "weekly", periodStartLocalDate, periodEndLocalDate: today, snapshot: { openPeriod: true } })} disabled={start.isPending}>{start.isPending ? "Opening…" : "Begin review"}</Button>{history}</div>;
  if (review.state === "completed") return <div className="review-ritual"><div><span>Weekly review</span><p>Reflection saved. The next review can begin when you are ready.</p></div><Button type="button" variant="ghost" onClick={() => { setLocalReview(null); setReflection(""); }}>New review</Button>{history}</div>;
  return <div className="review-ritual is-active"><span>Weekly review · {review.periodStartLocalDate} to {review.periodEndLocalDate}</span><textarea value={reflection} onChange={event => setReflection(event.target.value)} placeholder="What moved, what was blocked, and what will change next week?" aria-label="Weekly review reflection" /><Button type="button" className="primary-action" onClick={() => complete.mutate({ ...scope, id: review.id, expectedVersion: review.version, reflection: reflection.trim() || null })} disabled={complete.isPending}>{complete.isPending ? "Saving…" : "Close review"}</Button>{history}</div>;
}

function PlanningHealthStrip() {
  const scope = useMemo(() => getWorkspaceScope(), []);
  const [today] = useState(() => localDateInTimezone(scope.timezone));
  const range = useMemo(() => isoRange(today), [today]);
  const dashboard = trpc.planner.dashboard.useQuery({ ...scope, todayLocalDate: today, rangeStart: range.start, rangeEnd: range.end });
  const health = dashboard.data?.planningHealth;
  if (!health) return null;
  const advice = health.blockedCount ? "Unblock one stalled item before adding new work." : health.carryoverCount ? "Reschedule carryover deliberately, then protect one focus task." : health.focusCompletionRate === 100 && health.completedToday ? "Today’s planned work is moving. Keep the next commitment small." : "Choose one protected focus before the day expands.";
  return <div className="planning-health"><div><span>Plan health</span><p>{advice}</p></div><dl><div><dt>Carryover</dt><dd>{health.carryoverCount}</dd></div><div><dt>Blocked</dt><dd>{health.blockedCount}</dd></div><div><dt>Focus</dt><dd>{health.focusCompletionRate}%</dd></div></dl></div>;
}

function DecisionSignals() {
  const scope = useMemo(() => getWorkspaceScope(), []);
  const [today] = useState(() => localDateInTimezone(scope.timezone));
  const range = useMemo(() => isoRange(today), [today]);
  const dashboard = trpc.planner.dashboard.useQuery({ ...scope, todayLocalDate: today, rangeStart: range.start, rangeEnd: range.end });
  const signals = dashboard.data?.decisionSignals;
  if (!signals) return null;
  const reliability = signals.scheduleReliability === null ? "No scheduled history" : `${signals.scheduleReliability}% kept`;
  const advice = signals.carryoverRate >= 35 ? "Reduce the next plan before adding more commitments." : signals.estimateCoverage < 60 ? "Add estimates to make capacity guidance more useful." : signals.averageBlockedAgeDays >= 3 ? "Resolve or deliberately close ageing blocked work." : "Your plan has enough signal for a deliberate next move.";
  return <div className="decision-signals"><div><span>Decision signals</span><p>{advice}</p></div><dl><div><dt>Reliability</dt><dd>{reliability}</dd></div><div><dt>Carryover</dt><dd>{signals.carryoverRate}%</dd></div><div><dt>Estimated</dt><dd>{signals.estimateCoverage}%</dd></div></dl></div>;
}

function TaskTriagePanel() {
  const scope = useMemo(() => getWorkspaceScope(), []);
  const [today] = useState(() => localDateInTimezone(scope.timezone));
  const range = useMemo(() => ({ start: shiftLocalDate(today, -31), end: shiftLocalDate(today, 31) }), [today]);
  const utils = trpc.useUtils();
  const snapshot = trpc.planner.workspace.snapshot.useQuery({ ...scope, ...range });
  const [filter, setFilter] = useState("open");
  const [sort, setSort] = useState("priority");
  const [selected, setSelected] = useState<string[]>([]);
  const bulk = trpc.planner.task.bulkSetState.useMutation({ onSuccess: () => { setSelected([]); utils.planner.workspace.snapshot.invalidate(); utils.planner.dashboard.invalidate(); } });
  const createView = trpc.planner.savedView.create.useMutation({ onSuccess: () => utils.planner.workspace.snapshot.invalidate() });
  const updateView = trpc.planner.savedView.update.useMutation({ onSuccess: () => utils.planner.workspace.snapshot.invalidate() });
  const deleteView = trpc.planner.savedView.delete.useMutation({ onSuccess: () => utils.planner.workspace.snapshot.invalidate() });
  const priorityRank: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, none: 4 };
  const allTasks = snapshot.data?.tasks ?? [];
  const filtered = allTasks.filter(task => filter === "today" ? task.scheduledLocalDate === today || task.dueLocalDate === today : filter === "risk" ? Boolean(task.dueLocalDate && task.dueLocalDate < today && task.state !== "completed" && task.state !== "archived") : filter === "open" ? task.state !== "completed" && task.state !== "archived" : task.state !== "archived");
  const rows = [...filtered].sort((a, b) => sort === "due" ? (a.dueLocalDate ?? "9999-12-31").localeCompare(b.dueLocalDate ?? "9999-12-31") : sort === "scheduled" ? (a.scheduledLocalDate ?? "9999-12-31").localeCompare(b.scheduledLocalDate ?? "9999-12-31") : sort === "created" ? Number(new Date(b.createdAt).getTime()) - Number(new Date(a.createdAt).getTime()) : (priorityRank[a.priority] ?? 5) - (priorityRank[b.priority] ?? 5));
  const toggle = (id: string) => setSelected(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]);
  const applyView = (view: any) => { const config = view.configuration as { filter?: string; sort?: string }; setFilter(config.filter ?? "open"); setSort(config.sort ?? "priority"); };
  const views = (snapshot.data?.savedViews ?? []).filter(view => view.viewType === "tasks");
  const saveCurrent = () => { const name = window.prompt("Name this task view. Reuse a name to overwrite its filter and sort."); if (!name?.trim()) return; const existing = views.find(view => view.name.toLocaleLowerCase() === name.trim().toLocaleLowerCase()); if (existing) updateView.mutate({ ...scope, id: existing.id, expectedVersion: existing.version, configuration: { filter, sort } }); else createView.mutate({ ...scope, name: name.trim(), viewType: "tasks", configuration: { filter, sort }, isPinned: 0 }); };
  return <section className="triage-panel" aria-labelledby="triage-heading"><div className="triage-heading"><div><span>Action queue</span><h2 id="triage-heading">Triage before you add</h2></div><button type="button" onClick={saveCurrent} disabled={createView.isPending}>Save view</button></div><div className="triage-controls"><div><label>Show<select value={filter} onChange={event => setFilter(event.target.value)}><option value="open">Open work</option><option value="today">Today</option><option value="risk">At risk</option><option value="all">All active history</option></select></label><label>Order<select value={sort} onChange={event => setSort(event.target.value)}><option value="priority">Priority</option><option value="due">Due date</option><option value="scheduled">Planned date</option><option value="created">Newest</option></select></label></div>{views.length ? <div className="saved-view-chips">{views.map(view => <span key={view.id}><button type="button" onClick={() => applyView(view)}>{view.name}</button><button type="button" aria-label={`${view.isPinned ? "Unpin" : "Pin"} ${view.name}`} onClick={() => updateView.mutate({ ...scope, id: view.id, expectedVersion: view.version, isPinned: view.isPinned ? 0 : 1 })}>{view.isPinned ? "★" : "☆"}</button><button type="button" aria-label={`Delete ${view.name}`} onClick={() => deleteView.mutate({ ...scope, id: view.id })}>×</button></span>)}</div> : null}</div>{selected.length ? <div className="bulk-actions"><span>{selected.length} selected</span><button type="button" onClick={() => bulk.mutate({ ...scope, ids: selected, state: "in_progress" })}>Start</button><button type="button" onClick={() => bulk.mutate({ ...scope, ids: selected, state: "completed" })}>Complete</button><button type="button" onClick={() => bulk.mutate({ ...scope, ids: selected, state: "archived" })}>Archive</button></div> : null}<div className="triage-list">{rows.slice(0, 6).map(task => <label key={task.id}><input type="checkbox" checked={selected.includes(task.id)} onChange={() => toggle(task.id)} /><span><strong>{task.title}</strong><small>{task.state.replace("_", " ")} · {task.dueLocalDate ?? task.scheduledLocalDate ?? "no date"}</small></span><em>{task.priority}</em></label>)}{!rows.length ? <p>No tasks match this decision lens.</p> : null}</div></section>;
}

function CalendarSubscriptionControl() {
  const scope = useMemo(() => getWorkspaceScope(), []);
  const [feed, setFeed] = useState<any>(null);
  const ensure = trpc.planner.calendarFeed.ensure.useMutation({ onSuccess: setFeed });
  const revoke = trpc.planner.calendarFeed.revoke.useMutation({ onSuccess: () => setFeed(null) });
  const url = feed ? `${window.location.origin}/api/calendar/${feed.token}.ics` : null;
  return <div className="calendar-subscription"><span>iPhone Calendar</span>{!feed ? <><p>Create a private, read-only calendar link for the iPhone Calendar app.</p><Button type="button" variant="ghost" onClick={() => ensure.mutate(scope)} disabled={ensure.isPending}>{ensure.isPending ? "Creating…" : "Create link"}</Button></> : <><p>Use this link with <strong>Calendar → Add Subscription Calendar</strong> on iPhone.</p><div className="calendar-feed-actions"><Button type="button" variant="ghost" onClick={() => navigator.clipboard?.writeText(url!)}>Copy link</Button><a href={url ?? undefined} target="_blank" rel="noreferrer">Open .ics</a><Button type="button" variant="ghost" onClick={() => revoke.mutate({ ...scope, id: feed.id })}>Revoke</Button></div></>}</div>;
}

function vapidKeyToUint8Array(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (value.length % 4)) % 4);
  const raw = window.atob(base64);
  return Uint8Array.from(raw, character => character.charCodeAt(0));
}

function BrowserNotificationControl() {
  const scope = useMemo(() => getWorkspaceScope(), []);
  const utils = trpc.useUtils();
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(() => typeof Notification === "undefined" || !navigator.serviceWorker ? "unsupported" : Notification.permission);
  const [message, setMessage] = useState<string | null>(null);
  const [currentEndpoint, setCurrentEndpoint] = useState<string | null>(null);
  const devices = trpc.planner.notification.devices.useQuery(scope);
  const currentDeviceQuery = trpc.planner.notification.currentDevice.useQuery({ ...scope, endpoint: currentEndpoint ?? "https://placeholder.invalid/personal-calander" }, { enabled: Boolean(currentEndpoint) });
  const enableDevice = trpc.planner.notification.enableDevice.useMutation({ onSuccess: () => { setMessage("This device is ready for visible planning reminders."); utils.planner.notification.devices.invalidate(); utils.planner.notification.currentDevice.invalidate(); } });
  const disableDevice = trpc.planner.notification.disableDevice.useMutation({ onSuccess: () => { setMessage("This device will no longer receive planning reminders."); setCurrentEndpoint(null); utils.planner.notification.devices.invalidate(); utils.planner.notification.currentDevice.invalidate(); } });
  const testDevice = trpc.planner.notification.testDevice.useMutation({ onSuccess: () => { setMessage("Test notification accepted. Check this device’s notification center."); utils.planner.notification.devices.invalidate(); }, onError: error => setMessage(error.message) });
  const reminderRules = trpc.planner.reminder.rules.useQuery(scope);
  const activateCadence = trpc.planner.reminder.activateApproved.useMutation({ onSuccess: () => { setMessage("Daily 11:00 and Sunday 17:00 Pacific/Auckland reminders are now scheduled."); utils.planner.reminder.rules.invalidate(); }, onError: error => setMessage(error.message) });
  const pauseCadence = trpc.planner.reminder.pauseApproved.useMutation({ onSuccess: () => { setMessage("Automatic planning reminders are paused. Your device remains connected for manual tests."); utils.planner.reminder.rules.invalidate(); }, onError: error => setMessage(error.message) });
  const currentDevice = currentDeviceQuery.data?.status === "active" ? currentDeviceQuery.data : null;
  const registerSubscription = async (subscription: PushSubscriptionJSON) => {
    if (!subscription.endpoint || !subscription.keys?.p256dh || !subscription.keys.auth) throw new Error("This browser did not return the keys required for secure reminders.");
    setCurrentEndpoint(subscription.endpoint);
    await enableDevice.mutateAsync({ ...scope, subscription: { endpoint: subscription.endpoint, keys: { p256dh: subscription.keys.p256dh, auth: subscription.keys.auth }, deviceLabel: "This device", userAgent: navigator.userAgent } });
  };
  const enable = async () => {
    if (typeof Notification === "undefined" || !navigator.serviceWorker || !import.meta.env.VITE_VAPID_PUBLIC_KEY) { setPermission("unsupported"); return; }
    try {
      const nextPermission = await Notification.requestPermission();
      setPermission(nextPermission);
      if (nextPermission !== "granted") return;
      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      const subscription = existing ?? await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: vapidKeyToUint8Array(import.meta.env.VITE_VAPID_PUBLIC_KEY) });
      await registerSubscription(subscription.toJSON());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "This device could not be enabled for reminders.");
    }
  };
  const disable = async () => {
    const device = currentDevice;
    if (!device) return;
    try {
      await disableDevice.mutateAsync({ ...scope, id: device.id });
      if (navigator.serviceWorker) {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        await subscription?.unsubscribe();
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The local browser subscription could not be removed. Your saved device remains unchanged.");
    }
  };
  useEffect(() => {
    let cancelled = false;
    if (!navigator.serviceWorker) return;
    void navigator.serviceWorker.ready.then(registration => registration.pushManager.getSubscription()).then(subscription => { if (!cancelled) setCurrentEndpoint(subscription?.endpoint ?? null); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    if (!navigator.serviceWorker) return;
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === "personal-calander:subscription-changed" && event.data.subscription) registerSubscription(event.data.subscription);
      if (event.data?.type === "personal-calander:subscription-refresh-needed") setMessage("This device needs reminders re-enabled after its browser refreshed the subscription.");
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, []);
  const copy = permission === "unsupported" ? "This browser does not support the installed-app reminder path." : permission === "denied" ? "Notifications are blocked. Re-enable them in this site’s browser settings before connecting this device." : currentDevice ? "This exact device is registered for visible planning reminders. Send a test before enabling a cadence." : "Enable only on a device where you want planning reminders. You can disconnect it at any time.";
  const cadenceEnabled = (reminderRules.data ?? []).length === 2 && (reminderRules.data ?? []).every(rule => rule.isEnabled === 1);
  return <div className="notification-control"><span>Phone reminders</span><p>{copy}</p>{permission !== "granted" || !currentDevice ? <Button type="button" variant="ghost" onClick={enable} disabled={enableDevice.isPending || currentDeviceQuery.isLoading}>{enableDevice.isPending || currentDeviceQuery.isLoading ? "Connecting…" : permission === "denied" ? "Permission blocked" : "Enable reminders on this device"}</Button> : <div className="calendar-feed-actions"><Button type="button" variant="ghost" onClick={() => testDevice.mutate({ ...scope, subscriptionId: currentDevice.id, origin: window.location.origin })} disabled={testDevice.isPending}>{testDevice.isPending ? "Sending…" : "Send test notification"}</Button><Button type="button" variant="ghost" className="danger-action" onClick={disable} disabled={disableDevice.isPending}>Disable this device</Button></div>}<div className="reminder-cadence"><div><b>Scheduled rhythm</b><p>Daily planning at 11:00 and weekly review Sunday at 17:00 in New Zealand time.</p></div>{cadenceEnabled ? <Button type="button" variant="ghost" className="danger-action" onClick={() => pauseCadence.mutate(scope)} disabled={pauseCadence.isPending}>Pause reminders</Button> : <Button type="button" variant="ghost" onClick={() => activateCadence.mutate(scope)} disabled={!currentDevice || activateCadence.isPending}>{activateCadence.isPending ? "Scheduling…" : "Enable daily + weekly"}</Button>}</div>{!currentDevice ? <p className="notification-feedback">Connect this browser first; schedules will then send only to active devices.</p> : null}{devices.data && devices.data.length > 1 ? <p className="notification-feedback">{devices.data.length - 1} other saved device{devices.data.length === 2 ? "" : "s"} remain separate; this control acts only on this browser’s subscription.</p> : null}{message ? <p className="notification-feedback" role="status">{message}</p> : null}{devices.data?.some(device => device.status === "expired") ? <p className="notification-feedback" role="alert">A previous device subscription expired. Enable reminders again on that device.</p> : null}</div>;
}

function OccurrencePanel() {
  const scope = useMemo(() => getWorkspaceScope(), []);
  const [today] = useState(() => localDateInTimezone(scope.timezone));
  const range = useMemo(() => ({ start: shiftLocalDate(today, -7), end: shiftLocalDate(today, 7) }), [today]);
  const utils = trpc.useUtils();
  const snapshot = trpc.planner.workspace.snapshot.useQuery({ ...scope, ...range });
  const resolve = trpc.planner.occurrence.resolve.useMutation({ onSuccess: () => { utils.planner.workspace.snapshot.invalidate(); utils.planner.dashboard.invalidate(); } });
  const taskTitles = new Map((snapshot.data?.tasks ?? []).map(task => [task.id, task.title]));
  const pending = (snapshot.data?.taskOccurrences ?? []).filter(item => item.state === "pending" && item.localDate <= today).slice(0, 3);
  if (!pending.length) return null;
  return <div className="occurrence-panel"><div><span>Recurring work due</span><p>{pending.length} dated commitment{pending.length === 1 ? "" : "s"} need an outcome.</p></div><div className="occurrence-list">{pending.map(item => <div className="occurrence-row" key={item.id}><p><strong>{taskTitles.get(item.taskId) ?? "Recurring task"}</strong><small>{item.localDate === today ? "Today" : item.localDate}</small></p><div><button type="button" onClick={() => resolve.mutate({ ...scope, id: item.id, expectedVersion: item.version, state: "completed" })} disabled={resolve.isPending}>Done</button><button type="button" onClick={() => resolve.mutate({ ...scope, id: item.id, expectedVersion: item.version, state: "skipped" })} disabled={resolve.isPending}>Skip</button><button type="button" onClick={() => resolve.mutate({ ...scope, id: item.id, expectedVersion: item.version, state: "missed" })} disabled={resolve.isPending}>Missed</button></div></div>)}</div></div>;
}

function FocusPanel({ tasks, categories, onToggle, onCompose }: { tasks: any[]; categories: any[]; onToggle: (task: any) => void; onCompose: () => void }) {
  const categoryColors = new Map(categories.map(category => [category.id, category.color]));
  return (
    <section className="focus-panel" aria-labelledby="focus-heading">
      <div className="panel-heading"><div><span className="eyebrow">Immediate focus</span><h2 id="focus-heading">Today’s commitment</h2></div><span className="panel-count">{tasks.filter(task => task.state !== "completed").length} open</span></div>
      <div className="focus-list">
        {tasks.length ? tasks.map(task => <TaskRow key={task.id} task={task} categoryColor={categoryColors.get(task.categoryId)} onToggle={onToggle} />) : <EmptyState title="Begin with one honest commitment" detail="Capture a task, then decide whether it belongs in today." action={onCompose} />}
      </div>
      <DailyCompass />
      <TaskTriagePanel />
      <RecurringWorkControl />
      <OccurrencePanel />
      <PlanningHealthStrip />
      <DecisionSignals />
      <CalendarSubscriptionControl />
      <BrowserNotificationControl />
      <AICompanion />
    </section>
  );
}

function Timeline({ tasks, selectedDate, onDrop, onMoveDay }: { tasks: any[]; selectedDate: string; onDrop: (id: string, localDate: string) => void; onMoveDay: (amount: number) => void }) {
  const hours = Array.from({ length: 10 }, (_, index) => index + 8);
  const scope = useMemo(() => getWorkspaceScope(), []);
  const scheduled = tasks.filter(task => task.scheduledLocalDate === selectedDate && task.state !== "completed");
  return (
    <section className="timeline-panel" aria-labelledby="timeline-heading">
      <div className="timeline-heading"><div><span className="eyebrow">Time canvas</span><h2 id="timeline-heading">{displayLocalDate(selectedDate, scope.timezone, { weekday: "long", month: "short", day: "numeric" })}</h2></div><div className="date-pager"><button onClick={() => onMoveDay(-1)} aria-label="Previous day"><ChevronLeft size={17} /></button><button onClick={() => onMoveDay(1)} aria-label="Next day"><ChevronRight size={17} /></button></div></div>
      <div className="timeline-scroller">
        {hours.map(hour => {
          const slotTasks = scheduled.filter(task => !task.plannedStartAt ? hour === 9 : new Date(task.plannedStartAt).getHours() === hour);
          return <div key={hour} className="time-slot" onDragOver={event => event.preventDefault()} onDrop={event => onDrop(event.dataTransfer.getData("text/plain"), selectedDate)}><time>{String(hour).padStart(2, "0")}:00</time><div className="time-slot-line">{slotTasks.map(task => <div className="time-block" key={task.id}><span className="time-block-title">{task.title}</span><span>{task.estimateMinutes ? `${task.estimateMinutes}m` : shortTime(task.plannedStartAt)}</span></div>)}</div></div>;
        })}
        {!scheduled.length ? <div className="timeline-empty">Drag a task here to reserve attention on this day.</div> : null}
      </div>
    </section>
  );
}

const horizonOrder: Record<string, number> = { yearly: 0, quarterly: 1, monthly: 2 };
const nextActionCopy: Record<string, string> = {
  add_execution: "Connect a project, task, or habit that makes the outcome actionable.",
  add_milestone: "Add a dated monthly or quarterly checkpoint to make the runway visible.",
  review_plan: "Review the plan: pace, deadline, or review rhythm needs attention before the next commitment.",
  none: "The current evidence supports the next step. Keep the plan honest as conditions change.",
};

function GoalPlanningControl({ goals }: { goals: any[] }) {
  const scope = useMemo(() => getWorkspaceScope(), []);
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [horizon, setHorizon] = useState<"monthly" | "quarterly" | "yearly">("yearly");
  const [parentGoalId, setParentGoalId] = useState("none");
  const [dueLocalDate, setDueLocalDate] = useState("");
  const [startLocalDate, setStartLocalDate] = useState("");
  const createGoal = trpc.planner.goal.create.useMutation({ onSuccess: () => { utils.planner.workspace.snapshot.invalidate(); utils.planner.dashboard.invalidate(); setOpen(false); setTitle(""); setHorizon("yearly"); setParentGoalId("none"); setDueLocalDate(""); setStartLocalDate(""); } });
  const submit = (event: FormEvent) => { event.preventDefault(); if (!title.trim()) return; createGoal.mutate({ ...scope, title: title.trim(), parentGoalId: parentGoalId === "none" ? null : parentGoalId, startLocalDate: startLocalDate || null, dueLocalDate: dueLocalDate || null, state: "not_started", priority: "medium", horizon, progressMode: "task", progressValue: 0, targetValue: 100 }); };
  return <><button type="button" className="text-button" onClick={() => setOpen(true)}>Plan goal <Plus size={14} /></button><Dialog open={open} onOpenChange={setOpen}><DialogContent className="composer-dialog"><DialogHeader><DialogTitle>Plan a long-horizon goal</DialogTitle><DialogDescription>Use a concrete time horizon and an optional explicit parent. The system never infers hierarchy from similar names.</DialogDescription></DialogHeader><form className="composer-form" onSubmit={submit}><div className="field"><Label htmlFor="planning-goal-title">Goal</Label><Input id="planning-goal-title" autoFocus value={title} onChange={event => setTitle(event.target.value)} placeholder="What meaningful outcome are you building?" /></div><div className="field-grid"><div className="field"><Label>Horizon</Label><Select value={horizon} onValueChange={value => setHorizon(value as "monthly" | "quarterly" | "yearly")}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="yearly">Yearly direction</SelectItem><SelectItem value="quarterly">Quarterly outcome</SelectItem><SelectItem value="monthly">Monthly focus</SelectItem></SelectContent></Select></div><div className="field"><Label>Parent goal</Label><Select value={parentGoalId} onValueChange={setParentGoalId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">No parent goal</SelectItem>{goals.map(goal => <SelectItem key={goal.id} value={goal.id}>{goal.title}</SelectItem>)}</SelectContent></Select></div></div><div className="field-grid"><div className="field"><Label htmlFor="planning-goal-start">Start date</Label><Input id="planning-goal-start" type="date" value={startLocalDate} onChange={event => setStartLocalDate(event.target.value)} /></div><div className="field"><Label htmlFor="planning-goal-due">Due date</Label><Input id="planning-goal-due" type="date" value={dueLocalDate} onChange={event => setDueLocalDate(event.target.value)} /></div></div><p className="recurrence-help">Pace is shown only if both dates are valid. Link a project, task, habit, or milestone afterward to make the outcome executable.</p><div className="composer-submit"><Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" className="primary-action" disabled={createGoal.isPending}>{createGoal.isPending ? "Creating…" : "Create goal"}</Button></div></form></DialogContent></Dialog></>;
}

function HorizonCompass({ goals }: { goals: any[] }) {
  const scope = useMemo(() => getWorkspaceScope(), []);
  const [today] = useState(() => localDateInTimezone(scope.timezone));
  const range = useMemo(() => ({ start: shiftLocalDate(today, -31), end: shiftLocalDate(today, 62) }), [today]);
  const utils = trpc.useUtils();
  const snapshot = trpc.planner.workspace.snapshot.useQuery({ ...scope, ...range });
  const dashboard = trpc.planner.dashboard.useQuery({ ...scope, todayLocalDate: today, rangeStart: range.start, rangeEnd: range.end });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [goalId, setGoalId] = useState("");
  const [title, setTitle] = useState("");
  const [horizon, setHorizon] = useState<"monthly" | "quarterly">("monthly");
  const [dueLocalDate, setDueLocalDate] = useState("");
  const [progressValue, setProgressValue] = useState("0");
  const [targetValue, setTargetValue] = useState("100");
  const [cue, setCue] = useState("");
  const [response, setResponse] = useState("");
  const activeGoals = goals.filter(goal => goal.state !== "archived").sort((left, right) => (horizonOrder[left.horizon] ?? 9) - (horizonOrder[right.horizon] ?? 9));
  const healthByGoal = new Map((dashboard.data?.longHorizon ?? []).map((item: any) => [item.goalId, item]));
  const milestones = snapshot.data?.milestones ?? [];
  const reset = () => { setEditing(null); setTitle(""); setHorizon("monthly"); setDueLocalDate(""); setProgressValue("0"); setTargetValue("100"); setCue(""); setResponse(""); };
  const openMilestone = (forGoal: any, milestone?: any) => { setGoalId(forGoal.id); setEditing(milestone ?? null); setTitle(milestone?.title ?? ""); setHorizon(milestone?.horizon ?? "monthly"); setDueLocalDate(milestone?.dueLocalDate ?? ""); setProgressValue(String(milestone?.progressValue ?? 0)); setTargetValue(String(milestone?.targetValue ?? 100)); setCue(milestone?.cue ?? ""); setResponse(milestone?.response ?? ""); setOpen(true); };
  const refresh = () => { utils.planner.workspace.snapshot.invalidate(); utils.planner.dashboard.invalidate(); };
  const create = trpc.planner.milestone.create.useMutation({ onSuccess: () => { refresh(); setOpen(false); reset(); } });
  const update = trpc.planner.milestone.update.useMutation({ onSuccess: () => { refresh(); setOpen(false); reset(); } });
  const submit = (event: FormEvent) => { event.preventDefault(); if (!goalId || !title.trim()) return; const values = { title: title.trim(), horizon, dueLocalDate: dueLocalDate || null, progressValue: Math.max(0, Number(progressValue) || 0), targetValue: Math.max(1, Number(targetValue) || 100), cue: cue.trim() || null, response: response.trim() || null }; if (editing) update.mutate({ ...scope, id: editing.id, expectedVersion: editing.version, patch: values }); else create.mutate({ ...scope, goalId, ...values }); };
  if (!activeGoals.length) return null;
  return <section className="horizon-compass" aria-labelledby="horizon-heading"><div className="panel-heading"><div><span className="eyebrow">Decision analytics</span><h2 id="horizon-heading">Horizon compass</h2></div><span className="panel-count">Live planning evidence</span></div><p className="horizon-intro">Progress is attributed to a visible source; pace appears only when a valid start and due date exist. It is a planning cue, not a productivity score.</p><div className="horizon-grid">{activeGoals.map(goal => { const health = healthByGoal.get(goal.id); const goalMilestones = milestones.filter((milestone: any) => milestone.goalId === goal.id && milestone.state !== "archived"); const status = health?.isOverdue ? "overdue" : health?.paceStatus === "behind" ? "behind" : health?.paceStatus === "ahead" ? "ahead" : "on pace"; return <article className={cn("horizon-card", health?.isOverdue && "is-overdue", health?.paceStatus === "behind" && "is-behind")} key={goal.id}><div className="horizon-card-top"><span className="horizon-label">{goal.horizon || "long-term"}</span><span className="horizon-status">{status}</span></div><h3>{goal.title}</h3><div className="horizon-progress-row"><strong>{health?.progress ?? 0}%</strong><span>{health ? health.progressSource.replace("_", " ") : "calculating"}</span></div><Progress value={health?.progress ?? 0} className="goal-progress" /><dl className="horizon-facts"><div><dt>Expected</dt><dd>{health?.expectedProgress === null || health?.expectedProgress === undefined ? "Needs dates" : `${health.expectedProgress}%`}</dd></div><div><dt>Runway</dt><dd>{health?.daysUntilDue === null || health?.daysUntilDue === undefined ? "No due date" : health.daysUntilDue < 0 ? `${Math.abs(health.daysUntilDue)}d overdue` : `${health.daysUntilDue}d left`}</dd></div><div><dt>Evidence</dt><dd>{health ? `${health.activeTaskCount + health.activeProjectCount + health.activeHabitCount} linked` : "—"}</dd></div></dl><p className="horizon-next-action"><b>Next:</b> {nextActionCopy[health?.nextAction ?? "none"]}</p><div className="milestone-list">{goalMilestones.length ? goalMilestones.map((milestone: any) => <button type="button" key={milestone.id} onClick={() => openMilestone(goal, milestone)}><span>{milestone.title}</span><small>{milestone.horizon} · {milestone.dueLocalDate || "no due date"}</small></button>) : <p>No milestones yet.</p>}</div><button type="button" className="text-button" onClick={() => openMilestone(goal)}>Add milestone <Plus size={14} /></button></article>; })}</div><Dialog open={open} onOpenChange={value => { setOpen(value); if (!value) reset(); }}><DialogContent className="composer-dialog"><DialogHeader><DialogTitle>{editing ? "Refine milestone" : "Add milestone"}</DialogTitle><DialogDescription>Milestones are dated evidence for a monthly or quarterly outcome. If–then cues remain optional and user-authored.</DialogDescription></DialogHeader><form className="composer-form" onSubmit={submit}><div className="field"><Label>Goal</Label><Select value={goalId} onValueChange={setGoalId}><SelectTrigger><SelectValue placeholder="Choose a goal" /></SelectTrigger><SelectContent>{activeGoals.map(goal => <SelectItem value={goal.id} key={goal.id}>{goal.title}</SelectItem>)}</SelectContent></Select></div><div className="field"><Label htmlFor="milestone-title">Milestone</Label><Input id="milestone-title" value={title} onChange={event => setTitle(event.target.value)} placeholder="What proof belongs on the runway?" /></div><div className="field-grid"><div className="field"><Label>Horizon</Label><Select value={horizon} onValueChange={value => setHorizon(value as "monthly" | "quarterly")}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="monthly">Monthly</SelectItem><SelectItem value="quarterly">Quarterly</SelectItem></SelectContent></Select></div><div className="field"><Label htmlFor="milestone-due">Due date</Label><Input id="milestone-due" type="date" value={dueLocalDate} onChange={event => setDueLocalDate(event.target.value)} /></div></div><div className="field-grid"><div className="field"><Label htmlFor="milestone-progress">Current value</Label><Input id="milestone-progress" type="number" min="0" value={progressValue} onChange={event => setProgressValue(event.target.value)} /></div><div className="field"><Label htmlFor="milestone-target">Target value</Label><Input id="milestone-target" type="number" min="1" value={targetValue} onChange={event => setTargetValue(event.target.value)} /></div></div><div className="field"><Label htmlFor="milestone-cue">If</Label><Input id="milestone-cue" value={cue} onChange={event => setCue(event.target.value)} placeholder="Optional situation or cue" /></div><div className="field"><Label htmlFor="milestone-response">Then</Label><Input id="milestone-response" value={response} onChange={event => setResponse(event.target.value)} placeholder="Optional response you choose" /></div><div className="composer-submit"><Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" className="primary-action" disabled={create.isPending || update.isPending}>{create.isPending || update.isPending ? "Saving…" : editing ? "Save milestone" : "Create milestone"}</Button></div></form></DialogContent></Dialog></section>;
}

function GoalPanel({ goals, projects, tasks, categories, onCompose }: { goals: any[]; projects: any[]; tasks: any[]; categories: any[]; onCompose: () => void }) {
  const categoryColors = new Map(categories.map(category => [category.id, category.color]));
  const activeGoals = goals.filter(goal => goal.state !== "archived");
  const progress = (goal: any) => {
    if (goal.progressMode === "manual" || goal.progressMode === "measure") return Math.round((goal.progressValue / Math.max(1, goal.targetValue)) * 100);
    const related = tasks.filter(task => task.goalId === goal.id || projects.find(project => project.id === task.projectId)?.goalId === goal.id);
    return related.length ? Math.round((related.filter(task => task.state === "completed").length / related.length) * 100) : 0;
  };
  return <section className="goal-panel" aria-labelledby="goals-heading"><div className="panel-heading"><div><span className="eyebrow">Longer horizon</span><h2 id="goals-heading">Goal runway</h2></div><GoalPlanningControl goals={activeGoals} /></div>{activeGoals.length ? <><div className="goal-list">{activeGoals.slice(0, 3).map(goal => { const value = progress(goal); return <div className="goal-line" key={goal.id}><div className="goal-line-top"><span className="category-dot" style={{ background: goal.color || categoryColors.get(goal.categoryId) || "#C6F06A" }} /><span>{goal.title}</span><strong>{value}%</strong></div><Progress value={value} className="goal-progress" /></div>; })}</div><HorizonCompass goals={activeGoals} /></> : <EmptyState title="Give today a destination" detail="A goal turns daily work into a visible direction." action={onCompose} />}</section>;
}

function HabitPanel({ habits, checkIns, today, streaks = [], onCheckIn, onClearCheckIn, onRetry, pending, error, onCompose }: { habits: any[]; checkIns: any[]; today: string; streaks?: { habitId: string; streak: number }[]; onCheckIn: (habitId: string, localDate: string, state: "completed" | "skipped") => void; onClearCheckIn: (habitId: string, localDate: string) => void; onRetry: () => void; pending: boolean; error: string | null; onCompose: () => void }) {
  const days = Array.from({ length: 7 }, (_, index) => shiftLocalDate(today, index - 6));
  const stateFor = (habitId: string, day: string) => checkIns.find(checkIn => checkIn.habitId === habitId && checkIn.localDate === day)?.state;
  const streakByHabit = new Map(streaks.map(item => [item.habitId, item.streak]));
  const visibleStreak = (habit: any) => {
    if (streakByHabit.has(habit.id)) return streakByHabit.get(habit.id) ?? 0;
    let cursor = today;
    let streak = 0;
    for (let guard = 0; guard < 730; guard += 1) {
      if (!isHabitScheduledOnLocalDate(habit, cursor)) { cursor = shiftLocalDate(cursor, -1); continue; }
      const state = stateFor(habit.id, cursor);
      if (state === "completed") { streak += 1; cursor = shiftLocalDate(cursor, -1); continue; }
      if (state === "skipped") { cursor = shiftLocalDate(cursor, -1); continue; }
      break;
    }
    return streak;
  };
  return <section className="habit-panel" aria-labelledby="habits-heading"><div className="panel-heading"><div><span className="eyebrow">Rhythm</span><h2 id="habits-heading">Seven-day trace</h2></div><button className="text-button" onClick={onCompose}>Add habit <Plus size={14} /></button></div>{habits.filter(habit => !habit.archivedAt).length ? <div className="habit-grid"><div className="habit-grid-days">{days.map(day => <span key={day}>{displayLocalDate(day, "UTC", { weekday: "narrow" })}</span>)}</div>{habits.filter(habit => !habit.archivedAt).slice(0, 4).map(habit => { const todayScheduled = isHabitScheduledOnLocalDate(habit, today); const todayState = stateFor(habit.id, today); const isComplete = todayState === "completed"; return <div className="habit-line" key={habit.id}><span className="habit-name"><i style={{ background: habit.color }} />{habit.name}</span><span className="habit-streak">{visibleStreak(habit)}d</span><div className="habit-squares">{days.map(day => { const scheduled = isHabitScheduledOnLocalDate(habit, day); const state = stateFor(habit.id, day); const canEdit = scheduled && day <= today; const clear = state === "completed" || state === "skipped"; if (!scheduled) return <span key={day} className="habit-square is-unscheduled" aria-label={`${habit.name} is not scheduled on ${day}`} />; return <button key={day} type="button" className={cn("habit-square", state && `is-${state}`)} aria-label={`${clear ? "Clear" : "Complete"} ${habit.name} on ${day}`} aria-pressed={state === "completed"} onClick={() => clear ? onClearCheckIn(habit.id, day) : onCheckIn(habit.id, day, "completed")} disabled={!canEdit || pending}>{pending && day === today ? <Loader2 className="animate-spin" size={11} /> : state === "completed" ? <Check size={11} /> : state === "skipped" ? <X size={11} /> : null}</button>; })}</div><div className="habit-actions">{todayScheduled ? <><button type="button" className={cn("habit-primary-action", isComplete && "is-complete")} onClick={() => isComplete || todayState === "skipped" ? onClearCheckIn(habit.id, today) : onCheckIn(habit.id, today, "completed")} disabled={pending}>{pending ? "Saving…" : isComplete ? "Undo today" : todayState === "skipped" ? "Clear skip" : "Complete today"}</button>{!isComplete && todayState !== "skipped" ? <button type="button" className="habit-skip-action" onClick={() => onCheckIn(habit.id, today, "skipped")} disabled={pending}>Skip today</button> : null}</> : <span className="habit-rest-day">Not scheduled today</span>}</div></div>; })}</div> : <EmptyState title="Build a rhythm, not a streak" detail="Track habits with intentional skips and a visible history." action={onCompose} />}{error ? <div className="habit-feedback" role="alert"><span>{error} Your previous record has not been changed.</span><button type="button" onClick={onRetry} disabled={pending}>Retry</button></div> : <p className="habit-feedback" role="status">Scheduled past and current days can be completed or undone. A skip is intentional and does not break a streak.</p>}</section>;
}

function HabitCalendarTracker({ habits, checkIns, today, onCheckIn, onClearCheckIn, pending, onCompose = () => window.dispatchEvent(new Event("personal-calander:compose-habit")) }: { habits: any[]; checkIns: any[]; today: string; onCheckIn: (habitId: string, localDate: string, state: "completed" | "skipped") => void; onClearCheckIn: (habitId: string, localDate: string) => void; pending: boolean; onCompose?: () => void }) {
  const [anchor, setAnchor] = useState(today);
  const [selectedDate, setSelectedDate] = useState(today);
  const dates = useMemo(() => Array.from({ length: 28 }, (_, index) => shiftLocalDate(anchor, index - 27)), [anchor]);
  const selectedHabits = habits.filter(habit => !habit.archivedAt && isHabitScheduledOnLocalDate(habit, selectedDate));
  const stateFor = (habitId: string, localDate: string) => checkIns.find(checkIn => checkIn.habitId === habitId && checkIn.localDate === localDate)?.state;
  const activeHabits = habits.filter(habit => !habit.archivedAt);
  return <section className="habit-calendar-tracker" aria-labelledby="habit-calendar-heading"><div className="panel-heading"><div><span className="eyebrow">Habit tracker</span><h2 id="habit-calendar-heading">Your habit calendar</h2></div><div className="habit-calendar-pager"><button type="button" aria-label="Previous four weeks" onClick={() => setAnchor(date => shiftLocalDate(date, -28))}><ChevronLeft size={16} /></button><span>{displayLocalDate(anchor, "UTC", { month: "short", year: "numeric" })}</span><button type="button" aria-label="Next four weeks" onClick={() => setAnchor(date => shiftLocalDate(date, 28))} disabled={anchor >= today}><ChevronRight size={16} /></button></div></div><p className="habit-calendar-copy">Choose a day to review its scheduled habits. The main Calendar remains reserved for tasks and time blocks.</p>{activeHabits.length ? <><div className="habit-calendar-weekdays">{["M", "T", "W", "T", "F", "S", "S"].map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}</div><div className="habit-calendar-grid">{dates.map(date => { const scheduled = activeHabits.filter(habit => isHabitScheduledOnLocalDate(habit, date)); const completed = scheduled.filter(habit => stateFor(habit.id, date) === "completed").length; const skipped = scheduled.filter(habit => stateFor(habit.id, date) === "skipped").length; return <button type="button" key={date} className={cn("habit-calendar-day", date === selectedDate && "is-selected", date === today && "is-today", date > today && "is-future")} onClick={() => setSelectedDate(date)} aria-pressed={date === selectedDate}><time>{date.slice(-2)}</time>{scheduled.length ? <span className="habit-calendar-status"><b>{completed}</b>/{scheduled.length}{skipped ? <i>·{skipped} skip</i> : null}</span> : <span className="habit-calendar-status is-empty">—</span>}</button>; })}</div><div className="habit-day-detail"><div><span>{displayLocalDate(selectedDate, "UTC", { weekday: "long", month: "long", day: "numeric" })}</span><p>{selectedDate > today ? "Future habits are visible for planning but cannot be checked in yet." : selectedHabits.length ? "Complete, deliberately skip, or undo the scheduled habits for this date." : "No habits are scheduled for this date."}</p></div>{selectedHabits.length ? <div className="habit-day-actions">{selectedHabits.map(habit => { const state = stateFor(habit.id, selectedDate); const clear = state === "completed" || state === "skipped"; return <div key={habit.id}><span><i style={{ background: habit.color }} />{habit.name}</span>{clear ? <button type="button" onClick={() => onClearCheckIn(habit.id, selectedDate)} disabled={pending || selectedDate > today}>Undo {state}</button> : <><button type="button" className="habit-complete-button" onClick={() => onCheckIn(habit.id, selectedDate, "completed")} disabled={pending || selectedDate > today}>Complete</button><button type="button" onClick={() => onCheckIn(habit.id, selectedDate, "skipped")} disabled={pending || selectedDate > today}>Skip</button></>}</div>; })}</div> : null}</div></> : <EmptyState title="Add a habit to start the calendar" detail="Your habit tracker will show scheduled check-ins without filling the main task calendar." action={onCompose} actionLabel="Create habit" />}</section>;
}

function AnalyticsPanel({ dashboard, categories }: { dashboard: any; categories: any[] }) {
  const distribution = (dashboard?.categoryDistribution ?? []).filter((item: any) => item.count > 0).map((item: any) => ({ ...item, color: categories.find(category => category.id === item.id)?.color ?? "#C6F06A" }));
  return <section className="analytics-panel" aria-labelledby="insight-heading"><div className="panel-heading"><div><span className="eyebrow">Observed pattern</span><h2 id="insight-heading">Momentum</h2></div><span className="panel-count">Past 28 days</span></div><div className="analytics-grid"><div className="trend-chart"><p className="chart-label">Completions</p>{dashboard?.completionTrend?.some((point: any) => point.completed) ? <ResponsiveContainer width="100%" height={126}><AreaChart data={dashboard.completionTrend}><defs><linearGradient id="completionFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#C6F06A" stopOpacity={0.35} /><stop offset="100%" stopColor="#C6F06A" stopOpacity={0} /></linearGradient></defs><CartesianGrid vertical={false} stroke="rgba(245,245,239,0.08)" /><XAxis dataKey="localDate" tickFormatter={(value: string) => value.slice(5)} tickLine={false} axisLine={false} tick={{ fill: "#6F766E", fontSize: 10 }} interval="preserveStartEnd" /><YAxis hide /><ChartTooltip contentStyle={{ background: "#191D1A", border: "1px solid rgba(245,245,239,0.12)", borderRadius: 10 }} labelStyle={{ color: "#D9DCD4" }} itemStyle={{ color: "#C6F06A" }} /><Area type="monotone" dataKey="completed" stroke="#C6F06A" strokeWidth={2} fill="url(#completionFill)" /></AreaChart></ResponsiveContainer> : <div className="chart-zero"><CircleDot size={18} /> Complete tasks to reveal your pace.</div>}</div><div className="distribution-chart"><p className="chart-label">Category load</p>{distribution.length ? <ResponsiveContainer width="100%" height={126}><BarChart data={distribution} layout="vertical" margin={{ left: 0, right: 8 }}><XAxis type="number" hide /><YAxis type="category" dataKey="name" width={72} tick={{ fill: "#9AA198", fontSize: 11 }} tickLine={false} axisLine={false} /><ChartTooltip contentStyle={{ background: "#191D1A", border: "1px solid rgba(245,245,239,0.12)", borderRadius: 10 }} cursor={{ fill: "rgba(245,245,239,0.05)" }} /><Bar dataKey="count" fill="#7DB8E0" radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer> : <div className="chart-zero"><Target size={18} /> Categories will reveal balance.</div>}</div></div></section>;
}

function Composer({ open, kind, categories, goals = [], onOpenChange, onKindChange, onCreate, onManageCategories }: { open: boolean; kind: ComposerKind; categories: any[]; goals?: any[]; onOpenChange: (open: boolean) => void; onKindChange: (kind: ComposerKind) => void; onCreate: (values: { title: string; categoryId: string | null; goalId: string | null; parentGoalId: string | null; goalHorizon: "monthly" | "quarterly" | "yearly"; dueLocalDate: string | null; estimateMinutes: number | null; recurrenceRule: Record<string, unknown> | null; recurrenceUntilLocalDate: string | null; habitFrequency: "daily" | "days_of_week" | "interval" | null; habitSchedule: Record<string, unknown> | null }) => void; onManageCategories: () => void }) {
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState("none");
  const [dueLocalDate, setDueLocalDate] = useState("");
  const [estimate, setEstimate] = useState("");
  const [recurrenceFrequency, setRecurrenceFrequency] = useState("none");
  const [recurrenceInterval, setRecurrenceInterval] = useState("1");
  const [recurrenceUntilLocalDate, setRecurrenceUntilLocalDate] = useState("");
  const [habitFrequency, setHabitFrequency] = useState<"daily" | "days_of_week" | "interval">("daily");
  const [habitWeekdays, setHabitWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [habitIntervalDays, setHabitIntervalDays] = useState("2");
  const [habitAnchorLocalDate, setHabitAnchorLocalDate] = useState("");
  const [goalId, setGoalId] = useState("none");
  const [parentGoalId, setParentGoalId] = useState("none");
  const [goalHorizon, setGoalHorizon] = useState<"monthly" | "quarterly" | "yearly">("yearly");
  const label = { task: "Task", goal: "Goal", project: "Project", habit: "Habit" }[kind];
  const toggleHabitWeekday = (weekday: number) => setHabitWeekdays(current => current.includes(weekday) ? current.filter(value => value !== weekday) : [...current, weekday].sort((left, right) => left - right));
  const submit = (event: FormEvent) => { event.preventDefault(); if (!title.trim()) return; const recurrenceRule = kind === "task" && recurrenceFrequency !== "none" ? { frequency: recurrenceFrequency, interval: Math.max(1, Number(recurrenceInterval) || 1) } : null; const habitSchedule = kind !== "habit" ? null : habitFrequency === "daily" ? { cadence: "daily" } : habitFrequency === "days_of_week" ? { weekdays: habitWeekdays.length ? habitWeekdays : [1, 2, 3, 4, 5] } : { intervalDays: Math.max(1, Number(habitIntervalDays) || 1), ...(habitAnchorLocalDate ? { startLocalDate: habitAnchorLocalDate } : {}) }; onCreate({ title: title.trim(), categoryId: categoryId === "none" ? null : categoryId, goalId: goalId === "none" ? null : goalId, parentGoalId: parentGoalId === "none" ? null : parentGoalId, goalHorizon, dueLocalDate: dueLocalDate || null, estimateMinutes: estimate ? Number(estimate) : null, recurrenceRule, recurrenceUntilLocalDate: recurrenceRule ? recurrenceUntilLocalDate || null : null, habitFrequency: kind === "habit" ? habitFrequency : null, habitSchedule }); setTitle(""); setDueLocalDate(""); setEstimate(""); setGoalId("none"); setParentGoalId("none"); setGoalHorizon("yearly"); setRecurrenceFrequency("none"); setRecurrenceInterval("1"); setRecurrenceUntilLocalDate(""); setHabitFrequency("daily"); setHabitWeekdays([1, 2, 3, 4, 5]); setHabitIntervalDays("2"); setHabitAnchorLocalDate(""); };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="composer-dialog"><DialogHeader><DialogTitle>Shape a new {label.toLowerCase()}</DialogTitle><DialogDescription>Keep it concise. You can add detail after it has a place in the plan.</DialogDescription></DialogHeader><form onSubmit={submit} className="composer-form"><div className="composer-kind">{(["task", "goal", "project", "habit"] as ComposerKind[]).map(item => <button type="button" className={cn(item === kind && "is-active")} onClick={() => onKindChange(item)} key={item}>{item}</button>)}</div><div className="field"><Label htmlFor="composer-title">Name</Label><Input id="composer-title" autoFocus value={title} onChange={event => setTitle(event.target.value)} placeholder={kind === "habit" ? "Read for 20 minutes" : kind === "goal" ? "Build a sustainable routine" : "What needs attention?"} /></div>{kind !== "habit" ? <div className="field-grid"><div className="field"><Label htmlFor="composer-date">Due date</Label><Input id="composer-date" type="date" value={dueLocalDate} onChange={event => setDueLocalDate(event.target.value)} /></div>{kind === "task" ? <div className="field"><Label htmlFor="composer-estimate">Estimate</Label><Input id="composer-estimate" type="number" min="0" max="1440" value={estimate} onChange={event => setEstimate(event.target.value)} placeholder="minutes" /></div> : null}</div> : null}{kind === "task" ? <div className="recurrence-fields"><div className="field"><Label>Repeat</Label><Select value={recurrenceFrequency} onValueChange={setRecurrenceFrequency}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Does not repeat</SelectItem><SelectItem value="daily">Daily</SelectItem><SelectItem value="weekly">Weekly</SelectItem><SelectItem value="monthly">Monthly</SelectItem></SelectContent></Select></div>{recurrenceFrequency !== "none" ? <><div className="field"><Label htmlFor="composer-recurrence-interval">Every</Label><Input id="composer-recurrence-interval" type="number" min="1" max="365" value={recurrenceInterval} onChange={event => setRecurrenceInterval(event.target.value)} /></div><div className="field"><Label htmlFor="composer-recurrence-until">Stop after</Label><Input id="composer-recurrence-until" type="date" value={recurrenceUntilLocalDate} onChange={event => setRecurrenceUntilLocalDate(event.target.value)} /></div><p className="recurrence-help">The series follows this task’s due date; a planned date takes precedence when one is set.</p></> : null}</div> : null}{kind === "habit" ? <div className="habit-schedule-fields"><div className="field"><Label>Planned rhythm</Label><Select value={habitFrequency} onValueChange={value => { const next = value as "daily" | "days_of_week" | "interval"; setHabitFrequency(next); if (next === "days_of_week" && habitWeekdays.length === 0) setHabitWeekdays([1, 2, 3, 4, 5]); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="daily">Every day</SelectItem><SelectItem value="days_of_week">Selected weekdays</SelectItem><SelectItem value="interval">Every N days</SelectItem></SelectContent></Select></div>{habitFrequency === "days_of_week" ? <div className="field"><Label>Scheduled days</Label><div className="weekday-picker" aria-label="Scheduled weekdays">{[[0, "Sun"], [1, "Mon"], [2, "Tue"], [3, "Wed"], [4, "Thu"], [5, "Fri"], [6, "Sat"]].map(([weekday, weekdayLabel]) => <button key={String(weekday)} type="button" className={cn(habitWeekdays.includes(weekday as number) && "is-selected")} aria-pressed={habitWeekdays.includes(weekday as number)} onClick={() => toggleHabitWeekday(weekday as number)}>{weekdayLabel}</button>)}</div><p className="recurrence-help">Choose the specific days this habit should appear in its dedicated tracker.</p></div> : null}{habitFrequency === "interval" ? <div className="field-grid"><div className="field"><Label htmlFor="habit-interval-days">Every</Label><Input id="habit-interval-days" type="number" min="1" max="365" value={habitIntervalDays} onChange={event => setHabitIntervalDays(event.target.value)} /></div><div className="field"><Label htmlFor="habit-start-date">Starting on</Label><Input id="habit-start-date" type="date" value={habitAnchorLocalDate} onChange={event => setHabitAnchorLocalDate(event.target.value)} /></div></div> : null}</div> : null}<div className="field"><div className="field-label-row"><Label>Category</Label><button type="button" className="field-inline-action" onClick={onManageCategories}>New category</button></div><Select value={categoryId} onValueChange={setCategoryId}><SelectTrigger><SelectValue placeholder="No category" /></SelectTrigger><SelectContent><SelectItem value="none">No category</SelectItem>{categories.map(category => <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>)}</SelectContent></Select></div><div className="composer-submit"><Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" className="primary-action">Create {label}</Button></div></form></DialogContent></Dialog>;
}

function CategoryManagerRow({ category, onUpdate, onDelete, busy }: { category: any; onUpdate: (category: any, patch: { name: string; color: string }) => void; onDelete: (category: any) => void; busy: boolean }) {
  const [name, setName] = useState(category.name);
  const [color, setColor] = useState(category.color);
  useEffect(() => { setName(category.name); setColor(category.color); }, [category]);
  const changed = name.trim() !== category.name || color !== category.color;
  return <li className="category-manager-row"><input type="color" value={color} onChange={event => setColor(event.target.value)} aria-label={`Color for ${category.name}`} /><Input value={name} onChange={event => setName(event.target.value)} aria-label={`Name for ${category.name}`} maxLength={80} /><Button type="button" variant="ghost" disabled={!changed || busy || !name.trim()} onClick={() => onUpdate(category, { name: name.trim(), color })}>Save</Button><Button type="button" variant="ghost" className="danger-action" disabled={busy} onClick={() => onDelete(category)}>Remove</Button></li>;
}

function CategoryDialog({ open, onOpenChange, categories }: { open: boolean; onOpenChange: (open: boolean) => void; categories: any[] }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("#7DB8E0");
  const scope = useMemo(() => getWorkspaceScope(), []);
  const [today] = useState(() => localDateInTimezone(scope.timezone));
  const range = useMemo(() => ({ start: shiftLocalDate(today, -31), end: shiftLocalDate(today, 31) }), [today]);
  const utils = trpc.useUtils();
  const refresh = () => { utils.planner.workspace.snapshot.invalidate(); utils.planner.dashboard.invalidate(); };
  const workspace = trpc.planner.workspace.snapshot.useQuery({ ...scope, ...range }, { enabled: open });
  const create = trpc.planner.category.create.useMutation({ onSuccess: () => { setName(""); refresh(); } });
  const update = trpc.planner.category.update.useMutation({ onSuccess: refresh });
  const remove = trpc.planner.category.delete.useMutation({ onSuccess: refresh });
  const archiveTask = trpc.planner.task.update.useMutation({ onSuccess: refresh });
  const archiveGoal = trpc.planner.goal.archive.useMutation({ onSuccess: refresh });
  const archiveProject = trpc.planner.project.archive.useMutation({ onSuccess: refresh });
  const archiveHabit = trpc.planner.habit.archive.useMutation({ onSuccess: refresh });
  const submit = (event: FormEvent) => { event.preventDefault(); if (!name.trim()) return; create.mutate({ ...scope, name: name.trim(), color, sortOrder: categories.length }); };
  const deleteCategory = (category: any) => { if (window.confirm(`Remove “${category.name}”? Existing tasks, goals, projects, and habits will keep their history but lose this category label.`)) remove.mutate({ ...scope, id: category.id, expectedVersion: category.version }); };
  const busy = create.isPending || update.isPending || remove.isPending || archiveTask.isPending || archiveGoal.isPending || archiveProject.isPending || archiveHabit.isPending;
  const archive = (type: "task" | "goal" | "project" | "habit", item: any) => { if (!window.confirm(`Archive “${item.title ?? item.name}”? It will leave active planning but its history will be kept.`)) return; if (type === "task") archiveTask.mutate({ ...scope, id: item.id, expectedVersion: item.version, patch: { state: "archived" } }); if (type === "goal") archiveGoal.mutate({ ...scope, id: item.id, expectedVersion: item.version }); if (type === "project") archiveProject.mutate({ ...scope, id: item.id, expectedVersion: item.version }); if (type === "habit") archiveHabit.mutate({ ...scope, id: item.id, expectedVersion: item.version }); };
  const activeItems = [
    ...(workspace.data?.tasks ?? []).filter(item => item.state !== "archived").map(item => ({ type: "task" as const, item, label: item.title })),
    ...(workspace.data?.goals ?? []).filter(item => item.state !== "archived").map(item => ({ type: "goal" as const, item, label: item.title })),
    ...(workspace.data?.projects ?? []).filter(item => item.state !== "archived").map(item => ({ type: "project" as const, item, label: item.title })),
    ...(workspace.data?.habits ?? []).filter(item => !item.archivedAt).map(item => ({ type: "habit" as const, item, label: item.name })),
  ].sort((left, right) => left.label.localeCompare(right.label));
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="composer-dialog category-manager-dialog"><DialogHeader><DialogTitle>Organize planning</DialogTitle><DialogDescription>Categories organize work by color. Removing a category detaches its label; archiving an item removes it from active planning while keeping history.</DialogDescription></DialogHeader><form className="composer-form category-create-form" onSubmit={submit}><div className="field"><Label htmlFor="category-name">New category</Label><Input id="category-name" autoFocus value={name} onChange={event => setName(event.target.value)} placeholder="Deep work" maxLength={80} /></div><div className="field"><Label htmlFor="category-color">Color signal</Label><div className="color-input-wrap"><input id="category-color" type="color" value={color} onChange={event => setColor(event.target.value)} /><code>{color.toUpperCase()}</code></div></div><Button type="submit" className="primary-action" disabled={busy || !name.trim()}>Add category</Button></form><div className="category-manager-list"><span>Current categories</span>{categories.length ? <ul>{categories.map(category => <CategoryManagerRow key={category.id} category={category} busy={busy} onUpdate={(current, patch) => update.mutate({ ...scope, id: current.id, expectedVersion: current.version, patch })} onDelete={deleteCategory} />)}</ul> : <p>No categories yet. Add one above, then apply it from any creation form.</p>}</div><div className="lifecycle-manager"><span>Archive active workspace items</span><p>Use archive for cleanup. It is safer than permanent deletion and preserves completed work, check-ins, and review history.</p>{workspace.isLoading ? <p>Loading active items…</p> : activeItems.length ? <ul>{activeItems.map(({ type, item, label }) => <li key={`${type}-${item.id}`}><span><small>{type}</small>{label}</span><Button type="button" variant="ghost" className="danger-action" disabled={busy} onClick={() => archive(type, item)}>Archive</Button></li>)}</ul> : <p>No active workspace items are available to archive.</p>}</div></DialogContent></Dialog>;
}

function AICompanion() {
  const [scope] = useState<WorkspaceScope>(() => getWorkspaceScope());
  const [today] = useState(() => localDateInTimezone(scope.timezone));
  const [thought, setThought] = useState("");
  const utils = trpc.useUtils();
  const draft = trpc.planner.ai.draft.useMutation();
  const createTask = trpc.planner.task.create.useMutation({ onSuccess: () => { utils.planner.workspace.snapshot.invalidate(); utils.planner.dashboard.invalidate(); setThought(""); draft.reset(); } });
  const createGoal = trpc.planner.goal.create.useMutation({ onSuccess: () => { utils.planner.workspace.snapshot.invalidate(); draft.reset(); } });
  const confirm = () => {
    if (!draft.data) return;
    if (draft.data.kind === "task") createTask.mutate({ ...scope, title: draft.data.title, dueLocalDate: draft.data.suggestedDueLocalDate, state: "not_started", priority: draft.data.priority, horizon: draft.data.horizon, sortOrder: 0 });
    else createGoal.mutate({ ...scope, title: draft.data.title, dueLocalDate: draft.data.suggestedDueLocalDate, state: "not_started", priority: draft.data.priority, horizon: draft.data.horizon, progressMode: "task", progressValue: 0, targetValue: 100 });
  };
  return <details className="ai-companion"><summary><span><Sparkles size={14} /> Optional companion</span><small>Draft a thought, then decide</small></summary><div className="ai-companion-body" aria-labelledby="ai-heading"><div><h3 id="ai-heading">Give a loose thought a shape.</h3><p>The companion only proposes a draft. Nothing enters your plan until you confirm it.</p></div><form onSubmit={event => { event.preventDefault(); if (thought.trim()) draft.mutate({ ...scope, todayLocalDate: today, thought: thought.trim() }); }}><Input value={thought} onChange={event => setThought(event.target.value)} placeholder="I keep postponing the budget review…" aria-label="Describe a planning thought for a draft" /><Button type="submit" className="primary-action" disabled={draft.isPending}>{draft.isPending ? <><Loader2 className="animate-spin" size={15} /> Thinking</> : <>Draft it <Sparkles size={15} /></>}</Button></form>{draft.error ? <p className="ai-error">{draft.error.message}</p> : null}{draft.data ? <div className="ai-draft"><div><span className="ai-draft-type">Proposed {draft.data.kind}</span><h3>{draft.data.title}</h3><p>{draft.data.summary}</p><small>{draft.data.priority} priority · {draft.data.horizon} horizon{draft.data.suggestedDueLocalDate ? ` · ${draft.data.suggestedDueLocalDate}` : ""}</small></div><div className="ai-draft-actions"><Button variant="ghost" onClick={() => draft.reset()}>Discard</Button><Button className="primary-action" onClick={confirm} disabled={createTask.isPending || createGoal.isPending}>Confirm draft</Button></div></div> : null}</div></details>;
}

function TaskInspector({ task, categories, open, onOpenChange, onSave }: { task: any | null; categories: any[]; open: boolean; onOpenChange: (open: boolean) => void; onSave: (patch: Record<string, unknown>) => void }) {
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [scheduled, setScheduled] = useState("");
  const [estimate, setEstimate] = useState("");
  const [priority, setPriority] = useState("medium");
  const [state, setState] = useState("not_started");
  const [categoryId, setCategoryId] = useState("none");
  const [recurrenceFrequency, setRecurrenceFrequency] = useState("none");
  const [recurrenceInterval, setRecurrenceInterval] = useState("1");
  const [recurrenceUntil, setRecurrenceUntil] = useState("");
  useEffect(() => { if (task) { const rule = task.recurrenceRule as Record<string, unknown> | null; const frequency = rule?.frequency; setTitle(task.title); setDue(task.dueLocalDate ?? ""); setScheduled(task.scheduledLocalDate ?? ""); setEstimate(task.estimateMinutes?.toString() ?? ""); setPriority(task.priority); setState(task.state); setCategoryId(task.categoryId ?? "none"); setRecurrenceFrequency(frequency === "daily" || frequency === "weekly" || frequency === "monthly" ? frequency : "none"); setRecurrenceInterval(String(Math.max(1, Number(rule?.interval) || 1))); setRecurrenceUntil(task.recurrenceUntilLocalDate ?? ""); } }, [task]);
  if (!task) return null;
  const submit = (event: FormEvent) => { event.preventDefault(); const recurrenceRule = recurrenceFrequency === "none" ? null : { frequency: recurrenceFrequency, interval: Math.max(1, Number(recurrenceInterval) || 1) }; onSave({ title: title.trim(), dueLocalDate: due || null, scheduledLocalDate: scheduled || null, estimateMinutes: estimate ? Number(estimate) : null, priority, state, categoryId: categoryId === "none" ? null : categoryId, recurrenceRule, recurrenceAnchor: recurrenceRule ? "scheduled" : null, recurrenceUntilLocalDate: recurrenceRule ? recurrenceUntil || null : null }); };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="composer-dialog task-inspector"><DialogHeader><DialogTitle>Refine the commitment</DialogTitle><DialogDescription>Dates, time intent, and priority each carry a different planning meaning.</DialogDescription></DialogHeader><form className="composer-form" onSubmit={submit}><div className="field"><Label htmlFor="task-title">Task</Label><Input id="task-title" value={title} onChange={event => setTitle(event.target.value)} /></div><div className="field-grid"><div className="field"><Label>State</Label><Select value={state} onValueChange={setState}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["not_started", "in_progress", "blocked", "completed", "archived"].map(value => <SelectItem key={value} value={value}>{value.replace("_", " ")}</SelectItem>)}</SelectContent></Select></div><div className="field"><Label>Priority</Label><Select value={priority} onValueChange={setPriority}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.keys(priorityMeta).map(value => <SelectItem key={value} value={value}>{priorityMeta[value as keyof typeof priorityMeta].label}</SelectItem>)}</SelectContent></Select></div></div><div className="field-grid"><div className="field"><Label htmlFor="task-due">Due date</Label><Input id="task-due" type="date" value={due} onChange={event => setDue(event.target.value)} /></div><div className="field"><Label htmlFor="task-scheduled">Planned date</Label><Input id="task-scheduled" type="date" value={scheduled} onChange={event => setScheduled(event.target.value)} /></div></div><div className="field-grid"><div className="field"><Label htmlFor="task-estimate">Estimate (minutes)</Label><Input id="task-estimate" type="number" min="0" max="1440" value={estimate} onChange={event => setEstimate(event.target.value)} /></div><div className="field"><Label>Category</Label><Select value={categoryId} onValueChange={setCategoryId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">No category</SelectItem>{categories.map(category => <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>)}</SelectContent></Select></div></div><div className="recurrence-fields"><div className="field"><Label>Repeat</Label><Select value={recurrenceFrequency} onValueChange={setRecurrenceFrequency}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Does not repeat</SelectItem><SelectItem value="daily">Daily</SelectItem><SelectItem value="weekly">Weekly</SelectItem><SelectItem value="monthly">Monthly</SelectItem></SelectContent></Select></div>{recurrenceFrequency !== "none" ? <><div className="field"><Label htmlFor="task-recurrence-interval">Every</Label><Input id="task-recurrence-interval" type="number" min="1" max="365" value={recurrenceInterval} onChange={event => setRecurrenceInterval(event.target.value)} /></div><div className="field"><Label htmlFor="task-recurrence-until">Stop after</Label><Input id="task-recurrence-until" type="date" value={recurrenceUntil} onChange={event => setRecurrenceUntil(event.target.value)} /></div><p className="recurrence-help">Occurrences are anchored to the task’s planned date when set, otherwise its due date.</p></> : null}</div><div className="composer-submit"><Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" className="primary-action">Save changes</Button></div></form></DialogContent></Dialog>;
}

export default function Home() {
  const [scope] = useState<WorkspaceScope>(() => getWorkspaceScope());
  const [today] = useState(() => localDateInTimezone(scope.timezone));
  const [selectedDate, setSelectedDate] = useState(today);
  const [surface, setSurface] = useState<Surface>("today");
  const [calendarMode, setCalendarMode] = useState<CalendarMode>("Day");
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerKind, setComposerKind] = useState<ComposerKind>("task");
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [quickTitle, setQuickTitle] = useState("");
  const [taskSearch, setTaskSearch] = useState("");
  const [taskFilter, setTaskFilter] = useState<"all" | "today" | "overdue">("all");
  const workspaceEnsured = useRef(false);
  const utils = trpc.useUtils();
  const range = useMemo(() => isoRange(today), [today]);
  const snapshotQuery = trpc.planner.workspace.snapshot.useQuery({ ...scope, ...range }, { refetchInterval: 30_000 });
  const dashboardQuery = trpc.planner.dashboard.useQuery({ ...scope, todayLocalDate: today, rangeStart: range.start, rangeEnd: range.end }, { refetchInterval: 30_000 });
  const ensureWorkspace = trpc.planner.workspace.ensure.useMutation();
  const createTask = trpc.planner.task.create.useMutation({ onSuccess: () => { utils.planner.workspace.snapshot.invalidate(); utils.planner.dashboard.invalidate(); } });
  const updateTask = trpc.planner.task.update.useMutation({ onSuccess: () => { utils.planner.workspace.snapshot.invalidate(); utils.planner.dashboard.invalidate(); } });
  const createGoal = trpc.planner.goal.create.useMutation({ onSuccess: () => utils.planner.workspace.snapshot.invalidate() });
  const createProject = trpc.planner.project.create.useMutation({ onSuccess: () => utils.planner.workspace.snapshot.invalidate() });
  const createHabit = trpc.planner.habit.create.useMutation({ onSuccess: () => { utils.planner.workspace.snapshot.invalidate(); utils.planner.dashboard.invalidate(); } });
  const [habitActionError, setHabitActionError] = useState<string | null>(null);
  const [lastHabitAction, setLastHabitAction] = useState<{ kind: "checkIn"; habitId: string; localDate: string; state: "completed" | "skipped" } | { kind: "clear"; habitId: string; localDate: string } | null>(null);
  const refreshHabitData = async () => { setHabitActionError(null); setLastHabitAction(null); await Promise.all([utils.planner.workspace.snapshot.invalidate(), utils.planner.dashboard.invalidate()]); };
  const habitCheckIn = trpc.planner.habit.checkIn.useMutation({ onSuccess: refreshHabitData, onError: error => setHabitActionError(error.message) });
  const clearHabitCheckIn = trpc.planner.habit.clearCheckIn.useMutation({ onSuccess: refreshHabitData, onError: error => setHabitActionError(error.message) });

  useEffect(() => {
    if (workspaceEnsured.current) return;
    workspaceEnsured.current = true;
    ensureWorkspace.mutate(scope);
  }, [scope]);

  const snapshot = snapshotQuery.data ? { ...snapshotQuery.data, habitCheckIn: snapshotQuery.data.habitCheckIns } : snapshotQuery.data;
  const activeTasks = useMemo(() => (snapshot?.tasks ?? []).filter(task => task.state !== "archived"), [snapshot?.tasks]);
  const focusTasks = useMemo(() => activeTasks.filter(task => task.scheduledLocalDate === today || task.dueLocalDate === today).sort((a, b) => (a.state === "completed" ? 1 : 0) - (b.state === "completed" ? 1 : 0)), [activeTasks, today]);
  const taskRows = useMemo(() => activeTasks.filter(task => { const matchesText = task.title.toLowerCase().includes(taskSearch.toLowerCase()); const matchesFilter = taskFilter === "all" || (taskFilter === "today" && (task.scheduledLocalDate === today || task.dueLocalDate === today)) || (taskFilter === "overdue" && Boolean(task.dueLocalDate && task.dueLocalDate < today && task.state !== "completed")); return matchesText && matchesFilter; }), [activeTasks, taskSearch, taskFilter, today]);
  const openComposer = (kind: ComposerKind) => { setComposerKind(kind); setComposerOpen(true); };
  useEffect(() => {
    const composeHabit = () => openComposer("habit");
    window.addEventListener("personal-calander:compose-habit", composeHabit);
    return () => window.removeEventListener("personal-calander:compose-habit", composeHabit);
  }, []);
  const focusTaskSearch = () => { setSurface("tasks"); window.setTimeout(() => document.querySelector<HTMLInputElement>("[data-task-search]")?.focus(), 0); };
  const invalidatePlan = () => { utils.planner.workspace.snapshot.invalidate(); utils.planner.dashboard.invalidate(); };
  const recordHabitCheckIn = (habitId: string, localDate: string, state: "completed" | "skipped") => { setHabitActionError(null); setLastHabitAction({ kind: "checkIn", habitId, localDate, state }); habitCheckIn.mutate({ ...scope, habitId, localDate, state }); };
  const undoHabitCheckIn = (habitId: string, localDate: string) => { setHabitActionError(null); setLastHabitAction({ kind: "clear", habitId, localDate }); clearHabitCheckIn.mutate({ ...scope, habitId, localDate }); };
  const retryHabitAction = () => { if (!lastHabitAction) return; if (lastHabitAction.kind === "checkIn") recordHabitCheckIn(lastHabitAction.habitId, lastHabitAction.localDate, lastHabitAction.state); else undoHabitCheckIn(lastHabitAction.habitId, lastHabitAction.localDate); };
  const toggleTask = (task: any) => updateTask.mutate({ ...scope, id: task.id, expectedVersion: task.version, patch: { state: task.state === "completed" ? "not_started" : "completed" } });
  const scheduleTask = (id: string, date: string) => { const task = activeTasks.find(item => item.id === id); if (task) updateTask.mutate({ ...scope, id: task.id, expectedVersion: task.version, patch: { scheduledLocalDate: date } }); };
  const createQuickTask = (event: FormEvent) => { event.preventDefault(); if (!quickTitle.trim()) return; createTask.mutate({ ...scope, title: quickTitle.trim(), scheduledLocalDate: today, state: "not_started", priority: "medium", horizon: "daily", sortOrder: 0 }); setQuickTitle(""); };
  const createFromComposer = (values: { title: string; categoryId: string | null; goalId: string | null; parentGoalId: string | null; goalHorizon: "monthly" | "quarterly" | "yearly"; dueLocalDate: string | null; estimateMinutes: number | null; recurrenceRule: Record<string, unknown> | null; recurrenceUntilLocalDate: string | null; habitFrequency: "daily" | "days_of_week" | "interval" | null; habitSchedule: Record<string, unknown> | null }) => {
    if (composerKind === "task") createTask.mutate({ ...scope, title: values.title, categoryId: values.categoryId, goalId: values.goalId, dueLocalDate: values.dueLocalDate, estimateMinutes: values.estimateMinutes, state: "not_started", priority: "medium", horizon: "weekly", sortOrder: 0, recurrenceRule: values.recurrenceRule, recurrenceAnchor: values.recurrenceRule ? "scheduled" : null, recurrenceUntilLocalDate: values.recurrenceUntilLocalDate });
    if (composerKind === "goal") createGoal.mutate({ ...scope, title: values.title, categoryId: values.categoryId, parentGoalId: values.parentGoalId, dueLocalDate: values.dueLocalDate, state: "not_started", priority: "medium", horizon: values.goalHorizon, progressMode: "task", progressValue: 0, targetValue: 100 });
    if (composerKind === "project") createProject.mutate({ ...scope, title: values.title, categoryId: values.categoryId, goalId: values.goalId, dueLocalDate: values.dueLocalDate, state: "not_started", priority: "medium", horizon: "quarterly" });
    if (composerKind === "habit") createHabit.mutate({ ...scope, name: values.title, categoryId: values.categoryId, goalId: values.goalId, color: "#C6F06A", frequency: values.habitFrequency ?? "daily", schedule: values.habitSchedule ?? { cadence: "daily" } });
    setComposerOpen(false);
  };

  if (snapshotQuery.isLoading || !snapshot) return <LoadingBoard />;
  if (snapshotQuery.error) return <div className="planner-error"><div><p className="eyebrow">Connection interrupted</p><h1>Planning data could not load.</h1><p>{snapshotQuery.error.message}</p><Button onClick={() => snapshotQuery.refetch()}>Try again</Button></div></div>;

  const surfaceTitle = surface === "today" ? "Today" : navItems.find(item => item.id === surface)?.label ?? "Planner";
  const categoryColors = new Map<any, string>(snapshot.categories.map(category => [category.id, category.color]));
  const modeCopy: Record<CalendarMode, string> = { Day: "Make one focused day believable.", Week: "Balance commitments across the week.", Month: "Keep due work and milestones in view.", Quarter: "Review active projects and runway.", Year: "Connect annual direction to current work." };

  const habitPending = habitCheckIn.isPending || clearHabitCheckIn.isPending;
  return <div className="planner-shell"><aside className="planner-rail"><div className="brand-lockup"><span className="brand-mark"><span /></span><span>Personal<br /><b>Calander</b></span></div><nav aria-label="Planning views" className="planner-nav">{navItems.map(item => <button key={item.id} className={cn(surface === item.id && "is-active")} onClick={() => setSurface(item.id)}><item.icon size={18} strokeWidth={1.75} /><span>{item.label}</span>{item.id === "today" && focusTasks.filter(task => task.state !== "completed").length ? <i>{focusTasks.filter(task => task.state !== "completed").length}</i> : null}</button>)}</nav><div className="rail-footer"><div className="workspace-pill"><span className="workspace-avatar">P</span><div><strong>Personal space</strong><small>{scope.timezone.replace("_", " ")}</small></div></div></div></aside><main className="planner-main"><header className="planner-topbar"><div><p className="top-date">{displayLocalDate(today, scope.timezone, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</p><h1>{surfaceTitle}</h1></div><form className="quick-capture" onSubmit={createQuickTask}><Plus size={17} /><Input value={quickTitle} onChange={event => setQuickTitle(event.target.value)} placeholder="Capture a task for today…" aria-label="Quickly capture a task" /><kbd>↵</kbd></form><div className="top-actions"><Tooltip><TooltipTrigger asChild><button className="icon-quiet" aria-label="Search tasks" onClick={focusTaskSearch}><Search size={18} /></button></TooltipTrigger><TooltipContent>Search tasks</TooltipContent></Tooltip><Button type="button" variant="ghost" onClick={() => setCategoryDialogOpen(true)}>Categories</Button><Button className="primary-action" onClick={() => openComposer("task")}><Plus size={17} /> New</Button></div></header>{surface === "today" ? <div className="today-canvas"><div className="today-columns"><FocusPanel tasks={focusTasks} categories={snapshot.categories} onToggle={toggleTask} onCompose={() => openComposer("task")} /><Timeline tasks={activeTasks} selectedDate={selectedDate} onMoveDay={amount => setSelectedDate(date => shiftLocalDate(date, amount))} onDrop={scheduleTask} /></div><div className="lower-columns"><GoalPanel goals={snapshot.goals} projects={snapshot.projects} tasks={snapshot.tasks} categories={snapshot.categories} onCompose={() => openComposer("goal")} /><HabitPanel habits={snapshot.habits} checkIns={snapshot.habitCheckIns} today={today} streaks={dashboardQuery.data?.streaks} onCheckIn={recordHabitCheckIn} onClearCheckIn={undoHabitCheckIn} onRetry={retryHabitAction} pending={habitPending} error={habitActionError} onCompose={() => openComposer("habit")} /></div><section className="planning-band"><div><span className="eyebrow">Capacity reading</span><h2>{dashboardQuery.data?.workload?.isOverCapacity ? "Today is overfull" : "Today can still breathe"}</h2><p>{dashboardQuery.data ? `${dashboardQuery.data.workload.plannedMinutes} of ${dashboardQuery.data.workload.capacityMinutes} planned minutes are committed.` : "Calculating available attention…"}</p></div><div className="capacity-meter"><span style={{ width: `${Math.min(100, (dashboardQuery.data?.workload?.ratio ?? 0) * 100)}%` }} /><small>{Math.round((dashboardQuery.data?.workload?.ratio ?? 0) * 100)}% planned</small></div></section><AnalyticsPanel dashboard={dashboardQuery.data} categories={snapshot.categories} /></div> : null}{surface === "tasks" ? <section className="work-surface"><div className="surface-toolbar"><div className="task-search"><Search size={17} /><Input data-task-search value={taskSearch} onChange={event => setTaskSearch(event.target.value)} placeholder="Search your plan" /></div><div className="filter-group"><button className={cn(taskFilter === "all" && "is-active")} onClick={() => setTaskFilter("all")}>All</button><button className={cn(taskFilter === "today" && "is-active")} onClick={() => setTaskFilter("today")}>Today</button><button className={cn(taskFilter === "overdue" && "is-active")} onClick={() => setTaskFilter("overdue")}>At risk</button></div></div><div className="task-worklist"><div className="worklist-heading"><span>{taskRows.length} tasks</span><span>Drag onto the calendar to plan</span></div>{taskRows.length ? taskRows.map(task => <TaskRow key={task.id} task={task} categoryColor={categoryColors.get(task.categoryId)} onToggle={toggleTask} onSchedule={scheduleTask} />) : <EmptyState title="No tasks match this view" detail="Clear the filters or create a new task." action={() => openComposer("task")} />}</div></section> : null}{surface === "calendar" ? <section className="calendar-surface"><div className="calendar-toolbar"><div className="calendar-mode-tabs">{(["Day", "Week", "Month", "Quarter", "Year"] as CalendarMode[]).map(mode => <button key={mode} className={cn(calendarMode === mode && "is-active")} onClick={() => setCalendarMode(mode)}>{mode}</button>)}</div><p>{modeCopy[calendarMode]}</p></div>{calendarMode === "Day" ? <Timeline tasks={activeTasks} selectedDate={selectedDate} onMoveDay={amount => setSelectedDate(date => shiftLocalDate(date, amount))} onDrop={scheduleTask} /> : <CalendarMatrix mode={calendarMode} anchor={selectedDate} tasks={activeTasks} categories={snapshot.categories} today={today} onMoveDay={amount => setSelectedDate(date => shiftLocalDate(date, amount))} />}</section> : null}{surface === "goals" ? <section className="work-surface goal-workspace"><GoalPanel goals={snapshot.goals} projects={snapshot.projects} tasks={snapshot.tasks} categories={snapshot.categories} onCompose={() => openComposer("goal")} /><div className="project-listing"><div className="panel-heading"><div><span className="eyebrow">Finite bodies of work</span><h2>Projects</h2></div><button className="text-button" onClick={() => openComposer("project")}>New project <Plus size={14} /></button></div>{snapshot.projects.length ? snapshot.projects.map(project => <div className="project-row" key={project.id}><div><strong>{project.title}</strong><span>{project.horizon} horizon{project.dueLocalDate ? ` · due ${project.dueLocalDate}` : ""}</span></div><span className={cn("state-pill", `state-${project.state}`)}>{project.state.replace("_", " ")}</span></div>) : <EmptyState title="Projects make goals executable" detail="Create a finite project and connect daily work to it." action={() => openComposer("project")} />}</div></section> : null}{surface === "habits" ? <section className="work-surface habit-workspace"><HabitPanel habits={snapshot.habits} checkIns={snapshot.habitCheckIn} today={today} streaks={dashboardQuery.data?.streaks} onCheckIn={recordHabitCheckIn} onClearCheckIn={undoHabitCheckIn} onRetry={retryHabitAction} pending={habitPending} error={habitActionError} onCompose={() => openComposer("habit")} /><HabitCalendarTracker habits={snapshot.habits} checkIns={snapshot.habitCheckIn} today={today} onCheckIn={recordHabitCheckIn} onClearCheckIn={undoHabitCheckIn} pending={habitPending} /><AnalyticsPanel dashboard={dashboardQuery.data} categories={snapshot.categories} /></section> : null}{surface === "review" ? <section className="review-surface"><div className="review-intro"><span className="eyebrow">Weekly review</span><h2>Close the loop before you open a new one.</h2><p>Separate facts from judgement: complete or classify the recurring work that is due, then write the one adjustment that deserves next week.</p><Button className="primary-action" onClick={() => setSurface("today")}>Return to today</Button></div><div className="review-workbench"><ReviewRitual sessions={snapshot.reviewSessions} /><OccurrencePanel /><PlanningHealthStrip /><DecisionSignals /></div></section> : null}</main><Composer open={composerOpen} kind={composerKind} categories={snapshot.categories} onOpenChange={setComposerOpen} onKindChange={setComposerKind} onCreate={createFromComposer} onManageCategories={() => setCategoryDialogOpen(true)} /><CategoryDialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen} categories={snapshot.categories} /></div>;
}

function CalendarMatrix({ mode, anchor, tasks, categories, today, onMoveDay }: { mode: CalendarMode; anchor: string; tasks: any[]; categories: any[]; today: string; onMoveDay: (amount: number) => void }) {
  const categoryColors = new Map(categories.map(category => [category.id, category.color]));
  const scope = useMemo(() => getWorkspaceScope(), []);
  const utils = trpc.useUtils();
  const slots = mode === "Week" ? 7 : mode === "Month" ? 35 : mode === "Quarter" ? 12 : 12;
  const step = mode === "Week" ? 1 : mode === "Month" ? 1 : mode === "Quarter" ? 7 : 30;
  const start = shiftLocalDate(anchor, mode === "Month" ? -14 : mode === "Week" ? -3 : -Math.floor(slots / 2) * step);
  const dates = Array.from({ length: slots }, (_, index) => shiftLocalDate(start, index * step));
  const refresh = () => { utils.planner.workspace.snapshot.invalidate(); utils.planner.dashboard.invalidate(); };
  const updateTask = trpc.planner.task.update.useMutation({ onSuccess: refresh });
  const scheduleFromDrop = (taskId: string, localDate: string) => { const task = tasks.find(item => item.id === taskId); if (task) updateTask.mutate({ ...scope, id: task.id, expectedVersion: task.version, patch: { scheduledLocalDate: localDate } }); };
  return <div className={cn("calendar-matrix", `matrix-${mode.toLowerCase()}`)}><div className="matrix-header"><button onClick={() => onMoveDay(-slots * step)}><ChevronLeft size={17} /></button><strong>{mode === "Year" ? anchor.slice(0, 4) : displayLocalDate(anchor, scope.timezone, { month: "long", year: "numeric" })}</strong><button onClick={() => onMoveDay(slots * step)}><ChevronRight size={17} /></button></div><p className="calendar-task-legend">Tasks and time blocks live here. Open Habits for the habit-specific calendar and check-in tracker.</p><div className="matrix-grid">{dates.map(date => { const items = tasks.filter(task => task.scheduledLocalDate === date || task.dueLocalDate === date).slice(0, 3); return <article key={date} className={cn("matrix-cell", date === today && "is-today")} onDragOver={event => event.preventDefault()} onDrop={event => scheduleFromDrop(event.dataTransfer.getData("text/plain"), date)}><time>{mode === "Quarter" || mode === "Year" ? displayLocalDate(date, scope.timezone, { month: "short", year: mode === "Year" ? "2-digit" : undefined }) : displayLocalDate(date, scope.timezone, { weekday: mode === "Week" ? "short" : undefined, month: "short", day: "numeric" })}</time>{items.map(task => <div className="matrix-task" key={task.id}><i style={{ background: categoryColors.get(task.categoryId) ?? "#C6F06A" }} />{task.title}</div>)}{items.length === 0 ? <span className="matrix-empty">—</span> : null}</article>; })}</div></div>;
}
