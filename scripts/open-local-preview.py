"""Open the local Vite dev server in a visible browser with synthetic planner data.

Every API, auth and remote request is intercepted by the preview-auth fixtures,
so nothing reaches a live database and no planner write leaves the browser.
Start Vite first: npx vite --port 3100 --strictPort --host 127.0.0.1
"""
import argparse
from datetime import datetime, timezone
from pathlib import Path
import runpy

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent
AUTH = runpy.run_path(str(ROOT / "preview-auth-states.py"))
LINKED = runpy.run_path(str(ROOT / "preview-linked-planner.py"))
# The synthetic fixtures are dated around this morning.
FIXTURE_NOW = datetime(2026, 9, 20, 9, 0, tzinfo=timezone.utc)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default="http://127.0.0.1:3100/")
    parser.add_argument("--width", type=int, default=1440)
    parser.add_argument("--height", type=int, default=900)
    parser.add_argument("--theme", choices=("light", "dark"), default="light")
    args = parser.parse_args()

    fixtures = LINKED["fixtures"]()
    fixtures["planner.search.workspace"] = []
    fixtures["planner.task.rolloverPreview"] = {"fromLocalDate": "2026-09-19", "candidates": []}

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        context = browser.new_context(
            viewport={"width": args.width, "height": args.height},
            color_scheme=args.theme,
            timezone_id="Asia/Calcutta",
            service_workers="block",
        )
        page = context.new_page()
        page.clock.set_fixed_time(FIXTURE_NOW)
        AUTH["install_preview"](context, args.url, "linked", fixtures)
        page.goto(args.url, wait_until="networkidle")
        print(f"Local preview open at {args.url} (synthetic data). Close the window to exit.", flush=True)
        page.wait_for_event("close", timeout=0)
        browser.close()


if __name__ == "__main__":
    main()
