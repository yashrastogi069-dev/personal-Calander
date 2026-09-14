"""Browser-side assertions for the committed Phase 4 interaction test."""

import importlib.util
import json
import re
import sys
from pathlib import Path

from playwright.sync_api import expect, sync_playwright


ROOT = Path(__file__).resolve().parents[1]
PREVIEW_HELPER = ROOT / "scripts" / "preview-auth-states.py"


def load_preview_helper():
    spec = importlib.util.spec_from_file_location("phase4_preview_auth", PREVIEW_HELPER)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load {PREVIEW_HELPER}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def main() -> None:
    url = sys.argv[1]
    width = int(sys.argv[2]) if len(sys.argv) > 2 else 390
    if width not in (320, 390):
        raise ValueError(f"Unsupported smoke width: {width}")
    helper = load_preview_helper()

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={"width": width, "height": 844},
            device_scale_factor=1,
            service_workers="block",
        )
        page = context.new_page()
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        requests, unexpected = helper.install_preview(context, url, "linked")

        try:
            page.goto(
                f"{url}/phase4-prototypes?variant=a&viewport=phone",
                wait_until="domcontentloaded",
                timeout=20_000,
            )
            shell = page.get_by_test_id("prototype-shell")
            expect(shell).to_be_visible(timeout=20_000)
            expect(shell).to_have_attribute("data-prototype-viewport", "phone")

            page.get_by_test_id("phone-open-capture").click()
            capture = page.get_by_role("dialog", name="Capture")
            expect(capture).to_be_visible()
            page.get_by_test_id("close-capture").click()
            expect(capture).not_to_be_visible()

            page.get_by_role("button", name="More", exact=True).click()
            page.get_by_test_id("more-viewport-desktop").click()
            expect(shell).to_have_attribute("data-prototype-viewport", "desktop")
            page.get_by_test_id("viewport-phone").click()
            expect(shell).to_have_attribute("data-prototype-viewport", "phone")

            page.get_by_test_id("view-tasks").click()
            page.get_by_role("button", name=re.compile(r"^Doing")).click()
            task_title = "Reply to Samira about the contractor estimate"
            page.locator("button.p4-board-task-main", has_text=task_title).click()
            detail = page.get_by_role("dialog", name="Task detail")
            expect(detail).to_be_visible()
            expect(detail.locator('[data-selected-task-id="reply-samira"]')).to_be_visible()
            expect(detail.get_by_text(task_title, exact=True)).to_be_visible()
            expect(detail.get_by_text("Waiting", exact=True)).to_be_visible()
            for selector in [
                ".p4-notice",
                ".p4-mode-switch button",
                ".p4-phone-lanes button",
                ".p4-board-task-main strong",
                ".p4-board-task-main small",
                ".p4-task-detail dt",
                ".p4-task-detail dd",
                ".p4-detail-warning",
            ]:
                font_size = page.eval_on_selector(
                    selector,
                    "element => Number.parseFloat(getComputedStyle(element).fontSize)",
                )
                assert font_size >= 14, (selector, font_size)
            page.get_by_test_id("close-task-detail").click()
            expect(detail).not_to_be_visible()

            filtered_errors = [error for error in errors if error != "WebSocket closed without opened."]
            assert not filtered_errors, filtered_errors
            assert not unexpected, unexpected
            assert not any(name.startswith("planner.") for name in requests), requests
            assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
            print(json.dumps({"capture": True, "viewportRoundTrip": True, "selectedTask": True}))
        finally:
            context.close()
            browser.close()


if __name__ == "__main__":
    main()
