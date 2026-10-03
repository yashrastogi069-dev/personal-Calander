"""Capture every primary planner view with synthetic data for a private UI review.

The harness intercepts auth and planner requests, blocks service workers, and
only accepts loopback URLs. Captures must be written outside the repository.
"""

from __future__ import annotations

import argparse
from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
import runpy
import tempfile
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright


REPOSITORY = Path(__file__).resolve().parents[1]
AUTH = Path(__file__).with_name("preview-auth-states.py")
LINKED = Path(__file__).with_name("preview-linked-planner.py")
ROUTES = [
    ("today", "home", "today", ""),
    ("tasks-list", "tasks", "list", ""),
    ("tasks-board", "tasks", "board", ""),
    ("capture", "tasks", "inbox", "&action=capture"),
    ("search", "home", "search", ""),
    ("focus", "home", "focus", ""),
    ("plan", "plan", "daily", ""),
    ("roadmap", "plan", "roadmap", ""),
    ("calendar", "plan", "calendar", ""),
    ("projects", "intentions", "projects", ""),
    ("outcomes", "intentions", "outcomes", "&record=preview-outcome"),
    ("directions", "intentions", "directions", "&record=preview-direction"),
    ("habits", "habits", "due", ""),
    ("review", "review", "rituals", ""),
    ("review-insights", "review", "insights", ""),
    ("settings", "settings", "account", ""),
    ("connections", "settings", "connections", ""),
]
DARK_ROUTES = {
    "today", "tasks-list", "plan", "roadmap", "calendar", "projects", "outcomes",
    "directions", "habits", "review", "settings", "focus",
}
VIEWPORTS = {
    320: (700, "phone320"),
    390: (844, "phone"),
    768: (1024, "tablet"),
    1440: (1000, "desktop"),
}


def loopback_url(value: str) -> str:
    parsed = urlparse(value)
    if parsed.scheme not in {"http", "https"} or parsed.hostname not in {
        "localhost", "127.0.0.1"
    }:
        raise ValueError("Only localhost preview URLs are allowed")
    if parsed.username or parsed.password:
        raise ValueError("Credentials are not allowed in the preview URL")
    return value.rstrip("/")


def output_dir(value: Path | None) -> Path:
    output = (
        value or Path(tempfile.gettempdir()) / "personal-calendar-ui-review"
    ).expanduser().resolve()
    if output == REPOSITORY or output.is_relative_to(REPOSITORY):
        raise ValueError("Review captures must be written outside the repository")
    if output.exists() and any(output.iterdir()):
        raise ValueError(f"Output directory must be new or empty: {output}")
    output.mkdir(parents=True, exist_ok=True)
    return output


