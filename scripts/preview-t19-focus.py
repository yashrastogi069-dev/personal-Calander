"""Screenshot-free T19 Focus gate using synthetic, intercepted planner records only.

Run against a loopback Vite server, for example:
    python scripts/preview-t19-focus.py --url http://localhost:3000/
No real planner API request or external network request is allowed through.
"""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import runpy
import tempfile
import traceback
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
AUTH = runpy.run_path(str(Path(__file__).with_name("preview-auth-states.py")))
LINKED = runpy.run_path(str(Path(__file__).with_name("preview-linked-planner.py")))
PRODUCT = runpy.run_path(str(Path(__file__).with_name("preview-phase4-product.py")))
WIDTHS = (320, 390, 768, 1440)
HEIGHTS = {320: 760, 390: 844, 768: 1024, 1440: 1000}
FIXED_NOW = datetime(2026, 10, 2, 12, 0, tzinfo=timezone.utc)
WRITE_PROCEDURES = ("planner.focus.start", "planner.focus.pause", "planner.focus.resume", "planner.focus.finish")


def synthetic_fixtures(state: str) -> dict:
    fixtures = LINKED["fixtures"]()
    snapshot = fixtures["planner.workspace.snapshot"]
    snapshot["tasks"][0]["title"] = "Synthetic long-focus task"
    snapshot["focusSessions"] = [{
        "id": f"synthetic-focus-{state}",
        "workspaceId": AUTH["WORKSPACE"]["id"],
        "taskId": snapshot["tasks"][0]["id"],
        "state": state,
        "startedAt": "2026-09-20T07:00:00.000Z",
        "lastResumedAt": "2026-10-01T10:00:00.000Z" if state == "active" else None,
        "activeSeconds": 467280 if state == "active" else 467220,
        "targetMinutes": 25,
        "pausedAt": "2026-10-01T10:00:00.000Z" if state == "paused" else None,
        "endedAt": None,
        "outcome": None,
        "note": None,
        "version": 7,
    }]
    return fixtures


def inspect_layout(page, name: str) -> dict:
    metrics = page.evaluate("""() => ({
      viewport: innerWidth,
      document: document.documentElement.scrollWidth,
      body: document.body.scrollWidth,
      companion: document.querySelector('.focus-companion')?.getBoundingClientRect().toJSON() ?? null,
      face: document.querySelector('.focus-companion .focus-time-dial-face')?.getBoundingClientRect().toJSON() ?? null,
      timerFontPx: document.querySelector('.focus-companion .focus-time-dial-time')
        ? parseFloat(getComputedStyle(document.querySelector('.focus-companion .focus-time-dial-time')).fontSize) : null,
      phoneNav: document.querySelector('.mobile-planner-nav')?.getBoundingClientRect().toJSON() ?? null,
      companionActions: [...document.querySelectorAll('.focus-companion-actions button')]
        .map(button => button.getBoundingClientRect().toJSON()),
      dial: document.querySelector('.focus-time-dial')?.getAttribute('aria-label') ?? null
    })""")
    assert metrics["document"] <= metrics["viewport"] + 1, (name, metrics)
    assert metrics["body"] <= metrics["viewport"] + 1, (name, metrics)
    if metrics["companion"]:
        assert metrics["companion"]["left"] >= -1, (name, metrics)
        assert metrics["companion"]["right"] <= metrics["viewport"] + 1, (name, metrics)
        assert all(button["height"] >= 44 and button["width"] >= 44 for button in metrics["companionActions"]), (name, metrics)
        if metrics["phoneNav"] and metrics["phoneNav"]["height"] > 0:
            assert metrics["companion"]["bottom"] <= metrics["phoneNav"]["top"] + 1, (name, metrics)
    if name == "today":
        assert metrics["face"] and metrics["face"]["width"] >= (68 if metrics["viewport"] <= 680 else 110), metrics
        assert metrics["timerFontPx"] and metrics["timerFontPx"] >= (18 if metrics["viewport"] <= 680 else 27), metrics
    return metrics


