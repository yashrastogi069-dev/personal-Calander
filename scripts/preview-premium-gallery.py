"""Loopback-only D0 primitives check on the dev-only /premium-gallery route. All planner/auth APIs are intercepted."""
import argparse
import json
from pathlib import Path
import runpy
import tempfile
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parent
UI = runpy.run_path(str(ROOT / "preview-ui-review.py"))
AUTH = runpy.run_path(str(ROOT / "preview-auth-states.py"))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default="http://localhost:3100/")
    parser.add_argument("--capture-dir", type=Path, default=Path(tempfile.gettempdir()) / "premium-gallery")
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
                for theme in ("light", "dark"):
                    for motion in ("no-preference", "reduce"):
                        context = browser.new_context(viewport={"width": width, "height": 900 if width >= 768 else 844}, color_scheme=theme, reduced_motion=motion, has_touch=width < 768, is_mobile=width < 768, service_workers="block")
                        context.add_init_script(f"try {{ localStorage.setItem('theme', '{theme}') }} catch {{}}")
                        AUTH["install_preview"](context, url, "linked", UI["synthetic_fixtures"]())
                        page = context.new_page()
                        errors = []
                        page.on("pageerror", lambda error: errors.append(str(error)))
                        page.goto(f"{url}/premium-gallery", wait_until="networkidle")
                        page.get_by_role("tablist", name="Home view").wait_for()
                        page.get_by_role("tab", name="Calendar").click()
                        selected = page.get_by_role("tab", name="Calendar").get_attribute("aria-selected")
                        page.keyboard.press("ArrowLeft")
                        try:
                            expect(page.get_by_role("tab", name="Today")).to_have_attribute("aria-selected", "true", timeout=3000)
                            keyboard_ok = True
                        except AssertionError:
                            keyboard_ok = False
                        animation = page.locator(".pc-rise").first.evaluate("el => getComputedStyle(el).animationName")
                        page.wait_for_timeout(1200)
                        overflow = page.evaluate("document.documentElement.scrollWidth > window.innerWidth")
                        tab_heights = page.locator(".pc-seg-tab").evaluate_all("els => els.map(el => el.getBoundingClientRect().height)")
                        name = f"gallery-{width}-{theme}-{motion}"
                        page.screenshot(path=str(capture / f"{name}.png"), full_page=True)
                        touch_ok = width >= 768 or min(tab_heights) >= 44
                        ok = touch_ok and not errors and not overflow and selected == "true" and keyboard_ok and ((animation == "none") == (motion == "reduce"))
                        results.append({"case": name, "ok": ok, "errors": errors, "overflow": overflow, "animation": animation, "keyboard": keyboard_ok, "tabHeights": tab_heights})
                        context.close()
        finally:
            browser.close()
    passed = sum(result["ok"] for result in results)
    print(json.dumps({"passed": passed, "failed": len(results) - passed, "capture": str(capture), "results": [r for r in results if not r["ok"]]}, indent=1))


if __name__ == "__main__":
    main()
