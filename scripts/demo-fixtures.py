"""Rich, browser-only demo dataset and a stateful tRPC interceptor for local previews.

Everything here is synthetic and lives in Python memory for one browser context.
`fixtures(now, tz)` builds a realistic planner snapshot relative to the real clock;
`install_demo(context, url, ...)` intercepts every API request so nothing reaches a
live database, and common mutations (task, habit, focus, daily plan, capture) are
applied to the in-memory state so the UI refetches real-looking results.
"""
from __future__ import annotations

import copy
import json
import random
from datetime import date, datetime, time, timedelta, timezone
from typing import Any
from urllib.parse import parse_qs, unquote, urlparse
from zoneinfo import ZoneInfo

WORKSPACE_ID = "demo-workspace-0001"
CONNECTION_ID = "demo-google-calendar"
USER = {"id": 1, "authUserId": "22222222-2222-4222-8222-222222222222", "name": "Yash (demo)", "email": "demo@example.invalid", "role": "user"}

CATEGORIES = [
    ("cat-work", "Work", "#2f6fe4"),
    ("cat-health", "Health", "#0f9d8a"),
    ("cat-learning", "Learning", "#c27612"),
    ("cat-personal", "Personal", "#7a5af0"),
    ("cat-social", "Social", "#e0567a"),
]

SNAPSHOT_ARRAYS = [
    "categories", "goals", "milestones", "projects", "projectDependencies", "tasks", "habits", "habitCheckIns",
    "savedViews", "externalEvents", "dailyCheckIns", "taskOccurrences", "reviewSessions", "dailyPlans",
    "dailyPlanItems", "commitmentResolutions", "carriedCommitments", "weeklyObjectives", "focusSessions",
    "planningTemplates", "scheduleProposals", "taskDependencies", "integrationConnections",
    "planningAvailabilityExceptions", "focusHabitAttribution",
]


# ---------------------------------------------------------------------------
# Dataset
# ---------------------------------------------------------------------------

