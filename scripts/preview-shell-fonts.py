"""Read-only public-font loading and synthetic shell interaction checks."""
import argparse
import json
from pathlib import Path
import runpy
import tempfile
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parent
VISIBLE = runpy.run_path(str(ROOT / "preview-visible-workspace.py"))
AUTH = runpy.run_path(str(ROOT / "preview-auth-states.py"))

def main():
    expect.set_options(timeout=15000)
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default="http://localhost:3100")
    parser.add_argument("--output", type=Path, default=Path(tempfile.gettempdir()) / "shell-fonts-manifest.json")
    args = parser.parse_args()
    url = VISIBLE["UI"]["loopback_url"](args.url)
    results, failures, font_requests = [], [], []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        for width in (390, 1440):
            for theme in ("light", "dark"):
                context = browser.new_context(viewport={"width": width, "height": 844 if width == 390 else 1000}, color_scheme=theme, timezone_id="UTC", service_workers="block")
                context.add_init_script(f"if(location.origin === new URL({json.dumps(url)}).origin) localStorage.setItem('theme', {json.dumps(theme)})")
                requests, unexpected = AUTH["install_preview"](context, url, "linked", VISIBLE["fixtures_for"]("active"))
                def public_fonts(route):
                    if urlparse(route.request.url).hostname in {"fonts.googleapis.com", "fonts.gstatic.com"} and route.request.method == "GET":
                        font_requests.append(route.request.url)
                        route.continue_(headers={k: v for k, v in route.request.headers.items() if k.lower() not in {"authorization", "cookie"}})
                    else:
                        route.fallback()
                context.route("**/*", public_fonts)
                page = context.new_page()
                page.set_default_timeout(15000)
                page.set_default_navigation_timeout(30000)
                page.clock.set_fixed_time(VISIBLE["NOW"])
                try:
                    page.goto(url + "?destination=home&view=today", wait_until="networkidle")
                    expect(page.locator(".focus-companion.is-home")).to_be_visible()
                    page.evaluate("() => document.fonts.ready")
                    cdp = context.new_cdp_session(page)
                    cdp.send("DOM.enable")
                    cdp.send("CSS.enable")
                    document = cdp.send("DOM.getDocument")
                    fonts = {}
                    for selector in (".planner-title h1", "[data-watch-part=elapsed]"):
                        node = cdp.send("DOM.querySelector", {"nodeId": document["root"]["nodeId"], "selector": selector})
                        fonts[selector] = cdp.send("CSS.getPlatformFontsForNode", {"nodeId": node["nodeId"]})["fonts"]
                    faces = page.evaluate("() => ({status: document.fonts.status, faces: [...document.fonts].map(f => ({family:f.family,status:f.status,weight:f.weight}))})")
                    tabs = page.locator(".planner-view-navigation").bounding_box()
                    watch = page.locator(".focus-companion.is-home").bounding_box()
                    assert tabs["y"] + tabs["height"] <= watch["y"], "tabs must precede watch"
                    assert not page.evaluate("document.documentElement.scrollWidth > innerWidth")
                    page.get_by_role("button", name="Expand Focus companion", exact=True).click()
                    expect(page.get_by_role("button", name="Open full Focus view", exact=True)).to_be_visible()
                    page.get_by_role("button", name="Digital", exact=True).click()
                    expect(page.locator(".focus-companion .focus-time-dial-face")).not_to_be_visible()
                    page.get_by_role("button", name="Dial", exact=True).click()
                    page.get_by_role("button", name="Stop current Focus session", exact=True).click()
                    expect(page.get_by_role("group", name="Confirm stopping Focus")).to_be_visible()
                    expect(page.get_by_text("Stop and save elapsed time? The task will not be completed.", exact=True)).to_be_visible()
                    page.get_by_role("button", name="Cancel", exact=True).click()
                    page.get_by_role("button", name="Collapse Focus companion", exact=True).click()
                    page.get_by_label("More planner controls", exact=True).click()
                    page.locator(".planner-quick-entry > summary").click()
                    page.get_by_label("Quickly capture a task", exact=True).fill("Synthetic retained quick entry")
                    page.locator(".planner-quick-entry > summary").click()
                    page.locator(".planner-quick-entry > summary").click()
                    expect(page.get_by_label("Quickly capture a task", exact=True)).to_have_value("Synthetic retained quick entry")
                    page.goto(url + "?destination=tasks&view=list", wait_until="networkidle")
                    summary = page.get_by_text("Task triage tools", exact=True)
                    summary.scroll_into_view_if_needed()
                    summary.click()
                    if width == 390:
                        page.evaluate("window.scrollTo(0, document.documentElement.scrollHeight)")
                        nav = page.locator(".mobile-planner-nav").bounding_box()
                        bottom = page.locator(".planner-main").evaluate("e => parseFloat(getComputedStyle(e).paddingBottom)")
                        assert bottom >= nav["height"], "destination disclosures need bottom-navigation clearance"
                    assert not any(any(token in request for token in (".create", ".update", ".finish", ".pause", ".resume")) for request in requests)
                    results.append({"width": width, "theme": theme, "fonts": fonts, "documentFonts": faces, "watch": watch, "tabs": tabs, "passed": True})
                except Exception as error:
                    failures.append({"width": width, "theme": theme, "error": str(error)})
                context.close()
        browser.close()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps({"syntheticOnly": True, "screenshots": False, "publicReadOnlyFontHosts": ["fonts.googleapis.com", "fonts.gstatic.com"], "fontRequests": font_requests, "results": results, "failures": failures}, indent=2), encoding="utf-8")
    print(json.dumps({"passed": len(results), "failures": failures, "manifest": str(args.output)}))
    if failures:
        raise SystemExit(1)

if __name__ == "__main__":
    main()
