import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DashboardView, daysBetween, layoutScheduleItems } from "./DashboardView";
import { FocusSessionContext, type FocusSessionValue } from "@/features/focus/FocusSessionContext";
import { dashboardFixture, emptyDashboardFixture, FIXTURE_TIMEZONE, noopDashboardActions } from "./dashboardFixture";
import type { DashboardModel, DashboardScheduleItem } from "./dashboardTypes";

function matches(source: string, pattern: RegExp): RegExpExecArray[] {
  const found: RegExpExecArray[] = [];
  const global = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`);
  for (let match = global.exec(source); match; match = global.exec(source)) found.push(match);
  return found;
}

function render(model: DashboardModel = dashboardFixture, actions = noopDashboardActions()) {
  return renderToStaticMarkup(<DashboardView model={model} actions={actions} timezone={FIXTURE_TIMEZONE} />);
}

/** Visible text only, tags stripped and whitespace collapsed. */
function text(html: string) {
  return html.replace(/<[^>]+>/g, " ").replace(/&#x27;|&#39;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ");
}

describe("DashboardView", () => {
  it("renders a labelled dashboard region with one labelled section per card", () => {
    const html = render();
    expect(html).toMatch(/^<section class="pc-dash" aria-label="Dashboard">/);
    const labelled = matches(html, /<section[^>]*aria-labelledby="([^"]+)"/g).map(match => match[1]);
    expect(labelled.length).toBeGreaterThanOrEqual(9);
    for (const id of labelled) expect(html).toMatch(new RegExp(`<h[23][^>]*id="${id.replace(/[:]/g, "\\:")}"`));
  });

  it("shows the hero counts and only the non-zero pills", () => {
    const view = text(render());
    expect(view).toContain("Today's commitments");
    expect(view).toMatch(/3 \/ 5 done/);
    expect(view).toContain("2 due today");
    expect(view).toContain("1 overdue");
    expect(view).toContain("2h 10m focus left");

    const quietHtml = render({ ...dashboardFixture, commitments: { ...dashboardFixture.commitments, dueToday: 0, overdue: 0, openPlannedMinutes: null } });
    const quiet = text(quietHtml.slice(0, quietHtml.indexOf("pc-dash-area-habit")));
    expect(quiet).toMatch(/3 \/ 5 done/);
    expect(quiet).not.toContain("due today");
    expect(quiet).not.toContain("overdue");
    expect(quiet).not.toContain("focus left");
  });

  it("renders the KPI facts from the model", () => {
    const view = text(render());
    expect(view).toContain("82%");
    expect(view).toContain("23 of 28 check-ins");
    expect(view).toContain("6h 30m");
    expect(view).toContain("of 10h planned");
    expect(view).toMatch(/Work 4h/);
    expect(view).toMatch(/today · 1 overdue/);
    expect(view).toContain("Planned 3h 15m · Free 4h 30m");
  });

  it("shows every empty state for an empty workspace", () => {
    const view = text(render(emptyDashboardFixture));
    expect(view).toContain("Nothing committed yet");
    expect(view).toContain("No scheduled habits yet");
    expect(view).toContain("No focus logged this week");
    expect(view).toContain("Nothing due");
    expect(view).toContain("Nothing is scheduled today");
    expect(view).toContain("You're clear for now");
    expect(view).toContain("Nothing else is timed today");
    expect(view).toContain("Nothing committed this week");
    expect(view).toContain("No active projects");
    expect(view).toContain("No milestones in the next 30 days");
    expect(view).toContain("No habits due today");
    expect(view).toContain("Plan the day");
    expect(view).not.toContain("unscheduled task");
  });

  it("shows focus actual as tracked when nothing planned is estimated", () => {
    const view = text(render({ ...dashboardFixture, focusWeek: { ...dashboardFixture.focusWeek, plannedMinutes: null } }));
    expect(view).toContain("tracked");
    expect(view).not.toContain("of 10h planned");
  });

  it("draws the now-line only when nowMinute is known", () => {
    const withNow = render();
    expect(withNow).toContain('data-testid="dashboard-now-line"');
    // The line is its own element (drawn behind the blocks); the time pill sits in the gutter.
    expect(withNow).toMatch(/class="pc-dash-now-line"[\s\S]*?class="pc-dash-now-time/);
    expect(text(withNow)).toContain("10:45 AM");

    const withoutNow = render({ ...dashboardFixture, schedule: { ...dashboardFixture.schedule, nowMinute: null } });
    expect(withoutNow).not.toContain("dashboard-now-line");
    expect(withoutNow).not.toContain("pc-dash-now-line");
  });

  it("formats schedule times in the workspace timezone and marks appointments busy", () => {
    const view = text(render());
    expect(view).toContain("11:00 AM-12:00 PM");
    expect(view).toContain("Team sync");
    expect(view).toMatch(/10:00 AM-10:30 AM · busy/);
    expect(view).toContain("2 unscheduled tasks");
  });

  it("lists later-today items, or says nothing else is timed", () => {
    const view = text(render());
    expect(view).toContain("Later today");
    expect(view).toContain("Lunch with Priya");
    expect(view).toContain("1:00 PM");
    expect(view).not.toContain("Nothing else is timed today");

    expect(text(render({ ...dashboardFixture, laterToday: [] }))).toContain("Nothing else is timed today");
  });

  it("describes up next with its timing, project and actions", () => {
    const view = text(render());
    expect(view).toContain("Up next · in 15 min");
    expect(view).toContain("Draft portfolio case study");
    expect(view).toContain("Part of Launch portfolio site");
    expect(view).toContain("Start focus");
    expect(text(render({ ...dashboardFixture, upNext: { ...dashboardFixture.upNext!, timing: "now", minutesUntil: null } }))).toMatch(/\bNow\b/);
    expect(text(render({ ...dashboardFixture, upNext: { ...dashboardFixture.upNext!, timing: "anytime", startsAt: null, endsAt: null, minutesUntil: null } }))).toContain("Anytime");
  });

  it("disables habit check-ins without a handler and exposes pressed state", () => {
    const enabled = render();
    expect(enabled).toMatch(/aria-pressed="true"[^>]*aria-label="Check in Walk 20 min"/);
    expect(enabled).toMatch(/aria-pressed="false"[^>]*aria-label="Check in Read 20 pages"/);
    expect(enabled).not.toMatch(/class="pc-dash-check"[^>]*disabled/);

    const offline = render(dashboardFixture, noopDashboardActions({ checkInHabit: undefined }));
    const checks = matches(offline, /<button[^>]*class="pc-dash-check"[^>]*>/g).map(match => match[0]);
    expect(checks).toHaveLength(4);
    for (const check of checks) expect(check).toContain("disabled");

    const view = text(enabled);
    expect(view).toContain("Checked in 1 of 4");
    expect(view).toContain("Done · 12-day streak");
    expect(view).toContain("Streak of 6");
    expect(view).toContain("3 of 5 this week");
  });

  it("renders project progress, status words and milestones", () => {
    const view = text(render());
    expect(view).toContain("6 of 10 tasks · due 30 Nov");
    expect(view).toContain("At risk");
    expect(view).toContain("On track");
    expect(view).toContain("Portfolio v1 · 18 Oct");
  });

  it("keeps the legacy overview routes as quiet links", () => {
    const html = render();
    expect(html).toContain('aria-label="Open weekly objectives"');
    expect(html).toContain('aria-label="Open saved reviews"');
    expect(html).toContain('aria-label="Open goals"');
  });

  it("gives week rhythm bars a text equivalent and a today bubble", () => {
    const html = render();
    expect(html).toContain('aria-label="Today: 3 of 5 done"');
    expect(html).toContain('aria-label="Mon: 4 of 5 done"');
    expect(html).toContain('aria-label="Sun: 0 committed"');
    expect(html).toContain("pc-dash-bar-tick");
    expect(text(html)).toContain("7 of 24 done this week");
  });

  it("gives card titles a decorative icon without changing their accessible names", () => {
    const html = render();
    for (const title of ["Today's commitments", "Schedule", "Week rhythm", "Goals &amp; Projects", "Habits due today"]) {
      const heading = new RegExp(`<h2 id="[^"]+" class="pc-dash-title"><svg[^>]*aria-hidden="true"[^>]*>[\\s\\S]*?</svg><span>${title.replace(/'/g, "(?:'|&#x27;)")}</span></h2>`);
      expect(html, title).toMatch(heading);
    }
  });

  it("shows a live dot only while up next is running now", () => {
    expect(render()).not.toContain("pc-live");
    const now = render({ ...dashboardFixture, upNext: { ...dashboardFixture.upNext!, timing: "now", minutesUntil: null } });
    expect(now).toMatch(/<span class="pc-live pc-dash-live" aria-hidden="true"><\/span>Now/);
  });

  it("keeps every check mark in the DOM and never celebrates on first render", () => {
    const html = render();
    expect(matches(html, /class="lucide lucide-check pc-dash-check-mark"/g)).toHaveLength(dashboardFixture.habitsToday.length);
    expect(html).not.toContain("is-celebrating");
    expect(html).not.toContain("pc-dash-tick");
    // The streak flame appears only beside a completed habit with a real streak.
    expect(matches(html, /pc-dash-streak/g)).toHaveLength(dashboardFixture.habitsToday.filter(habit => habit.state === "completed" && habit.streak > 1).length);
  });

  it("marks the hero complete only when every commitment is done", () => {
    const heroOf = (html: string) => html.slice(0, html.indexOf("pc-dash-area-habit"));
    expect(heroOf(render())).not.toContain("is-complete");
    expect(heroOf(render())).not.toContain("pc-dash-hero-check");
    const all = { ...dashboardFixture.commitments, done: dashboardFixture.commitments.total, segments: dashboardFixture.commitments.segments.map(() => "done" as const) };
    const complete = heroOf(render({ ...dashboardFixture, commitments: all }));
    expect(complete).toContain("pc-dash-hero is-complete");
    expect(complete).toContain("pc-dash-hero-check");
    expect(heroOf(render(emptyDashboardFixture))).not.toContain("is-complete");
  });

  it("gives screen readers the final figure next to each animated count", () => {
    const html = render();
    expect(html).toMatch(/<span aria-hidden="true">82%<\/span><span class="pc-dash-sr">82%<\/span>/);
  });

  it("swaps the due dot for a state icon", () => {
    expect(render()).toMatch(/pc-dash-due-icon"><svg[^>]*lucide-alarm-clock/);
    expect(render(emptyDashboardFixture)).toMatch(/pc-dash-due-icon"><svg[^>]*lucide-calendar-check/);
  });

  it("never invents explanatory copy", () => {
    for (const model of [dashboardFixture, emptyDashboardFixture]) {
      const view = text(render(model)).toLowerCase();
      expect(view).not.toContain("why it matters");
      expect(view).not.toContain("why:");
    }
  });
});

