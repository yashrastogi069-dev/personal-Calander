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

function EmptyState({ title, detail, action }: { title: string; detail: string; action?: () => void }) {
  return (
    <div className="empty-state">
      <div className="empty-state-mark"><Plus size={18} strokeWidth={1.7} /></div>
      <div>
        <p className="empty-state-title">{title}</p>
        <p className="empty-state-copy">{detail}</p>
      </div>
      {action ? <Button variant="ghost" className="empty-state-action" onClick={action}>Shape it</Button> : null}
    </div>
  );
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
  const scope = useMemo(() => getWorkspaceScope(), []);
  const utils = trpc.useUtils();
  const saveTask = trpc.planner.task.update.useMutation({ onSuccess: () => { utils.planner.workspace.snapshot.invalidate(); utils.planner.dashboard.invalidate(); setEditorOpen(false); } });
  const createSubtask = trpc.planner.task.create.useMutation({ onSuccess: () => { utils.planner.workspace.snapshot.invalidate(); utils.planner.dashboard.invalidate(); } });

  useEffect(() => { setTitle(task.title); setDueLocalDate(task.dueLocalDate ?? ""); setScheduledLocalDate(task.scheduledLocalDate ?? ""); setEstimateMinutes(task.estimateMinutes?.toString() ?? ""); setState(task.state); }, [task]);
  const submit = (event: FormEvent) => { event.preventDefault(); if (!title.trim()) return; saveTask.mutate({ ...scope, id: task.id, expectedVersion: task.version, patch: { title: title.trim(), dueLocalDate: dueLocalDate || null, scheduledLocalDate: scheduledLocalDate || null, estimateMinutes: estimateMinutes ? Number(estimateMinutes) : null, state } }); };
  const addSubtask = () => { const subtaskTitle = window.prompt(`Add a subtask beneath “${task.title}”`); if (!subtaskTitle?.trim()) return; createSubtask.mutate({ ...scope, title: subtaskTitle.trim(), parentTaskId: task.id, goalId: task.goalId, projectId: task.projectId, categoryId: task.categoryId, state: "not_started", priority: task.priority, horizon: task.horizon, sortOrder: task.sortOrder + 1 }); };

  return <><article className={cn("task-row", completed && "is-complete")} draggable={!completed && Boolean(onSchedule)} onDragStart={event => event.dataTransfer.setData("text/plain", task.id)}>
    <TaskCheck checked={completed} label={task.title} onClick={() => onToggle(task)} />
    <div className="task-row-main"><p className="task-row-title">{task.title}</p><div className="task-row-meta">{categoryColor ? <span className="category-dot" style={{ backgroundColor: categoryColor }} /> : null}{task.dueLocalDate ? <span>{task.dueLocalDate}</span> : <span>Unscheduled</span>}{task.estimateMinutes ? <span>{task.estimateMinutes}m</span> : null}{task.state === "blocked" ? <span className="blocked-mark">Blocked</span> : null}</div></div>
    <Tooltip><TooltipTrigger asChild><button className="task-priority" aria-label={`${priority.label} priority`}><Flag size={14} className={priority.className} /></button></TooltipTrigger><TooltipContent>{priority.label} priority</TooltipContent></Tooltip>
    <div className="task-row-actions"><button className="icon-quiet" aria-label={`Add a subtask to ${task.title}`} onClick={addSubtask}><Plus size={15} /></button><button className="icon-quiet" aria-label={`Edit ${task.title}`} onClick={() => setEditorOpen(true)}><MoreHorizontal size={17} /></button></div>
  </article><Dialog open={editorOpen} onOpenChange={setEditorOpen}><DialogContent className="composer-dialog small-dialog"><DialogHeader><DialogTitle>Refine the commitment</DialogTitle><DialogDescription>Due date, planned date, and work time remain distinct so rescheduling stays honest.</DialogDescription></DialogHeader><form className="composer-form" onSubmit={submit}><div className="field"><Label htmlFor={`task-title-${task.id}`}>Task</Label><Input id={`task-title-${task.id}`} value={title} onChange={event => setTitle(event.target.value)} /></div><div className="field"><Label>State</Label><Select value={state} onValueChange={setState}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["not_started", "in_progress", "blocked", "completed", "archived"].map(value => <SelectItem key={value} value={value}>{value.replace("_", " ")}</SelectItem>)}</SelectContent></Select></div><div className="field-grid"><div className="field"><Label htmlFor={`task-due-${task.id}`}>Due date</Label><Input id={`task-due-${task.id}`} type="date" value={dueLocalDate} onChange={event => setDueLocalDate(event.target.value)} /></div><div className="field"><Label htmlFor={`task-plan-${task.id}`}>Planned date</Label><Input id={`task-plan-${task.id}`} type="date" value={scheduledLocalDate} onChange={event => setScheduledLocalDate(event.target.value)} /></div></div><div className="field"><Label htmlFor={`task-estimate-${task.id}`}>Estimate in minutes</Label><Input id={`task-estimate-${task.id}`} type="number" min="0" max="1440" value={estimateMinutes} onChange={event => setEstimateMinutes(event.target.value)} /></div><div className="composer-submit"><Button type="button" variant="ghost" onClick={() => setEditorOpen(false)}>Cancel</Button><Button type="submit" className="primary-action" disabled={saveTask.isPending}>{saveTask.isPending ? "Saving…" : "Save changes"}</Button></div></form></DialogContent></Dialog></>;
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

