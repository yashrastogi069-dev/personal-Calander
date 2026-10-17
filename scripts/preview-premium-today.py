"""Today layout pass verification against the local Vite dev server, on demo data only.

Every API, auth and remote request is intercepted by scripts/demo-fixtures.py, so nothing reaches a live
database. Runs: 1440x900 and 390x844 in light and dark, plus one reduced-motion run. The page clock is fixed
(10:40 local by default) so the hero, now-line and evening card are deterministic. Shots go to --shots
(outside the repository).

Per run:
  default page (hero task variant, list, habit chips, timeline), one check per list row, no "Resolve in
  Plan/Recovery" copy; a tick shows Undo and sends nothing, Undo reverts it (0 writes), a second tick sends
  exactly one expected write after the Undo window (by row source) and the row stays dimmed; tapping a due habit
  chip sends exactly one planner.habit.checkIn; Plan my day moves 1-3 (a leftover decision, energy, two tray
  picks with a live capacity bar, one slot placed) with the expected writes; Shut down day steps 1-3 including the
  3+ carry item that Move all skips and the disabled Close day, then Close day (decisions + dailyPlan.close) and the
  closed card; a meeting hero ("in 12 min", Join from the stored payload); the quiet morning card and the evening
  shutdown card. No horizontal overflow, no runtime/console errors, no unexpected network.

Start Vite first: npx vite --port 3100 --strictPort --host 127.0.0.1

  python scripts/preview-premium-today.py --shots DIR [--url http://127.0.0.1:3100/]
"""
import argparse
from datetime import datetime, time, timedelta, timezone
import json
from pathlib import Path
import runpy
import sys
from urllib.parse import urlparse
from zoneinfo import ZoneInfo

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parent.resolve()
DEMO = runpy.run_path(str(ROOT / "demo-fixtures.py"))

IGNORED_ERRORS = {"WebSocket closed without opened."}
BOOTSTRAP = {"planner.workspace.ensure"}
UNDO_MS = 5000
STRICT_TASK = "task-linkedin-headline"
LEFTOVER_ITEM = "item-yday-task-expense"
EXPECTED_TICK = {
    "task": "planner.task.update",
    "occurrence": "planner.occurrence.resolve",
    "daily_commitment": "planner.recovery.resolve",
    "carried_commitment": "planner.recovery.resolve",
}

RUNS = [
    (1440, 900, "light", False),
    (1440, 900, "dark", False),
    (390, 844, "light", False),
    (390, 844, "dark", False),
    (1440, 900, "light", True),
]


def local_instant(tz: str, hour: int, minute: int) -> datetime:
    zone = ZoneInfo(tz)
    today = datetime.now(timezone.utc).astimezone(zone).date()
    return datetime.combine(today, time(hour, minute), zone).astimezone(timezone.utc)


def settle(page, ms=1200):
    try:
        page.wait_for_load_state("networkidle", timeout=8000)
    except Exception:
        pass
    page.wait_for_timeout(ms)


def shoot(page, path: Path, width: int, height: int) -> None:
    """The planner scrolls inside .planner-main, so grow the viewport to its content for a full capture."""
    content = page.evaluate("""() => {
      const main = document.querySelector('.planner-main');
      if (!main) return document.documentElement.scrollHeight;
      return main.getBoundingClientRect().top + main.scrollHeight;
    }""")
    tall = int(min(max(height, content + 24), 6000))
    if tall > height:
        page.set_viewport_size({"width": width, "height": tall})
        page.wait_for_timeout(300)
    page.screenshot(path=str(path))
    if tall > height:
        page.set_viewport_size({"width": width, "height": height})
        page.wait_for_timeout(200)


def writes(backend, start: int) -> list[str]:
    return [name for name in backend.mutations[start:] if name not in BOOTSTRAP]


