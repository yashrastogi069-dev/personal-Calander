"""Screenshot-free, fully intercepted T19 durable Focus browser gate.

Run against a loopback Vite server. No planner API or external request is allowed through.
"""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
import runpy
from pathlib import Path

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
AUTH = runpy.run_path(str(ROOT / "scripts" / "preview-auth-states.py"))
LINKED = runpy.run_path(str(ROOT / "scripts" / "preview-linked-planner.py"))
PRODUCT = runpy.run_path(str(ROOT / "scripts" / "preview-phase4-product.py"))
WIDTHS = (320, 390, 768, 1440)
NOW = datetime(2026, 10, 2, 12, 0, tzinfo=timezone.utc)


def fixtures():
    data = LINKED["fixtures"]()
    data["planner.task.rolloverPreview"] = {"fromLocalDate": "2026-10-02", "candidates": []}
    snapshot = data["planner.workspace.snapshot"]
    snapshot["tasks"][0]["title"] = "Synthetic focus task"
    session = {
        "id": "synthetic-finished-focus", "workspaceId": AUTH["WORKSPACE"]["id"],
        "taskId": snapshot["tasks"][0]["id"], "habitId": "synthetic-habit",
        "state": "completed", "startedAt": "2026-10-02T11:00:00.000Z",
        "endedAt": "2026-10-02T11:25:00.000Z", "lastResumedAt": None,
        "activeSeconds": 1500, "targetMinutes": 25, "outcome": "continue",
        "note": "Synthetic saved context", "nextStepAction": None,
        "nextStepTaskId": None, "version": 1,
    }
    snapshot["habits"] = [{
        "id": "synthetic-habit", "workspaceId": AUTH["WORKSPACE"]["id"],
        "name": "Read a chapter", "frequency": "daily", "schedule": {},
        "createdAt": "2026-01-01T00:00:00.000Z", "archivedAt": None, "version": 1,
    }]
    snapshot["habitCheckIns"] = []
    snapshot["focusSessions"] = [session]
    snapshot["focusHabitAttributionAvailable"] = True
    snapshot["focusHabitAttribution"] = [{
        "habitId": "synthetic-habit", "localDate": "2026-10-02",
        "timezone": "UTC", "activeSeconds": 1500,
    }]
    data["planner.focus.setFollowUp"] = {**session, "nextStepAction": "plan", "version": 2}
    data["planner.focus.start"] = {
        **session, "id": "synthetic-new-focus", "state": "active", "outcome": None,
        "note": None, "nextStepAction": None, "endedAt": None,
        "lastResumedAt": "2026-10-02T12:00:00.000Z", "activeSeconds": 0,
    }
    return data


def run_case(browser, url: str, width: int, scheme: str):
    context = browser.new_context(
        viewport={"width": width, "height": 844 if width < 768 else 1000},
        color_scheme=scheme, timezone_id="UTC", service_workers="block",
    )
    page = context.new_page()
    page.clock.set_fixed_time(NOW)
    errors = []
    focus_start_bodies = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.on("request", lambda request: focus_start_bodies.append(request.post_data or "") if "planner.focus.start" in request.url else None)
    requests, unexpected = AUTH["install_preview"](context, url, "linked", fixtures())
    try:
        page.goto(f"{url.rstrip('/')}/?destination=home&view=focus&action=focus", wait_until="networkidle")
        PRODUCT["wait_for_target"](page, "home", "focus")
        page.locator(".focus-workspace").wait_for(state="visible", timeout=20_000)
        assert page.locator("#focus-habit").is_visible(), (
            f"explicit habit selector missing at {page.url}; "
            f"headings={page.locator('h1,h2,h3').all_text_contents()[:10]}; "
            f"body={page.locator('body').inner_text()[:1200]}"
        )
        page.locator("#focus-habit").select_option("synthetic-habit")
        card = page.get_by_role("article", name="Next step after Focus")
        card.get_by_text("Next action not saved.").wait_for()
        card.get_by_label("Next action", exact=True).select_option("plan")
        context.set_offline(True)
        page.evaluate("dispatchEvent(new Event('offline'))")
        card.get_by_text("Reconnect to save the next action", exact=False).wait_for()
        assert card.get_by_role("button", name="Save next action").is_disabled(), "offline save was enabled"
        assert "planner.focus.setFollowUp" not in requests, "offline save sent a write"
        context.set_offline(False)
        page.evaluate("dispatchEvent(new Event('online'))")
        with page.expect_response(lambda response: "planner.focus.setFollowUp" in response.url):
            card.get_by_role("button", name="Save next action").click()
        card.get_by_text("Saved next action: Daily plan.").wait_for()
        habit = page.get_by_role("article", name="Habit duration companion")
        assert "Read a chapter" in habit.inner_text()
        assert "25m 0s" in habit.inner_text()
        assert "does not complete a habit check-in" in habit.inner_text()
        trail = page.get_by_role("article", name="Session trail")
        trail.get_by_role("button", name="synthetic", exact=False).click()
        assert "Habit attribution: Read a chapter." in trail.inner_text()
        assert "Saved next action: Daily plan." in trail.inner_text(), "trail must reflect the confirmed save immediately"
        with page.expect_response(lambda response: "planner.focus.start" in response.url):
            page.get_by_role("button", name="Start focus").click()
        assert any("synthetic-habit" in body for body in focus_start_bodies), "habit selection was not sent to Focus start"
        assert page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"), "horizontal overflow"
        assert "planner.focus.setFollowUp" in requests
        errors[:] = [error for error in errors if error != "WebSocket closed without opened."]
        assert not errors, errors
        assert not unexpected, unexpected
        return f"PASS {width}px {scheme}: saved handoff, habit time, trail, no overflow/runtime errors"
    finally:
        context.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", default="http://localhost:3000/")
    args = parser.parse_args()
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        try:
            for width in WIDTHS:
                for scheme in ("light", "dark"):
                    print(run_case(browser, args.url, width, scheme), flush=True)
        finally:
            browser.close()
