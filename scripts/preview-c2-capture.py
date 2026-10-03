"""Synthetic, loopback-only rendered capture checks. No screenshots or live planner writes."""

import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import runpy
import tempfile
import traceback
from urllib.parse import unquote, urlparse

from playwright.sync_api import expect, sync_playwright

HERE = Path(__file__).resolve().parent
UI = runpy.run_path(str(HERE / "preview-ui-review.py"))
AUTH = runpy.run_path(str(HERE / "preview-auth-states.py"))


def find_value(value, name):
    if isinstance(value, dict):
        if name in value:
            return value[name]
        for child in value.values():
            found = find_value(child, name)
            if found is not None:
                return found
    if isinstance(value, list):
        for child in value:
            found = find_value(child, name)
            if found is not None:
                return found
    return None


def install_mutations(context, fixtures, captured, modes):
    task_sample = fixtures["planner.workspace.snapshot"]["tasks"][0]

    def intercept(route):
        parsed = urlparse(route.request.url)
        names = unquote(parsed.path.removeprefix("/api/trpc/")).split(",")
        if not parsed.path.startswith("/api/trpc/") or not any(name.endswith(".create") for name in names):
            route.fallback()
            return
        body = json.loads(route.request.post_data or "{}")
        output = []
        for name in names:
            captured.append({"procedure": name, "requestId": find_value(body, "clientRequestId"), "title": find_value(body, "title") or find_value(body, "name"), "scheduledLocalDate": find_value(body, "scheduledLocalDate"), "dueLocalDate": find_value(body, "dueLocalDate")})
            if modes.get(name) == "error":
                output.append({"error": {"json": {"message": "Synthetic rejected save", "code": -32600, "data": {"code": "BAD_REQUEST", "httpStatus": 400, "path": name}}}})
            else:
                record = {**task_sample, "id": f"synthetic-created-{len(captured)}", "title": find_value(body, "title") or "Synthetic captured task", "clientRequestId": find_value(body, "clientRequestId")}
                output.append({"result": {"data": {"json": record}}})
        route.fulfill(status=200, content_type="application/json", body=json.dumps(output if "batch=1" in parsed.query else output[0]))

    context.route("**/api/trpc/**", intercept)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default="http://localhost:3001")
    parser.add_argument("--output", type=Path, default=Path(tempfile.gettempdir()) / "c2-capture-report.json")
    parser.add_argument("--widths", default="390,1440")
    parser.add_argument("--themes", default="light,dark")
    args = parser.parse_args()
    url = UI["loopback_url"](args.url)
    fixtures = UI["synthetic_fixtures"]()
    results, failures, page_errors = [], [], []
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        for width in [int(item) for item in args.widths.split(",")]:
            for theme in args.themes.split(","):
                context = browser.new_context(viewport={"width": width, "height": 844 if width < 768 else 1000}, color_scheme=theme, service_workers="block", timezone_id="UTC")
                context.add_init_script(f"localStorage.setItem('theme', '{theme}')")
                requests, unexpected = AUTH["install_preview"](context, url, "linked", fixtures)
                captured, modes = [], {}
                install_mutations(context, fixtures, captured, modes)
                page = context.new_page()
                page.clock.set_fixed_time(datetime(2026, 10, 3, 9, tzinfo=timezone.utc))
                page.on("pageerror", lambda error: page_errors.append(str(error)) if str(error) != "WebSocket closed without opened." else None)

                def check(name, action):
                    try:
                        action()
                        assert not page.evaluate("document.documentElement.scrollWidth > innerWidth"), "horizontal overflow"
                        results.append({"case": name, "width": width, "theme": theme})
                    except Exception as error:
                        failures.append({"case": name, "width": width, "theme": theme, "error": str(error).split("Call log:")[0][:700], "trace": traceback.format_exc(limit=3)[-1000:]})

                def goto(query):
                    page.goto(url + query, wait_until="networkidle")
                    expect(page.locator(".phase4-planner-shell")).to_be_visible()

                def open_capture():
                    page.get_by_role("navigation", name="Global planner actions").get_by_role("button", name="Capture").click()
                    expect(page.locator("#capture-sheet-title")).to_be_visible()

                def capture_roundtrip():
                    goto("?destination=tasks&view=list")
                    open_capture()
                    title = page.locator("#capture-sheet-title")
                    expect(title).to_be_visible()
                    page.get_by_role("tab", name="Project", exact=True).click()
                    title.fill("Synthetic project draft")
                    page.locator("#capture-sheet-deadline").fill("2026-10-20")
                    page.keyboard.press("Escape")
                    goto("?destination=tasks&view=list")
                    open_capture()
                    expect(page.get_by_role("tab", name="Project", exact=True)).to_have_attribute("aria-selected", "true")
                    expect(title).to_have_value("Synthetic project draft")
                    expect(page.locator("#capture-sheet-deadline")).to_have_value("2026-10-20")
                    page.reload(wait_until="networkidle")
                    open_capture()
                    expect(title).to_have_value("Synthetic project draft")
                    expect(page.get_by_role("tab", name="Project", exact=True)).to_have_attribute("aria-selected", "true")
                check("scoped-project-draft-close-reload-kind", capture_roundtrip)

                def pwa_task_isolated():
                    goto("?create=task")
                    expect(page.locator("#capture-sheet-title")).to_be_visible()
                    expect(page.get_by_role("tab", name="Task", exact=True)).to_be_visible()
                    expect(page.get_by_role("tab", name="Project", exact=True)).to_have_count(0)
                    expect(page.locator("#capture-sheet-title")).to_have_value("")
                    expect(page.get_by_text("Your earlier project draft remains available", exact=False)).to_be_visible()
                    expect(page.get_by_role("checkbox", name="Plan for today")).not_to_be_checked()
                    expect(page.get_by_role("button", name="Save to Inbox", exact=True)).to_be_visible()
                    page.keyboard.press("Escape")
                    goto("?destination=tasks&view=list")
                    open_capture()
                    expect(page.get_by_role("tab", name="Project", exact=True)).to_have_attribute("aria-selected", "true")
                    expect(page.locator("#capture-sheet-title")).to_have_value("Synthetic project draft")
                check("pwa-task-does-not-consume-project-draft", pwa_task_isolated)

                def interpretation_handoff():
                    page.get_by_role("tab", name="Task", exact=True).click()
                    page.locator("#capture-sheet-title").fill("Synthetic call tomorrow at 2")
                    page.locator("#capture-sheet-estimate").fill("45")
                    page.get_by_role("checkbox", name="Plan for today").check()
                    page.get_by_role("button", name="Interpret dates", exact=False).click()
                    expect(page.get_by_role("heading", name="Review parsed details")).to_be_visible()
                    expect(page.get_by_label("Estimate", exact=True)).to_have_value("45")
                    expect(page.get_by_label("Plan for", exact=True)).not_to_have_value("")
                    expect(page.get_by_role("button", name="Add to Today", exact=True)).to_be_visible()
                check("interpretation-carries-estimate-today-and-title-only", interpretation_handoff)

                if width == 390 and theme == "light":
                    def task_retry():
                        goto("?destination=tasks&view=list")
                        open_capture()
                        page.get_by_role("tab", name="Task", exact=True).click()
                        page.locator("#capture-sheet-title").fill("Synthetic retry task")
                        page.get_by_role("checkbox", name="Plan for today").uncheck()
                        modes["planner.task.create"] = "error"
                        before = len(captured)
                        page.get_by_role("button", name="Save to Inbox", exact=True).click()
                        expect(page.get_by_role("alert")).to_contain_text("Synthetic rejected save")
                        page.get_by_role("button", name="Save to Inbox", exact=True).click()
                        page.wait_for_timeout(500)
                        assert len(captured) == before + 2
                        assert captured[-1]["requestId"] == captured[-2]["requestId"]
                        page.locator("#capture-sheet-title").fill("Synthetic changed retry task")
                        page.get_by_role("button", name="Save to Inbox", exact=True).click()
                        assert len(captured) == before + 2, "changed task submitted before uncertainty confirmation"
                        expect(page.get_by_role("alert")).to_contain_text("may have completed")
                        page.get_by_role("button", name="Save to Inbox", exact=True).click()
                        page.wait_for_timeout(500)
                        assert len(captured) == before + 3
                        assert captured[-1]["requestId"] != captured[-2]["requestId"]
                    check("task-retry-identity-and-changed-intent", task_retry)

                    def non_task_outcome():
                        goto("?destination=tasks&view=list")
                        open_capture()
                        page.get_by_role("tab", name="Project", exact=True).click()
                        page.locator("#capture-sheet-title").fill("Synthetic uncertain project")
                        modes["planner.project.create"] = "error"
                        before = len(captured)
                        page.get_by_role("button", name="Create Project", exact=True).click()
                        page.wait_for_timeout(500)
                        assert len(captured) == before + 1
                        expect(page.get_by_text("This project save may have completed", exact=False)).to_be_visible()
                        page.get_by_role("button", name="Create Project", exact=True).click()
                        assert len(captured) == before + 1, "uncertain project retried without acknowledgement"
                        page.get_by_role("tab", name="Goal", exact=True).click()
                        page.locator("#capture-sheet-title").fill("Synthetic separate goal")
                        modes["planner.goal.create"] = "error"
                        page.get_by_role("button", name="Create Goal", exact=True).click()
                        page.wait_for_timeout(500)
                        assert len(captured) == before + 2
                        page.get_by_role("tab", name="Project", exact=True).click()
                        expect(page.get_by_text("This project save may have completed", exact=False)).to_be_visible()
                    check("non-task-unknown-outcome-kind-isolation", non_task_outcome)

                    def title_only_destination():
                        modes.pop("planner.task.create", None)
                        goto("?destination=tasks&view=inbox&action=capture")
                        if page.locator("#capture-sheet-title").is_visible():
                            page.keyboard.press("Escape")
                        raw = page.locator("#natural-task")
                        expect(raw).to_be_visible()
                        raw.fill("Synthetic title tomorrow at 4")
                        before = len(captured)
                        page.get_by_role("button", name="Save to Inbox", exact=True).click()
                        page.wait_for_timeout(500)
                        assert len(captured) == before + 1
                        assert captured[-1]["procedure"] == "planner.task.create"
                        assert captured[-1]["title"] == "Synthetic title tomorrow at 4"
                        assert captured[-1]["scheduledLocalDate"] is None
                        assert captured[-1]["dueLocalDate"] is None
                        raw.fill("Synthetic title for today")
                        page.get_by_role("checkbox", name="Plan for today", exact=True).check()
                        page.get_by_role("button", name="Add to Today", exact=True).click()
                        page.wait_for_timeout(500)
                        assert len(captured) == before + 2
                        assert captured[-1]["title"] == "Synthetic title for today"
                        assert captured[-1]["scheduledLocalDate"] == "2026-10-03"
                        assert captured[-1]["dueLocalDate"] is None
                    check("title-only-inbox-and-today-create", title_only_destination)

                    def malformed_storage():
                        page.evaluate("() => { const key = Object.keys(sessionStorage).find(key => key.includes(':capture-draft:v1:') && key.endsWith(':natural')); if (key) sessionStorage.setItem(key, '{'); }")
                        goto("?destination=tasks&view=inbox&action=capture")
                        if page.locator("#capture-sheet-title").is_visible():
                            page.keyboard.press("Escape")
                        expect(page.locator("#natural-task")).to_be_visible()
                        page.locator("#natural-task").fill("Synthetic after malformed storage")
                        expect(page.get_by_role("button", name="Save to Inbox", exact=True)).to_be_visible()
                    check("malformed-capture-storage-nonfatal", malformed_storage)

                    def late_task_success_keeps_newer_draft():
                        pending = []
                        context.route("**/api/trpc/planner.task.create*", lambda route: pending.append(route))
                        goto("?destination=tasks&view=list")
                        open_capture()
                        page.get_by_role("button", name="Discard draft", exact=True).click()
                        open_capture()
                        page.get_by_role("tab", name="Task", exact=True).click()
                        page.locator("#capture-sheet-title").fill("Synthetic pending task")
                        page.get_by_role("checkbox", name="Plan for today").uncheck()
                        page.get_by_role("button", name="Save to Inbox", exact=True).click()
                        for _ in range(20):
                            if pending:
                                break
                            page.wait_for_timeout(100)
                        assert len(pending) == 1, "task create request was not held"
                        page.get_by_role("dialog", name="Capture").get_by_role("button", name="Close").click()
                        open_capture()
                        page.locator("#capture-sheet-title").fill("Synthetic newer draft")
                        record = {**fixtures["planner.workspace.snapshot"]["tasks"][0], "id": "synthetic-late-task", "title": "Synthetic pending task", "clientRequestId": find_value(json.loads(pending[0].request.post_data or "{}"), "clientRequestId")}
                        pending[0].fulfill(status=200, content_type="application/json", body=json.dumps([{"result": {"data": {"json": record}}}]))
                        expect(page.locator("#capture-sheet-title")).to_have_value("Synthetic newer draft")
                        expect(page.get_by_role("button", name="Save to Inbox", exact=True)).to_be_enabled()
                    check("late-task-success-keeps-newer-draft", late_task_success_keeps_newer_draft)


                assert not unexpected, f"Unexpected intercepted APIs: {unexpected}"
                context.close()
        browser.close()
    report = {"syntheticOnly": True, "screenshots": False, "passed": len(results), "failures": failures, "pageErrors": page_errors, "cases": results}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps({"passed": len(results), "failures": failures, "pageErrors": page_errors, "report": str(args.output)}))
    if failures or page_errors:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