describe("layoutScheduleItems", () => {
  const local = (iso: string) => {
    const date = new Date(iso);
    return { localDate: iso.slice(0, 10), minute: date.getUTCHours() * 60 + date.getUTCMinutes() };
  };
  const item = (id: string, start: string, end: string): DashboardScheduleItem => ({
    id, kind: "task", title: id, startsAt: `2026-10-13T${start}:00.000Z`, endsAt: `2026-10-13T${end}:00.000Z`, done: false, tone: "work", categoryName: null, taskId: id,
  });

  it("lists all-day appointments apart from the hourly timeline and shows unknown planned time as a dash", () => {
    const html = render();
    expect(html).toContain('aria-label="All day"');
    expect(text(html)).toContain("All day Synthetic public holiday");
    const unknown = text(render({ ...dashboardFixture, schedule: { ...dashboardFixture.schedule, plannedMinutes: null } }));
    expect(unknown).toContain("Planned — · Free");
  });

  it("shows no status pill for a project without roadmap evidence", () => {
    const [first, ...rest] = dashboardFixture.projects;
    const pills = (html: string) => matches(html, /class="pc-status /g).length;
    const baseline = pills(render());
    expect(baseline).toBe(dashboardFixture.projects.length);
    expect(pills(render({ ...dashboardFixture, projects: [{ ...first, status: null, statusLabel: null }, ...rest] }))).toBe(baseline - 1);
  });

  it("disables habit check-ins while a habit write is pending and surfaces its error", () => {
    const actions = { ...noopDashboardActions(), checkInHabit: () => {} };
    const idle = renderToStaticMarkup(<DashboardView model={dashboardFixture} actions={actions} timezone={FIXTURE_TIMEZONE} />);
    expect(matches(idle, /aria-label="Check in [^"]+" disabled=""/g)).toHaveLength(0);
    const busy = renderToStaticMarkup(<DashboardView model={dashboardFixture} actions={actions} timezone={FIXTURE_TIMEZONE} habitPending habitError="Reconnect before recording a habit. Nothing was saved." />);
    expect(matches(busy, /aria-label="Check in [^"]+" disabled=""/g)).toHaveLength(dashboardFixture.habitsToday.length);
    expect(busy).toContain('role="alert"');
    expect(text(busy)).toContain("Reconnect before recording a habit.");
  });

  it("places overlapping items side by side and leaves separate items full width", () => {
    const placed = layoutScheduleItems([item("a", "09:00", "10:00"), item("b", "09:30", "10:30"), item("c", "11:00", "12:00")], "2026-10-13", 8, 18, local);
    const byId = Object.fromEntries(placed.map(entry => [entry.item.id, entry]));
    expect(byId.a).toMatchObject({ col: 0, cols: 2 });
    expect(byId.b).toMatchObject({ col: 1, cols: 2 });
    expect(byId.c).toMatchObject({ col: 0, cols: 1 });
  });

  it("reuses a freed column inside one overlap cluster and clamps to the window", () => {
    const placed = layoutScheduleItems([item("long", "09:00", "12:00"), item("x", "09:00", "10:00"), item("y", "10:00", "11:00"), item("early", "06:00", "09:30")], "2026-10-13", 8, 18, local);
    const byId = Object.fromEntries(placed.map(entry => [entry.item.id, entry]));
    expect(byId.early.start).toBe(8 * 60);
    // "early" ends at 9:30, so "y" (10:00) takes its freed column instead of opening a fourth.
    expect(byId.y.col).toBe(byId.early.col);
    expect(Math.max(...placed.map(entry => entry.cols))).toBe(3);
  });
});

describe("Next 30 days strip", () => {
  it("lists every milestone as its own row, so labels cannot collide", () => {
    const html = render({
      ...dashboardFixture,
      milestones: [
        { id: "a", title: "Alpha", dueLocalDate: "2026-10-14", offsetPercent: 3 },
        { id: "b", title: "Beta", dueLocalDate: "2026-10-15", offsetPercent: 7 },
        { id: "c", title: "Gamma", dueLocalDate: "2026-10-16", offsetPercent: 10 },
      ],
    });
    expect(matches(html, /class="pc-dash-strip-marker/g)).toHaveLength(3);
    const list = html.slice(html.indexOf('class="pc-dash-strip-list"'));
    expect(matches(list, /<li/g).length).toBeGreaterThanOrEqual(3);
    expect(text(list)).toMatch(/Alpha · 14 Oct/);
  });

  it("counts whole days between local dates", () => {
    expect(daysBetween("2026-10-13", "2026-10-13")).toBe(0);
    expect(daysBetween("2026-10-13", "2026-10-14")).toBe(1);
    expect(daysBetween("2026-10-30", "2026-11-12")).toBe(13);
  });
});

function focusValue(overrides: Partial<FocusSessionValue>): FocusSessionValue {
  const noop = () => {};
  return {
    scope: { workspaceId: "w", timezone: FIXTURE_TIMEZONE } as FocusSessionValue["scope"],
    today: "2026-10-13", snapshot: {}, online: true, session: null, task: null, title: "Draft Q4 report", toneClass: "pc-tone-work",
    nextMeeting: null, pending: false, error: null, clearError: noop, pause: noop, resume: noop, finish: noop, finishing: false,
    finishError: null, clearFinishError: noop, lastSaved: null, handoff: null, recentHandoff: null, dismissHandoff: noop, sessions: [],
    durableFollowUp: false, saveFollowUp: noop, followUpPending: false, followUpError: null, clearFollowUpError: noop, savedFlash: false,
    celebrateId: null, finishSheetOpen: false, openFinish: noop, closeFinish: noop, onOpenFocus: noop, onOpenTask: noop, onOpenPlan: noop,
    onStartAnother: noop,
    ...overrides,
  };
}

function renderWithFocus(value: FocusSessionValue) {
  return renderToStaticMarkup(
    <FocusSessionContext.Provider value={value}>
      <DashboardView model={dashboardFixture} actions={noopDashboardActions()} timezone={FIXTURE_TIMEZONE} />
    </FocusSessionContext.Provider>
  );
}

describe("Dashboard focus card", () => {
  const live = { id: "s1", state: "active", activeSeconds: 14 * 60 + 32, lastResumedAt: null, targetMinutes: 25, version: 1 } as FocusSessionValue["session"];

  it("is the white weekly card with a Start focus row when idle", () => {
    const html = render();
    const card = html.slice(html.indexOf("pc-dash-area-focus"), html.indexOf("pc-dash-area-due"));
    expect(card).toContain("pc-dash-kpi");
    expect(card).not.toContain("pc-dash-night");
    expect(text(card)).toContain("Focus this week");
    expect(text(card)).toContain("Start focus on Draft portfolio case study");
  });

  it("becomes the night instrument while a session runs, with labelled controls", () => {
    const html = renderWithFocus(focusValue({ session: live }));
    const card = html.slice(html.indexOf("pc-dash-area-focus"), html.indexOf("pc-dash-area-due"));
    expect(card).toContain("pc-dash-night pc-on-night pc-dash-focus-live pc-tone-work");
    expect(card).toContain('class="pc-dial pc-dial-sm is-running');
    expect(text(card)).toContain("Focusing");
    expect(text(card)).toContain("Draft Q4 report");
    expect(card).toMatch(/role="timer"[^>]*>14 minutes of 25, Draft Q4 report</);
    expect(text(card)).toMatch(/Pause/);
    expect(text(card)).toMatch(/Finish/);
    expect(card).toContain("this week");
  });

  it("guards controls offline and reads Resume while paused", () => {
    const paused = renderWithFocus(focusValue({ session: { ...live!, state: "paused" } as FocusSessionValue["session"] }));
    expect(text(paused.slice(paused.indexOf("pc-dash-area-focus"), paused.indexOf("pc-dash-area-due")))).toContain("Resume");
    const offline = renderWithFocus(focusValue({ session: live, online: false }));
    const card = offline.slice(offline.indexOf("pc-dash-area-focus"), offline.indexOf("pc-dash-area-due"));
    expect(card).toMatch(/disabled=""[^>]*>[\s\S]*?Offline/);
  });

  it("offers Open focus, not a second Start focus, on the Up next card while a session is open", () => {
    const upCard = (html: string) => text(html.slice(html.indexOf("pc-dash-area-up"), html.indexOf("pc-dash-later")));
    const sameTask = renderWithFocus(focusValue({ session: { ...live!, taskId: dashboardFixture.upNext!.taskId } as FocusSessionValue["session"] }));
    expect(upCard(sameTask)).toContain("Focusing · Open");
    expect(upCard(sameTask)).not.toContain("Start focus");
    const otherTask = renderWithFocus(focusValue({ session: { ...live!, taskId: "another" } as FocusSessionValue["session"] }));
    expect(upCard(otherTask)).toContain("Open focus");
    expect(upCard(renderWithFocus(focusValue({})))).toContain("Start focus");
  });

  it("says Saved with a next-step link for a recent finish", () => {
    const html = renderWithFocus(focusValue({ recentHandoff: { id: "s0", version: 2, taskId: "t", taskTitle: "Draft Q4 report", outcome: "continue", note: "", nextStepAction: null, nextStepTaskId: null, activeSeconds: 25 * 60, targetMinutes: 25, endedAt: null, state: "completed" } }));
    const card = html.slice(html.indexOf("pc-dash-area-focus"), html.indexOf("pc-dash-area-due"));
    expect(text(card)).toContain("Saved · 25m on Draft Q4 report");
    expect(text(card)).toContain("Choose next step");
  });
});
