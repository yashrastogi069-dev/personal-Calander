"""Loopback-only Plan Studio verification. All planner/auth APIs are intercepted."""
import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import runpy
import tempfile
from urllib.parse import unquote, urlparse
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parent
UI = runpy.run_path(str(ROOT / "preview-ui-review.py"))
AUTH = runpy.run_path(str(ROOT / "preview-auth-states.py"))


def fixture_data(empty=False):
    fixtures = UI["synthetic_fixtures"]()
    snapshot = fixtures["planner.workspace.snapshot"]
    wid = snapshot["workspace"]["id"]
    if empty:
        for name in ("tasks", "dailyPlans", "dailyPlanItems", "taskOccurrences", "weeklyObjectives", "externalEvents"):
            snapshot[name] = []
    else:
        snapshot["tasks"].extend([
            {"id": "preview-deadline-only", "workspaceId": wid, "title": "Deadline without a planned day", "state": "not_started", "priority": "medium", "horizon": "weekly", "dueLocalDate": "2026-09-20", "version": 1},
            {"id": "preview-saturday", "workspaceId": wid, "title": "Saturday saved work", "state": "not_started", "priority": "medium", "horizon": "weekly", "scheduledLocalDate": "2026-09-19", "version": 1},
        ])
        snapshot["tasks"][0].update(plannedStartAt="2026-09-20T10:00:00Z", plannedEndAt="2026-09-20T10:25:00Z")
        snapshot["dailyPlans"] = [{"id": "preview-day-plan", "workspaceId": wid, "localDate": "2026-09-20", "state": "active", "intention": "Synthetic saved intention", "version": 3}]
        snapshot["dailyPlanItems"] = [{"id": "preview-plan-item", "dailyPlanId": "preview-day-plan", "workspaceId": wid, "taskId": "preview-task-a", "state": "committed", "sortOrder": 0, "version": 2}]
        snapshot["weeklyObjectives"] = [{"id": "preview-week-objective", "workspaceId": wid, "weekStartLocalDate": "2026-09-14", "title": "Synthetic weekly outcome", "state": "in_progress", "version": 4}]
        snapshot["externalEvents"] = [{"id": "preview-appointment", "workspaceId": wid, "title": "Saved calendar appointment", "status": "active", "startsAt": "2026-09-20T12:00:00Z", "endsAt": "2026-09-20T12:30:00Z", "provider": "google", "version": 1}]
    return fixtures


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default="http://localhost:3100/")
    parser.add_argument("--widths", default="320,390,768,1440")
    parser.add_argument("--themes", default="light,dark")
    parser.add_argument("--output", type=Path, default=Path(tempfile.gettempdir()) / "premium-plan-results.json")
    parser.add_argument("--capture-dir", type=Path, help="Optional synthetic diagnostic captures outside this repository")
    args = parser.parse_args()
    url = UI["loopback_url"](args.url).rstrip("/")
    if args.capture_dir:
        capture_path = args.capture_dir.resolve()
        assert not capture_path.is_relative_to(ROOT.parent.resolve()), "Keep diagnostic captures outside the repository"
        capture_path.mkdir(parents=True, exist_ok=True)
    results, failures = [], []
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        try:
            for width in map(int, args.widths.split(",")):
                for theme in args.themes.split(","):
                    context = browser.new_context(viewport={"width": width, "height": 1000 if width >= 768 else 844}, color_scheme=theme, timezone_id="UTC", service_workers="block")
                    fixtures = fixture_data()
                    requests, unexpected = AUTH["install_preview"](context, url, "linked", fixtures)
                    page = context.new_page()
                    page.clock.set_fixed_time(datetime(2026, 9, 20, 9, 0, tzinfo=timezone.utc))
                    errors, writes = [], []
                    page.on("pageerror", lambda error: errors.append(str(error)) if str(error) != "WebSocket closed without opened." else None)
                    bootstrap = []
                    # Workspace ensure is the shell's idempotent bootstrap, not a Plan write; record it separately.
                    def record_post(request):
                        if "/api/trpc/" not in request.url or request.method != "POST":
                            return
                        entry = {"procedure": unquote(urlparse(request.url).path.split("/api/trpc/")[-1]), "payload": request.post_data}
                        (bootstrap if entry["procedure"] == "planner.workspace.ensure" else writes).append(entry)
                    page.on("request", record_post)

                    def goto(view="weekly"):
                        page.goto(f"{url}/?destination=plan&view={view}", wait_until="networkidle")
                        expect(page.locator(".plan-workspace")).to_be_visible()

                    def check(name, action):
                        try:
                            action()
                            assert not errors, errors
                            assert not page.evaluate("document.documentElement.scrollWidth > innerWidth"), "Document horizontal overflow"
                            results.append({"case": name, "width": width, "theme": theme, "passed": True})
                        except Exception as error:
                            failure = {"case": name, "width": width, "theme": theme, "error": str(error)}
                            failures.append(failure)
                            print(json.dumps(failure), flush=True)

                    def board():
                        goto()
                        expect(page.get_by_role("region", name="Week board", exact=True)).to_be_visible() if width > 680 else expect(page.get_by_role("group", name="Planning week", exact=True)).to_be_visible()
                        pool = page.get_by_role("region", name="Unplanned work", exact=True)
                        expect(pool.get_by_text("Deadline without a planned day", exact=True)).to_be_visible()
                        assert page.locator('.plan-week-day [data-task-id="preview-deadline-only"]').count() == 0
                        assert page.locator('.plan-week-day [data-task-id="preview-task-a"]').count() == 1
                        expect(page.get_by_text("Synthetic weekly outcome", exact=True)).to_be_visible()
                        if width <= 680:
                            day_buttons = page.get_by_role("group", name="Planning week").get_by_role("button")
                            assert day_buttons.count() == 7
                            boxes = day_buttons.evaluate_all("elements => elements.map(e => ({width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height}))")
                            assert all(box["width"] >= 44 and box["height"] >= 44 for box in boxes), boxes
                        assert not writes, writes
                        if args.capture_dir:
                            page.screenshot(path=str(args.capture_dir / f"plan-week-{width}-{theme}.png"), full_page=True)
                    check("week-board-date-source-dedup-and-touch-targets", board)

                    def weekend():
                        selected = page.get_by_role("complementary", name="Selected day plan", exact=True)
                        if width <= 680:
                            page.get_by_role("group", name="Planning week").get_by_role("button").nth(5).click()
                        else:
                            page.locator(".plan-week-day-head").nth(5).click()
                        expect(selected).to_contain_text("Saturday")
                        selected.get_by_role("button", name="Review 2026-09-19 in Calendar", exact=True).click()
                        expect(page.locator(".phase4-planner-shell")).to_have_attribute("data-view", "calendar")
                        page.go_back(wait_until="networkidle")
                        expect(selected).to_contain_text("Saturday")
                        page.reload(wait_until="networkidle")
                        expect(selected).to_contain_text("Saturday")
                        assert not writes, writes
                    check("weekend-calendar-back-reload-no-write", weekend)

                    def offline():
                        goto("daily")
                        # The selected day survives in this tab by design; return to the saved plan's day first.
                        today_button = page.get_by_role("navigation", name="Planning day").get_by_role("button", name="Today", exact=True)
                        if today_button.is_enabled():
                            today_button.click()
                        field = page.locator("#daily-intention")
                        expect(field).to_be_visible()
                        field.fill("Synthetic offline retained intention")
                        context.set_offline(True)
                        try:
                            page.wait_for_function("!navigator.onLine")
                            expect(page.get_by_role("button", name="Save intention", exact=True)).to_be_disabled()
                            expect(field).to_have_value("Synthetic offline retained intention")
                            assert not writes, writes
                        finally:
                            context.set_offline(False)
                    check("offline-plan-write-disabled-draft-retained", offline)

                    def mutation():
                        goto("daily")
                        today_button = page.get_by_role("navigation", name="Planning day").get_by_role("button", name="Today", exact=True)
                        if today_button.is_enabled():
                            today_button.click()
                        field = page.locator("#daily-intention")
                        field.fill("Synthetic updated intention")
                        fixtures["planner.dailyPlan.upsert"] = {**fixtures["planner.workspace.snapshot"]["dailyPlans"][0], "intention": "Synthetic updated intention", "version": 4}
                        page.get_by_role("button", name="Save intention", exact=True).click()
                        page.wait_for_function("document.querySelector('#daily-intention')?.value === 'Synthetic updated intention'")
                        expect.poll if False else None
                        page.wait_for_timeout(150)
                        call = next(write for write in writes if write["procedure"] == "planner.dailyPlan.upsert")
                        payload = json.loads(call["payload"])
                        # tRPC batch indexes are transport-only; inspect the actual JSON arguments.
                        args_json = payload.get("0", payload).get("json", {})
                        assert args_json["workspaceId"] == "preview-workspace-0001", args_json
                        assert args_json["localDate"] == "2026-09-20", args_json
                        assert args_json["expectedVersion"] == 3, args_json
                        assert args_json["intention"] == "Synthetic updated intention", args_json
                    check("existing-versioned-daily-plan-mutation", mutation)
                    results.append({"width": width, "theme": theme, "bootstrapCalls": len(bootstrap), "mockPlannerWrites": writes, "livePlannerWrites": 0, "unexpectedProcedures": unexpected})
                    context.close()

            # Empty and storage-restriction checks use separate isolated synthetic contexts.
            for width in (320, 1440):
                for restricted in (False, True):
                    context = browser.new_context(viewport={"width": width, "height": 900}, service_workers="block")
                    AUTH["install_preview"](context, url, "linked", fixture_data(empty=True))
                    if restricted:
                        context.add_init_script("Object.defineProperty(Storage.prototype, 'getItem', {value(){throw new DOMException('Blocked', 'SecurityError')}}); Object.defineProperty(Storage.prototype, 'setItem', {value(){throw new DOMException('Blocked', 'SecurityError')}})")
                    page = context.new_page()
                    page.clock.set_fixed_time(datetime(2026, 9, 20, 9, 0, tzinfo=timezone.utc))
                    errors = []
                    page.on("pageerror", lambda error: errors.append(str(error)) if str(error) != "WebSocket closed without opened." else None)
                    try:
                        page.goto(f"{url}/?destination=plan&view=weekly", wait_until="networkidle")
                        expect(page.locator(".plan-workspace")).to_be_visible()
                        expect(page.get_by_text("No unplanned tasks in the loaded snapshot.", exact=True)).to_be_visible()
                        assert not errors, errors
                        assert not page.evaluate("document.documentElement.scrollWidth > innerWidth")
                        results.append({"case": "empty-and-blocked-storage", "width": width, "restrictedStorage": restricted, "passed": True})
                    except Exception as error:
                        failures.append({"case": "empty-and-blocked-storage", "width": width, "restrictedStorage": restricted, "error": str(error)})
                    context.close()
        finally:
            browser.close()
    args.output.write_text(json.dumps({"results": results, "failures": failures, "data": "synthetic only", "livePlannerWrites": 0}, indent=2), encoding="utf-8")
    print(json.dumps({"passed": sum(item.get("passed", False) for item in results), "failed": len(failures), "output": str(args.output)}))
    raise SystemExit(1 if failures else 0)


if __name__ == "__main__":
    main()
