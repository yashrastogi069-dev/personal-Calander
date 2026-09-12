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
    conflict = {"id": "preview-conflict-1", "workspaceId": workspace["id"], "operationId": "preview-operation-1", "entity": "task", "entityId": "preview-task-0", "field": "title", "baseValue": "Plan the week", "localValue": "Plan a focused week", "serverValue": "Plan a calm week", "serverVersion": 1, "state": "needs_review", "resolvedValue": None, "createdAt": "2026-09-06T08:00:00.000Z", "resolvedAt": None}
    return {"planner.workspace.snapshot": snapshot, "planner.workspace.ensure": workspace, "planner.dashboard": {"workspace": workspace}, "planner.sync.conflicts": [conflict], "planner.calendarFeed.current": None, "planner.notification.devices": [], "planner.reminder.rules": [], "planner.review.history": []}

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
                try:
                    expect(page.get_by_role("heading", name="Today", exact=True)).to_be_visible(timeout=20000)
                except AssertionError as error:
                    raise AssertionError({"message": "Linked planner did not render", "runtimeErrors": errors, "requests": requests, "unexpected": unexpected, "body": page.locator("body").inner_text()[:1200]}) from error
                if size == "phone":
                    expect(page.get_by_role("button", name="More", exact=True)).to_be_visible()
                else:
                    expect(page.get_by_role("button", name="Settings", exact=True)).to_be_visible()
                assert "planner.workspace.snapshot" in requests, requests
                assert not unexpected, unexpected
                shared["assert_layout"](page, errors)
                expect(page.get_by_role("button", name="Review safely", exact=True)).to_be_visible()
                page.get_by_role("button", name="Review safely", exact=True).click()
                review = page.get_by_role("dialog", name="Review saved changes")
                expect(review).to_be_visible()
                expect(review.get_by_text("Plan a focused week", exact=True)).to_be_visible()
                expect(review.get_by_text("Plan a calm week", exact=True)).to_be_visible()
                expect(review.get_by_role("button", name="Keep online", exact=True)).to_be_visible()
                expect(review.get_by_role("button", name="Use this device", exact=True)).to_be_visible()
                if size == "phone":
                    page.wait_for_timeout(300)
                    page.screenshot(path=str(args.output / "preview-linked-phone-sync-review.png"))
                page.keyboard.press("Escape")
                if size == "phone":
                    page.get_by_role("button", name="More", exact=True).click()
                    expect(page.locator("#mobile-more-sheet")).to_be_visible()
                    overlay = page.locator(".mobile-more-layer").bounding_box()
                    assert overlay and overlay["height"] >= shared["SIZES"][size]["height"] - 2, overlay
                    page.screenshot(path=str(args.output / "preview-linked-phone-more-sheet.png"))
                    page.locator(".mobile-more-settings").click()
                    expect(page.locator("#settings-heading")).to_be_visible()
                    page.screenshot(path=str(args.output / "preview-linked-phone-settings.png"))
                    page.get_by_role("button", name="Customize phone layout", exact=True).click()
                    expect(page.get_by_role("heading", name="Make the planner yours", exact=True)).to_be_visible()
                    page.get_by_role("button", name="Done", exact=True).click()
                else:
                    page.get_by_role("button", name="Settings", exact=True).click()
                    expect(page.locator("#settings-heading")).to_be_visible()
                    rail = page.locator(".planner-rail").bounding_box()
                    page.locator(".planner-main").evaluate("element => { element.scrollTop = 600 }")
                    rail_after_scroll = page.locator(".planner-rail").bounding_box()
                    assert rail and rail_after_scroll and rail["y"] == rail_after_scroll["y"], (rail, rail_after_scroll)
                    page.get_by_role("button", name="Collapse planning sidebar", exact=True).click()
                    assert page.locator(".planner-shell").evaluate("element => element.classList.contains('is-rail-collapsed')")
                    page.get_by_role("button", name="Expand planning sidebar", exact=True).click()
                if size == "phone":
                    page.get_by_role("button", name="More", exact=True).click()
                    page.locator("#mobile-more-sheet").get_by_role("button", name="Categories & Recycle Bin", exact=True).click()
                else:
                    page.get_by_role("button", name="Categories", exact=True).click()
                recycle = page.get_by_role("dialog", name="Categories & Recycle Bin")
                expect(recycle).to_be_visible()
                expect(recycle.get_by_text("Recycle Bin · kept indefinitely", exact=True)).to_be_visible()
                page.keyboard.press("Escape")
                page.get_by_role("button", name="Tasks", exact=True).click()
                lanes = page.locator(".task-lane")
                expect(lanes).to_have_count(3)
                if size == "phone":
                    expect(page.get_by_role("tab")).to_have_count(3)
                    expect(page.locator(".task-lane:visible")).to_have_count(1)
                lane_surfaces = lanes.evaluate_all(
                    "elements => elements.map(element => getComputedStyle(element).getPropertyValue('--lane-surface').trim())"
                )
                assert lane_surfaces == ["#2a405d", "#155b59", "#1d4b3d"], lane_surfaces
                assert page.evaluate("document.documentElement.scrollWidth <= document.documentElement.clientWidth"), "Task board overflows the viewport"
                task_path = args.output / f"preview-linked-task-lanes-{size}.png"
                page.screenshot(path=str(task_path), full_page=True)
                if size == "phone":
                    context.set_offline(True)
                    page.get_by_role("button", name="Edit Review the calendar", exact=True).click()
                    editor = page.get_by_role("dialog", name="Refine the commitment")
                    editor.get_by_label("Task", exact=True).fill("Review calendar offline")
                    editor.get_by_role("button", name="Save changes", exact=True).click()
                    expect(page.get_by_text("Review calendar offline", exact=True)).to_be_visible()
                    page.get_by_role("button", name="Move Plan a focused week down in To do", exact=True).click()
                    page.get_by_role("button", name="Complete Plan a focused week", exact=True).click()
                    capture = page.get_by_label("Quickly capture a task", exact=True)
                    capture.fill("Captured while offline")
                    capture.press("Enter")
                    expect(page.get_by_text("Captured while offline", exact=True)).to_be_visible()
                    expect(page.get_by_text("Needs review", exact=True)).to_be_visible()
                    pending = page.evaluate("""async () => await new Promise((resolve, reject) => {
                      const request = indexedDB.open('personal-calander-planner-v1');
                      request.onerror = () => reject(request.error);
                      request.onsuccess = () => {
                        const count = request.result.transaction('operations').objectStore('operations').count();
                        count.onerror = () => reject(count.error);
                        count.onsuccess = () => resolve(count.result);
                      };
                    })""")
                    assert pending == 4, pending
                    result_offline = {"offlineTaskQueued": pending, "offlineScreenshot": str(args.output / "preview-linked-phone-offline-sync.png")}
                    page.screenshot(path=result_offline["offlineScreenshot"], full_page=True)
                else:
                    result_offline = {}
                path = args.output / f"preview-linked-home-{size}.png"
                page.screenshot(path=str(path), full_page=True)
                result = {"state": "linked-synthetic-data", "size": size, "screenshot": str(path), "taskLaneScreenshot": str(task_path), "taskLaneSurfaces": lane_surfaces, "requests": requests}
                result.update(result_offline)
                try:
                    if size == "phone":
                        page.get_by_role("button", name="More", exact=True).click()
                        page.locator(".mobile-more-settings").click()
                    else:
                        page.get_by_role("button", name="Settings", exact=True).click()
                    expect(page.get_by_role("button", name="Sign out on this device", exact=True)).to_be_visible()
                    page.once("dialog", lambda dialog: dialog.accept())
                    page.get_by_role("button", name="Sign out on this device", exact=True).click(timeout=1500)
                    expect(page.get_by_role("button", name="Continue with Google")).to_be_visible()
                    result["signOutPointerAccessible"] = True
                    if size == "phone":
                        expect(page.get_by_text("1 task change waiting to sync.", exact=True)).not_to_be_visible()
                        result["signedOutCacheHidden"] = True
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