def synthetic_fixtures(large_roadmap: bool = False) -> dict:
    fixtures = runpy.run_path(str(LINKED))["fixtures"]()
    snapshot = fixtures["planner.workspace.snapshot"]
    workspace_id = snapshot["workspace"]["id"]
    snapshot["goals"] = [
        {
            "id": "preview-outcome", "workspaceId": workspace_id,
            "title": "Build a calmer weekly routine", "intentionKind": "outcome",
            "successCriteria": "Four focused mornings each week for six weeks.",
            "state": "in_progress", "priority": "high", "horizon": "quarterly",
            "progressMode": "measure", "progressValue": 58, "targetValue": 100,
            "startLocalDate": "2026-08-01", "dueLocalDate": "2026-10-31",
            "reviewCadence": "weekly", "nextReviewLocalDate": "2026-09-23",
            "version": 3,
        },
        {
            "id": "preview-direction", "workspaceId": workspace_id,
            "title": "Make room for health and people", "intentionKind": "direction",
            "standards": "Prefer sustainable progress over an overloaded week.",
            "state": "in_progress", "priority": "medium", "horizon": "yearly",
            "reviewCadence": "monthly", "nextReviewLocalDate": "2026-10-01",
            "version": 1,
        },
    ]
    snapshot["projects"] = [
        {
            "id": "preview-project", "workspaceId": workspace_id,
            "title": "Quarterly reset", "state": "in_progress",
            "goalId": "preview-outcome", "horizon": "quarterly",
            "startLocalDate": "2026-09-01", "dueLocalDate": "2026-10-31", "riskLevel": "watch",
            "riskNote": "Travel week may reduce focus time.", "version": 1,
        },
        {
            "id": "preview-project-b", "workspaceId": workspace_id,
            "title": "Kitchen organization", "state": "in_progress",
            "goalId": "preview-direction", "horizon": "monthly",
            "startLocalDate": "2026-11-01", "dueLocalDate": "2026-11-30", "version": 1,
        },
        {
            "id": "preview-project-undated", "workspaceId": workspace_id,
            "title": "Long-form writing project with a title that wraps naturally on a phone",
            "state": "not_started", "horizon": "yearly", "version": 1,
        },
        {
            "id": "preview-project-archived", "workspaceId": workspace_id,
            "title": "Previous planning cycle", "state": "archived",
            "startLocalDate": "2026-01-01", "dueLocalDate": "2026-03-31",
            "version": 2,
        },
    ]
    snapshot["milestones"] = [
        {
            "id": "preview-milestone", "workspaceId": workspace_id,
            "goalId": "preview-outcome", "title": "Six-week check-in",
            "state": "not_started", "dueLocalDate": "2026-10-15",
            "version": 1,
        },
    ]
    if large_roadmap:
        for index in range(48):
            start = datetime(2025, 1, 1) + timedelta(days=index * 14)
            due = start + timedelta(days=45 + index % 4 * 20)
            snapshot["projects"].append({
                "id": f"preview-project-large-{index}", "workspaceId": workspace_id,
                "title": f"Long horizon workstream {index + 1}: "
                         "maintain a meaningful, readable project name on every device",
                "state": "completed" if index % 11 == 0 else "in_progress",
                "horizon": "quarterly", "version": 1,
                "startLocalDate": start.strftime("%Y-%m-%d"),
                "dueLocalDate": due.strftime("%Y-%m-%d"),
            })
        snapshot["projectDependenciesAvailable"] = True
        snapshot["projectDependencies"] = [{
            "id": "preview-hard-dependency", "workspaceId": workspace_id,
            "projectId": "preview-project-b",
            "dependsOnProjectId": "preview-project", "dependencyType": "hard",
            "version": 1,
        }]
    snapshot["tasks"] = [
        {
            "id": "preview-task-a", "workspaceId": workspace_id,
            "title": "Choose three weekly priorities", "state": "in_progress",
            "priority": "high", "horizon": "daily", "categoryId": "preview-category",
            "scheduledLocalDate": "2026-09-20", "dueLocalDate": "2026-09-21",
            "estimateMinutes": 25, "sortOrder": 0, "version": 2,
            "projectId": "preview-project", "goalId": "preview-outcome",
        },
        {
            "id": "preview-task-b", "workspaceId": workspace_id,
            "title": "Prepare meals for busy days", "state": "not_started",
            "priority": "medium", "horizon": "weekly", "categoryId": "preview-category",
            "scheduledLocalDate": "2026-09-20", "dueLocalDate": "2026-09-23",
            "estimateMinutes": 45, "sortOrder": 1, "version": 1,
            "projectId": "preview-project", "goalId": "preview-outcome",
        },
        {
            "id": "preview-task-c", "workspaceId": workspace_id,
            "title": "Review next week's calendar", "state": "completed",
            "priority": "medium", "horizon": "weekly", "categoryId": "preview-category",
            "scheduledLocalDate": "2026-09-20", "estimateMinutes": 20,
            "sortOrder": 2, "version": 1,
        },
        {
            "id": "preview-task-d", "workspaceId": workspace_id,
            "title": "List weeknight dinner options", "state": "not_started",
            "priority": "medium", "horizon": "weekly", "categoryId": "preview-category",
            "scheduledLocalDate": "2026-09-22", "estimateMinutes": 30,
            "sortOrder": 3, "version": 1,
            "projectId": "preview-project-b", "goalId": "preview-direction",
        },
    ]
    snapshot["habits"] = [{
        "id": "preview-habit", "workspaceId": workspace_id,
        "name": "Take a 20-minute walk", "title": "Take a 20-minute walk",
        "frequency": "days_of_week",
        "schedule": {"weekdays": [1, 2, 3, 4, 5], "startLocalDate": "2026-08-01"},
        "color": "#5B8F79", "goalId": "preview-outcome",
        "createdAt": "2026-08-01T00:00:00Z", "version": 1,
    }, {
        "id": "preview-habit-weekly", "workspaceId": workspace_id,
        "name": "Read before bed", "title": "Read before bed",
        "frequency": "times_per_week", "schedule": {"timesPerWeek": 3, "startLocalDate": "2026-08-01"},
        "color": "#55758A", "goalId": "preview-outcome", "createdAt": "2026-08-01T00:00:00Z", "version": 2,
    }, {
        "id": "preview-habit-return", "workspaceId": workspace_id,
        "name": "Journal for five minutes", "title": "Journal for five minutes",
        "frequency": "daily", "schedule": {"startLocalDate": "2026-08-01"},
        "color": "#936B4F", "createdAt": "2026-08-01T00:00:00Z", "version": 1,
    }, {
        "id": "preview-habit-paused", "workspaceId": workspace_id,
        "name": "Stretching", "title": "Stretching",
        "frequency": "daily", "schedule": {"startLocalDate": "2026-08-01", "pauseStartedLocalDate": "2026-09-30", "pauseUntilLocalDate": "2026-10-05"},
        "color": "#776E92", "createdAt": "2026-08-01T00:00:00Z", "version": 4,
    }, {
        "id": "preview-habit-archived", "workspaceId": workspace_id,
        "name": "Old morning walk", "title": "Old morning walk",
        "frequency": "daily", "schedule": {"startLocalDate": "2026-08-01"},
        "color": "#797D70", "createdAt": "2026-08-01T00:00:00Z", "archivedAt": "2026-09-30T00:00:00Z", "version": 3,
    }]
    snapshot["habitCheckIns"] = [
        {
            "id": f"preview-check-{day}", "workspaceId": workspace_id,
            "habitId": "preview-habit", "localDate": f"2026-09-{day:02d}",
            "state": "completed" if day % 3 else "skipped", "version": 1,
        }
        for day in range(1, 21) if datetime(2026, 9, day).weekday() < 5
    ]
    snapshot["habitCheckIns"].extend([
        {"id": "preview-weekly-1", "workspaceId": workspace_id, "habitId": "preview-habit-weekly", "localDate": "2026-09-28", "state": "completed", "note": "Fiction", "version": 1},
        {"id": "preview-weekly-2", "workspaceId": workspace_id, "habitId": "preview-habit-weekly", "localDate": "2026-09-29", "state": "completed", "note": "History", "version": 1},
        {"id": "preview-return-1", "workspaceId": workspace_id, "habitId": "preview-habit-return", "localDate": "2026-09-20", "state": "completed", "version": 1},
        {"id": "preview-archived-1", "workspaceId": workspace_id, "habitId": "preview-habit-archived", "localDate": "2026-09-30", "state": "completed", "version": 1},
    ])
    fixtures["planner.habit.practiceEvidence"] = {"checkIns": snapshot["habitCheckIns"]}
    fixtures["planner.dashboard"] = {"workspace": snapshot["workspace"]}
    fixtures["planner.search.workspace"] = []
    fixtures["planner.task.rolloverPreview"] = {
        "fromLocalDate": "2026-09-19",
        "candidates": [],
    }
    return fixtures


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default="http://localhost:14773")
    parser.add_argument("--output", type=Path)
    parser.add_argument("--only", help="Comma-separated route names to capture")
    parser.add_argument("--scenario", choices=["standard", "roadmap-large-data"], default="standard")
    parser.add_argument("--no-screenshots", action="store_true", help="Run route assertions without saving images")
    parser.add_argument("--widths", default="390,1440", help="Comma-separated widths: 320,390,768,1440")
    args = parser.parse_args()
    url = loopback_url(args.url)
    output = output_dir(args.output)
    auth = runpy.run_path(str(AUTH))
    fixtures = synthetic_fixtures(args.scenario == "roadmap-large-data")
    selected_routes = set(args.only.split(",")) if args.only else ({"roadmap"} if args.scenario == "roadmap-large-data" else None)
    if selected_routes and selected_routes.difference(route[0] for route in ROUTES):
        raise ValueError(f"Unknown routes: {sorted(selected_routes.difference(route[0] for route in ROUTES))}")
    widths = [int(value) for value in args.widths.split(",")]
    if any(width not in VIEWPORTS for width in widths):
        raise ValueError("Supported widths are 320, 390, 768, and 1440")
    results, errors, unexpected = [], [], []

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        try:
            for width in widths:
                height, device = VIEWPORTS[width]
                for theme in ("light", "dark"):
                    for name, destination, view, extra in ROUTES:
                        if selected_routes and name not in selected_routes:
                            continue
                        if theme == "dark" and name not in DARK_ROUTES:
                            continue
                        context = browser.new_context(
                            viewport={"width": width, "height": height},
                            device_scale_factor=1,
                            color_scheme=theme,
                            timezone_id="Asia/Calcutta",
                            service_workers="block",
                        )
                        context.add_init_script(f"localStorage.setItem('theme', '{theme}')")
                        page = context.new_page()
                        page.clock.set_fixed_time(datetime(2026, 10, 1, 9, tzinfo=timezone.utc) if name == "habits" else datetime(2026, 9, 20, 9, tzinfo=timezone.utc))
                        page.on("pageerror", lambda error: errors.append(str(error)))
                        requests, rejected = auth["install_preview"](context, url, "linked", fixtures)
                        page.goto(
                            f"{url}?destination={destination}&view={view}{extra}",
                            wait_until="networkidle",
                            timeout=30000,
                        )
                        page.locator(".phase4-planner-shell").wait_for(state="visible", timeout=20000)
                        if name == "today":
                            expected_surface = "#ffffff" if theme == "light" else "#111b29"
                            assert page.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--surface').trim()") == expected_surface
                            if theme == "light":
                                quick_entry = page.locator(".planner-quick-entry")
                                quick_entry.locator("summary").click()
                                draft = quick_entry.locator("input").first
                                draft.fill("Synthetic draft - do not save")
                                quick_entry.locator("summary").click()
                                quick_entry.locator("summary").click()
                                assert draft.input_value() == "Synthetic draft - do not save"
                                draft.fill("")
                                quick_entry.locator("summary").click()
                        if name == "roadmap":
                            page.locator(".roadmap-workspace").wait_for(state="visible", timeout=30000)
                        path = output / f"{device}-{theme}-{name}.png"
                        if not args.no_screenshots:
                            page.screenshot(path=str(path), full_page=args.scenario != "roadmap-large-data", animations="disabled")
                        results.append({
                            "route": name, "theme": theme, "viewport": f"{width}x{height}",
                            "screenshot": None if args.no_screenshots else str(path),
                            "horizontalOverflow": page.evaluate(
                                "document.documentElement.scrollWidth > innerWidth"
                            ),
                            "unexpectedRequests": rejected, "plannerRequests": requests,
                        })
                        unexpected.extend(rejected)

                        if name == "habits":
                            page.locator(".habit-workspace").wait_for(state="visible")
                            assert page.locator(".habit-list-item").count() == 4
                            assert page.locator(".habit-list-group").count() >= 3
                            assert page.locator(".habit-trace").is_visible()
                            assert page.locator(".habit-calendar").is_visible()
                            assert page.locator(".habit-calendar-labels").is_visible()
                            assert page.locator(".habit-calendar").evaluate("element => getComputedStyle(element).gridTemplateColumns.split(' ').length") == 7
                            assert page.locator(".habit-archived").count() == 1
                            assert page.locator(".habit-return").count() >= 1
                            assert page.locator(".habit-practice").bounding_box()["y"] < page.locator(".habit-selected").bounding_box()["y"]
                            assert not page.evaluate("document.documentElement.scrollWidth > innerWidth")
                            page.get_by_role("button", name="Previous month").click()
                            assert page.locator(".habit-calendar-extra").count() >= 2
                            page.get_by_role("button", name="History", exact=True).click()
                            assert page.locator(".habit-correction").is_visible()
                            page.get_by_role("button", name="Settings", exact=True).click()
                            assert page.locator(".habit-settings").is_visible()
                            assert page.get_by_role("button", name="Save settings").is_visible()
                            assert not page.evaluate("document.documentElement.scrollWidth > innerWidth")

                        if name == "today":
                            assert page.get_by_role("heading", name="Today’s habits").is_visible()

                        if name == "review-insights":
                            assert page.get_by_role("heading", name="Tasks completed over time").is_visible()
                            assert page.get_by_role("heading", name="Tasks by category").is_visible()

                        if name == "projects" and theme == "light":
                            if width <= 680:
                                assert not page.locator(".project-detail").is_visible()
                            page.locator(".project-card").filter(has_text="Kitchen organization").click()
                            page.locator(".project-detail").wait_for(state="visible")
                            assert page.locator("#project-detail-heading").inner_text() == "Kitchen organization"
                            assert page.locator(".project-context-switcher select").input_value() == "preview-project-b"
                            assert "record=preview-project-b" in page.url
                            if width <= 680:
                                assert page.locator(".project-context-all").is_visible()
                                assert not page.locator(".intentions-list").is_visible()
                            selected_path = output / f"{device}-light-project-selected.png"
                            if not args.no_screenshots:
                                page.screenshot(path=str(selected_path), full_page=True, animations="disabled")
                            results.append({
                                "route": "project-selected", "theme": theme,
                                "viewport": f"{width}x{height}", "screenshot": None if args.no_screenshots else str(selected_path),
                                "selectedProject": "preview-project-b",
                            })
                            page.get_by_role("button", name="Board", exact=True).click()
                            page.locator("#execution-project").wait_for(state="visible")
                            assert page.locator("#execution-project").input_value() == "preview-project-b"
                            page.locator("#execution-project").select_option("preview-project")
                            assert "record=preview-project" in page.url
                            assert page.locator(".project-context-switcher select").input_value() == "preview-project"
                            page.get_by_role("button", name="Timeline", exact=True).click()
                            page.locator(".roadmap-workspace.is-project").wait_for(state="visible")
                            assert page.locator(".roadmap-axis-panel").count() == 0
                            assert page.locator(".roadmap-task-point").count() == 0
                            page.locator(".roadmap-task-toggle button").click()
                            assert page.locator(".roadmap-task-point").count() >= 1
                            page.get_by_role("button", name="Preview exact change").click()
                            assert page.locator(".roadmap-preview").is_visible() or page.get_by_text("No project date change.").is_visible()
                            if width <= 680:
                                page.locator(".project-context-all").click()
                                assert "record=" not in page.url
                                assert page.locator(".intentions-list").is_visible()
                            else:
                                page.locator(".roadmap-task-point").first.click()
                                assert "destination=tasks" in page.url
                                assert "record=preview-task" in page.url

                        if name == "roadmap":
                            assert page.locator(".roadmap-workspace").is_visible()
                            assert page.locator(".roadmap-archived").is_visible()
                            assert page.locator("[aria-labelledby='roadmap-undated-heading']").is_visible()
                            assert page.locator(".roadmap-archived summary span").inner_text() == "1"
                            if width > 680:
                                assert page.locator(".roadmap-axis-panel").is_visible()
                                assert page.locator(".roadmap-axis-panel").evaluate("node => node.compareDocumentPosition(document.querySelector('.roadmap-focus')) & Node.DOCUMENT_POSITION_FOLLOWING")
                            if theme == "light":
                                for scale in ("Quarter", "Year", "Month"):
                                    page.get_by_role("button", name=scale, exact=True).click()
                                    assert page.get_by_role("button", name=scale, exact=True).get_attribute("aria-pressed") == "true"
                            if args.scenario == "roadmap-large-data":
                                assert 15 <= page.locator(".roadmap-axis-row").count() < 45
                                if width > 680:
                                    assert page.locator(".roadmap-axis-head").count() == 12
                                assert page.locator("#roadmap-outside-heading").is_visible()
                                assert page.locator(".roadmap-axis-name").filter(has_text="Choose three weekly priorities").count() == 0
                                previous_window = page.locator(".roadmap-window-label").inner_text()
                                page.locator("[aria-labelledby='roadmap-outside-heading'] .roadmap-item").first.click()
                                assert page.locator(".roadmap-window-label").inner_text() != previous_window
                                page.get_by_label("Due date", exact=True).fill("2026-11-10")
                                page.get_by_role("button", name="Preview exact change").click()
                                assert page.get_by_text("Cannot apply: hard dependency timing conflict").is_visible()
                                assert page.get_by_role("button", name="Apply project dates").is_disabled()
                            elif theme == "light":
                                page.locator(".roadmap-archived summary").click()
                                page.get_by_role("button", name="Open archived project").click()
                                page.locator("#project-detail-heading").wait_for(state="visible")
                                assert page.locator("#project-detail-heading").inner_text() == "Previous planning cycle"
                                page.get_by_role("button", name="Board", exact=True).click()
                                assert page.locator("#project-detail-archived-board-heading").is_visible()
                                assert page.locator("#execution-project").count() == 0
                                page.get_by_role("button", name="All projects", exact=True).click()
                                assert "record=" not in page.url
                                assert page.locator(".intentions-list").is_visible()

                        if name == "plan":
                            stages = ("recover", "capacity", "commit", "reserve", "review")
                            for stage_index, stage in enumerate(stages):
                                if width < 768:
                                    page.get_by_label("Jump to planning stage").select_option(stage)
                                else:
                                    page.locator(".plan-stage-button").nth(stage_index).click()
                                stage_path = output / f"{device}-{theme}-plan-stage-{stage}.png"
                                if not args.no_screenshots:
                                    page.screenshot(path=str(stage_path), full_page=True, animations="disabled")
                                results.append({
                                    "route": f"plan-stage-{stage}", "theme": theme,
                                    "viewport": f"{width}x{height}", "screenshot": None if args.no_screenshots else str(stage_path),
                                    "horizontalOverflow": page.evaluate(
                                        "document.documentElement.scrollWidth > innerWidth"
                                    ),
                                })

                        if name == "today" and width <= 680 and theme == "light":
                            more = page.get_by_role("button", name="More", exact=True)
                            if more.is_visible():
                                more.click()
                                page.get_by_role("dialog", name="More planning").wait_for(
                                    state="visible"
                                )
                                more_path = output / f"{device}-light-more-menu.png"
                                if not args.no_screenshots:
                                    page.screenshot(path=str(more_path), full_page=True, animations="disabled")
                                results.append({
                                    "route": "more-menu", "theme": theme,
                                    "viewport": f"{width}x{height}", "screenshot": None if args.no_screenshots else str(more_path),
                                })
                        context.close()
        finally:
            browser.close()

    (output / "capture-index.json").write_text(json.dumps(results, indent=2), encoding="utf-8")
    print(json.dumps({
        "checks": len(results), "screenshotsSaved": 0 if args.no_screenshots else len(results), "output": str(output),
        "unexpectedRequests": unexpected, "runtimeErrors": errors[:20],
    }, indent=2))


if __name__ == "__main__":
    main()