def assert_visible(locator, name: str) -> None:
    locator.wait_for(state="visible", timeout=20_000)
    assert locator.is_visible(), name


def run_case(browser, url: str, width: int, scheme: str, state: str) -> dict:
    context = browser.new_context(
        viewport={"width": width, "height": HEIGHTS[width]},
        color_scheme=scheme,
        device_scale_factor=1,
        timezone_id="UTC",
        service_workers="block",
    )
    page = context.new_page()
    page.clock.set_fixed_time(FIXED_NOW)
    runtime_errors: list[str] = []
    page.on("pageerror", lambda error: runtime_errors.append(str(error)))
    requests, unexpected = AUTH["install_preview"](context, url, "linked", synthetic_fixtures(state))
    try:
        page.goto(url, wait_until="networkidle")
        assert_visible(page.locator(".focus-companion"), "persistent companion on Today")
        assert_visible(page.locator(".focus-companion .focus-time-dial"), "companion clock")
        assert "Synthetic long-focus task" in page.locator(".focus-companion").inner_text()
        expected_action = "Pause current Focus session" if state == "active" else "Resume current Focus session"
        assert_visible(page.get_by_role("button", name=expected_action), expected_action)
        metrics = {"today": inspect_layout(page, "today")}
        companion = page.locator(".focus-companion")
        companion.evaluate("element => element.dataset.t19Mount = 'continuous'")

        PRODUCT["click_destination"](page, "Tasks")
        PRODUCT["wait_for_target"](page, "tasks", "list")
        assert_visible(companion, "companion on Tasks")
        assert companion.get_attribute("data-t19-mount") == "continuous", "companion remounted after Tasks navigation"
        metrics["tasks"] = inspect_layout(page, "tasks")

        PRODUCT["click_destination"](page, "Plan")
        PRODUCT["wait_for_target"](page, "plan", "daily")
        assert_visible(companion, "companion on Plan")
        assert companion.get_attribute("data-t19-mount") == "continuous", "companion remounted after Plan navigation"
        metrics["plan"] = inspect_layout(page, "plan")

        companion.get_by_role("button", name="Expand Focus companion").click()
        assert_visible(companion.get_by_role("group", name="Watch display style"), "watch appearance controls")
        companion.get_by_role("button", name="Digital", exact=True).click()
        assert "is-digital" in companion.locator(".focus-time-dial").get_attribute("class")
        companion.get_by_role("button", name="Dial", exact=True).click()
        assert "is-dial" in companion.locator(".focus-time-dial").get_attribute("class")
        assert_visible(companion.get_by_role("button", name="Stop Focus"), "stop entry")
        companion.get_by_role("button", name="Stop Focus").click()
        assert_visible(companion.get_by_role("group", name="Confirm stopping Focus"), "stop confirmation")
        companion.get_by_role("button", name="Cancel").click()
        assert companion.get_by_role("group", name="Confirm stopping Focus").count() == 0
        assert not any(item in requests for item in WRITE_PROCEDURES), requests

        companion.get_by_role("button", name="Open full Focus view").click()
        PRODUCT["wait_for_target"](page, "home", "focus")
        assert companion.count() == 0, "companion duplicated in full Focus"
        assert_visible(page.locator(".focus-watch-stage .focus-time-dial"), "full Focus watch")
        assert_visible(page.locator(".focus-follow-up"), "Focus follow-up conductor")
        assert_visible(page.get_by_role("article", name="Meeting horizon"), "Meeting horizon")
        assert_visible(page.get_by_role("article", name="Habit duration companion"), "Habit companion")
        assert_visible(page.get_by_role("article", name="Session trail"), "Session trail")
        assert "not attributed to habits yet" in page.locator(".focus-follow-up").inner_text()
        watch = page.locator(".focus-watch-stage")
        watch.get_by_role("button", name="Digital", exact=True).click()
        assert "is-digital" in watch.locator(".focus-time-dial").get_attribute("class")
        watch.get_by_role("button", name="Dial", exact=True).click()
        assert "is-dial" in watch.locator(".focus-time-dial").get_attribute("class")
        watch.get_by_role("button", name="Desk View").click()
        assert "is-desk" in watch.locator(".focus-time-dial").get_attribute("class")
        metrics["focus"] = inspect_layout(page, "focus")
        assert_visible(page.get_by_role("button", name="Stop", exact=True), "stop control")
        page.get_by_role("button", name="Stop", exact=True).click()
        assert_visible(page.get_by_role("group", name="Confirm stop focus"), "full Focus stop confirmation")
        page.get_by_role("button", name="Keep focusing").click()
        assert not any(item in requests for item in WRITE_PROCEDURES), requests

        context.set_offline(True)
        page.evaluate("dispatchEvent(new Event('offline'))")
        page.get_by_text("Focus sessions need a connection to save changes", exact=False).wait_for()
        action = "Pause" if state == "active" else "Resume"
        assert page.get_by_role("button", name=action, exact=True).is_disabled()
        assert page.get_by_role("button", name="Stop", exact=True).is_disabled()
        assert not any(item in requests for item in WRITE_PROCEDURES), requests
        metrics["offlineFocus"] = inspect_layout(page, "offline focus")
        context.set_offline(False)
        page.evaluate("dispatchEvent(new Event('online'))")

        page.reload(wait_until="networkidle")
        PRODUCT["click_destination"](page, "Tasks")
        PRODUCT["wait_for_target"](page, "tasks", "list")
        companion = page.locator(".focus-companion")
        assert_visible(companion, "companion after full Focus")
        assert companion.get_by_role("button", name="Collapse Focus companion").is_visible(), "expanded state lost"
        assert "is-dial" in companion.locator(".focus-time-dial").get_attribute("class")
        context.set_offline(True)
        page.evaluate("dispatchEvent(new Event('offline'))")
        companion.get_by_text("reconnect to", exact=False).wait_for()
        assert companion.get_by_role("button", name=expected_action).is_disabled()
        assert companion.get_by_role("button", name="Stop Focus").is_disabled()
        assert not any(item in requests for item in WRITE_PROCEDURES), requests
        assert not unexpected, unexpected
        runtime_errors[:] = [item for item in runtime_errors if item != "WebSocket closed without opened."]
        assert not runtime_errors, runtime_errors
        metrics["offlineCompanion"] = inspect_layout(page, "offline companion")
        return {"status": "PASS", "width": width, "scheme": scheme, "session": state,
                "synthetic": True, "metrics": metrics, "plannerReads": len(requests),
                "plannerWrites": 0, "runtimeErrors": runtime_errors, "unexpectedRequests": unexpected}
    finally:
        context.close()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default="http://localhost:3000/")
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    url = PRODUCT["assert_loopback_url"](args.url)
    output = args.output or Path(tempfile.gettempdir()) / "personal-calendar-t19-focus-results.json"
    output = output.expanduser().resolve()
    if output == ROOT or output.is_relative_to(ROOT):
        parser.error("Evidence output must be outside the repository")
    if urlparse(url).path not in {"", "/"}:
        parser.error("Use the loopback app root URL")
    results = []
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        try:
            for state in ("active", "paused"):
                for scheme in ("light", "dark"):
                    for width in WIDTHS:
                        try:
                            result = run_case(browser, url, width, scheme, state)
                            print(f"PASS {state} {scheme} {width}px", flush=True)
                        except Exception as error:
                            result = {"status": "FAIL", "width": width, "scheme": scheme,
                                      "session": state, "error": f"{type(error).__name__}: {error}",
                                      "traceback": traceback.format_exc()}
                            print(f"FAIL {state} {scheme} {width}px: {error}", flush=True)
                        results.append(result)
        finally:
            browser.close()
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(results, indent=2), encoding="utf-8")
    failed = [item for item in results if item["status"] != "PASS"]
    print(json.dumps({"passed": len(results) - len(failed), "failed": len(failed), "evidence": str(output)}))
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
