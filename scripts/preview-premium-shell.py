"""Loopback-only D1 shell check: grouped rail, Home tabs, ⌘K palette and phone pill. All planner/auth APIs are intercepted."""
import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import runpy
import tempfile
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parent
UI = runpy.run_path(str(ROOT / "preview-ui-review.py"))
AUTH = runpy.run_path(str(ROOT / "preview-auth-states.py"))
PLAN = runpy.run_path(str(ROOT / "preview-premium-plan.py"))

# (None, None) is the bare URL: D2 makes the Dashboard the default landing.
PAGES = [(None, None, "Dashboard"), ("home", "overview", "Dashboard"), ("home", "today", "Today"), ("plan", "calendar", "Calendar"), ("tasks", "list", None)]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default="http://localhost:3100/")
    parser.add_argument("--capture-dir", type=Path, default=Path(tempfile.gettempdir()) / "premium-shell")
    args = parser.parse_args()
    url = UI["loopback_url"](args.url).rstrip("/")
    capture = args.capture_dir.resolve()
    assert not capture.is_relative_to(ROOT.parent.resolve()), "Keep captures outside the repository"
    capture.mkdir(parents=True, exist_ok=True)
    results = []
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        try:
            for width in (1440, 390):
                phone = width < 768
                for theme in ("light", "dark"):
                    for destination, view, tab in PAGES:
                        context = browser.new_context(viewport={"width": width, "height": 900 if not phone else 844}, color_scheme=theme, timezone_id="UTC", has_touch=phone, is_mobile=phone, service_workers="block")
                        context.add_init_script(f"try {{ localStorage.setItem('theme', '{theme}') }} catch {{}}")
                        AUTH["install_preview"](context, url, "linked", PLAN["fixture_data"]())
                        page = context.new_page()
                        page.clock.set_fixed_time(datetime(2026, 9, 20, 9, 0, tzinfo=timezone.utc))
                        errors, checks = [], {}
                        page.on("pageerror", lambda error: errors.append(str(error)))
                        page.goto(f"{url}/?destination={destination}&view={view}" if destination else f"{url}/", wait_until="networkidle")
                        page.locator(".pc-shell").wait_for()
                        page.wait_for_timeout(900)
                        checks["noOverflow"] = not page.evaluate("document.documentElement.scrollWidth > window.innerWidth")
                        tabs = page.get_by_role("tablist", name="Home views")
                        if tab:
                            checks["homeTabs"] = tabs.count() == 1 and page.get_by_role("tab", name=tab).first.get_attribute("aria-selected") == "true"
                        else:
                            checks["noHomeTabs"] = tabs.count() == 0
                        if tab == "Dashboard":
                            checks["dashboard"] = page.locator("section.pc-dash").is_visible()
                        if phone:
                            capture_button = page.locator(".pc-phone-capture")
                            box = capture_button.bounding_box() if capture_button.count() else None
                            checks["phoneCapture"] = bool(box and box["width"] >= 44 and box["y"] + box["height"] <= 844)
                            nav = page.locator(".pc-phone-nav").bounding_box()
                            checks["phoneNavInView"] = bool(nav and nav["x"] >= 0 and nav["x"] + nav["width"] <= width)
                        else:
                            rail = page.get_by_role("navigation", name="Planning destinations")
                            checks["railGroups"] = all(rail.get_by_role("group", name=name).count() == 1 for name in ("Plan", "Grow", "Reflect"))
                        name = f"shell-{width}-{theme}-{destination or 'default'}-{view or 'landing'}"
                        page.screenshot(path=str(capture / f"{name}.png"), full_page=False)
                        if destination == "home" and view == "today":
                            page.keyboard.press("Control+k")
                            dialog = page.get_by_role("dialog")
                            try:
                                expect(dialog).to_be_visible(timeout=3000)
                                page.keyboard.type("analytics")
                                page.keyboard.press("Enter")
                                expect(dialog).to_be_hidden(timeout=3000)
                                checks["paletteJump"] = "view=insights" in page.url
                            except AssertionError:
                                checks["paletteJump"] = False
                            if tab:
                                page.goto(f"{url}/?destination={destination}&view={view}", wait_until="networkidle")
                                page.get_by_role("tab", name="Calendar").first.click()
                                page.wait_for_timeout(400)
                                checks["tabSwitch"] = "view=calendar" in page.url
                        ok = not errors and all(checks.values())
                        results.append({"case": name, "ok": ok, "checks": checks, "errors": errors[:2]})
                        context.close()
        finally:
            browser.close()
    passed = sum(result["ok"] for result in results)
    print(json.dumps({"passed": passed, "failed": len(results) - passed, "capture": str(capture), "failures": [r for r in results if not r["ok"]]}, indent=1))


if __name__ == "__main__":
    main()
