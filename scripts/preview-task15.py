"""Read-only, screenshot-free synthetic browser QA for Task 15 Plan and Calendar."""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
import runpy
import sys

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
AUTH = runpy.run_path(str(ROOT / "scripts" / "preview-auth-states.py"))
LINKED = runpy.run_path(str(ROOT / "scripts" / "preview-linked-planner.py"))
PRODUCT = runpy.run_path(str(ROOT / "scripts" / "preview-phase4-product.py"))
URL = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3000"
PRODUCT["assert_loopback_url"](URL)


def no_horizontal_overflow(page, label):
    metrics = PRODUCT["overflow_metrics"](page)
    assert not metrics["horizontalOverflow"], (label, metrics)


def run_width(browser, width):
    context = browser.new_context(
        viewport={"width": width, "height": 844 if width < 768 else 1000},
        color_scheme="light",
        timezone_id="UTC",
        service_workers="block",
    )
    page = context.new_page()
    page.clock.set_fixed_time(datetime(2026, 9, 20, 9, 0, tzinfo=timezone.utc))
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    fixtures = LINKED["fixtures"]()
    fixtures["planner.search.workspace"] = []
    fixtures["planner.task.rolloverPreview"] = {"fromLocalDate": "2026-09-19", "candidates": []}
    requests, unexpected = AUTH["install_preview"](context, URL, "linked", fixtures)
    try:
        page.goto(URL, wait_until="networkidle")
        page.get_by_role("heading", name="Today", exact=True).wait_for()
        PRODUCT["click_destination"](page, "Plan")
        PRODUCT["wait_for_target"](page, "plan", "daily")
        plan = page.locator(".plan-workspace")
        plan.wait_for()
        assert plan.get_attribute("data-plan-stage") == "commit"
        for index, stage in enumerate(("recover", "capacity", "commit", "reserve", "review")):
            page.locator(".plan-stage-nav button").nth(index).click()
            assert plan.get_attribute("data-plan-stage") == stage
            no_horizontal_overflow(page, f"Plan {stage} {width}")
        page.get_by_role("heading", name="Recent planning history").wait_for()
        page.locator(".plan-stage-nav button").nth(3).click()
        page.get_by_role("button", name="Open Calendar").click()
        PRODUCT["wait_for_target"](page, "plan", "calendar")
        page.get_by_role("heading", name="Reserve real focus time").wait_for()
        page.locator(".calendar-inbox-task").first.click()
        page.locator(".calendar-grid-slot").first.click()
        page.get_by_role("heading", name="Plan a focused week").wait_for()
        assert page.locator(".calendar-move-preview").count() == 1
        assert "Deadline" not in page.locator(".calendar-move-preview dl").inner_text()
        page.get_by_role("button", name="Cancel reservation preview").click()
        for mode in ("Week", "Month", "Quarter", "Year"):
            page.locator(".calendar-mode-tabs").get_by_role("button", name=mode).click()
            page.locator(f".matrix-{mode.lower()}").wait_for()
            no_horizontal_overflow(page, f"Calendar {mode} {width}")
        page.locator(".calendar-mode-tabs").get_by_role("button", name="Month").click()
        matrix = page.locator(".calendar-matrix")
        matrix.locator(".matrix-move-tools select").select_option("preview-task-0")
        matrix.locator(".matrix-move-tools input[type=date]").fill("2026-09-20")
        matrix.get_by_role("button", name="Review move").click()
        preview = matrix.locator(".matrix-preview")
        preview.wait_for()
        assert "Deadline stays unset" in preview.inner_text()
        assert preview.get_by_role("button", name="Apply move").is_enabled()
        preview.get_by_role("button", name="Cancel").click()
        no_horizontal_overflow(page, f"Calendar preview {width}")
        assert not unexpected, unexpected
        assert not errors, errors
        print(f"PASS Task 15 synthetic Plan/Calendar {width}px; {len(requests)} intercepted planner calls", flush=True)
    finally:
        context.close()


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    try:
        for width in (320, 390, 768, 1440):
            run_width(browser, width)
    finally:
        browser.close()
