"""Run incremental, synthetic-only Phase 4 product browser checks.

The initial ``shell-navigation`` scenario verifies the stable authenticated
shell at caller-selected widths. Planner APIs are intercepted with synthetic
fixtures, service workers are blocked, and no request reaches a real backend.
"""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
import ipaddress
import json
from pathlib import Path
import runpy
import tempfile
from urllib.parse import urlparse


REPOSITORY = Path(__file__).resolve().parents[1]
AUTH_HARNESS = Path(__file__).with_name("preview-auth-states.py")
LINKED_HARNESS = Path(__file__).with_name("preview-linked-planner.py")
SCENARIOS = ("shell-navigation",)
DEFAULT_WIDTHS = (390, 1440)
HEIGHTS = {390: 844, 1440: 1000}


def assert_loopback_url(value: str) -> str:
    parsed = urlparse(value)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise ValueError("Only loopback HTTP(S) preview URLs are allowed")
    if parsed.username is not None or parsed.password is not None:
        raise ValueError("Credentials are not allowed in the preview URL")
    host = parsed.hostname.lower()
    if host != "localhost":
        try:
            if not ipaddress.ip_address(host).is_loopback:
                raise ValueError("Only loopback HTTP(S) preview URLs are allowed")
        except ValueError as error:
            if "Only loopback" in str(error):
                raise
            raise ValueError("Only loopback HTTP(S) preview URLs are allowed") from error
    return value.rstrip("/")


def parse_widths(value: str) -> tuple[int, ...]:
    try:
        widths = tuple(dict.fromkeys(int(item.strip()) for item in value.split(",")))
    except ValueError as error:
        raise argparse.ArgumentTypeError("Widths must be comma-separated integers") from error
    if not widths or any(width < 320 or width > 2560 for width in widths):
        raise argparse.ArgumentTypeError("Widths must be between 320 and 2560")
    return widths


def external_output(value: Path | None) -> Path:
    output = (
        value
        or Path(tempfile.gettempdir())
        / f"personal-calendar-phase4-product-{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}"
    ).expanduser().resolve()
    repository = REPOSITORY.resolve()
    if output == repository or output.is_relative_to(repository):
        raise ValueError("Browser evidence must be written outside the repository")
    return output


def active_focus_owner(page) -> str:
    return page.evaluate(
        r"""() => {
          const element = document.activeElement;
          if (!element) return 'none';
          return element.getAttribute('aria-label') ||
            element.textContent?.trim().replace(/\s+/g, ' ').slice(0, 120) ||
            element.tagName.toLowerCase();
        }"""
    )


def overflow_metrics(page) -> dict:
    return page.evaluate(
        """() => ({
          viewportWidth: window.innerWidth,
          documentWidth: document.documentElement.scrollWidth,
          bodyWidth: document.body.scrollWidth,
          horizontalOverflow:
            document.documentElement.scrollWidth > window.innerWidth ||
            document.body.scrollWidth > window.innerWidth
        })"""
    )


def current_location(page) -> dict:
    return page.evaluate(
        """() => ({
          pathname: window.location.pathname,
          search: window.location.search,
          href: window.location.href
        })"""
    )


def wait_for_target(page, destination: str, view: str | None = None) -> None:
    page.wait_for_function(
        """expected => {
          const url = new URL(location.href);
          return url.searchParams.get('destination') === expected.destination &&
            (!expected.view || url.searchParams.get('view') === expected.view);
        }""",
        arg={"destination": destination, "view": view},
    )


def click_destination(page, label: str) -> None:
    sheet = page.get_by_role("dialog", name="More planning")
    if sheet.is_visible():
        sheet.wait_for(state="hidden")
    for candidate in page.get_by_role("button", name=label, exact=True).all():
        if candidate.is_visible() and candidate.evaluate(
            "element => element.closest('[role=dialog]') === null"
        ):
            candidate.click()
            return
    more = page.get_by_role("button", name="More", exact=True)
    more.click()
    sheet.wait_for(state="visible")
    sheet.get_by_role("button", name=label, exact=True).click()


def wait_for_parameter(page, name: str, value: str) -> None:
    page.wait_for_function(
        "expected => new URL(location.href).searchParams.get(expected.name) === expected.value",
        arg={"name": name, "value": value},
    )


def replace_record_and_notify(page, record: str) -> None:
    page.evaluate(
        """record => {
          const url = new URL(location.href);
          url.searchParams.set('record', record);
          history.replaceState(null, '', url.href);
          dispatchEvent(new PopStateEvent('popstate'));
        }""",
        record,
    )
    page.locator('[data-scroll-owner="destination"]').wait_for()
    page.wait_for_function(
        "expected => document.querySelector('[data-scroll-owner=\"destination\"]')?.dataset.selectedRecord === expected",
        arg=record,
    )