class Session:
    """One browser context + page on its own demo backend and fixed clock."""

    def __init__(self, browser, args, width, height, theme, reduced, now: datetime, mutate=None):
        self.width, self.height = width, height
        self.context = browser.new_context(
            viewport={"width": width, "height": height}, device_scale_factor=1, color_scheme=theme,
            reduced_motion="reduce" if reduced else "no-preference", timezone_id=args.tz, service_workers="block", locale="en-NZ",
            has_touch=width < 1024,
        )
        self.backend = DEMO["DemoBackend"](DEMO["fixtures"](now, args.tz), args.tz)
        if mutate:
            mutate(self.backend.snapshot)
        DEMO["install_demo"](self.context, args.url, backend=self.backend, now=now, tz=args.tz)
        self.page = self.context.new_page()
        self.page.clock.install(time=now)
        self.errors: list[str] = []
        self.console: list[str] = []
        self.page.on("pageerror", lambda error: self.errors.append(str(error)))
        self.page.on("console", lambda message: self.console.append(message.text) if message.type == "error" else None)
        self.page.goto(args.url.rstrip("/") + "/?destination=home&view=today", wait_until="domcontentloaded")
        settle(self.page, 1800)
        expect(self.page.locator(".td-page")).to_be_visible(timeout=20000)
        self.page.wait_for_timeout(500)

    def overflow(self, where: str) -> None:
        bad = self.page.evaluate("""() => {
          const doc = document.documentElement.scrollWidth > window.innerWidth + 1;
          const page = document.querySelector('.td-page');
          const inner = page ? page.scrollWidth > page.clientWidth + 1 : false;
          const sheet = document.querySelector('.td-sheet');
          const sheetWide = sheet ? sheet.scrollWidth > sheet.clientWidth + 1 || sheet.getBoundingClientRect().right > window.innerWidth + 1 : false;
          return {doc, inner, sheetWide};
        }""")
        assert not any(bad.values()), f"horizontal overflow at {where}: {bad}"

    def close(self) -> dict:
        runtime = [error for error in self.errors if error not in IGNORED_ERRORS]
        result = {"runtime": runtime, "console": sorted(set(self.console)), "unexpected": sorted(set(self.backend.unexpected)),
                  "mutations": [name for name in self.backend.mutations if name not in BOOTSTRAP]}
        self.context.close()
        return result


def strict_and_leftover(snapshot) -> None:
    """3+ carry case (rescheduleCount 3 on a committed item) and one open leftover from yesterday."""
    for task in snapshot["tasks"]:
        if task["id"] == STRICT_TASK:
            task["rescheduleCount"] = 3
        if task["id"] == "task-expense":
            task["state"] = "not_started"
    for item in snapshot["dailyPlanItems"]:
        if item["id"] == LEFTOVER_ITEM:
            item["state"] = "committed"
            item["resolvedToLocalDate"] = None
            item["resolvedAt"] = None


