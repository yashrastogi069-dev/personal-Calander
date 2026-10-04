"""Loopback-only screenshot-composition gate with synthetic planner/auth APIs.

Optional comparison captures must stay outside the repository. No live record,
remote request, service worker or planner write passes through this harness.
"""
import argparse
from copy import deepcopy
from datetime import datetime, timezone
import json
from pathlib import Path
import runpy
import tempfile
from playwright.sync_api import expect, sync_playwright

expect.set_options(timeout=15000)

ROOT = Path(__file__).resolve().parent
UI = runpy.run_path(str(ROOT / "preview-ui-review.py"))
AUTH = runpy.run_path(str(ROOT / "preview-auth-states.py"))
NOW = datetime(2026, 9, 20, 9, tzinfo=timezone.utc)


def fixtures_for(state, empty=False):
    fixtures = deepcopy(UI["synthetic_fixtures"]())
    snapshot = fixtures["planner.workspace.snapshot"]
    if empty:
        for key in ("tasks", "habits", "habitCheckIns", "projects", "milestones", "externalEvents", "dailyPlans", "dailyPlanItems"):
            snapshot[key] = []
    else:
        for index in range(4):
            if index >= len(snapshot["tasks"]):
                snapshot["tasks"].append(deepcopy(snapshot["tasks"][0]))
            snapshot["tasks"][index].update(id=f"preview-task-{chr(97 + index)}", state="not_started", scheduledLocalDate="2026-09-20", sortOrder=index)
        snapshot["tasks"][2]["title"] = "Read the project notes and prepare a useful next step"
        snapshot["tasks"][3]["title"] = "Plan dinner and groceries"
    snapshot["focusSessions"] = [] if state == "idle" else [{
        "id": "preview-visible-session", "workspaceId": snapshot["workspace"]["id"],
        "taskId": "preview-task-a", "state": state, "startedAt": "2026-09-20T08:55:00.000Z",
        "lastResumedAt": "2026-09-20T08:55:00.000Z" if state == "active" else None,
        "pausedAt": "2026-09-20T08:59:00.000Z" if state == "paused" else None,
        "activeSeconds": 240, "targetMinutes": 25, "version": 1,
    }]
    return fixtures