def run_shell_navigation(browser, url: str, output: Path, width: int) -> dict:
    auth = runpy.run_path(str(AUTH_HARNESS))
    linked = runpy.run_path(str(LINKED_HARNESS))
    height = HEIGHTS.get(width, 900 if width >= 768 else 844)
    context = browser.new_context(
        viewport={"width": width, "height": height},
        device_scale_factor=1,
        color_scheme="light",
        timezone_id="Asia/Calcutta",
        service_workers="block",
    )
    page = context.new_page()
    page.clock.set_fixed_time(datetime(2026, 9, 20, 9, 0, tzinfo=timezone.utc))
    runtime_errors: list[str] = []
    console_errors: list[str] = []
    page.on("pageerror", lambda error: runtime_errors.append(str(error)))
    page.on(
        "console",
        lambda message: console_errors.append(message.text)
        if message.type == "error" and "favicon" not in message.text.lower()
        else None,
    )
    fixtures = linked["fixtures"]()
    fixtures["planner.search.workspace"] = []
    requests, unexpected = auth["install_preview"](
        context, url, "linked", fixtures
    )
    result: dict = {
        "scenario": "shell-navigation",
        "width": width,
        "height": height,
        "data": "synthetic-only",
        "runtimeErrors": runtime_errors,
        "consoleErrors": console_errors,
        "unexpectedRequests": unexpected,
        "plannerRequests": requests,
    }
    try:
        page.goto(url, wait_until="networkidle")
        page.get_by_role("heading", name="Today", exact=True).wait_for(
            state="visible", timeout=20_000
        )
        shell = page.locator(".phase4-planner-shell")
        shell.wait_for(state="visible")
        shell.evaluate("element => element.dataset.harnessMountToken = 'stable-shell'")

        click_destination(page, "Tasks")
        wait_for_target(page, "tasks", "list")
        tasks_location = current_location(page)
        tasks_focus = active_focus_owner(page)

        click_destination(page, "Plan")
        wait_for_target(page, "plan", "daily")
        plan_location = current_location(page)

        page.go_back()
        wait_for_target(page, "tasks", "list")
        back_location = current_location(page)
        page.go_forward()
        wait_for_target(page, "plan", "daily")
        forward_location = current_location(page)

        click_destination(page, "Search")
        wait_for_target(page, "home", "search")
        workspace_search = page.get_by_label("Search this workspace", exact=True)
        workspace_search.fill("alpha planning")
        wait_for_parameter(page, "q", "alpha planning")
        search_alpha_location = current_location(page)

        click_destination(page, "Tasks")
        wait_for_target(page, "tasks", "list")
        task_search = page.locator("[data-task-search]")
        task_search.fill("lease")
        wait_for_parameter(page, "taskQ", "lease")
        page.locator(".filter-group").get_by_role(
            "button", name="Today", exact=True
        ).click()
        wait_for_parameter(page, "taskFilter", "today")
        replace_record_and_notify(page, "record-one")
        tasks_one_location = current_location(page)

        click_destination(page, "Search")
        wait_for_target(page, "home", "search")
        workspace_search = page.get_by_label("Search this workspace", exact=True)
        workspace_search.fill("beta planning")
        wait_for_parameter(page, "q", "beta planning")
        search_beta_location = current_location(page)

        click_destination(page, "Tasks")
        wait_for_target(page, "tasks", "list")
        task_search = page.locator("[data-task-search]")
        task_search.fill("budget")
        wait_for_parameter(page, "taskQ", "budget")
        page.locator(".filter-group").get_by_role(
            "button", name="Deadline risk", exact=True
        ).click()
        wait_for_parameter(page, "taskFilter", "deadline_risk")
        replace_record_and_notify(page, "record-two")
        tasks_two_location = current_location(page)

        page.go_back()
        wait_for_target(page, "home", "search")
        assert page.get_by_label("Search this workspace", exact=True).input_value() == "beta planning"
        page.go_back()
        wait_for_target(page, "tasks", "list")
        assert page.locator("[data-task-search]").input_value() == "lease"
        assert page.locator(".filter-group").get_by_role(
            "button", name="Today", exact=True
        ).get_attribute("class") == "is-active"
        assert page.locator('[data-scroll-owner="destination"]').get_attribute(
            "data-selected-record"
        ) == "record-one"
        page.go_back()
        wait_for_target(page, "home", "search")
        assert page.get_by_label("Search this workspace", exact=True).input_value() == "alpha planning"
        page.go_forward()
        wait_for_target(page, "tasks", "list")
        assert page.locator("[data-task-search]").input_value() == "lease"
        page.go_forward()
        wait_for_target(page, "home", "search")
        assert page.get_by_label("Search this workspace", exact=True).input_value() == "beta planning"
        page.go_forward()
        wait_for_target(page, "tasks", "list")
        assert page.locator("[data-task-search]").input_value() == "budget"
        assert page.locator('[data-scroll-owner="destination"]').get_attribute(
            "data-selected-record"
        ) == "record-two"

        reachable = []
        for label, destination, view in (
            ("Calendar", "plan", "calendar"),
            ("Goals", "intentions", "outcomes"),
            ("Connections", "settings", "connections"),
            ("Insights", "review", "insights"),
        ):
            click_destination(page, label)
            wait_for_target(page, destination, view)
            reachable.append(label)
        click_destination(page, "Categories & Recycle Bin")
        wait_for_target(page, "settings", "categories")
        page.get_by_role("dialog", name="Categories & Recycle Bin").wait_for(
            state="visible"
        )
        reachable.append("Categories & Recycle Bin")
        page.keyboard.press("Escape")

        stable_shell = shell.evaluate(
            "element => element.dataset.harnessMountToken === 'stable-shell'"
        )
        metrics = overflow_metrics(page)
        screenshot = output / f"shell-navigation-{width}.png"
        page.screenshot(path=str(screenshot), full_page=True)
        page.wait_for_timeout(100)
        runtime_errors[:] = [
            error
            for error in runtime_errors
            if error != "WebSocket closed without opened."
        ]
        result.update(
            {
                "status": "PASS",
                "tasksLocation": tasks_location,
                "planLocation": plan_location,
                "backLocation": back_location,
                "forwardLocation": forward_location,
                "searchAlphaLocation": search_alpha_location,
                "tasksOneLocation": tasks_one_location,
                "searchBetaLocation": search_beta_location,
                "tasksTwoLocation": tasks_two_location,
                "historyRenderedState": True,
                "reachableChildViews": reachable,
                "focusOwner": tasks_focus,
                "stableShell": stable_shell,
                "overflow": metrics,
                "screenshot": str(screenshot),
            }
        )
        assert stable_shell, "Authenticated shell remounted during navigation"
        assert back_location["search"] == tasks_location["search"]
        assert forward_location["search"] == plan_location["search"]
        assert not metrics["horizontalOverflow"], metrics
        assert not runtime_errors, runtime_errors
        assert not console_errors, console_errors
        assert not unexpected, unexpected
    finally:
        context.close()
    return result