def run(browser, args, width, height, theme, reduced, shots: Path) -> dict:
    tag = f"{width}x{height}-{theme}{'-reduced' if reduced else ''}"
    phone = width < 1024
    checks: dict = {}
    failures: list[str] = []
    sessions: list[dict] = []

    def check(name, fn):
        try:
            value = fn()
            checks[name] = value if value is not None else True
        except Exception as error:  # record and keep going so one run reports every problem
            checks[name] = False
            failures.append(f"{name}: {str(error)[:600]}")

    # ------------------------------------------------------------------ main session (10:40)
    now = local_instant(args.tz, 10, 40)
    s = Session(browser, args, width, height, theme, reduced, now, strict_and_leftover)
    page, backend = s.page, s.backend

    def default_layout():
        for section in ["summary", "list", "habits", "timeline"]:
            expect(page.locator(f'[data-today-section="{section}"]').first).to_be_visible(timeout=8000)
        expect(page.locator('.td-hero[data-hero="task"]')).to_be_visible()
        body = page.locator(".td-page").inner_text()
        assert "Resolve" not in body or "in Plan" not in body, "old Resolve in Plan copy"
        assert "Recovery" not in body, "Recovery copy on Today"
        expect(page.locator("[data-now-line]")).to_have_count(1)
        assert page.locator('.td-tl-entry.is-external').count() >= 1, "no external meeting in timeline"
        rows = page.locator(".td-row")
        per_row = rows.evaluate_all("els => els.map(e => e.querySelectorAll('button.tk-check').length)")
        assert per_row and all(count == 1 for count in per_row), per_row
        if phone:
            order = page.evaluate("""() => ['[data-hero]', '[data-today-section=list]', '[data-today-section=habits]', '[data-today-section=timeline]']
              .map(sel => Math.round(document.querySelector(sel).getBoundingClientRect().top))""")
            assert order == sorted(order), f"phone order {order}"
        if reduced:
            name = page.locator(".td-hero").evaluate("e => getComputedStyle(e).animationName")
            assert name == "none", name
        s.overflow("default")
        return {"rows": len(per_row), "because": page.locator(".td-hero-because").count()}
    check("defaultLayout", default_layout)
    shoot(page, shots / f"{tag}-today-default.png", width, height)
    try:
        page.locator(".td-hero").screenshot(path=str(shots / f"{tag}-today-hero-task.png"))
    except Exception:
        pass

    def tick_and_undo():
        rows = page.locator(".td-row:not(.is-ticked)")
        target = None
        for index in range(rows.count()):
            row = rows.nth(index)
            if row.locator("button.tk-check").get_attribute("aria-disabled") is None:
                target = row
                break
        assert target is not None, "no tickable row"
        key = target.get_attribute("data-today-item")
        source = target.get_attribute("data-source")
        expected = EXPECTED_TICK[source]
        row = page.locator(f'.td-row[data-today-item="{key}"]')
        start = len(backend.mutations)
        row.locator("button.tk-check").click()
        page.wait_for_timeout(700)
        toast = page.locator("[data-sonner-toast]", has_text="Undo")
        expect(toast.first).to_be_visible(timeout=3000)
        assert "is-ticked" in (row.get_attribute("class") or ""), "row not dimmed"
        assert writes(backend, start) == [], f"wrote inside the Undo window: {writes(backend, start)}"
        page.screenshot(path=str(shots / f"{tag}-today-tick-undo.png"))
        toast.first.locator("button", has_text="Undo").click()
        page.wait_for_timeout(UNDO_MS + 900)
        assert writes(backend, start) == [], f"Undo still wrote: {writes(backend, start)}"
        assert "is-ticked" not in (row.get_attribute("class") or ""), "row still ticked after Undo"
        row.locator("button.tk-check").click()
        page.wait_for_timeout(UNDO_MS + 1800)
        sent = writes(backend, start)
        assert sent == [expected], f"expected [{expected}], got {sent}"
        settle(page, 600)
        expect(page.locator(f'.td-row[data-today-item="{key}"]')).to_have_class(__import__("re").compile("is-ticked"))
        s.overflow("after tick")
        return {"row": key, "source": source, "writes": sent}
    check("tickUndoThenOneWrite", tick_and_undo)

    def habit_tap():
        chips = page.locator('.td-chip[data-habit-state="due"]')
        assert chips.count() >= 1, "no due habit chip"
        habit = chips.first.get_attribute("data-habit-id")
        start = len(backend.mutations)
        chips.first.locator(".td-chip-main").click()
        page.wait_for_timeout(1500)
        sent = writes(backend, start)
        assert sent == ["planner.habit.checkIn"], sent
        expect(page.locator(f'.td-chip[data-habit-id="{habit}"]')).to_have_attribute("data-habit-state", "done", timeout=5000)
        page.wait_for_timeout(500)
        page.locator('[data-today-section="habits"]').screenshot(path=str(shots / f"{tag}-today-habits.png"))
        return {"habit": habit, "writes": sent}
    check("habitChipTapOneWrite", habit_tap)

    def plan_my_day():
        start = len(backend.mutations)
        page.locator("[data-plan-open]").first.click()
        sheet = page.locator(".td-sheet")
        expect(sheet).to_be_visible(timeout=5000)
        page.wait_for_timeout(500)
        if phone:
            assert "is-sheet" in (sheet.get_attribute("class") or ""), "not a bottom sheet on phone"
        leftovers = sheet.locator("[data-leftover]")
        assert leftovers.count() >= 1, "no leftover in move 1"
        leftovers.first.locator(".td-seg-btn", has_text="Keep today").click()
        sheet.locator(".td-energy-btn").nth(2).click()
        page.wait_for_timeout(600)
        s.overflow("plan move 1")
        page.screenshot(path=str(shots / f"{tag}-today-plan-move1.png"))
        sheet.locator("[data-plan-next]").click()
        expect(sheet.locator('[data-plan-move="2"]')).to_be_visible(timeout=5000)
        before = sheet.locator("[data-capacity-label]").inner_text()
        picks = sheet.locator("[data-pick-task]")
        assert picks.count() >= 2, f"tray has {picks.count()} tasks"
        picks.nth(0).click()
        picks.nth(1).click()
        page.wait_for_timeout(500)
        after = sheet.locator("[data-capacity-label]").inner_text()
        assert before != after, f"capacity did not move: {before}"
        s.overflow("plan move 2")
        page.screenshot(path=str(shots / f"{tag}-today-plan-move2.png"))
        sheet.locator("[data-plan-next]").click()
        expect(sheet.locator('[data-plan-move="3"]')).to_be_visible(timeout=8000)
        page.wait_for_timeout(500)
        slots = sheet.locator(".td-slot")
        assert slots.count() >= 1, "no free slot offered"
        slots.first.click()
        page.wait_for_timeout(300)
        s.overflow("plan move 3")
        page.screenshot(path=str(shots / f"{tag}-today-plan-move3.png"))
        sheet.locator("[data-plan-next]").click()
        expect(sheet).to_be_hidden(timeout=8000)
        settle(page, 600)
        sent = writes(backend, start)
        assert sent.count("planner.recovery.resolve") == 1, sent
        assert sent.count("planner.dailyCheckIn.upsert") == 1, sent
        assert sent.count("planner.dailyPlan.addItem") == 2, sent
        assert sent.count("planner.task.reserve") == 1, sent
        assert len(sent) == 5, sent
        return {"capacity": [before, after], "writes": sent}
    check("planMyDay", plan_my_day)

    def shutdown():
        start = len(backend.mutations)
        page.locator("[data-today-menu]").click()
        page.locator("[data-menu-shutdown]").click()
        sheet = page.locator(".td-sheet")
        expect(sheet).to_be_visible(timeout=5000)
        page.wait_for_timeout(600)
        assert sheet.locator('[data-win="done"]').count() == 1
        page.screenshot(path=str(shots / f"{tag}-today-shutdown-wins.png"))
        sheet.locator("[data-shutdown-next]").click()
        expect(sheet.locator('[data-shutdown-step="2"]')).to_be_visible(timeout=5000)
        strict = sheet.locator('.td-decide.is-strict')
        assert strict.count() >= 1, "no 3+ carry item"
        assert strict.first.locator('[data-decision="tomorrow"]').is_disabled(), "strict item offers Tomorrow"
        sheet.locator("[data-move-all]").click()
        page.wait_for_timeout(300)
        counter = sheet.locator("[data-decided-count]").inner_text()
        assert not strict.first.get_attribute("class").__contains__("is-decided"), "Move all decided the strict item"
        s.overflow("shutdown step 2")
        page.screenshot(path=str(shots / f"{tag}-today-shutdown-open-strict.png"))
        sheet.locator("[data-shutdown-next]").click()
        expect(sheet.locator('[data-shutdown-step="3"]')).to_be_visible(timeout=5000)
        assert sheet.locator("[data-close-day]").is_disabled(), "Close day enabled with an undecided item"
        page.screenshot(path=str(shots / f"{tag}-today-shutdown-close-disabled.png"))
        assert writes(backend, start) == [], f"shutdown wrote before Close day: {writes(backend, start)}"
        sheet.locator(".td-sheet-foot .tk-btn", has_text="Back").click()
        for index in range(strict.count()):
            strict.nth(index).locator('[data-decision="let_go"]').click()
        sheet.locator("[data-shutdown-next]").click()
        sheet.locator("#td-reflection").fill("Shipped the CV draft. Calm finish.")
        expect(sheet.locator("[data-close-day]")).to_be_enabled(timeout=3000)
        total = int(counter.split(" of ")[1].split()[0])
        sheet.locator("[data-close-day]").click()
        expect(sheet).to_be_hidden(timeout=15000)
        settle(page, 800)
        sent = writes(backend, start)
        assert sent and sent[-1] == "planner.dailyPlan.close", sent
        assert len(sent) == total + 1, f"{len(sent)} writes for {total} items + close: {sent}"
        expect(page.locator('[data-today-card="closed"]')).to_be_visible(timeout=5000)
        shoot(page, shots / f"{tag}-today-closed.png", width, height)
        s.overflow("closed")
        return {"items": total, "counter": counter, "writes": sent}
    check("shutdownDay", shutdown)

    sessions.append(s.close())

    # ------------------------------------------------------------------ meeting hero (10:40 + standup in 12 min)
    def add_standup(snapshot):
        start = now + timedelta(minutes=12)
        snapshot["externalEvents"].append({"id": "evt-standup-now", "workspaceId": snapshot["workspace"]["id"], "connectionId": "conn-google-demo",
                                           "externalId": "evt-standup-now@google.demo", "title": "Standup", "startsAt": start,
                                           "endsAt": start + timedelta(minutes=15), "isAllDay": 0, "status": "active",
                                           "payload": {"hangoutLink": "https://meet.google.com/demo-standup"}, "updatedAt": now})
    m = Session(browser, args, width, height, theme, reduced, now, add_standup)

    def meeting_hero():
        hero = m.page.locator('.td-hero[data-hero="meeting"]')
        expect(hero).to_be_visible(timeout=8000)
        assert "Standup in 12 min" in hero.inner_text(), hero.inner_text()
        assert hero.locator('a[href="https://meet.google.com/demo-standup"]').count() == 1, "no Join link"
        hero.screenshot(path=str(shots / f"{tag}-today-hero-meeting.png"))
        m.overflow("meeting hero")
        return True
    check("meetingHero", meeting_hero)
    sessions.append(m.close())

    # ------------------------------------------------------------------ morning card (08:05, plan still a draft)
    def draft_plan(snapshot):
        for plan in snapshot["dailyPlans"]:
            if plan["id"] == "plan-today":
                plan["state"] = "draft"
    mo = Session(browser, args, width, height, theme, reduced, local_instant(args.tz, 8, 5), draft_plan)

    def morning_card():
        expect(mo.page.locator('[data-today-card="morning"]')).to_be_visible(timeout=8000)
        shoot(mo.page, shots / f"{tag}-today-morning.png", width, height)
        mo.overflow("morning")
        return True
    check("morningCard", morning_card)
    sessions.append(mo.close())

    # ------------------------------------------------------------------ evening card (18:20, after preferredShutdownAt 18:00)
    ev = Session(browser, args, width, height, theme, reduced, local_instant(args.tz, 18, 20))

    def evening_card():
        expect(ev.page.locator('[data-today-card="evening"]')).to_be_visible(timeout=8000)
        shoot(ev.page, shots / f"{tag}-today-evening.png", width, height)
        ev.overflow("evening")
        return True
    check("eveningCard", evening_card)
    sessions.append(ev.close())

    runtime = [error for session in sessions for error in session["runtime"]]
    console = sorted({error for session in sessions for error in session["console"]})
    unexpected = sorted({path for session in sessions for path in session["unexpected"]})
    if runtime:
        failures.append(f"runtime errors: {runtime[:5]}")
    if console:
        failures.append(f"console errors: {console[:5]}")
    if unexpected:
        failures.append(f"unexpected network: {unexpected}")
    return {"run": tag, "passed": not failures, "failures": failures, "checks": checks, "runtimeErrors": runtime,
            "consoleErrors": console[:20], "unexpected": unexpected, "mutations": [session["mutations"] for session in sessions]}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--url", default="http://127.0.0.1:3100/")
    parser.add_argument("--tz", default="Pacific/Auckland")
    parser.add_argument("--shots", type=Path, required=True, help="screenshot folder outside the repository")
    parser.add_argument("--only", type=int, default=None, help="run only RUNS[index] (debugging)")
    args = parser.parse_args()
    if urlparse(args.url).hostname not in ("localhost", "127.0.0.1"):
        parser.error("Only local preview servers are allowed")
    shots = args.shots.resolve()
    if shots.is_relative_to(REPO):
        parser.error("Keep screenshots outside the repository")
    shots.mkdir(parents=True, exist_ok=True)
    runs = RUNS if args.only is None else [RUNS[args.only]]

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        try:
            reports = [run(browser, args, width, height, theme, reduced, shots) for width, height, theme, reduced in runs]
        finally:
            browser.close()
    summary = {"passed": sum(report["passed"] for report in reports), "total": len(reports), "data": "demo fixtures only", "liveWrites": 0, "runs": reports}
    (shots / "preview-premium-today-report.json").write_text(json.dumps(summary, indent=2, default=str), encoding="utf8")
    print(json.dumps({"passed": summary["passed"], "total": summary["total"], "runs": [{"run": r["run"], "passed": r["passed"], "failures": r["failures"]} for r in reports]}, indent=2))
    sys.exit(0 if summary["passed"] == summary["total"] else 1)


if __name__ == "__main__":
    main()