METRICS = """() => {
  const box = selector => document.querySelector(selector)?.getBoundingClientRect().toJSON() ?? null;
  const style = selector => {const n = document.querySelector(selector); if (!n) return null;
    const s = getComputedStyle(n); return {font: s.fontFamily, size: s.fontSize, color: s.color, background: s.backgroundColor};};
  return {viewport: innerWidth, document: document.documentElement.scrollWidth,
    rail: box('.planner-rail'), header: box('.planner-topbar'), tabs: box('.planner-view-navigation'),
    watch: box('.focus-companion'), dial: box('.focus-companion .focus-time-dial-face'),
    watchType: style('.focus-companion .focus-time-dial-time'),
    capacity: box('.today-capacity-strip'), grid: box('.today-execution-grid'),
    work: box('.today-flexible-work'), day: box('.today-timeline'),
    habits: box('.today-habits'), nav: box('.mobile-planner-nav'),
    headingType: style('.planner-topbar h1'), bodyType: style('body'),
    rows: [...document.querySelectorAll('.today-workspace .canonical-task-row, .task-workspace .canonical-task-row')]
      .slice(0, 8).map(n => n.getBoundingClientRect().toJSON()),
    fonts: {ready: document.fonts.status, onestLoaded: [...document.fonts].some(f => f.family.includes('Onest') && f.status === 'loaded')}
  };
}"""


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default="http://localhost:3001/")
    parser.add_argument("--widths", default="320,390,768,1440")
    parser.add_argument("--themes", default="light,dark")
    parser.add_argument("--states", default="idle,active,paused")
    parser.add_argument("--empty", action="store_true", help="Verify empty work/history without opening a nonexistent record")
    parser.add_argument("--output", type=Path, default=Path(tempfile.gettempdir()) / "visible-workspace-manifest.json")
    parser.add_argument("--captures", type=Path, help="Optional private synthetic comparison directory outside repository")
    args = parser.parse_args()
    url = UI["loopback_url"](args.url)
    if args.captures:
        if args.captures.resolve().is_relative_to(ROOT.parent.resolve()):
            parser.error("Comparison captures must be outside the repository")
        args.captures.mkdir(parents=True, exist_ok=True)
    results, failures, page_errors, diagnostics = [], [], [], []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        for width in map(int, args.widths.split(",")):
            for theme in args.themes.split(","):
                for state in args.states.split(","):
                    fixtures = fixtures_for(state, empty=args.empty)
                    context = browser.new_context(viewport={"width": width, "height": 1000 if width >= 768 else 844}, color_scheme=theme, timezone_id="UTC", service_workers="block")
                    context.add_init_script(f"localStorage.setItem('theme', {json.dumps(theme)})")
                    requests, unexpected = AUTH["install_preview"](context, url, "linked", fixtures)
                    page = context.new_page()
                    page.set_default_timeout(8000)
                    page.set_default_navigation_timeout(30000)
                    page.clock.set_fixed_time(NOW)
                    page.on("pageerror", lambda error: diagnostics.append(str(error)) if str(error) == "WebSocket closed without opened." else page_errors.append(str(error)))
                    for view, query in (("today", "?destination=home&view=today"), ("tasks", "?destination=tasks&view=list")):
                        case = {"view": view, "width": width, "theme": theme, "state": state, "empty": args.empty}
                        try:
                            page.goto(url + query, wait_until="networkidle")
                            expect(page.locator(".phase4-planner-shell")).to_be_visible()
                            expect(page.locator(".today-workspace" if view == "today" else ".task-workspace")).to_be_visible()
                            measurements = page.evaluate(METRICS)
                            assert measurements["document"] <= width + 1, "horizontal document overflow"
                            if view == "today":
                                cells = page.locator(".today-habit-activity-day")
                                expect(cells).to_have_count(28)
                                assert cells.last.get_attribute("data-date") == "2026-09-20", "heatmap ends outside workspace today"
                                work = page.locator(".today-work-column").bounding_box()
                                habits = page.locator(".today-habit-column").bounding_box()
                                assert work and habits, "bento columns missing"
                                if width >= 1100:
                                    assert habits["x"] > work["x"] + work["width"] - 1 and abs(habits["y"] - work["y"]) < 2, "desktop work/habits are not adjacent"
                                else:
                                    assert habits["y"] >= work["y"] + work["height"] - 1, "phone work must remain before habits"
                            if view == "today" and state != "idle":
                                expect(page.locator(".focus-companion")).to_be_visible()
                                assert measurements["watchType"] and float(measurements["watchType"]["size"].removesuffix("px")) >= (36 if width < 768 else 44), "Home time is not prominently readable"
                            if view == "today" and not args.empty:
                                page.locator(".today-flexible-row .canonical-task-detail-action").first.click()
                                expect(page.get_by_label("Task title", exact=True)).to_be_visible()
                                expect(page.get_by_role("button", name="Focus on task", exact=True)).to_be_visible()
                                page.keyboard.press("Escape")
                                expect(page.get_by_label("Task title", exact=True)).not_to_be_visible()
                            if args.captures and state in ("idle", "active") and width in (390, 1440):
                                path = args.captures / f"{view}-{width}-{theme}-{state}.png"
                                page.screenshot(path=str(path), full_page=True)
                                case["comparison"] = str(path)
                            if args.empty:
                                expect(page.locator(".today-flexible-row" if view == "today" else ".task-workspace .canonical-task-row")).to_have_count(0)
                            if view == "tasks" and not args.empty:
                                page.goto(url + "?destination=tasks&view=list&record=preview-task-a", wait_until="networkidle")
                                expect(page.get_by_label("Task title", exact=True)).to_be_visible()
                                expect(page.get_by_role("button", name="Save changes", exact=True)).to_be_visible()
                                assert page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"), "inspector overflow"
                                page.keyboard.press("Escape")
                                expect(page.get_by_label("Task title", exact=True)).not_to_be_visible()
                            if view == "today":
                                page.clock.set_fixed_time(datetime(2026, 9, 21, 9, tzinfo=timezone.utc))
                                page.evaluate("window.dispatchEvent(new Event('focus'))")
                                expect(page.locator(".today-habit-activity-day").last).to_have_attribute("data-date", "2026-09-21")
                                page.clock.set_fixed_time(NOW)
                            assert not any(name.startswith(("planner.task.update", "planner.focus.start", "planner.focus.pause", "planner.focus.resume", "planner.focus.finish")) for name in requests), "read-only composition gate attempted a planner write"
                            results.append({**case, "passed": True, "measurements": measurements, "unexpectedProcedures": sorted(set(unexpected))})
                        except Exception as error:
                            failures.append({**case, "error": str(error)})
                            print(json.dumps(failures[-1]), flush=True)
                    context.close()
        browser.close()
    manifest = {"passed": len(results), "failures": failures, "pageErrors": page_errors, "transportDiagnostics": diagnostics, "results": results, "limits": ["Synthetic/intercepted APIs; no live writes", "External font requests stubbed; real font loading requires separate check", "Not physical iPhone, VoiceOver, provider or deployment evidence"]}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(json.dumps({"passed": len(results), "failed": len(failures), "pageErrors": len(page_errors), "manifest": str(args.output)}), flush=True)
    raise SystemExit(1 if failures or page_errors else 0)


if __name__ == "__main__":
    main()