def fixtures(now: datetime | None = None, tz: str = "Pacific/Auckland") -> dict[str, Any]:
    """Return {procedure: data} with a full planner snapshot dated around `now` in `tz`."""
    now = (now or datetime.now(timezone.utc)).astimezone(timezone.utc).replace(microsecond=0)
    zone = ZoneInfo(tz)
    local_now = now.astimezone(zone)
    today = local_now.date()
    rng = random.Random(20261013)
    midnight = datetime.combine(today, time(0, 0), zone).astimezone(timezone.utc)

    def ld(offset: int) -> str:
        return (today + timedelta(days=offset)).isoformat()

    def at(offset: int, hour: int, minute: int = 0) -> datetime:
        return datetime.combine(today + timedelta(days=offset), time(hour, minute), zone).astimezone(timezone.utc)

    def stamp(**extra: Any) -> dict[str, Any]:
        record = {"workspaceId": WORKSPACE_ID, "createdAt": now - timedelta(days=40), "updatedAt": now - timedelta(hours=2), "version": 1}
        record.update(extra)
        return record

    weekday = today.weekday()  # Monday = 0
    week_start = -weekday       # offset of this Monday

    workspace = {
        "id": WORKSPACE_ID, "ownerUserId": 1, "name": "Demo planner", "timezone": tz,
        "weekStartsOn": 1, "dailyCapacityMinutes": 420, "planningDayStartsAt": "06:00",
        "workdayStartsAt": "08:30", "workdayEndsAt": "17:30", "defaultBreakMinutes": 30,
        "preferredShutdownAt": "18:00", "accountabilityLevel": "structured",
        "createdAt": now - timedelta(days=90), "updatedAt": now - timedelta(days=3), "version": 3,
    }

    categories = [stamp(id=cid, name=name, color=color, sortOrder=index) for index, (cid, name, color) in enumerate(CATEGORIES)]

    goals = [
        stamp(id="goal-career", categoryId="cat-work", parentGoalId=None, title="Land a graduate marketing role before Christmas",
              description="Associate or graduate role in marketing, brand or international business in Auckland.",
              intentionKind="outcome", successCriteria="Signed offer for a graduate/associate marketing role.",
              standards="Every application tailored; follow up within 5 working days.", reviewCadence="weekly",
              nextReviewLocalDate=ld(week_start + 6), state="in_progress", priority="high", horizon="quarterly", color=None,
              progressMode="task", progressValue=0, targetValue=100, startLocalDate=ld(-45), dueLocalDate=ld(70),
              completedAt=None, archivedAt=None),
        stamp(id="goal-5k", categoryId="cat-health", parentGoalId=None, title="Run a sub-28 minute 5K",
              description="Build to three runs a week, then race Parkrun.", intentionKind="outcome",
              successCriteria="Official Parkrun time under 28:00.", standards="No more than 10% weekly distance increase.",
              reviewCadence="monthly", nextReviewLocalDate=ld(18), state="in_progress", priority="medium", horizon="quarterly",
              color=None, progressMode="measure", progressValue=64, targetValue=100, startLocalDate=ld(-35), dueLocalDate=ld(55),
              completedAt=None, archivedAt=None),
        stamp(id="goal-ga4", categoryId="cat-learning", parentGoalId=None, title="GA4 certification and one published portfolio case study",
              description="Show measurable marketing skills to employers.", intentionKind="outcome",
              successCriteria="GA4 certificate on LinkedIn and case study live on the portfolio.", standards=None,
              reviewCadence="weekly", nextReviewLocalDate=ld(week_start + 6), state="in_progress", priority="high", horizon="monthly",
              color=None, progressMode="task", progressValue=0, targetValue=100, startLocalDate=ld(-20), dueLocalDate=ld(30),
              completedAt=None, archivedAt=None),
    ]

    milestones = [
        stamp(id="ms-shortlist", goalId="goal-career", title="Shortlist 20 target companies", description=None, state="completed", horizon="monthly",
              progressValue=20, targetValue=20, startLocalDate=ld(-40), dueLocalDate=ld(-12), cue=None, response=None, completedAt=now - timedelta(days=12), archivedAt=None),
        stamp(id="ms-applications", goalId="goal-career", title="10 tailored applications sent", description=None, state="in_progress", horizon="monthly",
              progressValue=6, targetValue=10, startLocalDate=ld(-12), dueLocalDate=ld(9), cue="Sunday evening", response="Pick the next two roles", completedAt=None, archivedAt=None),
        stamp(id="ms-interviews", goalId="goal-career", title="Three first-round interviews booked", description=None, state="not_started", horizon="quarterly",
              progressValue=1, targetValue=3, startLocalDate=ld(0), dueLocalDate=ld(24), cue=None, response=None, completedAt=None, archivedAt=None),
        stamp(id="ms-30min", goalId="goal-5k", title="5K under 30 minutes", description=None, state="completed", horizon="monthly",
              progressValue=100, targetValue=100, startLocalDate=ld(-35), dueLocalDate=ld(-6), cue=None, response=None, completedAt=now - timedelta(days=7), archivedAt=None),
        stamp(id="ms-29min", goalId="goal-5k", title="5K under 29 minutes", description=None, state="in_progress", horizon="monthly",
              progressValue=55, targetValue=100, startLocalDate=ld(-6), dueLocalDate=ld(18), cue=None, response=None, completedAt=None, archivedAt=None),
        stamp(id="ms-ga4-exam", goalId="goal-ga4", title="Pass the GA4 practice exam", description=None, state="in_progress", horizon="monthly",
              progressValue=70, targetValue=100, startLocalDate=ld(-20), dueLocalDate=ld(6), cue=None, response=None, completedAt=None, archivedAt=None),
        stamp(id="ms-case-study", goalId="goal-ga4", title="Publish the portfolio case study", description=None, state="not_started", horizon="monthly",
              progressValue=20, targetValue=100, startLocalDate=ld(-5), dueLocalDate=ld(27), cue=None, response=None, completedAt=None, archivedAt=None),
    ]

    projects = [
        stamp(id="proj-jobs", goalId="goal-career", categoryId="cat-work", title="Graduate job search sprint",
              description="Tailored applications for Fonterra, Air New Zealand, Spark and ANZ.", riskLevel="none", riskNote=None,
              nextReviewLocalDate=ld(week_start + 6), state="in_progress", priority="high", horizon="monthly",
              startLocalDate=ld(-21), dueLocalDate=ld(30), completedAt=None, archivedAt=None),
        stamp(id="proj-portfolio", goalId="goal-ga4", categoryId="cat-learning", title="Portfolio website refresh",
              description="New homepage, one long-form case study, GA4 tracking.", riskLevel="watch",
              riskNote="Case study copy is a week behind.", nextReviewLocalDate=ld(5), state="in_progress", priority="medium",
              horizon="monthly", startLocalDate=ld(-14), dueLocalDate=ld(21), completedAt=None, archivedAt=None),
        stamp(id="proj-audit", goalId="goal-career", categoryId="cat-work", title="Grey Lynn market brand audit (volunteer)",
              description="Brand and social audit for a community farmers' market.", riskLevel="at_risk",
              riskNote="Waiting on logo files from the market committee.", nextReviewLocalDate=ld(2), state="in_progress",
              priority="medium", horizon="weekly", startLocalDate=ld(-10), dueLocalDate=ld(4), completedAt=None, archivedAt=None),
        stamp(id="proj-5k", goalId="goal-5k", categoryId="cat-health", title="8-week 5K training block",
              description="Intervals Tuesday, tempo Thursday, long run Saturday.", riskLevel="none", riskNote=None,
              nextReviewLocalDate=ld(10), state="in_progress", priority="medium", horizon="quarterly",
              startLocalDate=ld(-28), dueLocalDate=ld(28), completedAt=None, archivedAt=None),
    ]
    project_dependencies = [stamp(id="pdep-1", projectId="proj-portfolio", dependsOnProjectId="proj-audit", dependencyType="soft")]

    # ----- tasks -----------------------------------------------------------
    tasks: list[dict[str, Any]] = []

    def add_task(tid: str, title: str, category: str | None, **fields: Any) -> dict[str, Any]:
        record = stamp(
            id=tid, parentTaskId=None, goalId=None, projectId=None, categoryId=category, title=title, description=None,
            state="not_started", priority="medium", horizon="daily", dueLocalDate=None, scheduledLocalDate=None,
            plannedStartAt=None, plannedEndAt=None, estimateMinutes=None, sortOrder=len(tasks), scheduleMode="manual",
            outcome="none", outcomeAt=None, recurrenceRule=None, recurrenceAnchor=None, recurrenceUntilLocalDate=None,
            rescheduleCount=0, clientRequestId=None, completedAt=None, archivedAt=None,
        )
        record["createdAt"] = now - timedelta(days=rng.randint(3, 25))
        record.update(fields)
        if record["state"] == "completed" and record["completedAt"] is None:
            record["completedAt"] = now - timedelta(hours=1)
        tasks.append(record)
        return record

    # Today's time blocks. One block is always running now; fixed blocks that overlap it are dropped.
    minute_now = local_now.hour * 60 + local_now.minute
    now_start = max(0, (minute_now // 15) * 15 - 15)
    now_end = now_start + 60
    now_start_at = midnight + timedelta(minutes=now_start)
    now_end_at = midnight + timedelta(minutes=now_end)
    if local_now.hour >= 21 or local_now.hour < 6:
        now_title, now_cat, now_proj = "Polish LinkedIn headline and About section", "cat-work", "proj-jobs"
    else:
        now_title, now_cat, now_proj = "Deep work: competitor analysis for the Fonterra application", "cat-work", "proj-jobs"
    add_task("task-now", now_title, now_cat, projectId=now_proj, state="in_progress", priority="high", scheduledLocalDate=ld(0),
             plannedStartAt=now_start_at, plannedEndAt=now_end_at, estimateMinutes=60, horizon="daily")

    fixed_blocks = [
        # key, title, category, project, start (h, m), minutes, priority, parent
        ("run", "Morning run: easy 5K", "cat-health", "proj-5k", (7, 0), 45, "medium", None),
        ("inbox", "Inbox zero and reply to recruiter emails", "cat-work", "proj-jobs", (8, 30), 30, "medium", None),
        ("cv", "Tailor CV for the Fonterra graduate marketing role", "cat-work", "proj-jobs", (9, 15), 75, "critical", "task-fonterra"),
        ("ga4", "GA4 module 5: Explorations and funnels", "cat-learning", None, (11, 0), 45, "medium", None),
        ("cover", "Draft cover letter: Air New Zealand associate brand role", "cat-work", "proj-jobs", (13, 30), 60, "high", None),
        ("case", "Write the portfolio case study intro", "cat-learning", "proj-portfolio", (15, 0), 60, "medium", None),
        ("budget", "Weekly budget check", "cat-personal", None, (16, 30), 30, "low", None),
        ("read", "Read Building a StoryBrand, chapter 4", "cat-learning", None, (20, 0), 45, "low", None),
    ]
    goal_for_learning = {"ga4": "goal-ga4", "read": "goal-ga4"}
    for key, title, category, project, (hour, minute), minutes, priority, parent in fixed_blocks:
        start_min = hour * 60 + minute
        end_min = start_min + minutes
        if start_min < now_end and end_min > now_start:
            continue  # overlaps the running block
        start_at = midnight + timedelta(minutes=start_min)
        end_at = midnight + timedelta(minutes=end_min)
        is_past = end_min <= minute_now
        keep_open = key == "budget"  # one past slot stays open, as real days do
        state = "completed" if is_past and not keep_open else "not_started"
        add_task(f"task-{key}", title, category, projectId=project, goalId=goal_for_learning.get(key), priority=priority,
                 scheduledLocalDate=ld(0), plannedStartAt=start_at, plannedEndAt=end_at, estimateMinutes=minutes,
                 parentTaskId=parent, state=state, completedAt=(end_at - timedelta(minutes=3)) if state == "completed" else None)

    def done_today(minutes_ago: int) -> datetime:
        return max(now - timedelta(minutes=minutes_ago), midnight + timedelta(minutes=1))

    # Today, flexible (no time).
    add_task("task-thanks", "Send thank-you note to the Countdown hiring manager", "cat-work", projectId="proj-jobs", scheduledLocalDate=ld(0), dueLocalDate=ld(0), estimateMinutes=15, priority="high")
    add_task("task-physio", "Book physio appointment for the knee", "cat-health", scheduledLocalDate=ld(0), estimateMinutes=10, state="completed", completedAt=done_today(25))
    add_task("task-recruiter", "Call back Hays recruiter about the brand assistant role", "cat-work", projectId="proj-jobs", scheduledLocalDate=ld(0), estimateMinutes=20, state="completed", completedAt=done_today(55))
    add_task("task-linkedin-headline", "Update LinkedIn headline with GA4 and Master of Management", "cat-work", projectId="proj-jobs", scheduledLocalDate=ld(0), estimateMinutes=25)
    add_task("task-meal", "Meal prep for the week", "cat-personal", scheduledLocalDate=ld(0), estimateMinutes=60, priority="low")
    recurring = add_task("task-linkedin-daily", "LinkedIn engagement: 15 minutes", "cat-work", projectId="proj-jobs", scheduledLocalDate=ld(-20),
                         estimateMinutes=15, recurrenceRule={"frequency": "daily", "interval": 1}, recurrenceAnchor="scheduled", horizon="daily")

    # Overdue and blocked.
    add_task("task-expense", "Submit expense claim for the Marketing Meetup ticket", "cat-personal", dueLocalDate=ld(-3), scheduledLocalDate=ld(-3), estimateMinutes=15, rescheduleCount=1)
    add_task("task-ird", "Update IRD tax code for the new part-time job", "cat-personal", dueLocalDate=ld(-1), estimateMinutes=20, priority="high")
    add_task("task-hannah", "Reply to Hannah about the market survey questions", "cat-work", projectId="proj-audit", dueLocalDate=ld(-2), estimateMinutes=15)
    add_task("task-survey", "Finalise the brand audit survey (waiting on logo files)", "cat-work", projectId="proj-audit", state="blocked", dueLocalDate=ld(2), scheduledLocalDate=ld(1), estimateMinutes=45, priority="high")

    # Due or planned this week.
    add_task("task-fonterra", "Submit the Fonterra graduate marketing application", "cat-work", projectId="proj-jobs", dueLocalDate=ld(2), scheduledLocalDate=ld(1), estimateMinutes=45, priority="critical", horizon="weekly")
    add_task("task-fonterra-research", "Research the Fonterra brand portfolio", "cat-work", projectId="proj-jobs", parentTaskId="task-fonterra", state="completed", scheduledLocalDate=ld(-1), estimateMinutes=40, completedAt=at(-1, 14, 20))
    add_task("task-fonterra-cover", "Write the Fonterra cover letter draft", "cat-work", projectId="proj-jobs", parentTaskId="task-fonterra", dueLocalDate=ld(1), scheduledLocalDate=ld(1), estimateMinutes=50, priority="high")
    add_task("task-fonterra-proof", "Ask Priya to proofread the application", "cat-social", projectId="proj-jobs", parentTaskId="task-fonterra", dueLocalDate=ld(2), estimateMinutes=10)
    add_task("task-ga4-exam", "GA4 practice exam (aim for 80%+)", "cat-learning", goalId="goal-ga4", dueLocalDate=ld(3), scheduledLocalDate=ld(3), estimateMinutes=90, priority="high", horizon="weekly")
    add_task("task-star", "Prepare three STAR stories for interviews", "cat-work", projectId="proj-jobs", dueLocalDate=ld(4), scheduledLocalDate=ld(2), estimateMinutes=60, priority="high", horizon="weekly")
    add_task("task-rent", "Pay rent", "cat-personal", dueLocalDate=ld(3), estimateMinutes=5, priority="high")
    add_task("task-teardown", "Competitor social teardown for the market audit", "cat-work", projectId="proj-audit", scheduledLocalDate=ld(1), dueLocalDate=ld(3), estimateMinutes=90)
    add_task("task-long-run", "Long run: 8K at conversation pace", "cat-health", projectId="proj-5k", scheduledLocalDate=ld(max(1, 5 - weekday)), estimateMinutes=55)
    add_task("task-intervals", "Intervals: 6 x 400m", "cat-health", projectId="proj-5k", scheduledLocalDate=ld(2), estimateMinutes=40)
    add_task("task-drinks", "RSVP to Auckland Young Marketers drinks", "cat-social", dueLocalDate=ld(1), estimateMinutes=5)
    add_task("task-homepage", "Portfolio homepage: hero copy and project grid", "cat-learning", projectId="proj-portfolio", scheduledLocalDate=ld(2), dueLocalDate=ld(5), estimateMinutes=120, horizon="weekly")
    add_task("task-ga4-tracking", "Add GA4 tracking to the portfolio site", "cat-learning", projectId="proj-portfolio", dueLocalDate=ld(8), estimateMinutes=45, horizon="weekly")
    add_task("task-airnz", "Submit the Air New Zealand application", "cat-work", projectId="proj-jobs", dueLocalDate=ld(6), scheduledLocalDate=ld(4), estimateMinutes=45, priority="high", horizon="weekly")

    # Inbox / unscheduled ideas.
    for tid, title, category, horizon in [
        ("task-idea-ads", "Look into the Google Ads search certification", "cat-learning", "someday"),
        ("task-idea-referral", "Ask Sam for a referral at Spark", "cat-social", "weekly"),
        ("task-idea-meetups", "Find Auckland marketing meetups for November", "cat-social", "monthly"),
        ("task-idea-drive", "Tidy Google Drive application folders", None, "someday"),
        ("task-idea-shoes", "Replace running shoes (try on at Shoe Clinic)", "cat-health", "monthly"),
        ("task-idea-tiktok", "Idea: short video series on the grad job hunt", None, "someday"),
    ]:
        add_task(tid, title, category, horizon=horizon, priority="low" if horizon == "someday" else "medium")

    # Done earlier (spread over the last two weeks).
    for tid, title, category, project, offset, hour, minutes in [
        ("task-done-shortlist", "Shortlist 20 target companies", "cat-work", "proj-jobs", -10, 16, 90),
        ("task-done-spark", "Send application: Spark associate marketing", "cat-work", "proj-jobs", -6, 11, 60),
        ("task-done-anz", "Send application: ANZ graduate programme", "cat-work", "proj-jobs", -4, 15, 60),
        ("task-done-intervals", "Intervals: 5 x 400m", "cat-health", "proj-5k", -2, 7, 40),
        ("task-done-ga4-m4", "GA4 module 4: Reports", "cat-learning", None, -3, 10, 60),
        ("task-done-case-pick", "Pick the portfolio case study project", "cat-learning", "proj-portfolio", -5, 14, 30),
        ("task-done-jess", "Coffee chat with Jess from Kantar", "cat-social", None, -1, 9, 45),
        ("task-done-laundry", "Laundry and tidy room", "cat-personal", None, -1, 18, 40),
        ("task-done-homepage-copy", "Draft portfolio homepage copy", "cat-learning", "proj-portfolio", -2, 13, 60),
        ("task-done-cv-ats", "Fix CV formatting for ATS parsers", "cat-work", "proj-jobs", -7, 10, 45),
        ("task-done-kickoff", "Brand audit kickoff call", "cat-work", "proj-audit", -8, 17, 30),
        ("task-done-tempo", "Tempo run: 4K", "cat-health", "proj-5k", -5, 7, 30),
        ("task-done-countdown", "Countdown assistant brand manager interview", "cat-work", "proj-jobs", -3, 14, 60),
    ]:
        add_task(tid, title, category, projectId=project, state="completed", scheduledLocalDate=ld(offset), estimateMinutes=minutes,
                 goalId="goal-ga4" if tid == "task-done-ga4-m4" else None, completedAt=at(offset, hour, 0) + timedelta(minutes=minutes))
    # One task with an explicit "won't do" outcome keeps lifecycle history honest.
    add_task("task-wontdo", "Apply for the Farmers retail graduate scheme", "cat-work", projectId="proj-jobs", state="archived",
             outcome="wont_do", outcomeAt=now - timedelta(days=4), archivedAt=now - timedelta(days=4), scheduledLocalDate=ld(-4))

    task_by_id = {task["id"]: task for task in tasks}
    task_dependencies = [
        stamp(id="tdep-1", taskId="task-fonterra-cover", dependsOnTaskId="task-fonterra-research", dependencyType="hard"),
        stamp(id="tdep-2", taskId="task-teardown", dependsOnTaskId="task-survey", dependencyType="soft"),
        stamp(id="tdep-3", taskId="task-fonterra", dependsOnTaskId="task-fonterra-cover", dependencyType="hard"),
    ]
    for edge in task_dependencies:
        edge.pop("updatedAt", None)
        edge.pop("version", None)

    # Recurring task occurrences.
    task_occurrences = []
    for offset in range(-14, 8):
        if offset < 0:
            state = "completed" if rng.random() > 0.2 else "missed"
        else:
            state = "pending"
        occ_completed = at(offset, 12, 10) if state == "completed" else None
        task_occurrences.append(stamp(id=f"occ-linkedin-{offset + 20:02d}", taskId=recurring["id"], localDate=ld(offset), state=state,
                                      plannedStartAt=None, plannedEndAt=None, rescheduledToLocalDate=None, completedAt=occ_completed,
                                      resolvedAt=occ_completed or (at(offset, 23, 0) if state == "missed" else None), note=None))

    # ----- habits ----------------------------------------------------------
    habit_specs = [
        ("habit-run", "Morning run or walk", "cat-health", "goal-5k", "#0f9d8a", "daily", {}, "07:00", 0.82, 9),
        ("habit-read", "Read 20 pages", "cat-learning", "goal-ga4", "#c27612", "daily", {}, "21:00", 0.7, 4),
        ("habit-linkedin", "LinkedIn: three thoughtful comments", "cat-work", "goal-career", "#2f6fe4", "days_of_week", {"weekdays": [1, 2, 3, 4, 5]}, "12:30", 0.85, 6),
        ("habit-water", "Drink 2L of water", "cat-health", None, "#0f9d8a", "daily", {}, None, 0.75, 3),
        ("habit-family", "Call family in India", "cat-social", None, "#e0567a", "times_per_week", {"timesPerWeek": 2}, "19:30", 0.0, 0),
        ("habit-journal", "Journal for five minutes", "cat-personal", None, "#7a5af0", "daily", {}, "22:00", 0.6, 2),
    ]
    habits = []
    check_ins = []
    for hid, name, category, goal, color, frequency, schedule, reminder, rate, streak in habit_specs:
        habit = stamp(id=hid, goalId=goal, categoryId=category, name=name, description=None, color=color, frequency=frequency,
                      schedule={**schedule, "startLocalDate": ld(-60)}, reminderTime=reminder, archivedAt=None)
        habit["createdAt"] = now - timedelta(days=60)
        habits.append(habit)

        def add_check(offset: int, state: str) -> None:
            completed_at = None
            if state == "completed":
                completed_at = done_today(10) if offset == 0 else at(offset, rng.randint(7, 21), rng.choice([0, 15, 30, 45]))
            check_ins.append(stamp(id=f"chk-{hid}-{offset + 40:02d}", habitId=hid, localDate=ld(offset), timezoneAtCheckIn=tz,
                                   state=state, completedAt=completed_at, note=None,
                                   createdAt=completed_at or at(offset, 22, 0), updatedAt=completed_at or at(offset, 22, 0)))

        if frequency == "times_per_week":
            for offset in range(-29, 0):
                day = today + timedelta(days=offset)
                if day.weekday() in (2, 6) and offset < week_start:
                    add_check(offset, "completed")
            if week_start < 0:
                add_check(week_start, "completed")
            continue
        for offset in range(-29, 0):
            day = today + timedelta(days=offset)
            if frequency == "days_of_week" and day.isoweekday() % 7 not in schedule["weekdays"]:
                continue
            if -offset <= streak:
                add_check(offset, "completed")
            elif -offset == streak + 1:
                add_check(offset, "missed" if rng.random() < 0.5 else "skipped")
            else:
                roll = rng.random()
                if roll < rate:
                    add_check(offset, "completed")
                elif roll < rate + 0.06:
                    add_check(offset, "skipped")
                elif roll < rate + 0.14:
                    add_check(offset, "missed")
                # otherwise left unrecorded
    # Today: the run is already done; everything else is still due.
    check_ins.append(stamp(id="chk-habit-run-today", habitId="habit-run", localDate=ld(0), timezoneAtCheckIn=tz, state="completed",
                           completedAt=done_today(90), note="Easy pace, felt good", createdAt=done_today(90), updatedAt=done_today(90)))

    # ----- focus sessions --------------------------------------------------
    focus_sessions = []
    focus_pool = ["task-done-spark", "task-done-anz", "task-done-ga4-m4", "task-done-homepage-copy", "task-done-cv-ats",
                  "task-done-shortlist", "task-homepage", "task-fonterra-research", "task-done-case-pick", "task-teardown"]

    def add_session(sid: str, task_id: str | None, start: datetime, minutes: int, outcome: str = "continue", state: str = "completed") -> None:
        active = max(60, minutes * 60 - rng.randint(0, 120))
        end = start + timedelta(seconds=active)
        focus_sessions.append(stamp(id=sid, taskId=task_id, habitId=None, nextStepAction=None, nextStepTaskId=None, state=state,
                                    startedAt=start, lastResumedAt=start, pausedAt=None, endedAt=end, targetMinutes=minutes,
                                    activeSeconds=active, note=None, outcome=outcome if state == "completed" else "stopped",
                                    adjustedEstimateMinutes=None, createdAt=start, updatedAt=end))

    for offset in range(-14, 0):
        day = today + timedelta(days=offset)
        count = rng.choice([1, 2, 2, 3]) if day.weekday() < 5 else rng.choice([0, 1])
        hours = sorted(rng.sample([9, 10, 11, 13, 14, 15, 16], count))
        for index, hour in enumerate(hours):
            add_session(f"focus-{offset + 20:02d}-{index}", rng.choice(focus_pool), at(offset, hour, rng.choice([0, 10, 30])),
                        rng.choice([25, 30, 45, 50, 60]), outcome=rng.choice(["continue", "continue", "done"]))
    focus_sessions[3]["state"] = "abandoned"
    focus_sessions[3]["outcome"] = "stopped"
    first_today = now - timedelta(minutes=165)
    if first_today >= midnight:
        add_session("focus-today-0", "task-cv" if "task-cv" in task_by_id else "task-recruiter", first_today, 45)
    second_today = now - timedelta(minutes=40)
    if second_today >= midnight and second_today >= now_start_at - timedelta(minutes=15):
        add_session("focus-today-1", "task-now", max(second_today, now_start_at), 25)

    # ----- calendar --------------------------------------------------------
    integration_connections = [stamp(id=CONNECTION_ID, provider="google_calendar", displayName="Google Calendar (demo)", sourceOfTruth="read_only",
                                     syncCursor=None, status="connected", lastSyncedAt=now - timedelta(minutes=6), lastError=None)]
    external_events = []

    def add_event(eid: str, title: str, start: datetime, end: datetime, all_day: bool = False) -> None:
        external_events.append({"id": eid, "workspaceId": WORKSPACE_ID, "connectionId": CONNECTION_ID, "externalId": f"{eid}@google.demo",
                                "title": title, "startsAt": start, "endsAt": end, "isAllDay": 1 if all_day else 0, "status": "active",
                                "payload": None, "updatedAt": now - timedelta(hours=6)})

    add_event("evt-marketing-week", "Auckland Marketing Week", at(week_start, 0), at(week_start + 3, 0), all_day=True)
    add_event("evt-mum-birthday", "Mum's birthday", at(week_start + 4, 0), at(week_start + 5, 0), all_day=True)
    add_event("evt-lunch-sam", "Lunch with Sam (Spark)", at(0, 12, 15), at(0, 13, 0))
    add_event("evt-webinar", "Webinar: brand storytelling (AMA NZ)", at(0, 17, 30), at(0, 18, 15))
    add_event("evt-jess", "Coffee with Jess (Kantar)", at(-1, 9, 0), at(-1, 9, 45))
    add_event("evt-interview-spark", "Interview: Spark associate marketing (video)", at(1, 10, 0), at(1, 10, 45))
    add_event("evt-dentist", "Dentist", at(2, 15, 30), at(2, 16, 15))
    add_event("evt-drinks", "Auckland Young Marketers drinks", at(3, 18, 0), at(3, 20, 0))
    add_event("evt-parkrun", "Parkrun: Cornwall Park", at(week_start + 5, 8, 0), at(week_start + 5, 9, 0))
    add_event("evt-standup", "Volunteer committee check-in", at(week_start + 1, 18, 30), at(week_start + 1, 19, 0))
    add_event("evt-flatmates", "Flat dinner", at(week_start + 6, 18, 30), at(week_start + 6, 20, 0))
    add_event("evt-next-week", "Graduate careers expo (AUT)", at(week_start + 8, 10, 0), at(week_start + 8, 14, 0))

    # ----- plans, objectives, reviews --------------------------------------
    plan_today = stamp(id="plan-today", localDate=ld(0), state="active", intention="Ship the Fonterra CV and protect deep work before lunch",
                       reflection=None, startedAt=midnight + timedelta(hours=7, minutes=40), closedAt=None)
    plan_yesterday = stamp(id="plan-yesterday", localDate=ld(-1), state="closed", intention="Research Fonterra properly, then rest",
                           reflection="Research done, laundry done. Felt calm.", startedAt=at(-1, 8, 0), closedAt=at(-1, 21, 30))
    daily_plans = [plan_today, plan_yesterday]
    daily_plan_items = []
    position = 0
    for tid in ["task-now", "task-cv", "task-thanks", "task-cover", "task-ga4", "task-linkedin-headline", "task-recruiter", "task-physio"]:
        task = task_by_id.get(tid)
        if not task:
            continue
        done = task["state"] == "completed"
        daily_plan_items.append(stamp(id=f"item-today-{tid}", dailyPlanId="plan-today", taskId=tid, position=position,
                                      state="done" if done else "committed", resolvedToLocalDate=None, note=None,
                                      resolvedAt=task["completedAt"] if done else None))
        position += 1
    for index, (tid, state) in enumerate([("task-fonterra-research", "done"), ("task-done-jess", "done"), ("task-done-laundry", "done"), ("task-expense", "rescheduled")]):
        daily_plan_items.append(stamp(id=f"item-yday-{tid}", dailyPlanId="plan-yesterday", taskId=tid, position=index, state=state,
                                      resolvedToLocalDate=ld(0) if state == "rescheduled" else None, note=None, resolvedAt=at(-1, 21, 20)))

    weekly_objectives = [
        stamp(id="wo-applications", weekStartLocalDate=ld(week_start), goalId="goal-career", projectId="proj-jobs",
              title="Submit the Fonterra and Air New Zealand applications", description=None, state="active", evidence=None,
              carriedForwardFromId=None, completedAt=None, archivedAt=None),
        stamp(id="wo-ga4", weekStartLocalDate=ld(week_start), goalId="goal-ga4", projectId=None,
              title="Pass the GA4 practice exam with 80% or more", description=None, state="active", evidence=None,
              carriedForwardFromId=None, completedAt=None, archivedAt=None),
        stamp(id="wo-run", weekStartLocalDate=ld(week_start), goalId="goal-5k", projectId="proj-5k",
              title="Three runs, including one 8K", description=None, state="active", evidence="Easy 5K done today.",
              carriedForwardFromId=None, completedAt=None, archivedAt=None),
        stamp(id="wo-last-apps", weekStartLocalDate=ld(week_start - 7), goalId="goal-career", projectId="proj-jobs",
              title="Send three tailored applications", description=None, state="completed",
              evidence="Spark, ANZ and Countdown sent; Countdown interview booked.", carriedForwardFromId=None,
              completedAt=at(week_start - 1, 19, 0), archivedAt=None),
        stamp(id="wo-last-portfolio", weekStartLocalDate=ld(week_start - 7), goalId="goal-ga4", projectId="proj-portfolio",
              title="Pick and outline the case study", description=None, state="continued", evidence="Picked; outline half done.",
              carriedForwardFromId=None, completedAt=None, archivedAt=None),
    ]

    last_sunday = week_start - 1
    review_sessions = [
        stamp(id="review-weekly-last", kind="weekly", periodStartLocalDate=ld(week_start - 7), periodEndLocalDate=ld(last_sunday), state="completed",
              reflection="Three applications out and a first interview booked. Running is consistent. Portfolio slipped; give it two protected blocks next week.",
              snapshot={"checklist": {"inbox": True, "calendar": True, "goals": True, "next_week": True}}, completedAt=at(last_sunday, 19, 30)),
        stamp(id="review-weekly-prev", kind="weekly", periodStartLocalDate=ld(week_start - 14), periodEndLocalDate=ld(last_sunday - 7), state="completed",
              reflection="Too many small tasks. Shortlist finished. Need earlier nights.", snapshot={"checklist": {"inbox": True, "calendar": True}},
              completedAt=at(last_sunday - 7, 20, 0)),
        stamp(id="review-daily-yday", kind="daily", periodStartLocalDate=ld(-1), periodEndLocalDate=ld(-1), state="completed",
              reflection="Good research session. Expense claim moved to today.", snapshot=None, completedAt=at(-1, 21, 30)),
        stamp(id="review-monthly", kind="monthly", periodStartLocalDate=(today.replace(day=1) - timedelta(days=1)).replace(day=1).isoformat(),
              periodEndLocalDate=(today.replace(day=1) - timedelta(days=1)).isoformat(), state="completed",
              reflection="Finished the Master's paperwork, started the job search properly, ran 11 times.", snapshot=None,
              completedAt=datetime.combine(today.replace(day=1), time(10, 0), zone).astimezone(timezone.utc)),
    ]

    daily_check_ins = [
        stamp(id="dci-today", localDate=ld(0), intention="Ship the Fonterra CV", reflection=None, energy=4, mood=4),
        stamp(id="dci-yday", localDate=ld(-1), intention="Research Fonterra", reflection="Calm, productive day.", energy=3, mood=4),
    ]

    snapshot: dict[str, Any] = {name: [] for name in SNAPSHOT_ARRAYS}
    snapshot.update({
        "workspace": workspace,
        "focusHabitAttributionAvailable": True,
        "goalIntentionAvailable": True,
        "projectRiskAvailable": True,
        "projectDependenciesAvailable": True,
        "icsOverlay": {"status": "unconfigured", "label": "Secure ICS overlay not configured", "message": "Demo data only. No external calendar is read."},
        "categories": categories, "goals": goals, "milestones": milestones, "projects": projects,
        "projectDependencies": project_dependencies, "tasks": tasks, "habits": habits, "habitCheckIns": check_ins,
        "externalEvents": external_events, "dailyCheckIns": daily_check_ins, "taskOccurrences": task_occurrences,
        "reviewSessions": review_sessions, "dailyPlans": daily_plans, "dailyPlanItems": daily_plan_items,
        "weeklyObjectives": weekly_objectives, "focusSessions": focus_sessions, "taskDependencies": task_dependencies,
        "integrationConnections": integration_connections,
    })
    return {
        "planner.workspace.snapshot": snapshot,
        "planner.workspace.ensure": workspace,
        "planner.sync.conflicts": [],
        "planner.calendarFeed.current": None,
        "planner.notification.devices": [],
        "planner.notification.currentDevice": None,
        "planner.reminder.rules": [],
        "planner.review.history": sorted(review_sessions, key=lambda row: row["periodEndLocalDate"], reverse=True),
        "planner.search.workspace": [],
        "auth.me": USER,
        "auth.workspace": workspace,
    }


# ---------------------------------------------------------------------------
# superjson helpers
# ---------------------------------------------------------------------------

def _iso(value: datetime) -> str:
    value = value.astimezone(timezone.utc)
    return value.strftime("%Y-%m-%dT%H:%M:%S.") + f"{value.microsecond // 1000:03d}Z"


def serialize(data: Any) -> dict[str, Any]:
    """Encode `data` as superjson: datetimes become ISO strings with Date annotations."""
    values: dict[str, list[str]] = {}

    def walk(value: Any, path: list[str]) -> Any:
        if isinstance(value, datetime):
            values[".".join(path)] = ["Date"]
            return _iso(value)
        if isinstance(value, dict):
            return {key: walk(item, path + [str(key).replace(".", "\\.")]) for key, item in value.items()}
        if isinstance(value, (list, tuple)):
            return [walk(item, path + [str(index)]) for index, item in enumerate(value)]
        return value

    encoded = walk(data, [])
    result: dict[str, Any] = {"json": encoded}
    if values:
        if "" in values:  # a bare Date result
            result["meta"] = {"values": ["Date"]}
        else:
            result["meta"] = {"values": values}
    return result


def deserialize(payload: Any) -> Any:
    """Decode a superjson request body item ({json, meta}) into Python values."""
    if not isinstance(payload, dict) or "json" not in payload:
        return payload
    data = payload.get("json")
    annotations = (payload.get("meta") or {}).get("values") or {}

    def parse_date(text: Any) -> Any:
        try:
            return datetime.fromisoformat(str(text).replace("Z", "+00:00"))
        except ValueError:
            return text

    if isinstance(annotations, list):
        return parse_date(data) if annotations and annotations[0] == "Date" else data
    for path, kinds in annotations.items():
        kind = kinds[0] if isinstance(kinds, list) and kinds else kinds
        parts = [part.replace("\\.", ".") for part in path.replace("\\.", "\u0000").split(".")]
        parts = [part.replace("\u0000", ".") for part in parts]
        target = data
        for part in parts[:-1]:
            target = target[int(part)] if isinstance(target, list) else target.get(part)
            if target is None:
                break
        if target is None:
            continue
        last = parts[-1]
        if kind == "Date":
            if isinstance(target, list):
                target[int(last)] = parse_date(target[int(last)])
            else:
                target[last] = parse_date(target.get(last))
        elif kind == "undefined" and isinstance(target, dict):
            target.pop(last, None)
    return data


# ---------------------------------------------------------------------------
# In-memory backend
# ---------------------------------------------------------------------------

class DemoError(Exception):
    def __init__(self, message: str, code: str = "BAD_REQUEST", status: int = 400):
        super().__init__(message)
        self.code = code
        self.status = status


SCOPE_KEYS = {"workspaceId", "timezone"}


class DemoBackend:
    """Applies planner mutations to an in-memory snapshot. One instance per browser context."""

    def __init__(self, base: dict[str, Any], tz: str):
        self.base = copy.deepcopy(base)
        self.snapshot = self.base["planner.workspace.snapshot"]
        self.workspace = self.snapshot["workspace"]
        self.zone = ZoneInfo(tz)
        self.tz = tz
        self.counter = 0
        self.requests: list[str] = []
        self.unexpected: list[str] = []
        self.mutations: list[str] = []
        # (procedure, input without scope) per mutation, so harnesses can assert the exact writes.
        self.calls: list[tuple[str, dict[str, Any]]] = []

    # ----- utilities -------------------------------------------------------
    def now(self) -> datetime:
        return datetime.now(timezone.utc)

    def new_id(self, prefix: str) -> str:
        self.counter += 1
        return f"demo-{prefix}-{self.counter:04d}"

    def local_date(self, instant: datetime) -> str:
        return instant.astimezone(self.zone).date().isoformat()

    def today(self) -> str:
        return self.local_date(self.now())

    def rows(self, name: str) -> list[dict[str, Any]]:
        return self.snapshot.setdefault(name, [])

    def find(self, name: str, record_id: str) -> dict[str, Any]:
        for row in self.rows(name):
            if row.get("id") == record_id:
                return row
        raise DemoError(f"{name[:-1].capitalize()} was not found.", "NOT_FOUND", 404)

    def bump(self, row: dict[str, Any], patch: dict[str, Any] | None = None) -> dict[str, Any]:
        if patch:
            row.update(patch)
        row["version"] = int(row.get("version", 1)) + 1
        row["updatedAt"] = self.now()
        return row

    def create(self, name: str, prefix: str, fields: dict[str, Any]) -> dict[str, Any]:
        now = self.now()
        row = {"id": self.new_id(prefix), "workspaceId": self.workspace["id"], "createdAt": now, "updatedAt": now, "version": 1}
        row.update({key: value for key, value in fields.items() if key not in SCOPE_KEYS})
        self.rows(name).append(row)
        return row

    @staticmethod
    def strip(input_: dict[str, Any] | None) -> dict[str, Any]:
        return {key: value for key, value in (input_ or {}).items() if key not in SCOPE_KEYS}

    # ----- task helpers ----------------------------------------------------
    def task_patch(self, task: dict[str, Any], patch: dict[str, Any]) -> dict[str, Any]:
        now = self.now()
        patch = dict(patch)
        if patch.get("state") == "completed" and not task.get("completedAt"):
            patch["completedAt"] = now
        if patch.get("state") and patch["state"] != "completed":
            patch["completedAt"] = None
        if patch.get("state") == "archived":
            patch["archivedAt"] = now
        if patch.get("state") and patch["state"] != "archived":
            patch["archivedAt"] = None
        if patch.get("outcome") == "wont_do":
            patch["outcomeAt"] = now
        self.bump(task, patch)
        if task["state"] == "completed":
            # Demo leniency: completing a committed task also settles today's commitment.
            for item in self.rows("dailyPlanItems"):
                if item["taskId"] == task["id"] and item["state"] == "committed":
                    self.bump(item, {"state": "done", "resolvedAt": now})
        return task

    def create_task(self, fields: dict[str, Any]) -> dict[str, Any]:
        request_id = fields.get("clientRequestId")
        if request_id:
            for task in self.rows("tasks"):
                if task.get("clientRequestId") == request_id:
                    return task
        defaults = {
            "parentTaskId": None, "goalId": None, "projectId": None, "categoryId": None, "description": None,
            "state": "not_started", "priority": "medium", "horizon": "weekly", "dueLocalDate": None, "scheduledLocalDate": None,
            "plannedStartAt": None, "plannedEndAt": None, "estimateMinutes": None, "sortOrder": 0, "scheduleMode": "manual",
            "outcome": "none", "outcomeAt": None, "recurrenceRule": None, "recurrenceAnchor": None,
            "recurrenceUntilLocalDate": None, "rescheduleCount": 0, "clientRequestId": None, "completedAt": None, "archivedAt": None,
        }
        defaults.update(self.strip(fields))
        if defaults["state"] == "completed":
            defaults["completedAt"] = self.now()
        return self.create("tasks", "task", defaults)

    # ----- dashboard (port of server/plannerRules.ts dashboardSummary) ------
    def dashboard(self, input_: dict[str, Any]) -> dict[str, Any]:
        snap = self.snapshot
        today = input_.get("todayLocalDate") or self.today()
        range_start = input_.get("rangeStart") or today
        range_end = input_.get("rangeEnd") or today
        tasks = snap["tasks"]
        capacity = self.workspace["dailyCapacityMinutes"]

        def shift(local: str, days: int) -> str:
            return (date.fromisoformat(local) + timedelta(days=days)).isoformat()

        def seq(start: str, end: str) -> list[str]:
            days, cursor = [], start
            while cursor <= end:
                days.append(cursor)
                cursor = shift(cursor, 1)
            return days

        def days_between(a: str, b: str) -> int:
            return (date.fromisoformat(b) - date.fromisoformat(a)).days

        active = [task for task in tasks if task["state"] not in ("completed", "archived")]
        today_tasks = [task for task in active if task.get("scheduledLocalDate") == today or task.get("dueLocalDate") == today]
        all_today = [task for task in tasks if task.get("scheduledLocalDate") == today or task.get("dueLocalDate") == today]
        upcoming_end = shift(today, 7)
        upcoming = [task for task in active if task.get("dueLocalDate") and today < task["dueLocalDate"] <= upcoming_end]
        planned_minutes = sum(max(0, task.get("estimateMinutes") or 0) for task in today_tasks)
        forecast = {
            "todayTaskCount": len(today_tasks),
            "plannedMinutes": planned_minutes,
            "capacityMinutes": capacity,
            "remainingMinutes": capacity - planned_minutes,
            "isOverCapacity": capacity - planned_minutes < 0,
            "reservedMinutes": sum(max(0, task.get("estimateMinutes") or 0) for task in today_tasks if task.get("plannedStartAt")),
            "deadlineOnlyMinutes": sum(max(0, task.get("estimateMinutes") or 0) for task in today_tasks if task.get("dueLocalDate") == today and task.get("scheduledLocalDate") != today),
            "unestimatedCount": len([task for task in today_tasks if task.get("estimateMinutes") is None]),
            "deadlineRiskCount": len([task for task in active if task.get("dueLocalDate") and task["dueLocalDate"] <= shift(today, 2)]),
        }
        carryover = [task for task in active if task.get("scheduledLocalDate") and task["scheduledLocalDate"] < today]
        blocked = [task for task in active if task["state"] == "blocked"]
        completed_today = len([task for task in tasks if task.get("completedAt") and self.local_date(task["completedAt"]) == today])
        scheduled_through = [task for task in tasks if task.get("scheduledLocalDate") and task["scheduledLocalDate"] <= today and task["state"] != "archived"]
        dated_through = [task for task in tasks if (task.get("scheduledLocalDate") or task.get("dueLocalDate")) and (task.get("scheduledLocalDate") or task.get("dueLocalDate")) <= today and task["state"] != "archived"]
        estimate_coverage = round(len([task for task in active if task.get("estimateMinutes") is not None]) / len(active) * 100) if active else 100
        project_goal = {project["id"]: project.get("goalId") for project in snap["projects"]}

        def goal_progress(goal: dict[str, Any]) -> int:
            if goal["progressMode"] in ("manual", "measure"):
                return max(0, min(100, round(goal["progressValue"] / max(1, goal["targetValue"]) * 100)))
            supporting = [task for task in tasks if task.get("goalId") == goal["id"] or (task.get("projectId") and project_goal.get(task["projectId"]) == goal["id"])]
            if not supporting:
                return 100 if goal["state"] == "completed" else 0
            return round(len([task for task in supporting if task["state"] == "completed"]) / len(supporting) * 100)

        live_goals = [goal for goal in snap["goals"] if goal["state"] != "archived"]
        goal_items = [{"id": goal["id"], "progress": goal_progress(goal), "atRisk": bool(goal.get("dueLocalDate") and goal["dueLocalDate"] < today and goal["state"] != "completed")} for goal in live_goals]

        long_horizon = []
        reviews = snap["reviewSessions"]
        for goal in live_goals:
            milestones = [item for item in snap["milestones"] if item["goalId"] == goal["id"] and item["state"] != "archived"]
            if goal["progressMode"] in ("manual", "measure"):
                progress, source = goal_progress(goal), "manual"
            elif milestones:
                progress = round(sum(100 if item["state"] == "completed" else max(0, min(100, round(item["progressValue"] / max(1, item["targetValue"]) * 100))) for item in milestones) / len(milestones))
                source = "milestones"
            else:
                progress, source = goal_progress(goal), "execution"
            projects = [project for project in snap["projects"] if project.get("goalId") == goal["id"] and project["state"] != "archived"]
            goal_tasks = [task for task in tasks if (task.get("goalId") == goal["id"] or (task.get("projectId") and project_goal.get(task["projectId"]) == goal["id"])) and task["state"] != "archived"]
            goal_habits = [habit for habit in snap["habits"] if habit.get("goalId") == goal["id"] and not habit.get("archivedAt")]
            future = [item for item in milestones if not item.get("dueLocalDate") or item["dueLocalDate"] >= today]
            horizon = goal.get("horizon") if goal.get("horizon") in ("monthly", "quarterly", "yearly") else None
            if horizon:
                kinds, cadence = {"monthly": (("weekly", "monthly"), 35), "quarterly": (("monthly", "quarterly"), 100), "yearly": (("quarterly", "yearly"), 190)}[horizon]
                eligible = sorted([review["periodEndLocalDate"] for review in reviews if review["state"] == "completed" and review["kind"] in kinds and review["periodEndLocalDate"] <= today], reverse=True)
                last_review = eligible[0] if eligible else None
                review_due = not last_review or days_between(last_review, today) > cadence
                review = {"reviewStatus": "due" if review_due else "fresh", "lastReviewLocalDate": last_review, "reviewDue": review_due}
            else:
                review = {"reviewStatus": "unavailable", "lastReviewLocalDate": None, "reviewDue": False}
            has_pace = bool(goal.get("startLocalDate") and goal.get("dueLocalDate") and days_between(goal["startLocalDate"], goal["dueLocalDate"]) > 0)
            expected = max(0, min(100, round(days_between(goal["startLocalDate"], today) / days_between(goal["startLocalDate"], goal["dueLocalDate"]) * 100))) if has_pace else None
            pace_delta = None if expected is None else progress - expected
            completed = goal["state"] == "completed"
            overdue = bool(goal.get("dueLocalDate") and goal["dueLocalDate"] < today and not completed)
            pace = "unavailable" if pace_delta is None or completed else "behind" if pace_delta < -10 else "ahead" if pace_delta > 10 else "on_pace"
            has_execution = len(projects) + len(goal_tasks) + len(goal_habits) > 0
            has_plan = has_execution or bool(milestones)
            next_action = "none" if completed else "add_execution" if not has_plan else "review_plan" if overdue or pace == "behind" or review["reviewDue"] else "add_milestone" if goal.get("dueLocalDate") and not milestones else "none"
            long_horizon.append({
                "goalId": goal["id"], "progress": progress, "progressSource": source, "expectedProgress": expected, "paceDelta": pace_delta,
                "paceStatus": pace, "daysUntilDue": days_between(today, goal["dueLocalDate"]) if goal.get("dueLocalDate") else None,
                "isOverdue": overdue, "hasExecutionCoverage": has_execution, "hasMilestoneCoverage": bool(milestones), "childGoalCount": 0,
                **review, "activeProjectCount": len(projects), "activeTaskCount": len(goal_tasks), "activeHabitCount": len(goal_habits),
                "activeMilestoneCount": len(milestones), "futureMilestoneCount": len(future), "nextAction": next_action,
            })

        completed_by_day: dict[str, int] = {}
        for task in tasks:
            if task.get("completedAt"):
                local = self.local_date(task["completedAt"])
                completed_by_day[local] = completed_by_day.get(local, 0) + 1
        completion_trend = [{"localDate": day, "completed": completed_by_day.get(day, 0)} for day in seq(range_start, range_end)]
        names = {category["id"]: category["name"] for category in snap["categories"]}
        distribution = [{"id": cid, "name": name, "count": len([task for task in tasks if task.get("categoryId") == cid and task["state"] != "archived"])} for cid, name in names.items()]

        def streak(habit_id: str) -> int:
            states = {row["localDate"]: row["state"] for row in snap["habitCheckIns"] if row["habitId"] == habit_id}
            cursor, count = today, 0
            if states.get(cursor) != "completed":
                cursor = shift(cursor, -1)
            for _ in range(3650):
                state = states.get(cursor)
                if state == "completed":
                    count += 1
                elif state != "skipped":
                    break
                cursor = shift(cursor, -1)
            return count

        weekday = date.fromisoformat(today).weekday()
        week_start = shift(today, -weekday)
        week_end = shift(week_start, 6)
        planned_focus = sum(task.get("estimateMinutes") or 0 for task in tasks if task.get("scheduledLocalDate") and week_start <= task["scheduledLocalDate"] <= week_end and task["state"] != "archived")
        completed_focus = round(sum(session["activeSeconds"] for session in snap["focusSessions"] if session["state"] == "completed" and week_start <= self.local_date(session["startedAt"]) <= week_end) / 60)
        planned_in_range = [task for task in active if task.get("scheduledLocalDate") and range_start <= task["scheduledLocalDate"] <= range_end]
        category_allocation = [{"id": cid, "name": name, "plannedMinutes": sum(task.get("estimateMinutes") or 0 for task in planned_in_range if task.get("categoryId") == cid), "taskCount": len([task for task in planned_in_range if task.get("categoryId") == cid])} for cid, name in names.items()]
        category_allocation = [item for item in category_allocation if item["taskCount"] > 0]
        unassigned = [task for task in planned_in_range if not task.get("categoryId")]
        if unassigned:
            category_allocation.append({"id": "unassigned", "name": "Uncategorised", "plannedMinutes": sum(task.get("estimateMinutes") or 0 for task in unassigned), "taskCount": len(unassigned)})
        goal_allocation = []
        for goal in live_goals:
            linked = [task for task in planned_in_range if task.get("goalId") == goal["id"] or (task.get("projectId") and project_goal.get(task["projectId"]) == goal["id"])]
            if linked:
                goal_allocation.append({"id": goal["id"], "name": goal["title"], "plannedMinutes": sum(task.get("estimateMinutes") or 0 for task in linked), "taskCount": len(linked)})
        review_history = [{"kind": review["kind"], "state": review["state"], "periodEndLocalDate": review["periodEndLocalDate"]} for review in sorted([review for review in reviews if review["state"] != "archived"], key=lambda review: review["periodEndLocalDate"], reverse=True)[:8]]

        return {
            "counts": {"today": len(today_tasks), "upcoming": len(upcoming), "completedInRange": sum(item["completed"] for item in completion_trend), "activeGoals": len(goal_items)},
            "planningHealth": {
                "carryoverCount": len(carryover), "blockedCount": len(blocked), "completedToday": completed_today,
                "focusCompletionRate": round(len([task for task in all_today if task["state"] == "completed"]) / len(all_today) * 100) if all_today else 0,
                "atRiskGoalCount": len([item for item in goal_items if item["atRisk"]]),
            },
            "decisionSignals": {
                "scheduleReliability": round(len([task for task in scheduled_through if task["state"] == "completed"]) / len(scheduled_through) * 100) if scheduled_through else None,
                "carryoverRate": round(len(carryover) / len(dated_through) * 100) if dated_through else 0,
                "averageBlockedAgeDays": round(sum(max(0, (self.now() - task["createdAt"]).days) for task in blocked) / len(blocked)) if blocked else 0,
                "estimateCoverage": estimate_coverage,
                "goalsWithVisibleProgress": len([item for item in goal_items if 0 < item["progress"] < 100]),
                "goalsBehindPace": len([item for item in long_horizon if item["paceStatus"] == "behind"]),
                "goalsWithoutExecution": len([item for item in long_horizon if item["nextAction"] == "add_execution"]),
                "overdueLongHorizonGoals": len([item for item in long_horizon if item["isOverdue"]]),
                "goalsNeedingReview": len([item for item in long_horizon if item["reviewDue"]]),
            },
            "workload": {**forecast, "ratio": planned_minutes / capacity if capacity else 0},
            "goalProgress": goal_items,
            "longHorizon": long_horizon,
            "completionTrend": completion_trend,
            "categoryDistribution": distribution,
            "streaks": [{"habitId": habit["id"], "streak": streak(habit["id"])} for habit in snap["habits"] if not habit.get("archivedAt")],
            "analytics": {
                "weeklyFocus": {"weekStart": week_start, "weekEnd": week_end, "plannedMinutes": planned_focus, "completedMinutes": completed_focus},
                "carryoverTrend": [{"localDate": day, "carryover": len([task for task in active if task.get("scheduledLocalDate") and task["scheduledLocalDate"] < day])} for day in seq(week_start, today)],
                "categoryAllocation": category_allocation,
                "goalAllocation": goal_allocation,
                "reviewHistory": review_history,
            },
            "workspace": self.workspace,
        }

    # ----- dispatcher ------------------------------------------------------
    def call(self, procedure: str, input_: Any) -> Any:
        self.requests.append(procedure)
        data = input_ if isinstance(input_, dict) else {}
        handler = getattr(self, "p_" + procedure.replace(".", "_"), None)
        if handler is not None:
            if not procedure.endswith(QUERY_SUFFIXES):
                self.mutations.append(procedure)
                self.calls.append((procedure, copy.deepcopy(self.strip(data))))
            return handler(data)
        if procedure in self.base:
            return self.base[procedure]
        self.unexpected.append(procedure)
        return None

    # queries
    def p_auth_me(self, _): return USER
    def p_auth_workspace(self, _): return self.workspace
    def p_auth_logout(self, _): return {"success": True}
    def p_planner_workspace_snapshot(self, _): return self.snapshot
    def p_planner_workspace_ensure(self, _): return self.workspace
    def p_planner_dashboard(self, data): return self.dashboard(data)
    def p_planner_sync_conflicts(self, _): return []
    def p_planner_review_history(self, data):
        rows = sorted(self.rows("reviewSessions"), key=lambda row: (row["periodEndLocalDate"], row["updatedAt"]), reverse=True)
        return rows[: int(data.get("limit") or 12)]
    def p_planner_habit_practiceEvidence(self, data):
        end = data.get("endLocalDate") or self.today()
        start = (date.fromisoformat(end) - timedelta(days=396)).isoformat()
        return {"startLocalDate": start, "endLocalDate": end, "habits": self.rows("habits"),
                "checkIns": [row for row in self.rows("habitCheckIns") if start <= row["localDate"] <= end]}
    def p_planner_task_rolloverPreview(self, data):
        return {"fromLocalDate": data.get("fromLocalDate"), "candidates": []}
    def p_planner_search_workspace(self, data):
        query = str(data.get("query") or "").lower()
        results = []
        for entity, name, field in (("task", "tasks", "title"), ("goal", "goals", "title"), ("project", "projects", "title"), ("habit", "habits", "name")):
            for row in self.rows(name):
                if query and query in str(row.get(field, "")).lower():
                    state = row.get("state") or ("archived" if row.get("archivedAt") else "active")
                    results.append({"id": row["id"], "title": row[field], "summary": row.get("description"), "state": state, "updatedAt": row["updatedAt"], "entity": entity})
        return results[: int(data.get("limit") or 20)]
    def p_planner_search_record(self, data):
        name = {"task": "tasks", "goal": "goals", "project": "projects", "habit": "habits", "review": "reviewSessions"}.get(data.get("entity"), "tasks")
        return next((row for row in self.rows(name) if row["id"] == data.get("id")), None)

    # tasks
    def p_planner_task_create(self, data): return self.create_task(data)
    def p_planner_task_update(self, data):
        return self.task_patch(self.find("tasks", data["id"]), data.get("patch") or {})
    def p_planner_task_reserve(self, data):
        task = self.find("tasks", data["id"])
        return self.bump(task, {"scheduledLocalDate": data["localDate"], "plannedStartAt": data["plannedStartAt"], "plannedEndAt": data["plannedEndAt"],
                                "scheduleMode": "pinned" if task.get("scheduleMode") == "pinned" else "manual"})
    def p_planner_task_bulkSetState(self, data):
        return [self.task_patch(self.find("tasks", task_id), {"state": data["state"]}) for task_id in data.get("ids", [])]
    def p_planner_task_applyRollover(self, data):
        return {"fromLocalDate": data.get("fromLocalDate"), "applied": 0, "alreadyApplied": 0}
    def p_planner_task_addDependency(self, data):
        now = self.now()
        edge = {"id": self.new_id("tdep"), "workspaceId": self.workspace["id"], "taskId": data["taskId"], "dependsOnTaskId": data["dependsOnTaskId"],
                "dependencyType": data.get("dependencyType", "hard"), "createdAt": now}
        self.rows("taskDependencies").append(edge)
        return edge
    def p_planner_task_removeDependency(self, data):
        self.snapshot["taskDependencies"] = [edge for edge in self.rows("taskDependencies") if edge["id"] != data["id"]]
        return {"id": data["id"], "removed": True}
    def p_planner_sync_replay(self, data):
        results = []
        for operation in data.get("operations", []):
            try:
                if operation.get("kind") == "create":
                    record = self.create_task({**operation.get("patch", {}), "clientRequestId": operation.get("operationId")})
                else:
                    record = self.task_patch(self.find("tasks", operation["entityId"]), operation.get("patch") or {})
                results.append({"operationId": operation.get("operationId"), "status": "completed", "outcome": "applied",
                                 "appliedFields": list((operation.get("patch") or {}).keys()), "alreadyAppliedFields": [], "conflicts": [], "record": record})
            except DemoError:
                results.append({"operationId": operation.get("operationId"), "status": "rejected", "code": "not_found"})
        return results
    def p_planner_sync_resolve(self, data): return {"conflictId": data.get("conflictId"), "resolved": True}
    # saved views (Tasks pills, T2b-2): the same create/update/delete procedures as the server
    def p_planner_savedView_create(self, data):
        return self.create("savedViews", "view", {"name": data["name"], "viewType": data.get("viewType", "tasks"),
                                                 "configuration": data.get("configuration") or {}, "isPinned": data.get("isPinned", 0)})
    def p_planner_savedView_update(self, data):
        row = self.find("savedViews", data["id"])
        if int(row.get("version", 1)) != int(data.get("expectedVersion", 0)):
            raise DemoError("This saved view changed in another place. Refresh and try again.", "CONFLICT", 409)
        return self.bump(row, {key: data[key] for key in ("name", "configuration", "isPinned") if key in data})
    def p_planner_savedView_delete(self, data):
        self.find("savedViews", data["id"])
        self.snapshot["savedViews"] = [row for row in self.rows("savedViews") if row["id"] != data["id"]]
        return {"id": data["id"], "deleted": True}
    def p_planner_occurrence_materialize(self, data):
        return [row for row in self.rows("taskOccurrences") if data.get("start", "") <= row["localDate"] <= data.get("end", "9999")]
    def p_planner_occurrence_resolve(self, data):
        row = self.find("taskOccurrences", data["id"])
        now = self.now()
        return self.bump(row, {"state": data["state"], "rescheduledToLocalDate": data.get("rescheduledToLocalDate"), "note": data.get("note"),
                               "completedAt": now if data["state"] == "completed" else None, "resolvedAt": now})

    # habits
    def p_planner_habit_checkIn(self, data):
        now = self.now()
        for row in self.rows("habitCheckIns"):
            if row["habitId"] == data["habitId"] and row["localDate"] == data["localDate"]:
                return self.bump(row, {"state": data["state"], "note": data.get("note"), "completedAt": now if data["state"] == "completed" else None})
        return self.create("habitCheckIns", "checkin", {"habitId": data["habitId"], "localDate": data["localDate"], "timezoneAtCheckIn": self.tz,
                                                         "state": data["state"], "completedAt": now if data["state"] == "completed" else None, "note": data.get("note")})
    def p_planner_habit_clearCheckIn(self, data):
        self.snapshot["habitCheckIns"] = [row for row in self.rows("habitCheckIns") if not (row["habitId"] == data["habitId"] and row["localDate"] == data["localDate"])]
        return {"habitId": data["habitId"], "localDate": data["localDate"], "cleared": True}
    def p_planner_habit_create(self, data):
        return self.create("habits", "habit", {"goalId": None, "categoryId": None, "description": None, "reminderTime": None, "archivedAt": None, "frequency": "daily", **self.strip(data)})
    def p_planner_habit_update(self, data): return self.bump(self.find("habits", data["id"]), data.get("patch") or {})
    def p_planner_habit_archive(self, data): return self.bump(self.find("habits", data["id"]), {"archivedAt": self.now()})
    def p_planner_habit_restore(self, data): return self.bump(self.find("habits", data["id"]), {"archivedAt": None})

    # focus
    def _running(self):
        return next((row for row in self.rows("focusSessions") if row["state"] in ("active", "paused")), None)
    def p_planner_focus_start(self, data):
        if self._running():
            raise DemoError("Finish the current focus session before starting another.", "CONFLICT", 409)
        now = self.now()
        session = self.create("focusSessions", "focus", {"taskId": data.get("taskId"), "habitId": data.get("habitId"), "nextStepAction": None,
                                                          "nextStepTaskId": None, "state": "active", "startedAt": now, "lastResumedAt": now,
                                                          "pausedAt": None, "endedAt": None, "targetMinutes": data.get("targetMinutes", 25),
                                                          "activeSeconds": 0, "note": None, "outcome": "continue", "adjustedEstimateMinutes": None})
        self.rows("focusSessions").sort(key=lambda row: row["startedAt"], reverse=True)
        return session
    def p_planner_focus_pause(self, data):
        session = self.find("focusSessions", data["id"])
        now = self.now()
        elapsed = int((now - session["lastResumedAt"]).total_seconds()) if session["state"] == "active" else 0
        return self.bump(session, {"state": "paused", "pausedAt": now, "activeSeconds": session["activeSeconds"] + max(0, elapsed)})
    def p_planner_focus_resume(self, data):
        return self.bump(self.find("focusSessions", data["id"]), {"state": "active", "pausedAt": None, "lastResumedAt": self.now()})
    def p_planner_focus_finish(self, data):
        session = self.find("focusSessions", data["id"])
        now = self.now()
        elapsed = int((now - session["lastResumedAt"]).total_seconds()) if session["state"] == "active" else 0
        outcome = data.get("outcome", "continue")
        self.bump(session, {"state": "abandoned" if outcome == "stopped" else "completed", "endedAt": now, "activeSeconds": session["activeSeconds"] + max(0, elapsed),
                            "note": data.get("note"), "outcome": outcome, "adjustedEstimateMinutes": data.get("adjustedEstimateMinutes")})
        if session.get("taskId") and outcome in ("done", "adjust_estimate"):
            task = self.find("tasks", session["taskId"])
            self.task_patch(task, {"state": "completed"} if outcome == "done" else {"estimateMinutes": data.get("adjustedEstimateMinutes")})
        return session
    def p_planner_focus_setFollowUp(self, data):
        return self.bump(self.find("focusSessions", data["id"]), {"nextStepAction": data.get("nextStepAction"), "nextStepTaskId": data.get("nextStepTaskId")})

    # daily plan and recovery
    def p_planner_dailyPlan_upsert(self, data):
        now = self.now()
        plan = next((row for row in self.rows("dailyPlans") if row["localDate"] == data["localDate"]), None)
        if plan is None:
            state = data.get("state") or "draft"
            return self.create("dailyPlans", "plan", {"localDate": data["localDate"], "state": state, "intention": data.get("intention"), "reflection": data.get("reflection"),
                                                      "startedAt": now if state == "active" else None, "closedAt": now if state == "closed" else None})
        patch = {key: data[key] for key in ("intention", "reflection", "state") if key in data}
        if patch.get("state") == "active" and not plan.get("startedAt"):
            patch["startedAt"] = now
        if patch.get("state") == "closed" and not plan.get("closedAt"):
            patch["closedAt"] = now
        return self.bump(plan, patch)
    def p_planner_dailyPlan_addItem(self, data):
        items = [row for row in self.rows("dailyPlanItems") if row["dailyPlanId"] == data["dailyPlanId"]]
        existing = next((row for row in items if row["taskId"] == data["taskId"]), None)
        if existing:
            return existing
        return self.create("dailyPlanItems", "item", {"dailyPlanId": data["dailyPlanId"], "taskId": data["taskId"], "position": max([row["position"] for row in items] or [-1]) + 1,
                                                      "state": "committed", "resolvedToLocalDate": None, "note": None, "resolvedAt": None})
    def p_planner_dailyPlan_updateItem(self, data):
        item = self.find("dailyPlanItems", data["id"])
        patch = {key: data[key] for key in ("state", "resolvedToLocalDate", "note", "position") if key in data}
        if patch.get("state") and patch["state"] != "committed":
            patch["resolvedAt"] = self.now()
        return self.bump(item, patch)
    def p_planner_dailyPlan_moveItem(self, data):
        item = self.find("dailyPlanItems", data["id"])
        siblings = sorted([row for row in self.rows("dailyPlanItems") if row["dailyPlanId"] == item["dailyPlanId"] and row["state"] == "committed"], key=lambda row: row["position"])
        index = siblings.index(item)
        target = index + int(data.get("direction", 1))
        if 0 <= target < len(siblings):
            other = siblings[target]
            item["position"], other["position"] = other["position"], item["position"]
            self.bump(other)
        return self.bump(item)
    def _resolve_item(self, item: dict[str, Any], state: str, to_date: str | None, note: str | None) -> dict[str, Any]:
        now = self.now()
        task = self.find("tasks", item["taskId"])
        if state == "done":
            self.bump(task, {"state": "completed", "completedAt": task.get("completedAt") or now})
        elif state in ("rescheduled", "deferred") and to_date:
            self.bump(task, {"scheduledLocalDate": to_date, "plannedStartAt": None, "plannedEndAt": None, "rescheduleCount": task.get("rescheduleCount", 0) + 1})
        elif state == "wont_do":
            self.bump(task, {"outcome": "wont_do", "outcomeAt": now})
        return self.bump(item, {"state": state, "resolvedToLocalDate": to_date, "note": note, "resolvedAt": now})
    def p_planner_dailyPlan_resolveItem(self, data):
        return self._resolve_item(self.find("dailyPlanItems", data["id"]), data["state"], data.get("resolvedToLocalDate"), data.get("note"))
    def p_planner_dailyPlan_close(self, data):
        return self.bump(self.find("dailyPlans", data["id"]), {"state": "closed", "closedAt": self.now(), "reflection": data.get("reflection")})
    def p_planner_recovery_resolve(self, data):
        decision = data.get("decision") or {}
        state = {"done": "done", "reschedule": "rescheduled", "reduce": "rescheduled", "pause": "deferred", "abandon": "wont_do"}.get(decision.get("action"), "done")
        to_date = decision.get("resolvedToLocalDate") or decision.get("returnLocalDate")
        item = self.find("dailyPlanItems", decision["dailyPlanItemId"]) if decision.get("dailyPlanItemId") else None
        if item:
            self._resolve_item(item, state, to_date, decision.get("decisionNote"))
        now = self.now()
        return self.create("commitmentResolutions", "resolution", {"operationId": decision.get("operationId"), "dailyPlanItemId": decision.get("dailyPlanItemId"),
                                                                   "taskId": decision.get("taskId"), "occurrenceId": decision.get("occurrenceId"), "sourceCarryId": None,
                                                                   "sourceCarryVersion": None, "requestFingerprint": None, "action": decision.get("action"),
                                                                   "originalScope": "", "revisedScope": decision.get("revisedScope"), "resolvedToLocalDate": decision.get("resolvedToLocalDate"),
                                                                   "returnLocalDate": decision.get("returnLocalDate"), "decisionNote": decision.get("decisionNote"), "timezone": self.tz,
                                                                   "createdAt": now})
    def p_planner_dailyCheckIn_upsert(self, data):
        row = next((row for row in self.rows("dailyCheckIns") if row["localDate"] == data["localDate"]), None)
        fields = {key: data[key] for key in ("intention", "reflection", "energy", "mood") if key in data}
        return self.bump(row, fields) if row else self.create("dailyCheckIns", "dci", {"localDate": data["localDate"], **fields})

    # weekly objectives, reviews
    def p_planner_weeklyObjective_create(self, data):
        return self.create("weeklyObjectives", "objective", {"goalId": None, "projectId": None, "description": None, "state": "active", "evidence": None,
                                                              "carriedForwardFromId": None, "completedAt": None, "archivedAt": None, **self.strip(data)})
    def p_planner_weeklyObjective_update(self, data):
        patch = dict(data.get("patch") or {})
        if patch.get("state") == "completed":
            patch["completedAt"] = self.now()
        return self.bump(self.find("weeklyObjectives", data["id"]), patch)
    def p_planner_weeklyObjective_carryForward(self, data):
        source = self.find("weeklyObjectives", data["id"])
        self.bump(source, {"state": "continued"})
        return self.create("weeklyObjectives", "objective", {**{key: source[key] for key in ("goalId", "projectId", "title", "description")}, "weekStartLocalDate": data["nextWeekStartLocalDate"],
                                                              "state": "active", "evidence": None, "carriedForwardFromId": source["id"], "completedAt": None, "archivedAt": None})
    def p_planner_review_start(self, data):
        return self.create("reviewSessions", "review", {"kind": data["kind"], "periodStartLocalDate": data["periodStartLocalDate"], "periodEndLocalDate": data["periodEndLocalDate"],
                                                         "state": "in_progress", "reflection": None, "snapshot": data.get("snapshot"), "completedAt": None})
    def p_planner_review_updateChecklist(self, data):
        review = self.find("reviewSessions", data["id"])
        return self.bump(review, {"snapshot": {**(review.get("snapshot") or {}), "checklist": data.get("checklist", {})}})
    def p_planner_review_complete(self, data):
        return self.bump(self.find("reviewSessions", data["id"]), {"state": "completed", "reflection": data.get("reflection"), "completedAt": self.now()})

    # goals, projects, milestones, categories, workspace
    def p_planner_goal_create(self, data):
        return self.create("goals", "goal", {"categoryId": None, "parentGoalId": None, "description": None, "intentionKind": None, "successCriteria": None, "standards": None,
                                              "reviewCadence": None, "nextReviewLocalDate": None, "state": "not_started", "priority": "medium", "horizon": "yearly", "color": None,
                                              "progressMode": "task", "progressValue": 0, "targetValue": 100, "startLocalDate": None, "dueLocalDate": None,
                                              "completedAt": None, "archivedAt": None, **self.strip(data)})
    def p_planner_goal_update(self, data): return self.bump(self.find("goals", data["id"]), data.get("patch") or {})
    def p_planner_goal_archive(self, data): return self.bump(self.find("goals", data["id"]), {"state": "archived", "archivedAt": self.now()})
    def p_planner_goal_restore(self, data): return self.bump(self.find("goals", data["id"]), {"state": "in_progress", "archivedAt": None})
    def p_planner_project_create(self, data):
        return self.create("projects", "project", {"goalId": None, "categoryId": None, "description": None, "riskLevel": "none", "riskNote": None, "nextReviewLocalDate": None,
                                                    "state": "not_started", "priority": "medium", "horizon": "quarterly", "startLocalDate": None, "dueLocalDate": None,
                                                    "completedAt": None, "archivedAt": None, **self.strip(data)})
    def p_planner_project_update(self, data): return self.bump(self.find("projects", data["id"]), data.get("patch") or {})
    def p_planner_project_archive(self, data): return self.bump(self.find("projects", data["id"]), {"state": "archived", "archivedAt": self.now()})
    def p_planner_project_restore(self, data): return self.bump(self.find("projects", data["id"]), {"state": "in_progress", "archivedAt": None})
    def p_planner_milestone_create(self, data):
        return self.create("milestones", "milestone", {"description": None, "state": "not_started", "progressValue": 0, "targetValue": 100, "startLocalDate": None,
                                                        "dueLocalDate": None, "cue": None, "response": None, "completedAt": None, "archivedAt": None, **self.strip(data)})
    def p_planner_milestone_update(self, data): return self.bump(self.find("milestones", data["id"]), data.get("patch") or {})
    def p_planner_category_create(self, data): return self.create("categories", "category", {"sortOrder": len(self.rows("categories")), **self.strip(data)})
    def p_planner_category_update(self, data): return self.bump(self.find("categories", data["id"]), data.get("patch") or {})
    def p_planner_category_delete(self, data):
        self.snapshot["categories"] = [row for row in self.rows("categories") if row["id"] != data["id"]]
        for name in ("tasks", "goals", "projects", "habits"):
            for row in self.rows(name):
                if row.get("categoryId") == data["id"]:
                    row["categoryId"] = None
        return {"id": data["id"], "detachedRecords": True, "deleted": True}
    def p_planner_workspace_update(self, data):
        return self.bump(self.workspace, {key: value for key, value in self.strip(data).items() if key != "expectedVersion"})
    def p_planner_scheduleProposal_create(self, data): raise DemoError("Schedule suggestions are not simulated in the demo.")
    def p_planner_ai_draft(self, data): raise DemoError("AI drafting is switched off in the offline demo.")
    def p_ai_chat(self, data): raise DemoError("AI chat is switched off in the offline demo.")


QUERY_SUFFIXES = (".snapshot", ".dashboard", ".conflicts", ".history", ".practiceEvidence", ".rolloverPreview", ".me", ".workspace",
                  ".record", ".rules", ".devices", ".currentDevice", ".current")


# ---------------------------------------------------------------------------
# Browser interception
# ---------------------------------------------------------------------------

SUPABASE_MODULE = """
let session = SESSION;
let callback = () => {};
export const supabase = {auth: {
  getSession: async () => ({data: {session}, error: null}),
  onAuthStateChange: fn => { callback = fn; queueMicrotask(() => fn('INITIAL_SESSION', session)); return {data: {subscription: {unsubscribe() {}}}}; },
  signOut: async () => { session = null; callback('SIGNED_OUT', null); return {error: null}; },
  signInWithOAuth: async () => ({data: {}, error: {message: 'The demo does not contact Google'}}),
  signInWithPassword: async () => ({data: {}, error: {message: 'The demo does not authenticate real accounts'}}),
  signUp: async () => ({data: {}, error: {message: 'The demo does not create accounts'}})
}};
export const requireSupabaseClient = () => supabase;
""".replace("SESSION", json.dumps({"access_token": "offline-demo-token", "user": {"id": USER["authUserId"]}}))


def _batch_inputs(request) -> dict[str, Any]:
    parsed = urlparse(request.url)
    raw = None
    if request.method == "GET":
        raw = (parse_qs(parsed.query).get("input") or [None])[0]
    else:
        raw = request.post_data
    if not raw:
        return {}
    try:
        body = json.loads(raw)
    except ValueError:
        return {}
    return body if isinstance(body, dict) else {}


def install_demo(context, url: str, backend: DemoBackend | None = None, *, now: datetime | None = None, tz: str = "Pacific/Auckland") -> DemoBackend:
    """Intercept every request in `context`. API calls are answered by the in-memory backend."""
    backend = backend or DemoBackend(fixtures(now, tz), tz)
    origin = urlparse(url).netloc

    def intercept(route):
        request = route.request
        parsed = urlparse(request.url)
        if parsed.scheme in ("data", "blob"):
            route.continue_()
            return
        if parsed.netloc != origin:
            # No live network: remote scripts, fonts, Supabase and analytics get an empty answer.
            route.fulfill(status=200, content_type="application/javascript", body="")
            return
        if parsed.path == "/src/lib/supabase.ts":
            route.fulfill(status=200, content_type="application/javascript", body=SUPABASE_MODULE)
            return
        if parsed.path.startswith("/api/trpc/"):
            procedures = unquote(parsed.path.removeprefix("/api/trpc/")).split(",")
            inputs = _batch_inputs(request)
            response = []
            for index, procedure in enumerate(procedures):
                try:
                    data = backend.call(procedure, deserialize(inputs.get(str(index))))
                    response.append({"result": {"data": serialize(data)}})
                except DemoError as error:
                    response.append({"error": {"json": {"message": str(error), "code": -32600 if error.status < 500 else -32603,
                                                        "data": {"code": error.code, "httpStatus": error.status, "path": procedure}}}})
                except Exception as error:  # keep the page alive and surface the bug
                    backend.unexpected.append(f"{procedure} (handler error: {error!r})")
                    response.append({"error": {"json": {"message": f"Demo handler failed: {error}", "code": -32603,
                                                        "data": {"code": "INTERNAL_SERVER_ERROR", "httpStatus": 500, "path": procedure}}}})
            route.fulfill(status=200, content_type="application/json", body=json.dumps(response))
            return
        if parsed.path == "/api/health":
            route.fulfill(status=200, content_type="application/json", body='{"ok":true}')
            return
        if parsed.path.startswith("/api/") or parsed.path.startswith("/_vercel/"):
            backend.unexpected.append(parsed.path)
            route.fulfill(status=404, content_type="application/json", body="{}")
            return
        route.continue_()

    context.route("**/*", intercept)
    return backend


if __name__ == "__main__":
    data = fixtures()
    snap = data["planner.workspace.snapshot"]
    print(json.dumps({name: len(snap[name]) for name in SNAPSHOT_ARRAYS if isinstance(snap.get(name), list)}, indent=2))
