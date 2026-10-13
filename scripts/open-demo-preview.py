"""Open the local Vite dev server with a rich, browser-only demo dataset.

Every API, auth and remote request is intercepted by scripts/demo-fixtures.py, so
nothing reaches a live database. The clock is real (no freezing), so the Dashboard's
"now" line, count-ups and the focus timer run live. Clicks such as completing a
task, checking in a habit or starting focus change in-memory demo data only.

Start Vite first: npx vite --port 3100 --strictPort --host 127.0.0.1

  python scripts/open-demo-preview.py                      # headed, light, 1440x900
  python scripts/open-demo-preview.py --theme dark --width 390 --height 844
  python scripts/open-demo-preview.py --headless --shots DIR [--matrix]   # verification tour
"""
import argparse
import re
from datetime import datetime, timezone
import json
from pathlib import Path
import runpy
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent
DEMO = runpy.run_path(str(ROOT / "demo-fixtures.py"))

# label, query string, optional action after load
TOUR = [
    ("dashboard", "destination=home&view=overview"),
    ("today", "destination=home&view=today"),
    ("tasks", "destination=tasks&view=list"),
    ("habits", "destination=habits&view=due"),
    ("calendar", "destination=plan&view=calendar"),
    ("plan-daily", "destination=plan&view=daily"),
    ("plan-weekly", "destination=plan&view=weekly"),
    ("roadmap", "destination=plan&view=roadmap"),
    ("focus", "destination=home&view=focus&action=focus"),
]
IGNORED_ERRORS = {"WebSocket closed without opened."}


def new_context(browser, args, width, height, theme):
    return browser.new_context(
        viewport={"width": width, "height": height},
        device_scale_factor=1,
        color_scheme=theme,
        timezone_id=args.tz,
        service_workers="block",
        locale="en-NZ",
    )


def settle(page, ms=2400):
    try:
        page.wait_for_load_state("networkidle", timeout=8000)
    except Exception:
        pass
    page.wait_for_timeout(ms)


def shoot(page, path: Path, width: int, height: int) -> None:
    """The planner scrolls inside .planner-main, so grow the viewport to its content for a full capture."""
    content = page.evaluate("""() => {
      const main = document.querySelector('.planner-main');
      if (!main) return document.documentElement.scrollHeight;
      return main.getBoundingClientRect().top + main.scrollHeight;
    }""")
    tall = int(min(max(height, content + 24), 6000))
    if tall > height:
        page.set_viewport_size({"width": width, "height": tall})
        page.wait_for_timeout(400)
    page.screenshot(path=str(path))
    if tall > height:
        page.set_viewport_size({"width": width, "height": height})


