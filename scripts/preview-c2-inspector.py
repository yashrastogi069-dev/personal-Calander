"""Loopback-only C2 task inspector checks; all APIs are synthetic and intercepted."""

import argparse
from copy import deepcopy
from datetime import datetime, timezone
import json
from pathlib import Path
import runpy
import tempfile
from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parent
UI = runpy.run_path(str(ROOT / "preview-ui-review.py"))
AUTH = runpy.run_path(str(ROOT / "preview-auth-states.py"))


def open_task(page, url, task_id="preview-task-a"):
    page.goto(url + f"?destination=tasks&view=list&record={task_id}", wait_until="networkidle")
    expect(page.locator(".phase4-planner-shell")).to_be_visible()
    expect(page.get_by_label("Task title", exact=True)).to_be_visible()


def stale_and_discard(page, url, fixtures):
    open_task(page, url)
    title = page.get_by_label("Task title", exact=True)
    title.fill("Synthetic unfinished edit")
    fixtures["planner.workspace.snapshot"]["tasks"][0].update(version=3, title="Remote saved title")
    page.reload(wait_until="networkidle")
    expect(title).to_have_value("Synthetic unfinished edit")
    expect(page.get_by_text("Task changed since this draft began.")).to_be_visible()
    expect(page.get_by_role("button", name="Save changes")).to_be_disabled()

    page.get_by_role("button", name="Reload latest task").click()
    dialog = page.get_by_role("alertdialog")
    expect(dialog).to_be_visible()
    dialog.get_by_role("button", name="Keep draft").click()
    expect(title).to_have_value("Synthetic unfinished edit")
    page.get_by_role("button", name="Reload latest task").click()
    page.keyboard.press("Escape")
    expect(dialog).not_to_be_visible()
    expect(title).to_have_value("Synthetic unfinished edit")

    page.get_by_role("button", name="Reload latest task").click()
    dialog.get_by_role("button", name="Discard draft and reload").click()
    expect(title).to_have_value("Remote saved title")
    expect(page.get_by_text("Task changed since this draft began.")).not_to_be_visible()
    expect(page.get_by_role("button", name="Save changes")).to_be_enabled()
    page.keyboard.press("Escape")
    expect(page.get_by_label("Task title", exact=True)).not_to_be_visible()


def late_save(page, context, url, fixtures):
    pending = []
    def hold_update(route):
        pending.append(route)
    context.route("**/api/trpc/planner.task.update*", hold_update)
    open_task(page, url)
    page.get_by_label("Task title", exact=True).fill("Synthetic saved A")
    page.get_by_role("button", name="Save changes").click()
    expect(page.get_by_role("button", name="Saving…")).to_be_disabled()
    expect(page.get_by_label("Task title", exact=True)).to_be_disabled()
    for _ in range(20):
        if pending:
            break
        page.wait_for_timeout(100)
    assert len(pending) == 1, "task update request was not intercepted"

    page.get_by_role("button", name="Close", exact=True).first.click()
    page.get_by_role("button", name="Open details for Prepare meals for busy days").click()
    expect(page.get_by_label("Task title", exact=True)).to_have_value("Prepare meals for busy days")
    saved = {**fixtures["planner.workspace.snapshot"]["tasks"][0], "title": "Synthetic saved A", "version": 3}
    pending[0].fulfill(status=200, content_type="application/json", body=json.dumps([{"result": {"data": {"json": saved}}}]))
    expect(page.get_by_label("Task title", exact=True)).to_have_value("Prepare meals for busy days")
    expect(page.get_by_role("button", name="Save changes")).to_be_enabled()
    assert "record=preview-task-b" in page.url, page.url


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default="http://localhost:3001", help="loopback preview origin")
    parser.add_argument("--widths", default="390,1440", help="comma-separated phone/desktop widths")
    parser.add_argument("--output", type=Path, default=Path(tempfile.gettempdir()) / "c2-inspector-manifest.json")
    args = parser.parse_args()
    url = UI["loopback_url"](args.url)
    results, failures = [], []
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        for width in [int(part) for part in args.widths.split(",")]:
            for theme in ("light", "dark"):
                for case, action in (("stale-discard", stale_and_discard), ("late-save", late_save)):
                    fixtures = deepcopy(UI["synthetic_fixtures"]())
                    context = browser.new_context(viewport={"width": width, "height": 844 if width < 768 else 1000}, color_scheme=theme, service_workers="block", timezone_id="UTC")
                    context.add_init_script(f"localStorage.setItem('theme', '{theme}')")
                    requests, unexpected = AUTH["install_preview"](context, url, "linked", fixtures)
                    page = context.new_page()
                    page.clock.set_fixed_time(datetime(2026, 9, 20, 9, tzinfo=timezone.utc))
                    errors = []
                    page.on("pageerror", lambda error: errors.append(str(error)))
                    try:
                        action(page, context, url, fixtures) if case == "late-save" else action(page, url, fixtures)
                        assert not unexpected, unexpected
                        assert not [error for error in errors if error != "WebSocket closed without opened."], errors
                        assert not page.evaluate("document.documentElement.scrollWidth > innerWidth"), "horizontal overflow"
                        results.append({"case": case, "width": width, "theme": theme, "passed": True, "intercepted": len(requests)})
                    except Exception as error:
                        failures.append({"case": case, "width": width, "theme": theme, "error": str(error)})
                    finally:
                        context.close()
        browser.close()
    report = {"passed": len(results), "failed": len(failures), "results": results, "failures": failures}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps({"passed": report["passed"], "failed": report["failed"], "output": str(args.output), "failures": failures}))
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
