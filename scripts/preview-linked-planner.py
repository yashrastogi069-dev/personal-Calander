"""Render the current Home design with clearly synthetic, intercepted planner data."""
import argparse
import json
from pathlib import Path
import runpy
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect, TimeoutError as PlaywrightTimeoutError

shared = runpy.run_path(str(Path(__file__).with_name("preview-auth-states.py")))

def fixtures():
    workspace = shared["WORKSPACE"]
    names = ["categories", "goals", "milestones", "projects", "tasks", "habits", "habitCheckIns", "savedViews", "externalEvents", "dailyCheckIns", "taskOccurrences", "reviewSessions", "dailyPlans", "dailyPlanItems", "weeklyObjectives", "focusSessions", "planningTemplates", "scheduleProposals", "taskDependencies", "integrationConnections", "planningAvailabilityExceptions"]
    snapshot = {name: [] for name in names}
    snapshot.update({"workspace": workspace, "icsOverlay": {"configured": False, "status": "not_configured"}})
    snapshot["categories"] = [{"id": "preview-category", "name": "Personal", "color": "#C6F06A", "sortOrder": 0}]
    for i, title in enumerate(["Plan a focused week", "Review the calendar", "Make time for a walk"]):
        snapshot["tasks"].append({"id": f"preview-task-{i}", "workspaceId": workspace["id"], "title": title, "state": "not_started", "priority": "medium", "horizon": "daily", "categoryId": "preview-category", "scheduledLocalDate": "2026-09-06", "dueLocalDate": None, "estimateMinutes": 30, "sortOrder": i, "version": 1, "projectId": None, "goalId": None, "parentTaskId": None, "recurrenceRule": None, "scheduleMode": "manual", "plannedStartAt": None, "plannedEndAt": None})
    return {"planner.workspace.snapshot": snapshot, "planner.workspace.ensure": workspace, "planner.dashboard": {"workspace": workspace}, "planner.notification.devices": [], "planner.reminder.rules": [], "planner.review.history": []}

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default="http://localhost:14773")
    parser.add_argument("--output", type=Path, default=shared["DEFAULT_OUTPUT"])
    args = parser.parse_args()
    if urlparse(args.url).hostname not in ["localhost", "127.0.0.1"]:
        parser.error("Only local preview servers are allowed")
    args.output.mkdir(parents=True, exist_ok=True)
    results = []
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        try:
            for size in shared["SIZES"]:
                context, page, errors = shared["new_page"](browser, size)
                requests, unexpected = shared["install_preview"](context, args.url, "linked", fixtures())
                page.goto(args.url, wait_until="networkidle")
                expect(page.get_by_role("heading", name="Today", exact=True)).to_be_visible(timeout=20000)
                expect(page.get_by_role("button", name="Sign out", exact=True)).to_be_visible()
                assert "planner.workspace.snapshot" in requests, requests
                assert not unexpected, unexpected
                shared["assert_layout"](page, errors)
                if size == "phone":
                    page.get_by_role("button", name="More", exact=True).click()
                    expect(page.locator("#mobile-more-sheet")).to_be_visible()
                    overlay = page.locator(".mobile-more-layer").bounding_box()
                    assert overlay and overlay["height"] >= shared["SIZES"][size]["height"] - 2, overlay
                    page.screenshot(path=str(args.output / "preview-linked-phone-more-sheet.png"))
                    page.locator(".mobile-more-settings").click()
                    expect(page.get_by_role("heading", name="Make the planner yours", exact=True)).to_be_visible()
                    page.screenshot(path=str(args.output / "preview-linked-phone-settings.png"))
                    page.get_by_role("button", name="Done", exact=True).click()
                page.get_by_role("button", name="Tasks", exact=True).click()
                lanes = page.locator(".task-lane")
                expect(lanes).to_have_count(3)
                lane_surfaces = lanes.evaluate_all(
                    "elements => elements.map(element => getComputedStyle(element).getPropertyValue('--lane-surface').trim())"
                )
                assert lane_surfaces == ["#2a405d", "#155b59", "#1d4b3d"], lane_surfaces
                assert page.evaluate("document.documentElement.scrollWidth <= document.documentElement.clientWidth"), "Task board overflows the viewport"
                task_path = args.output / f"preview-linked-task-lanes-{size}.png"
                page.screenshot(path=str(task_path), full_page=True)
                path = args.output / f"preview-linked-home-{size}.png"
                page.screenshot(path=str(path), full_page=True)
                result = {"state": "linked-synthetic-data", "size": size, "screenshot": str(path), "taskLaneScreenshot": str(task_path), "taskLaneSurfaces": lane_surfaces, "requests": requests}
                try:
                    page.get_by_role("button", name="Sign out", exact=True).click(timeout=1500)
                    expect(page.get_by_role("button", name="Continue with Google")).to_be_visible()
                    result["signOutPointerAccessible"] = True
                except PlaywrightTimeoutError:
                    # Visibility is required above. Report pointer obstruction separately
                    # without disguising it through forced clicks or changing app styles.
                    result["signOutPointerAccessible"] = False
                    result["interactionIssue"] = "Visible Sign out is covered by the fixed phone navigation."
                context.close()
                errors[:] = [error for error in errors if error != "WebSocket closed without opened."]
                assert not errors, errors
                result["runtimeErrors"] = list(errors)
                results.append(result)
        finally: browser.close()
    (args.output / "preview-linked-results.json").write_text(json.dumps(results, indent=2), encoding="utf8")
    print(json.dumps({"linked_states_passed": len(results), "data": "synthetic only", "output": str(args.output)}))

if __name__ == "__main__": main()