function ReviewRitual() {
  const scope = useMemo(() => getWorkspaceScope(), []);
  const [today] = useState(() => localDateInTimezone(scope.timezone));
  const [review, setReview] = useState<any>(null);
  const [reflection, setReflection] = useState("");
  const start = trpc.planner.review.start.useMutation({ onSuccess: setReview });
  const complete = trpc.planner.review.complete.useMutation({ onSuccess: setReview });
  const periodStartLocalDate = shiftLocalDate(today, -6);
  if (!review) return <div className="review-ritual"><span>Weekly review</span><p>Clear the week, name what changed, and choose one honest next move.</p><Button type="button" variant="ghost" onClick={() => start.mutate({ ...scope, kind: "weekly", periodStartLocalDate, periodEndLocalDate: today, snapshot: { openPeriod: true } })} disabled={start.isPending}>{start.isPending ? "Opening…" : "Begin review"}</Button></div>;
  if (review.state === "completed") return <div className="review-ritual"><span>Weekly review</span><p>Reflection saved. The next review can begin when you are ready.</p><Button type="button" variant="ghost" onClick={() => { setReview(null); setReflection(""); }}>New review</Button></div>;
  return <div className="review-ritual is-active"><span>Weekly review · {periodStartLocalDate} to {today}</span><textarea value={reflection} onChange={event => setReflection(event.target.value)} placeholder="What moved, what was blocked, and what will change next week?" aria-label="Weekly review reflection" /><Button type="button" className="primary-action" onClick={() => complete.mutate({ ...scope, id: review.id, expectedVersion: review.version, reflection: reflection.trim() || null })} disabled={complete.isPending}>{complete.isPending ? "Saving…" : "Close review"}</Button></div>;
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

function BrowserNotificationControl() {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(() => typeof Notification === "undefined" ? "unsupported" : Notification.permission);
  const requestPermission = async () => {
    if (typeof Notification === "undefined") return setPermission("unsupported");
    setPermission(await Notification.requestPermission());
  };
  const copy = permission === "unsupported" ? "This browser does not support web notifications." : permission === "granted" ? "Permission is ready. Delivery activates after VAPID credentials are configured." : permission === "denied" ? "Permission is blocked. Re-enable notifications in this browser’s site settings to continue." : "Allow notifications only if you want planning reminders on this device.";
  return <div className="notification-control"><span>Phone reminders</span><p>{copy}</p>{permission === "default" ? <Button type="button" variant="ghost" onClick={requestPermission}>Allow on this device</Button> : <span className={cn("notification-state", `is-${permission}`)}>{permission === "granted" ? "Permission ready" : permission === "denied" ? "Blocked" : "Unavailable"}</span>}</div>;
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
      <ReviewRitual />
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

function GoalPanel({ goals, projects, tasks, categories, onCompose }: { goals: any[]; projects: any[]; tasks: any[]; categories: any[]; onCompose: () => void }) {
  const categoryColors = new Map(categories.map(category => [category.id, category.color]));
  const activeGoals = goals.filter(goal => goal.state !== "archived");
  const progress = (goal: any) => {
    if (goal.progressMode === "manual" || goal.progressMode === "measure") return Math.round((goal.progressValue / Math.max(1, goal.targetValue)) * 100);
    const related = tasks.filter(task => task.goalId === goal.id || projects.find(project => project.id === task.projectId)?.goalId === goal.id);
    return related.length ? Math.round((related.filter(task => task.state === "completed").length / related.length) * 100) : 0;
  };
  return <section className="goal-panel" aria-labelledby="goals-heading"><div className="panel-heading"><div><span className="eyebrow">Longer horizon</span><h2 id="goals-heading">Goal runway</h2></div><button className="text-button" onClick={onCompose}>New goal <Plus size={14} /></button></div>{activeGoals.length ? <div className="goal-list">{activeGoals.slice(0, 3).map(goal => { const value = progress(goal); return <div className="goal-line" key={goal.id}><div className="goal-line-top"><span className="category-dot" style={{ background: goal.color || categoryColors.get(goal.categoryId) || "#C6F06A" }} /><span>{goal.title}</span><strong>{value}%</strong></div><Progress value={value} className="goal-progress" /></div>; })}</div> : <EmptyState title="Give today a destination" detail="A goal turns daily work into a visible direction." action={onCompose} />}</section>;
}

function HabitPanel({ habits, checkIns, today, streaks = [], onCheckIn, onClearCheckIn, onRetry, pending, error, onCompose }: { habits: any[]; checkIns: any[]; today: string; streaks?: { habitId: string; streak: number }[]; onCheckIn: (habitId: string, localDate: string, state: "completed" | "skipped") => void; onClearCheckIn: (habitId: string, localDate: string) => void; onRetry: () => void; pending: boolean; error: string | null; onCompose: () => void }) {
  const days = Array.from({ length: 7 }, (_, index) => shiftLocalDate(today, index - 6));
  const stateFor = (habitId: string, day: string) => checkIns.find(checkIn => checkIn.habitId === habitId && checkIn.localDate === day)?.state;
  const streakByHabit = new Map(streaks.map(item => [item.habitId, item.streak]));
  const visibleStreak = (habitId: string) => {
    if (streakByHabit.has(habitId)) return streakByHabit.get(habitId) ?? 0;
    let cursor = today;
    let streak = 0;
    for (let guard = 0; guard < 365; guard += 1) {
      const state = stateFor(habitId, cursor);
      if (state === "completed") { streak += 1; cursor = shiftLocalDate(cursor, -1); continue; }
      if (state === "skipped") { cursor = shiftLocalDate(cursor, -1); continue; }
      break;
    }
    return streak;
  };
  return <section className="habit-panel" aria-labelledby="habits-heading"><div className="panel-heading"><div><span className="eyebrow">Rhythm</span><h2 id="habits-heading">Seven-day trace</h2></div><button className="text-button" onClick={onCompose}>Add habit <Plus size={14} /></button></div>{habits.filter(habit => !habit.archivedAt).length ? <div className="habit-grid"><div className="habit-grid-days">{days.map(day => <span key={day}>{displayLocalDate(day, "UTC", { weekday: "narrow" })}</span>)}</div>{habits.filter(habit => !habit.archivedAt).slice(0, 4).map(habit => { const todayState = stateFor(habit.id, today); const isComplete = todayState === "completed"; return <div className="habit-line" key={habit.id}><span className="habit-name"><i style={{ background: habit.color }} />{habit.name}</span><span className="habit-streak">{visibleStreak(habit.id)}d</span><div className="habit-squares">{days.map(day => { const state = stateFor(habit.id, day); const canEdit = day <= today; const clear = state === "completed" || state === "skipped"; return <button key={day} type="button" className={cn("habit-square", state && `is-${state}`)} aria-label={`${clear ? "Clear" : "Complete"} ${habit.name} on ${day}`} aria-pressed={state === "completed"} onClick={() => clear ? onClearCheckIn(habit.id, day) : onCheckIn(habit.id, day, "completed")} disabled={!canEdit || pending}>{pending && day === today ? <Loader2 className="animate-spin" size={11} /> : state === "completed" ? <Check size={11} /> : state === "skipped" ? <X size={11} /> : null}</button>; })}</div><div className="habit-actions"><button type="button" className={cn("habit-primary-action", isComplete && "is-complete")} onClick={() => isComplete || todayState === "skipped" ? onClearCheckIn(habit.id, today) : onCheckIn(habit.id, today, "completed")} disabled={pending}>{pending ? "Saving…" : isComplete ? "Undo today" : todayState === "skipped" ? "Clear skip" : "Complete today"}</button>{!isComplete && todayState !== "skipped" ? <button type="button" className="habit-skip-action" onClick={() => onCheckIn(habit.id, today, "skipped")} disabled={pending}>Skip today</button> : null}</div></div>; })}</div> : <EmptyState title="Build a rhythm, not a streak" detail="Track habits with intentional skips and a visible history." action={onCompose} />}{error ? <div className="habit-feedback" role="alert"><span>{error} Your previous record has not been changed.</span><button type="button" onClick={onRetry} disabled={pending}>Retry</button></div> : <p className="habit-feedback" role="status">Tap any past or current day to complete it; tap again to undo. A skip is intentional and does not break a streak.</p>}</section>;
}

function AnalyticsPanel({ dashboard, categories }: { dashboard: any; categories: any[] }) {
  const distribution = (dashboard?.categoryDistribution ?? []).filter((item: any) => item.count > 0).map((item: any) => ({ ...item, color: categories.find(category => category.id === item.id)?.color ?? "#C6F06A" }));
  return <section className="analytics-panel" aria-labelledby="insight-heading"><div className="panel-heading"><div><span className="eyebrow">Observed pattern</span><h2 id="insight-heading">Momentum</h2></div><span className="panel-count">Past 28 days</span></div><div className="analytics-grid"><div className="trend-chart"><p className="chart-label">Completions</p>{dashboard?.completionTrend?.some((point: any) => point.completed) ? <ResponsiveContainer width="100%" height={126}><AreaChart data={dashboard.completionTrend}><defs><linearGradient id="completionFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#C6F06A" stopOpacity={0.35} /><stop offset="100%" stopColor="#C6F06A" stopOpacity={0} /></linearGradient></defs><CartesianGrid vertical={false} stroke="rgba(245,245,239,0.08)" /><XAxis dataKey="localDate" tickFormatter={(value: string) => value.slice(5)} tickLine={false} axisLine={false} tick={{ fill: "#6F766E", fontSize: 10 }} interval="preserveStartEnd" /><YAxis hide /><ChartTooltip contentStyle={{ background: "#191D1A", border: "1px solid rgba(245,245,239,0.12)", borderRadius: 10 }} labelStyle={{ color: "#D9DCD4" }} itemStyle={{ color: "#C6F06A" }} /><Area type="monotone" dataKey="completed" stroke="#C6F06A" strokeWidth={2} fill="url(#completionFill)" /></AreaChart></ResponsiveContainer> : <div className="chart-zero"><CircleDot size={18} /> Complete tasks to reveal your pace.</div>}</div><div className="distribution-chart"><p className="chart-label">Category load</p>{distribution.length ? <ResponsiveContainer width="100%" height={126}><BarChart data={distribution} layout="vertical" margin={{ left: 0, right: 8 }}><XAxis type="number" hide /><YAxis type="category" dataKey="name" width={72} tick={{ fill: "#9AA198", fontSize: 11 }} tickLine={false} axisLine={false} /><ChartTooltip contentStyle={{ background: "#191D1A", border: "1px solid rgba(245,245,239,0.12)", borderRadius: 10 }} cursor={{ fill: "rgba(245,245,239,0.05)" }} /><Bar dataKey="count" fill="#7DB8E0" radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer> : <div className="chart-zero"><Target size={18} /> Categories will reveal balance.</div>}</div></div></section>;
}

function Composer({ open, kind, categories, onOpenChange, onKindChange, onCreate, onManageCategories }: { open: boolean; kind: ComposerKind; categories: any[]; onOpenChange: (open: boolean) => void; onKindChange: (kind: ComposerKind) => void; onCreate: (values: { title: string; categoryId: string | null; dueLocalDate: string | null; estimateMinutes: number | null }) => void; onManageCategories?: () => void }) {
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState("none");
  const [dueLocalDate, setDueLocalDate] = useState("");
  const [estimate, setEstimate] = useState("");
  const label = { task: "Task", goal: "Goal", project: "Project", habit: "Habit" }[kind];
  const scope = useMemo(() => getWorkspaceScope(), []);
  const utils = trpc.useUtils();
  const createCategory = trpc.planner.category.create.useMutation({ onSuccess: () => utils.planner.workspace.snapshot.invalidate() });
  onManageCategories ??= () => {
    const name = window.prompt("Name this category");
    if (!name?.trim()) return;
    const color = window.prompt("Choose a six-digit hex color", "#7DB8E0") || "#7DB8E0";
    if (!/^#[0-9A-Fa-f]{6}$/.test(color)) return;
    createCategory.mutate({ ...scope, name: name.trim(), color });
  };
  const submit = (event: FormEvent) => { event.preventDefault(); if (!title.trim()) return; onCreate({ title: title.trim(), categoryId: categoryId === "none" ? null : categoryId, dueLocalDate: dueLocalDate || null, estimateMinutes: estimate ? Number(estimate) : null }); setTitle(""); setDueLocalDate(""); setEstimate(""); };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="composer-dialog"><DialogHeader><DialogTitle>Shape a new {label.toLowerCase()}</DialogTitle><DialogDescription>Keep it concise. You can add detail after it has a place in the plan.</DialogDescription></DialogHeader><form onSubmit={submit} className="composer-form"><div className="composer-kind">{(["task", "goal", "project", "habit"] as ComposerKind[]).map(item => <button type="button" className={cn(item === kind && "is-active")} onClick={() => onKindChange(item)} key={item}>{item}</button>)}</div><div className="field"><Label htmlFor="composer-title">Name</Label><Input id="composer-title" autoFocus value={title} onChange={event => setTitle(event.target.value)} placeholder={kind === "habit" ? "Read for 20 minutes" : kind === "goal" ? "Build a sustainable routine" : "What needs attention?"} /></div>{kind !== "habit" ? <div className="field-grid"><div className="field"><Label htmlFor="composer-date">Due date</Label><Input id="composer-date" type="date" value={dueLocalDate} onChange={event => setDueLocalDate(event.target.value)} /></div>{kind === "task" ? <div className="field"><Label htmlFor="composer-estimate">Estimate</Label><Input id="composer-estimate" type="number" min="0" max="1440" value={estimate} onChange={event => setEstimate(event.target.value)} placeholder="minutes" /></div> : null}</div> : null}<div className="field"><div className="field-label-row"><Label>Category</Label><button type="button" className="field-inline-action" onClick={onManageCategories}>New category</button></div><Select value={categoryId} onValueChange={setCategoryId}><SelectTrigger><SelectValue placeholder="No category" /></SelectTrigger><SelectContent><SelectItem value="none">No category</SelectItem>{categories.map(category => <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>)}</SelectContent></Select></div><div className="composer-submit"><Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" className="primary-action">Create {label}</Button></div></form></DialogContent></Dialog>;
}

function CategoryDialog({ open, onOpenChange, onCreate }: { open: boolean; onOpenChange: (open: boolean) => void; onCreate: (name: string, color: string) => void }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("#7DB8E0");
  const submit = (event: FormEvent) => { event.preventDefault(); if (!name.trim()) return; onCreate(name.trim(), color); setName(""); };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="composer-dialog small-dialog"><DialogHeader><DialogTitle>Define a category</DialogTitle><DialogDescription>Color provides context. Status still stays explicit in the plan.</DialogDescription></DialogHeader><form className="composer-form" onSubmit={submit}><div className="field"><Label htmlFor="category-name">Name</Label><Input id="category-name" autoFocus value={name} onChange={event => setName(event.target.value)} placeholder="Deep work" /></div><div className="field"><Label htmlFor="category-color">Color signal</Label><div className="color-input-wrap"><input id="category-color" type="color" value={color} onChange={event => setColor(event.target.value)} /><code>{color.toUpperCase()}</code></div></div><div className="composer-submit"><Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" className="primary-action">Add category</Button></div></form></DialogContent></Dialog>;
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
  useEffect(() => { if (task) { setTitle(task.title); setDue(task.dueLocalDate ?? ""); setScheduled(task.scheduledLocalDate ?? ""); setEstimate(task.estimateMinutes?.toString() ?? ""); setPriority(task.priority); setState(task.state); setCategoryId(task.categoryId ?? "none"); } }, [task]);
  if (!task) return null;
  const submit = (event: FormEvent) => { event.preventDefault(); onSave({ title: title.trim(), dueLocalDate: due || null, scheduledLocalDate: scheduled || null, estimateMinutes: estimate ? Number(estimate) : null, priority, state, categoryId: categoryId === "none" ? null : categoryId }); };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="composer-dialog task-inspector"><DialogHeader><DialogTitle>Refine the commitment</DialogTitle><DialogDescription>Dates, time intent, and priority each carry a different planning meaning.</DialogDescription></DialogHeader><form className="composer-form" onSubmit={submit}><div className="field"><Label htmlFor="task-title">Task</Label><Input id="task-title" value={title} onChange={event => setTitle(event.target.value)} /></div><div className="field-grid"><div className="field"><Label>State</Label><Select value={state} onValueChange={setState}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["not_started", "in_progress", "blocked", "completed", "archived"].map(value => <SelectItem key={value} value={value}>{value.replace("_", " ")}</SelectItem>)}</SelectContent></Select></div><div className="field"><Label>Priority</Label><Select value={priority} onValueChange={setPriority}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.keys(priorityMeta).map(value => <SelectItem key={value} value={value}>{priorityMeta[value as keyof typeof priorityMeta].label}</SelectItem>)}</SelectContent></Select></div></div><div className="field-grid"><div className="field"><Label htmlFor="task-due">Due date</Label><Input id="task-due" type="date" value={due} onChange={event => setDue(event.target.value)} /></div><div className="field"><Label htmlFor="task-scheduled">Planned date</Label><Input id="task-scheduled" type="date" value={scheduled} onChange={event => setScheduled(event.target.value)} /></div></div><div className="field-grid"><div className="field"><Label htmlFor="task-estimate">Estimate (minutes)</Label><Input id="task-estimate" type="number" min="0" max="1440" value={estimate} onChange={event => setEstimate(event.target.value)} /></div><div className="field"><Label>Category</Label><Select value={categoryId} onValueChange={setCategoryId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">No category</SelectItem>{categories.map(category => <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>)}</SelectContent></Select></div></div><div className="composer-submit"><Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" className="primary-action">Save changes</Button></div></form></DialogContent></Dialog>;
}

export default function Home() {
  const [scope] = useState<WorkspaceScope>(() => getWorkspaceScope());
  const [today] = useState(() => localDateInTimezone(scope.timezone));
  const [selectedDate, setSelectedDate] = useState(today);
  const [surface, setSurface] = useState<Surface>("today");
  const [calendarMode, setCalendarMode] = useState<CalendarMode>("Day");
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerKind, setComposerKind] = useState<ComposerKind>("task");
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

  const snapshot = snapshotQuery.data;
  const activeTasks = useMemo(() => (snapshot?.tasks ?? []).filter(task => task.state !== "archived"), [snapshot?.tasks]);
  const focusTasks = useMemo(() => activeTasks.filter(task => task.scheduledLocalDate === today || task.dueLocalDate === today).sort((a, b) => (a.state === "completed" ? 1 : 0) - (b.state === "completed" ? 1 : 0)), [activeTasks, today]);
  const taskRows = useMemo(() => activeTasks.filter(task => { const matchesText = task.title.toLowerCase().includes(taskSearch.toLowerCase()); const matchesFilter = taskFilter === "all" || (taskFilter === "today" && (task.scheduledLocalDate === today || task.dueLocalDate === today)) || (taskFilter === "overdue" && Boolean(task.dueLocalDate && task.dueLocalDate < today && task.state !== "completed")); return matchesText && matchesFilter; }), [activeTasks, taskSearch, taskFilter, today]);
  const openComposer = (kind: ComposerKind) => { setComposerKind(kind); setComposerOpen(true); };
  const invalidatePlan = () => { utils.planner.workspace.snapshot.invalidate(); utils.planner.dashboard.invalidate(); };
  const recordHabitCheckIn = (habitId: string, localDate: string, state: "completed" | "skipped") => { setHabitActionError(null); setLastHabitAction({ kind: "checkIn", habitId, localDate, state }); habitCheckIn.mutate({ ...scope, habitId, localDate, state }); };
  const undoHabitCheckIn = (habitId: string, localDate: string) => { setHabitActionError(null); setLastHabitAction({ kind: "clear", habitId, localDate }); clearHabitCheckIn.mutate({ ...scope, habitId, localDate }); };
  const retryHabitAction = () => { if (!lastHabitAction) return; if (lastHabitAction.kind === "checkIn") recordHabitCheckIn(lastHabitAction.habitId, lastHabitAction.localDate, lastHabitAction.state); else undoHabitCheckIn(lastHabitAction.habitId, lastHabitAction.localDate); };
  const toggleTask = (task: any) => updateTask.mutate({ ...scope, id: task.id, expectedVersion: task.version, patch: { state: task.state === "completed" ? "not_started" : "completed" } });
  const scheduleTask = (id: string, date: string) => { const task = activeTasks.find(item => item.id === id); if (task) updateTask.mutate({ ...scope, id: task.id, expectedVersion: task.version, patch: { scheduledLocalDate: date } }); };
  const createQuickTask = (event: FormEvent) => { event.preventDefault(); if (!quickTitle.trim()) return; createTask.mutate({ ...scope, title: quickTitle.trim(), scheduledLocalDate: today, state: "not_started", priority: "medium", horizon: "daily", sortOrder: 0 }); setQuickTitle(""); };
  const createFromComposer = (values: { title: string; categoryId: string | null; dueLocalDate: string | null; estimateMinutes: number | null }) => {
    if (composerKind === "task") createTask.mutate({ ...scope, title: values.title, categoryId: values.categoryId, dueLocalDate: values.dueLocalDate, estimateMinutes: values.estimateMinutes, state: "not_started", priority: "medium", horizon: "weekly", sortOrder: 0 });
    if (composerKind === "goal") createGoal.mutate({ ...scope, title: values.title, categoryId: values.categoryId, dueLocalDate: values.dueLocalDate, state: "not_started", priority: "medium", horizon: "yearly", progressMode: "task", progressValue: 0, targetValue: 100 });
    if (composerKind === "project") createProject.mutate({ ...scope, title: values.title, categoryId: values.categoryId, dueLocalDate: values.dueLocalDate, state: "not_started", priority: "medium", horizon: "quarterly" });
    if (composerKind === "habit") createHabit.mutate({ ...scope, name: values.title, categoryId: values.categoryId, color: "#C6F06A", frequency: "daily", schedule: { cadence: "daily" } });
    setComposerOpen(false);
  };

  if (snapshotQuery.isLoading || !snapshot) return <LoadingBoard />;
  if (snapshotQuery.error) return <div className="planner-error"><div><p className="eyebrow">Connection interrupted</p><h1>Planning data could not load.</h1><p>{snapshotQuery.error.message}</p><Button onClick={() => snapshotQuery.refetch()}>Try again</Button></div></div>;

  const surfaceTitle = surface === "today" ? "Today" : navItems.find(item => item.id === surface)?.label ?? "Planner";
  const categoryColors = new Map<any, string>(snapshot.categories.map(category => [category.id, category.color]));
  const modeCopy: Record<CalendarMode, string> = { Day: "Make one focused day believable.", Week: "Balance commitments across the week.", Month: "Keep due work and milestones in view.", Quarter: "Review active projects and runway.", Year: "Connect annual direction to current work." };

  const habitPending = habitCheckIn.isPending || clearHabitCheckIn.isPending;
  return <div className="planner-shell"><aside className="planner-rail"><div className="brand-lockup"><span className="brand-mark"><span /></span><span>Personal<br /><b>Calander</b></span></div><nav aria-label="Planning views" className="planner-nav">{navItems.map(item => <button key={item.id} className={cn(surface === item.id && "is-active")} onClick={() => setSurface(item.id)}><item.icon size={18} strokeWidth={1.75} /><span>{item.label}</span>{item.id === "today" && focusTasks.filter(task => task.state !== "completed").length ? <i>{focusTasks.filter(task => task.state !== "completed").length}</i> : null}</button>)}</nav><div className="rail-footer"><button><Command size={15} /><span>Command</span><kbd>⌘ K</kbd></button><div className="workspace-pill"><span className="workspace-avatar">P</span><div><strong>Personal space</strong><small>{scope.timezone.replace("_", " ")}</small></div></div></div></aside><main className="planner-main"><header className="planner-topbar"><div><p className="top-date">{displayLocalDate(today, scope.timezone, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</p><h1>{surfaceTitle}</h1></div><form className="quick-capture" onSubmit={createQuickTask}><Plus size={17} /><Input value={quickTitle} onChange={event => setQuickTitle(event.target.value)} placeholder="Capture a task for today…" aria-label="Quickly capture a task" /><kbd>↵</kbd></form><div className="top-actions"><Tooltip><TooltipTrigger asChild><button className="icon-quiet" aria-label="Search tasks"><Search size={18} /></button></TooltipTrigger><TooltipContent>Search tasks</TooltipContent></Tooltip><Button className="primary-action" onClick={() => openComposer("task")}><Plus size={17} /> New</Button></div></header>{surface === "today" ? <div className="today-canvas"><div className="today-columns"><FocusPanel tasks={focusTasks} categories={snapshot.categories} onToggle={toggleTask} onCompose={() => openComposer("task")} /><Timeline tasks={activeTasks} selectedDate={selectedDate} onMoveDay={amount => setSelectedDate(date => shiftLocalDate(date, amount))} onDrop={scheduleTask} /></div><div className="lower-columns"><GoalPanel goals={snapshot.goals} projects={snapshot.projects} tasks={snapshot.tasks} categories={snapshot.categories} onCompose={() => openComposer("goal")} /><HabitPanel habits={snapshot.habits} checkIns={snapshot.habitCheckIns} today={today} streaks={dashboardQuery.data?.streaks} onCheckIn={recordHabitCheckIn} onClearCheckIn={undoHabitCheckIn} onRetry={retryHabitAction} pending={habitPending} error={habitActionError} onCompose={() => openComposer("habit")} /></div><section className="planning-band"><div><span className="eyebrow">Capacity reading</span><h2>{dashboardQuery.data?.workload?.isOverCapacity ? "Today is overfull" : "Today can still breathe"}</h2><p>{dashboardQuery.data ? `${dashboardQuery.data.workload.plannedMinutes} of ${dashboardQuery.data.workload.capacityMinutes} planned minutes are committed.` : "Calculating available attention…"}</p></div><div className="capacity-meter"><span style={{ width: `${Math.min(100, (dashboardQuery.data?.workload?.ratio ?? 0) * 100)}%` }} /><small>{Math.round((dashboardQuery.data?.workload?.ratio ?? 0) * 100)}% planned</small></div></section><AnalyticsPanel dashboard={dashboardQuery.data} categories={snapshot.categories} /></div> : null}{surface === "tasks" ? <section className="work-surface"><div className="surface-toolbar"><div className="task-search"><Search size={17} /><Input value={taskSearch} onChange={event => setTaskSearch(event.target.value)} placeholder="Search your plan" /></div><div className="filter-group"><button className={cn(taskFilter === "all" && "is-active")} onClick={() => setTaskFilter("all")}>All</button><button className={cn(taskFilter === "today" && "is-active")} onClick={() => setTaskFilter("today")}>Today</button><button className={cn(taskFilter === "overdue" && "is-active")} onClick={() => setTaskFilter("overdue")}>At risk</button></div><button className="filter-button"><ListFilter size={16} /> Filters</button><button className="filter-button"><ArrowDownUp size={16} /> Sort</button></div><div className="task-worklist"><div className="worklist-heading"><span>{taskRows.length} tasks</span><span>Drag onto the calendar to plan</span></div>{taskRows.length ? taskRows.map(task => <TaskRow key={task.id} task={task} categoryColor={categoryColors.get(task.categoryId)} onToggle={toggleTask} onSchedule={scheduleTask} />) : <EmptyState title="No tasks match this view" detail="Clear the filters or create a new task." action={() => openComposer("task")} />}</div></section> : null}{surface === "calendar" ? <section className="calendar-surface"><div className="calendar-toolbar"><div className="calendar-mode-tabs">{(["Day", "Week", "Month", "Quarter", "Year"] as CalendarMode[]).map(mode => <button key={mode} className={cn(calendarMode === mode && "is-active")} onClick={() => setCalendarMode(mode)}>{mode}</button>)}</div><p>{modeCopy[calendarMode]}</p></div>{calendarMode === "Day" ? <Timeline tasks={activeTasks} selectedDate={selectedDate} onMoveDay={amount => setSelectedDate(date => shiftLocalDate(date, amount))} onDrop={scheduleTask} /> : <CalendarMatrix mode={calendarMode} anchor={selectedDate} tasks={activeTasks} categories={snapshot.categories} today={today} onMoveDay={amount => setSelectedDate(date => shiftLocalDate(date, amount))} />}</section> : null}{surface === "goals" ? <section className="work-surface goal-workspace"><GoalPanel goals={snapshot.goals} projects={snapshot.projects} tasks={snapshot.tasks} categories={snapshot.categories} onCompose={() => openComposer("goal")} /><div className="project-listing"><div className="panel-heading"><div><span className="eyebrow">Finite bodies of work</span><h2>Projects</h2></div><button className="text-button" onClick={() => openComposer("project")}>New project <Plus size={14} /></button></div>{snapshot.projects.length ? snapshot.projects.map(project => <div className="project-row" key={project.id}><div><strong>{project.title}</strong><span>{project.horizon} horizon{project.dueLocalDate ? ` · due ${project.dueLocalDate}` : ""}</span></div><span className={cn("state-pill", `state-${project.state}`)}>{project.state.replace("_", " ")}</span></div>) : <EmptyState title="Projects make goals executable" detail="Create a finite project and connect daily work to it." action={() => openComposer("project")} />}</div></section> : null}{surface === "habits" ? <section className="work-surface habit-workspace"><HabitPanel habits={snapshot.habits} checkIns={snapshot.habitCheckIns} today={today} streaks={dashboardQuery.data?.streaks} onCheckIn={recordHabitCheckIn} onClearCheckIn={undoHabitCheckIn} onRetry={retryHabitAction} pending={habitPending} error={habitActionError} onCompose={() => openComposer("habit")} /><AnalyticsPanel dashboard={dashboardQuery.data} categories={snapshot.categories} /></section> : null}{surface === "review" ? <section className="review-surface"><div className="review-intro"><span className="eyebrow">A gentle reconciliation</span><h2>Close the loop before you open a new one.</h2><p>A good review separates facts from judgement: what moved, what became blocked, and what deserves a place in the next period.</p><Button className="primary-action" onClick={() => setSurface("today")}>Return to today</Button></div><div className="review-steps"><article><span>01</span><h3>Clear signals</h3><p>{focusTasks.filter(task => task.state !== "completed").length} tasks still ask for a decision today.</p></article><article><span>02</span><h3>Read capacity</h3><p>{dashboardQuery.data?.workload?.isOverCapacity ? "The current plan needs less commitment or more time." : "The current plan is within the capacity you set."}</p></article><article><span>03</span><h3>Choose tomorrow</h3><p>Schedule only the next action that makes a goal more likely.</p></article></div></section> : null}</main><Composer open={composerOpen} kind={composerKind} categories={snapshot.categories} onOpenChange={setComposerOpen} onKindChange={setComposerKind} onCreate={createFromComposer} /></div>;
}

function CalendarMatrix({ mode, anchor, tasks, categories, today, onMoveDay }: { mode: CalendarMode; anchor: string; tasks: any[]; categories: any[]; today: string; onMoveDay: (amount: number) => void }) {
  const categoryColors = new Map(categories.map(category => [category.id, category.color]));
  const scope = useMemo(() => getWorkspaceScope(), []);
  const utils = trpc.useUtils();
  const slots = mode === "Week" ? 7 : mode === "Month" ? 35 : mode === "Quarter" ? 12 : 12;
  const step = mode === "Week" ? 1 : mode === "Month" ? 1 : mode === "Quarter" ? 7 : 30;
  const start = shiftLocalDate(anchor, mode === "Month" ? -14 : mode === "Week" ? -3 : -Math.floor(slots / 2) * step);
  const dates = Array.from({ length: slots }, (_, index) => shiftLocalDate(start, index * step));
  const habitRange = useMemo(() => ({ start: dates[0] ?? anchor, end: dates[dates.length - 1] ?? anchor }), [anchor, dates.join("|")]);
  const habitSnapshot = trpc.planner.workspace.snapshot.useQuery({ ...scope, ...habitRange });
  const refresh = () => { utils.planner.workspace.snapshot.invalidate(); utils.planner.dashboard.invalidate(); };
  const updateTask = trpc.planner.task.update.useMutation({ onSuccess: refresh });
  const habitCheckIn = trpc.planner.habit.checkIn.useMutation({ onSuccess: refresh });
  const clearHabitCheckIn = trpc.planner.habit.clearCheckIn.useMutation({ onSuccess: refresh });
  const scheduleFromDrop = (taskId: string, localDate: string) => { const task = tasks.find(item => item.id === taskId); if (task) updateTask.mutate({ ...scope, id: task.id, expectedVersion: task.version, patch: { scheduledLocalDate: localDate } }); };
  const habitPending = habitCheckIn.isPending || clearHabitCheckIn.isPending;
  return <div className={cn("calendar-matrix", `matrix-${mode.toLowerCase()}`)}><div className="matrix-header"><button onClick={() => onMoveDay(-slots * step)}><ChevronLeft size={17} /></button><strong>{mode === "Year" ? anchor.slice(0, 4) : displayLocalDate(anchor, scope.timezone, { month: "long", year: "numeric" })}</strong><button onClick={() => onMoveDay(slots * step)}><ChevronRight size={17} /></button></div><p className="calendar-habit-legend">Habits are shown on the dates they are scheduled. Complete or undo a past or current habit directly here.</p><div className="matrix-grid">{dates.map(date => { const items = tasks.filter(task => task.scheduledLocalDate === date || task.dueLocalDate === date).slice(0, 3); const dueHabits = (habitSnapshot.data?.habits ?? []).filter(habit => !habit.archivedAt && isHabitScheduledOnLocalDate(habit, date)).slice(0, 2); return <article key={date} className={cn("matrix-cell", date === today && "is-today")} onDragOver={event => event.preventDefault()} onDrop={event => scheduleFromDrop(event.dataTransfer.getData("text/plain"), date)}><time>{mode === "Quarter" || mode === "Year" ? displayLocalDate(date, scope.timezone, { month: "short", year: mode === "Year" ? "2-digit" : undefined }) : displayLocalDate(date, scope.timezone, { weekday: mode === "Week" ? "short" : undefined, month: "short", day: "numeric" })}</time>{items.map(task => <div className="matrix-task" key={task.id}><i style={{ background: categoryColors.get(task.categoryId) ?? "#C6F06A" }} />{task.title}</div>)}{dueHabits.map(habit => { const state = (habitSnapshot.data?.habitCheckIns ?? []).find(checkIn => checkIn.habitId === habit.id && checkIn.localDate === date)?.state; const editable = date <= today; const isDone = state === "completed" || state === "skipped"; return <button type="button" key={habit.id} className={cn("matrix-habit", state && `is-${state}`)} aria-label={`${isDone ? "Clear" : "Complete"} ${habit.name} on ${date}`} disabled={!editable || habitPending} onClick={() => isDone ? clearHabitCheckIn.mutate({ ...scope, habitId: habit.id, localDate: date }) : habitCheckIn.mutate({ ...scope, habitId: habit.id, localDate: date, state: "completed" })}><i style={{ background: habit.color }} />{state === "completed" ? <Check size={11} /> : null}<span>{habit.name}</span></button>; })}{items.length === 0 && dueHabits.length === 0 ? <span className="matrix-empty">—</span> : null}</article>; })}</div></div>;
}
