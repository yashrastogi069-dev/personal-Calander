import { cn } from "@/lib/utils";
import { useId } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import "./planning-insights.css";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  CircleDot,
  Clock3,
  Layers3,
  RotateCcw,
} from "lucide-react";

type PlanningInsightsWorkspaceProps = {
  dashboard: any;
  onOpenReview: () => void;
  onOpenPlan: () => void;
};

function formatMinutes(minutes: number) {
  return minutes ? `${minutes} min` : "0 min";
}

function formatDate(date: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date)
    ? `${date.slice(5, 7)}/${date.slice(8, 10)}/${date.slice(0, 4)}`
    : date;
}

function TaskPatterns({ dashboard }: { dashboard: any }) {
  const trend: { localDate: string; completed: number }[] =
    dashboard?.completionTrend ?? [];
  const categories: { id: string; name: string; count: number }[] = (
    dashboard?.categoryDistribution ?? []
  )
    .filter((item: { count: number }) => item.count > 0)
    .sort(
      (
        a: { name: string; count: number },
        b: { name: string; count: number }
      ) => b.count - a.count || a.name.localeCompare(b.name)
    );
  const total = trend.reduce((sum, point) => sum + point.completed, 0);
  const maximum = Math.max(...categories.map(point => point.count), 1);
  const range = trend.length
    ? `${formatDate(trend[0].localDate)} – ${formatDate(trend[trend.length - 1].localDate)}`
    : "No date range available";
  const fillId = `completion-fill-${useId().replaceAll(":", "")}`;

  return (
    <details className="insights-patterns" open>
      <summary>
        <span>
          <BarChart3 size={18} aria-hidden="true" />
          <strong>Task patterns</strong>
          <small>Completion pace and category load</small>
        </span>
        <span className="insights-patterns-toggle" aria-hidden="true">
          Show or hide
        </span>
      </summary>
      <div className="insights-patterns-grid">
        <section
          className="insights-chart"
          aria-labelledby="completion-chart-heading"
        >
          <div className="insights-chart-heading">
            <div>
              <h3 id="completion-chart-heading">Tasks completed over time</h3>
              <p>{range}</p>
            </div>
            <strong>
              {total} <span>completed</span>
            </strong>
          </div>
          {total > 0 ? (
            <>
              <div
                className="insights-trend-plot"
                role="img"
                aria-label={`${total} tasks completed from ${range}. Daily values follow in the list below.`}
              >
                <ResponsiveContainer width="100%" height={190}>
                  <AreaChart
                    data={trend}
                    margin={{ top: 12, right: 10, bottom: 0, left: -34 }}
                  >
                    <defs>
                      <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
                        <stop
                          offset="0%"
                          stopColor="var(--completion)"
                          stopOpacity={0.34}
                        />
                        <stop
                          offset="100%"
                          stopColor="var(--completion)"
                          stopOpacity={0.02}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke="var(--border)" />
                    <XAxis
                      dataKey="localDate"
                      tickFormatter={(value: string) => value.slice(5)}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: "var(--ink-muted)", fontSize: 11 }}
                      minTickGap={30}
                    />
                    <YAxis
                      allowDecimals={false}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: "var(--ink-muted)", fontSize: 11 }}
                      width={32}
                    />
                    <Tooltip
                      labelFormatter={value => formatDate(String(value))}
                      formatter={value => [`${value} tasks`, "Completed"]}
                      contentStyle={{
                        background: "var(--surface-elevated)",
                        border: "1px solid var(--border)",
                        borderRadius: 10,
                        color: "var(--ink)",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="completed"
                      name="Completed"
                      stroke="var(--completion)"
                      strokeWidth={2.5}
                      fill={`url(#${fillId})`}
                      dot={false}
                      activeDot={{ r: 5 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <details className="insights-chart-data">
                <summary>Read daily counts</summary>
                <ul>
                  {trend.map(point => (
                    <li key={point.localDate}>
                      <span>{formatDate(point.localDate)}</span>
                      <strong>{point.completed}</strong>
                    </li>
                  ))}
                </ul>
              </details>
            </>
          ) : (
            <p className="insights-chart-empty">
              No completed tasks in this date range. Complete a task to see your
              pace here.
            </p>
          )}
        </section>
        <section
          className="insights-chart"
          aria-labelledby="category-chart-heading"
        >
          <div className="insights-chart-heading">
            <div>
              <h3 id="category-chart-heading">Tasks by category</h3>
              <p>All current tasks · archived tasks excluded</p>
            </div>
          </div>
          {categories.length ? (
            <ol className="insights-category-bars">
              {categories.map(item => (
                <li key={item.id}>
                  <div>
                    <span>{item.name}</span>
                    <strong>{item.count}</strong>
                  </div>
                  <span className="insights-category-track" aria-hidden="true">
                    <i style={{ width: `${(item.count / maximum) * 100}%` }} />
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="insights-chart-empty">
              No current tasks have categories yet. Add a category to a task to
              see the balance here.
            </p>
          )}
        </section>
      </div>
    </details>
  );
}

export function PlanningInsightsWorkspace({
  dashboard,
  onOpenReview,
  onOpenPlan,
}: PlanningInsightsWorkspaceProps) {
  const analytics = dashboard?.analytics;
  const weeklyFocus = analytics?.weeklyFocus ?? {
    weekStart: null,
    weekEnd: null,
    plannedMinutes: 0,
    completedMinutes: 0,
  };
  const carryover = analytics?.carryoverTrend ?? [];
  const categoryAllocation = analytics?.categoryAllocation ?? [];
  const goalAllocation = analytics?.goalAllocation ?? [];
  const reviews = analytics?.reviewHistory ?? [];
  const focusScale = Math.max(
    weeklyFocus.plannedMinutes,
    weeklyFocus.completedMinutes,
    1
  );
  const carryoverScale = Math.max(
    ...carryover.map((point: any) => point.carryover),
    1
  );
  return (
    <section
      className="insights-workspace"
      aria-labelledby="insights-workspace-heading"
    >
      <header>
        <div>
          <h2 id="insights-workspace-heading">Your planning patterns</h2>
          <p>
            See completed tasks, current category load, planned time, and saved
            reviews together.
          </p>
        </div>
        <BarChart3 size={28} aria-hidden="true" />
      </header>
      <TaskPatterns dashboard={dashboard} />
      <section
        className="insights-focus"
        aria-labelledby="weekly-focus-heading"
      >
        <div className="insights-heading">
          <div>
            <span>
              <Clock3 size={15} /> Weekly focus
            </span>
            <h3 id="weekly-focus-heading">Planned and completed time</h3>
          </div>
          <small>
            {weeklyFocus.weekStart && weeklyFocus.weekEnd
              ? `${weeklyFocus.weekStart} — ${weeklyFocus.weekEnd}`
              : "Current week"}
          </small>
        </div>
        <div className="focus-comparison">
          <div>
            <div>
              <span>Planned focus</span>
              <strong>{formatMinutes(weeklyFocus.plannedMinutes)}</strong>
            </div>
            <i>
              <b
                style={{
                  width: `${Math.max(4, (weeklyFocus.plannedMinutes / focusScale) * 100)}%`,
                }}
              />
            </i>
          </div>
          <div>
            <div>
              <span>Completed focus</span>
              <strong>{formatMinutes(weeklyFocus.completedMinutes)}</strong>
            </div>
            <i>
              <b
                className="is-completed"
                style={{
                  width: `${Math.max(4, (weeklyFocus.completedMinutes / focusScale) * 100)}%`,
                }}
              />
            </i>
          </div>
        </div>
        <button type="button" onClick={onOpenPlan}>
          Open today’s plan <ArrowRight size={15} />
        </button>
      </section>
      <section className="insights-grid">
        <article className="insights-carryover">
          <div className="insights-heading">
            <div>
              <span>
                <RotateCcw size={15} /> Carryover
              </span>
              <h3>Unfinished planned work</h3>
            </div>
            <small>Daily count</small>
          </div>
          {carryover.length ? (
            <div className="carryover-bars">
              {carryover.map((point: any) => (
                <div key={point.localDate}>
                  <span
                    style={{
                      height: `${Math.max(8, (point.carryover / carryoverScale) * 82)}%`,
                    }}
                    title={`${point.localDate}: ${point.carryover} carryover`}
                  />
                  <small>{point.localDate.slice(8)}</small>
                </div>
              ))}
            </div>
          ) : (
            <p className="insights-empty">
              No dated tasks yet. Carryover appears only when a planned task
              remains unfinished on a later day.
            </p>
          )}
        </article>
        <article className="insights-allocation">
          <div className="insights-heading">
            <div>
              <span>
                <Layers3 size={15} /> Allocation
              </span>
              <h3>Planned work by category</h3>
            </div>
            <small>Current range</small>
          </div>
          {categoryAllocation.length ? (
            <div className="allocation-list">
              {categoryAllocation.map((item: any) => (
                <div key={item.id}>
                  <span>{item.name}</span>
                  <b>
                    {formatMinutes(item.plannedMinutes)} · {item.taskCount}{" "}
                    {item.taskCount === 1 ? "task" : "tasks"}
                  </b>
                </div>
              ))}
            </div>
          ) : (
            <p className="insights-empty">
              No scheduled task estimates exist in the current range.
            </p>
          )}
        </article>
        <article className="insights-allocation">
          <div className="insights-heading">
            <div>
              <span>
                <CircleDot size={15} /> Goal allocation
              </span>
              <h3>Planned work advancing goals</h3>
            </div>
            <small>Current range</small>
          </div>
          {goalAllocation.length ? (
            <div className="allocation-list">
              {goalAllocation.map((item: any) => (
                <div key={item.id}>
                  <span>{item.name}</span>
                  <b>
                    {formatMinutes(item.plannedMinutes)} · {item.taskCount}{" "}
                    {item.taskCount === 1 ? "task" : "tasks"}
                  </b>
                </div>
              ))}
            </div>
          ) : (
            <p className="insights-empty">
              Link a scheduled task or project to a goal to see allocation
              evidence.
            </p>
          )}
        </article>
      </section>
      <section
        className="insights-reviews"
        aria-labelledby="review-history-heading"
      >
        <div className="insights-heading">
          <div>
            <span>
              <CheckCircle2 size={15} /> Review history
            </span>
            <h3 id="review-history-heading">Saved review evidence</h3>
          </div>
          <button type="button" onClick={onOpenReview}>
            Open review <ArrowRight size={15} />
          </button>
        </div>
        {reviews.length ? (
          <div className="review-history-list">
            {reviews.map((review: any, index: number) => (
              <div key={`${review.kind}-${review.periodEndLocalDate}-${index}`}>
                <span
                  className={cn(
                    "review-history-status",
                    review.state === "completed" && "is-completed"
                  )}
                >
                  <CheckCircle2 size={15} />{" "}
                  {review.state === "completed"
                    ? "Completed"
                    : review.state.replaceAll("_", " ")}
                </span>
                <strong>{review.kind} review</strong>
                <small>Ended {review.periodEndLocalDate}</small>
              </div>
            ))}
          </div>
        ) : (
          <p className="insights-empty">
            No saved reviews yet. Completing a review adds factual history here.
          </p>
        )}
      </section>
    </section>
  );
}