def run(args: argparse.Namespace) -> int:
    url = assert_loopback_url(args.url)
    output = external_output(args.output)
    if output.exists() and any(output.iterdir()):
        raise ValueError(f"Output directory must be new or empty: {output}")
    output.mkdir(parents=True, exist_ok=True)

    from playwright.sync_api import sync_playwright

    results: list[dict] = []
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        try:
            for width in args.widths:
                try:
                    result = run_shell_navigation(browser, url, output, width)
                    results.append(result)
                    print(f"PASS shell-navigation {width}px", flush=True)
                except Exception as error:
                    results.append(
                        {
                            "scenario": args.scenario,
                            "width": width,
                            "status": "FAIL",
                            "error": f"{type(error).__name__}: {error}",
                        }
                    )
                    print(
                        f"FAIL shell-navigation {width}px: {type(error).__name__}: {error}",
                        flush=True,
                    )
        finally:
            browser.close()

    results_path = output / "phase4-product-results.json"
    results_path.write_text(json.dumps(results, indent=2), encoding="utf-8")
    failed = [result for result in results if result["status"] != "PASS"]
    print(
        json.dumps(
            {
                "status": "PASS" if not failed else "FAIL",
                "passed": len(results) - len(failed),
                "failed": len(failed),
                "output": str(output),
                "results": str(results_path),
            },
            indent=2,
        )
    )
    return 0 if not failed else 1


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--scenario",
        choices=SCENARIOS,
        default="shell-navigation",
        help="Scenario to run (initially: shell-navigation).",
    )
    parser.add_argument("--widths", type=parse_widths, default=DEFAULT_WIDTHS)
    parser.add_argument("--url", default="http://127.0.0.1:14775")
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    try:
        return run(args)
    except (ValueError, RuntimeError) as error:
        parser.error(str(error))
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