def run_tour(browser, args, width, height, theme, shots: Path) -> dict:
    context = new_context(browser, args, width, height, theme)
    backend = DEMO["install_demo"](context, args.url, now=datetime.now(timezone.utc), tz=args.tz)
    page = context.new_page()
    errors: list[str] = []
    console_errors: list[str] = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.on("console", lambda message: console_errors.append(message.text) if message.type == "error" else None)
    tag = f"{width}x{height}-{theme}"
    base = args.url.rstrip("/") + "/?"
    report: dict = {"viewport": tag, "pages": {}, "checks": {}}

    for label, query in TOUR:
        before = len(errors)
        page.goto(base + query, wait_until="domcontentloaded")
        settle(page)
        if label == "dashboard":
            text = page.locator("section.pc-dash").inner_text(timeout=15000) if page.locator("section.pc-dash").count() else ""
            report["checks"]["dashboardRendered"] = bool(text)
            buttons = page.locator("button.pc-dash-check")
            report["checks"]["habitButtons"] = buttons.count()
            shoot(page, shots / f"{tag}-dashboard.png", width, height)
            target = page.locator("button.pc-dash-check[aria-pressed='false']:not([disabled])").first
            if target.count():
                name = target.get_attribute("aria-label")
                target.click()
                page.wait_for_timeout(250)
                page.screenshot(path=str(shots / f"{tag}-dashboard-habit-burst.png"))
                settle(page, 600)
                pressed = page.locator(f"button.pc-dash-check[aria-label=\"{name}\"]").get_attribute("aria-pressed")
                report["checks"]["habitCheckIn"] = {"habit": name, "pressedAfterClick": pressed, "mutationSent": "planner.habit.checkIn" in backend.mutations}
            continue
        if label == "focus":
            shoot(page, shots / f"{tag}-focus.png", width, height)
            # After a recent session Focus opens on the next-step panel; "Start another focus"
            # returns to setup, where "Start focus" starts the session.
            another = page.get_by_role("button", name="Start another focus").first
            if another.count():
                another.click()
                settle(page, 600)
                report["checks"]["startAnotherShown"] = True
            start = page.get_by_role("button", name="Start focus", exact=True).first
            if start.count():
                start.click()
                page.wait_for_timeout(3200)
                report["checks"]["focusStarted"] = "planner.focus.start" in backend.mutations
                shoot(page, shots / f"{tag}-focus-running.png", width, height)
            elif page.get_by_role("button", name=re.compile(r"^(Pause|Finish)")).count():
                report["checks"]["focusStarted"] = "session already running"
            else:
                report["checks"]["focusStarted"] = "no start button found"
            continue
        shoot(page, shots / f"{tag}-{label}.png", width, height)
        if label == "calendar":
            week = page.get_by_role("button", name="Week", exact=True).last
            if week.count():
                week.click()
                settle(page, 1200)
                shoot(page, shots / f"{tag}-calendar-week.png", width, height)
        report["pages"][label] = {"newErrors": [error for error in errors[before:] if error not in IGNORED_ERRORS]}

    if not args.skip_dashboard_return:
        page.goto(base + "destination=home&view=overview", wait_until="domcontentloaded")
        settle(page, 2500)
        shoot(page, shots / f"{tag}-dashboard-after-focus.png", width, height)
    report["runtimeErrors"] = [error for error in errors if error not in IGNORED_ERRORS]
    report["consoleErrors"] = sorted(set(console_errors))[:20]
    report["unexpected"] = sorted(set(backend.unexpected))
    report["mutations"] = sorted(set(backend.mutations))
    report["horizontalOverflow"] = not page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
    context.close()
    return report


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--url", default="http://127.0.0.1:3100/")
    parser.add_argument("--width", type=int, default=1440)
    parser.add_argument("--height", type=int, default=900)
    parser.add_argument("--theme", choices=("light", "dark"), default="light")
    parser.add_argument("--tz", default="Pacific/Auckland", help="IANA timezone for the browser and the demo workspace")
    parser.add_argument("--headless", action="store_true", help="run the verification tour without a window")
    parser.add_argument("--shots", type=Path, help="screenshot folder for the headless tour")
    parser.add_argument("--matrix", action="store_true", help="tour 1440x900 and 390x844 in light and dark")
    parser.add_argument("--skip-dashboard-return", action="store_true", help=argparse.SUPPRESS)
    args = parser.parse_args()
    if urlparse(args.url).hostname not in ("localhost", "127.0.0.1"):
        parser.error("Only local preview servers are allowed")

    with sync_playwright() as playwright:
        if args.headless:
            if not args.shots:
                parser.error("--headless needs --shots DIR")
            args.shots.mkdir(parents=True, exist_ok=True)
            browser = playwright.chromium.launch(headless=True)
            combos = [(1440, 900, "light"), (1440, 900, "dark"), (390, 844, "light"), (390, 844, "dark")] if args.matrix else [(args.width, args.height, args.theme)]
            reports = [run_tour(browser, args, width, height, theme, args.shots) for width, height, theme in combos]
            browser.close()
            (args.shots / "demo-tour-report.json").write_text(json.dumps(reports, indent=2), encoding="utf8")
            print(json.dumps(reports, indent=2))
            return

        browser = playwright.chromium.launch(headless=False)
        context = new_context(browser, args, args.width, args.height, args.theme)
        DEMO["install_demo"](context, args.url, now=datetime.now(timezone.utc), tz=args.tz)
        page = context.new_page()
        page.goto(args.url.rstrip("/") + "/?destination=home&view=overview", wait_until="domcontentloaded")
        print(f"Demo preview open at {args.url} (synthetic data, real clock, {args.tz}). Close the window to exit.", flush=True)
        page.wait_for_event("close", timeout=0)
        browser.close()


if __name__ == "__main__":
    main()
