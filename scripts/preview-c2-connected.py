"""Loopback-only C2 navigation checks; every API is intercepted, no screenshots."""
from datetime import datetime, timezone
import argparse
import json
import re
from pathlib import Path
import runpy
import tempfile
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parent
UI = runpy.run_path(str(ROOT / "preview-ui-review.py"))
AUTH = runpy.run_path(str(ROOT / "preview-auth-states.py"))
ALIASES = {
    "today": ("home", "today"), "capture": ("tasks", "inbox"),
    "plan": ("plan", "daily"), "tasks": ("tasks", "list"),
    "search": ("home", "search"), "calendar": ("plan", "calendar"),
    "goals": ("intentions", "outcomes"), "projects": ("intentions", "projects"),
    "habits": ("habits", "due"), "focus": ("home", "focus"),
    "connections": ("settings", "connections"), "insights": ("review", "insights"),
    "review": ("review", "rituals"), "settings": ("settings", "account"),
}

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default="http://localhost:3001")
    parser.add_argument("--output", type=Path, default=Path(tempfile.gettempdir()) / "c2-connected-manifest.json")
    parser.add_argument("--widths", default="320,390,768,1440")
    parser.add_argument("--only-entry-pins", action="store_true", help="Focused supplemental PWA entry and pin migration matrix")
    parser.add_argument("--only-final-integration", action="store_true", help="Post-review integration matrix without unchanged legacy aliases")
    parser.add_argument("--only-planning", action="store_true", help="Verify actual lazy-loaded planning settings controls")
    parser.add_argument("--only-unpin", action="store_true", help="Verify explicit unpin persistence and dynamic phone columns")
    parser.add_argument("--themes", default="light,dark", help="Comma-separated light,dark themes")
    args = parser.parse_args()
    url = UI["loopback_url"](args.url)
    fixtures = UI["synthetic_fixtures"]()
    snapshot = fixtures["planner.workspace.snapshot"]
    snapshot["weeklyObjectives"] = [{"id": "preview-week", "workspaceId": snapshot["workspace"]["id"], "weekStartLocalDate": "2026-09-14", "title": "Synthetic weekly evidence", "state": "in_progress", "version": 1}]
    fixtures["planner.review.history"] = [{"id": "preview-review", "kind": "weekly", "state": "completed", "periodStartLocalDate": "2026-09-07", "periodEndLocalDate": "2026-09-13", "reflection": "Synthetic saved reflection", "version": 1}]
    results, errors, failures, transport_diagnostics = [], [], [], []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        for width in [int(value) for value in args.widths.split(",")]:
            for theme in args.themes.split(","):
                context = browser.new_context(viewport={"width": width, "height": 1000 if width >= 768 else 844}, color_scheme=theme, service_workers="block", timezone_id="UTC")
                context.add_init_script(f"if (location.origin === new URL({json.dumps(url)}).origin) localStorage.setItem('theme', '{theme}')")
                requests, unexpected = AUTH["install_preview"](context, url, "linked", fixtures)
                page = context.new_page()
                page.set_default_timeout(8000)
                page.set_default_navigation_timeout(30000)
                page.clock.set_fixed_time(datetime(2026, 9, 20, 9, tzinfo=timezone.utc))
                # Vite's development HMR socket closes during repeated document navigation.
                # Keep this known transport diagnostic separate from application exceptions.
                page.on("pageerror", lambda error: transport_diagnostics.append(str(error)) if str(error) == "WebSocket closed without opened." else errors.append(str(error)))

                def check(name, action):
                    if args.only_unpin and name not in {"legacy-pins-backup-and-new-view-choices", "unpin-rendered-no-refill-reload"}:
                        return
                    if args.only_planning and name != "settings-planning":
                        return
                    if args.only_entry_pins and name not in {"pwa-compose-inbox-default-consumed-reload", "legacy-pins-backup-and-new-view-choices"}:
                        return
                    if args.only_final_integration and (name.startswith("alias-") or (name.startswith("settings-") and name not in {"settings-planning", "settings-connections"})):
                        return
                    try:
                        action()
                        assert not page.evaluate("document.documentElement.scrollWidth > innerWidth"), "horizontal overflow"
                        measurement = page.evaluate("({viewport: innerWidth, document: document.documentElement.scrollWidth, main: document.querySelector('.planner-main')?.clientWidth, current: document.querySelector('.phase4-planner-shell')?.dataset.view})")
                        results.append({"case": name, "width": width, "theme": theme, "passed": True, "measurement": measurement})
                    except Exception as error:
                        failures.append({"case": name, "width": width, "theme": theme, "error": str(error)})
                        print(json.dumps(failures[-1]), flush=True)

                def goto(query):
                    page.goto(url + query, wait_until="networkidle")
                    expect(page.locator(".phase4-planner-shell")).to_be_visible()

                for alias, (destination, view) in ALIASES.items():
                    def alias_check(alias=alias, destination=destination, view=view):
                        goto("?surface=" + alias)
                        expect(page.locator(".phase4-planner-shell")).to_have_attribute("data-destination", destination)
                        expect(page.locator(".phase4-planner-shell")).to_have_attribute("data-view", view)
                    check("alias-" + alias, alias_check)

                def connected():
                    goto("?destination=home&view=overview")
                    expect(page.get_by_role("heading", name="Your saved planner at a glance")).to_be_visible()
                    page.locator(".planner-overview").get_by_role("button", name="Quarterly reset").click()
                    expect(page.locator("#project-detail-heading")).to_have_text("Quarterly reset")
                    assert "record=preview-project" in page.url
                    page.reload(wait_until="networkidle")
                    expect(page.locator("#project-detail-heading")).to_have_text("Quarterly reset")
                    page.go_back(wait_until="networkidle")
                    expect(page.locator(".planner-overview")).to_be_visible()
                    page.get_by_role("button", name="Open weekly objectives").click()
                    expect(page.locator("#weekly-objective-title")).to_be_visible()
                    expect(page.locator(".plan-stage-nav")).not_to_be_visible()
                    expect(page.get_by_text("Synthetic weekly evidence", exact=True)).to_be_visible()
                    page.get_by_role("navigation", name="Planning views").get_by_role("button", name="Daily plan", exact=True).click()
                    expect(page.locator(".plan-stage-nav")).to_be_visible() if width > 680 else expect(page.locator(".plan-mobile-stepper")).to_be_visible()
                    goto("?destination=review&view=history")
                    expect(page.get_by_role("heading", name="Saved review history")).to_be_visible()
                    expect(page.get_by_text("Synthetic saved reflection", exact=True)).to_be_visible()
                    expect(page.get_by_role("button", name="Begin review", exact=True)).not_to_be_visible()
                check("meaningful-child-views-project-back-reload", connected)

                def inspector():
                    goto("?destination=tasks&view=list&taskQ=weekly&taskFilter=all&taskSort=due&record=preview-task-a")
                    expect(page.get_by_label("Task title", exact=True)).to_have_value("Choose three weekly priorities")
                    page.get_by_label("Task title", exact=True).fill("Synthetic retained draft")
                    page.reload(wait_until="networkidle")
                    expect(page.get_by_label("Task title", exact=True)).to_have_value("Synthetic retained draft")
                    # Close before a same-group lens switch; URL retains filters and sort.
                    page.keyboard.press("Escape")
                    page.get_by_role("navigation", name="Task views").get_by_role("button", name="Board", exact=True).click()
                    assert "taskQ=weekly" in page.url and "taskSort=due" in page.url
                    page.go_back(wait_until="networkidle")
                    assert "view=list" in page.url
                    page.go_back(wait_until="networkidle")
                    expect(page.get_by_label("Task title", exact=True)).to_have_value("Synthetic retained draft")
                check("task-draft-reload-lens-back", inspector)

                for view, heading in (("account", "Your account"), ("appearance", "Appearance"), ("planning", "Planning preferences"), ("sync", "Sync & offline"), ("navigation", "Layout & organization"), ("device", "App & device"), ("connections", "Calendar & reminders")):
                    def settings_check(view=view, heading=heading):
                        goto(f"?destination=settings&view={view}")
                        expect(page.get_by_text(heading, exact=True).last).to_be_visible()
                        if view == "planning":
                            details = page.locator(".settings-planning-controls details")
                            expect(details).to_have_count(2)
                            details.first.locator("summary").click()
                            expect(page.get_by_role("button", name="Save preferences", exact=True)).to_be_visible()
                            details.last.locator("summary").click()
                            expect(page.get_by_role("button", name="Save recovery presentation", exact=True)).to_be_visible()
                        if view == "connections":
                            assert page.locator(".settings-surface").count() == 1
                            assert page.locator(".calendar-subscription").count() == 1
                            assert page.locator(".connections-workspace").count() == 1
                            page.reload(wait_until="networkidle")
                            assert page.locator(".calendar-subscription").count() == 1
                            assert page.locator(".connections-workspace").count() == 1
                    check("settings-" + view, settings_check)

                def chrome():
                    goto("?destination=home&view=overview")
                    if width <= 680:
                        nav = page.get_by_role("navigation", name="Phone planning destinations")
                        assert nav.locator('[aria-current="page"]').count() == 0
                        nav.get_by_role("button", name="More", exact=True).click()
                        expect(page.locator("#phase4-phone-more")).to_be_visible()
                        expect(page.locator("#phase4-phone-more").get_by_role("button", name="Weekly plan", exact=True)).to_be_visible()
                        page.keyboard.press("Escape")
                        expect(nav.get_by_role("button", name="More", exact=True)).to_be_focused()
                    else:
                        assert page.locator(".planner-rail").evaluate("e => getComputedStyle(e).overflowY") in ("auto", "scroll")
                check("phone-more-parent-current-or-rail-scroll", chrome)

                def capture_entry():
                    goto("?destination=home&view=today&compose=task&source=pwa-shortcut")
                    expect(page.locator("#capture-sheet-title")).to_be_visible()
                    assert "destination=tasks" in page.url and "view=list" in page.url
                    expect(page.get_by_role("checkbox", name="Plan for today")).not_to_be_checked()
                    expect(page.get_by_role("button", name="Save to Inbox", exact=True)).to_be_visible()
                    page.keyboard.press("Escape")
                    page.reload(wait_until="networkidle")
                    expect(page.locator("#capture-sheet-title")).not_to_be_visible()
                check("pwa-compose-inbox-default-consumed-reload", capture_entry)

                def pin_migration():
                    if not page.url.startswith(url):
                        goto("?destination=home&view=overview")
                    key = "personal-calander:mobile-preferences:" + snapshot["workspace"]["id"]
                    legacy = {"order": list(ALIASES), "primary": ["calendar", "habits", "focus", "connections"], "density": "compact"}
                    raw = json.dumps(legacy)
                    page.evaluate("([key, raw]) => localStorage.setItem(key, raw)", [key, raw])
                    goto("?destination=home&view=overview")
                    saved = page.evaluate("key => JSON.parse(localStorage.getItem(key))", key)
                    assert [item["legacyId"] for item in saved["primary"]] == legacy["primary"]
                    assert page.evaluate("key => localStorage.getItem(key + ':phase4-backup')", key) == raw
                    assert any(item["destination"] == "plan" and item["view"] == "weekly" for item in saved["order"])
                    if width <= 680:
                        nav = page.get_by_role("navigation", name="Phone planning destinations")
                        for label in ("Calendar", "Habits", "Focus", "Connections"):
                            expect(nav.get_by_role("button", name=label, exact=True)).to_be_visible()
                check("legacy-pins-backup-and-new-view-choices", pin_migration)

                def unpin_reload():
                    goto("?destination=settings&view=navigation")
                    page.get_by_role("button", name="Customize phone layout", exact=True).click()
                    sheet = page.locator(".mobile-customize-sheet")
                    before = sheet.get_by_role("button", name="Pinned", exact=True).count()
                    assert before >= 2
                    sheet.get_by_role("button", name="Pinned", exact=True).first.click()
                    sheet.get_by_role("button", name="Close phone customization", exact=True).click()
                    assert page.locator(".mobile-planner-nav > button").count() == before
                    if width <= 680:
                        assert page.locator(".mobile-planner-nav").evaluate("e => getComputedStyle(e).gridTemplateColumns.split(' ').length") == before
                    page.reload(wait_until="networkidle")
                    assert page.locator(".mobile-planner-nav > button").count() == before
                    if width <= 680:
                        assert page.locator(".mobile-planner-nav").evaluate("e => getComputedStyle(e).gridTemplateColumns.split(' ').length") == before
                check("unpin-rendered-no-refill-reload", unpin_reload)

                def record_family():
                    goto("?destination=intentions&view=outcomes&record=preview-outcome")
                    page.get_by_role("tab", name=re.compile("^Projects")).click()
                    assert "record=" not in page.url
                    assert page.locator(".planner-main").get_attribute("data-selected-record") is None
                    page.go_back(wait_until="networkidle")
                    assert "record=preview-outcome" in page.url
                    page.reload(wait_until="networkidle")
                    assert page.locator(".planner-main").get_attribute("data-selected-record") == "preview-outcome"
                    goto("?destination=intentions&view=projects&record=preview-project")
                    page.get_by_role("tab", name=re.compile("^Outcome goals")).click()
                    assert "record=" not in page.url
                    page.go_back(wait_until="networkidle")
                    page.reload(wait_until="networkidle")
                    assert page.locator(".planner-main").get_attribute("data-selected-record") == "preview-project"
                check("entity-family-switch-back-reload", record_family)
                assert not any(request.startswith("planner.") and any(token in request for token in (".create", ".update", ".complete", ".start", ".archive")) for request in requests), "Unexpected planner mutation"
                context.close()
                print(json.dumps({"completedWidth": width, "theme": theme, "passed": len(results), "failures": len(failures)}), flush=True)
        browser.close()
    manifest = {"syntheticOnly": True, "screenshots": False, "passed": len(results), "failures": failures, "pageErrors": errors, "devTransportDiagnostics": transport_diagnostics, "cases": results}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(json.dumps({"passed": len(results), "failures": failures, "pageErrors": errors, "manifest": str(args.output)}))
    if failures or errors:
        raise SystemExit(1)

if __name__ == "__main__":
    main()
