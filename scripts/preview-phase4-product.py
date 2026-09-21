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
SCENARIOS = ("shell-navigation", "task-capture-search")
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
    fixtures["planner.task.rolloverPreview"] = {
        "fromLocalDate": "2026-09-19",
        "candidates": [],
    }
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

        stable_shell = shell.evaluate(
            "element => element.dataset.harnessMountToken === 'stable-shell'"
        )

        reachable = []
        click_destination(page, "Calendar")
        wait_for_target(page, "plan", "calendar")
        page.get_by_role("heading", name="Reserve real focus time", exact=True).wait_for()
        page.get_by_role("heading", name="Morning rollover", exact=True).wait_for()
        page.get_by_label("Calendar keyboard shortcuts", exact=True).wait_for()
        calendar_execution_location = current_location(page)
        assert shell.evaluate(
            "element => element.dataset.harnessMountToken === 'stable-shell'"
        )
        page.go_back()
        wait_for_target(page, "tasks", "list")
        assert page.locator("[data-task-search]").input_value() == "budget"
        assert page.locator('[data-scroll-owner="destination"]').get_attribute(
            "data-selected-record"
        ) == "record-two"
        page.go_forward()
        wait_for_target(page, "plan", "calendar")
        page.get_by_role("heading", name="Reserve real focus time", exact=True).wait_for()
        assert shell.evaluate(
            "element => element.dataset.harnessMountToken === 'stable-shell'"
        )
        page.go_back()
        wait_for_target(page, "tasks", "list")
        reachable.append("Calendar")

        for label, destination, view in (
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
                "calendarExecutionLocation": calendar_execution_location,
                "calendarHistoryRoundTrip": True,
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


def run_task_capture_search(browser, url: str, output: Path, width: int) -> dict:
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
    page.clock.set_fixed_time(datetime(2026, 9, 21, 9, 0, tzinfo=timezone.utc))
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
    snapshot = fixtures["planner.workspace.snapshot"]
    base = {
        "workspaceId": snapshot["workspace"]["id"],
        "description": None,
        "priority": "medium",
        "horizon": "daily",
        "categoryId": "preview-category",
        "goalId": None,
        "projectId": None,
        "parentTaskId": None,
        "dueLocalDate": None,
        "plannedStartAt": None,
        "plannedEndAt": None,
        "estimateMinutes": None,
        "sortOrder": 0,
        "recurrenceRule": None,
        "recurrenceAnchor": None,
        "recurrenceUntilLocalDate": None,
        "scheduleMode": "manual",
        "outcome": "none",
        "outcomeAt": None,
        "rescheduleCount": 0,
        "clientRequestId": None,
        "completedAt": None,
        "archivedAt": None,
        "createdAt": "2026-09-20T08:00:00.000Z",
        "updatedAt": "2026-09-20T08:00:00.000Z",
        "version": 1,
    }
    inbox_task = {
        **base,
        "id": "preview-task-inbox",
        "title": "Clarify lease renewal",
        "state": "not_started",
        "scheduledLocalDate": None,
    }
    planned_task = {
        **base,
        "id": "preview-task-planned",
        "title": "Review calendar",
        "state": "in_progress",
        "scheduledLocalDate": "2026-09-21",
        "estimateMinutes": 30,
        "sortOrder": 2,
    }
    second_todo_task = {
        **base,
        "id": "preview-task-second-todo",
        "title": "Collect renewal papers",
        "state": "not_started",
        "scheduledLocalDate": "2026-09-22",
        "sortOrder": 1,
    }
    completed_task = {
        **base,
        "id": "preview-task-completed",
        "title": "Send confirmation",
        "state": "completed",
        "scheduledLocalDate": "2026-09-21",
        "completedAt": "2026-09-21T07:00:00.000Z",
        "sortOrder": 3,
    }
    archived_task = {
        **base,
        "id": "preview-task-archived",
        "title": "Old lease note",
        "state": "archived",
        "scheduledLocalDate": None,
        "archivedAt": "2026-09-19T07:00:00.000Z",
        "sortOrder": 4,
    }
    snapshot["tasks"] = [inbox_task, second_todo_task, planned_task, completed_task, archived_task]
    search_goal = {
        "id": "preview-goal-search",
        "workspaceId": snapshot["workspace"]["id"],
        "title": "Renew the lease intentionally",
        "description": "Goal search evidence",
        "state": "in_progress",
        "priority": "medium",
        "horizon": "yearly",
        "progressMode": "task",
        "progressValue": 20,
        "targetValue": 100,
        "dueLocalDate": "2026-12-31",
        "categoryId": None,
        "version": 1,
    }
    search_project = {
        "id": "preview-project-search",
        "workspaceId": snapshot["workspace"]["id"],
        "title": "Archived lease paperwork",
        "description": "Project search evidence",
        "state": "archived",
        "priority": "medium",
        "horizon": "quarterly",
        "dueLocalDate": "2026-10-15",
        "goalId": search_goal["id"],
        "categoryId": None,
        "version": 1,
    }
    search_habit = {
        "id": "preview-habit-search",
        "workspaceId": snapshot["workspace"]["id"],
        "name": "Review lease notes",
        "description": "Habit search evidence",
        "frequency": "daily",
        "schedule": {"cadence": "daily"},
        "color": "#2f6b5f",
        "archivedAt": None,
        "version": 1,
    }
    search_review = {
        "id": "preview-review-search",
        "workspaceId": snapshot["workspace"]["id"],
        "kind": "annual",
        "periodStartLocalDate": "2024-01-01",
        "periodEndLocalDate": "2024-12-31",
        "reflection": "Lease review evidence outside the active snapshot range",
        "state": "completed",
        "version": 1,
    }
    snapshot["goals"] = [search_goal]
    snapshot["projects"] = []
    snapshot["habits"] = [search_habit]
    snapshot["reviewSessions"] = []
    created_task = {
        **base,
        "id": "preview-task-created",
        "title": "Buy oat milk",
        "state": "not_started",
        "scheduledLocalDate": None,
        "clientRequestId": "preview-created-request",
    }
    fixtures["planner.task.create"] = created_task
    fixtures["planner.task.update"] = {**inbox_task, "sortOrder": 1.5, "version": 2}
    fixtures["planner.search.workspace"] = [
        {
            "entity": "task",
            "id": inbox_task["id"],
            "title": inbox_task["title"],
            "summary": "Unscheduled household follow-up",
            "state": inbox_task["state"],
        },
        {"entity": "goal", "id": search_goal["id"], "title": search_goal["title"], "summary": search_goal["description"], "state": search_goal["state"]},
        {"entity": "project", "id": search_project["id"], "title": search_project["title"], "summary": search_project["description"], "state": search_project["state"]},
        {"entity": "habit", "id": search_habit["id"], "title": search_habit["name"], "summary": search_habit["description"], "state": "active"},
        {"entity": "review", "id": search_review["id"], "title": "Annual review · 2024-01-01 to 2024-12-31", "summary": search_review["reflection"], "state": search_review["state"]},
    ]
    fixtures["planner.task.rolloverPreview"] = {
        "fromLocalDate": "2026-09-20",
        "candidates": [],
    }
    search_record_by_id = {
        record["id"]: record
        for record in (search_goal, search_project, search_habit, search_review)
    }
    requests, unexpected = auth["install_preview"](
        context, url, "linked", fixtures
    )
    result: dict = {
        "scenario": "task-capture-search",
        "width": width,
        "height": height,
        "data": "synthetic-only",
        "runtimeErrors": runtime_errors,
        "consoleErrors": console_errors,
        "unexpectedRequests": unexpected,
        "plannerRequests": requests,
    }
    try:
        def checkpoint(name: str) -> None:
            result["checkpoint"] = name
            print(f"task-capture-search {width}px: {name}", flush=True)

        checkpoint("open-pwa-capture")
        separator = "&" if "?" in url else "?"
        page.goto(f"{url}{separator}create=task", wait_until="networkidle")
        capture = page.get_by_role("dialog", name="Capture")
        capture.wait_for(state="visible", timeout=20_000)
        page.wait_for_timeout(300)
        assert capture.get_by_role("button", name="Save to Inbox", exact=True).is_visible()
        assert "scheduledLocalDate" not in capture.inner_text()
        for tab in capture.get_by_role("tab").all():
            assert tab.get_attribute("aria-controls") == "capture-kind-panel"
        capture_target_metrics = capture.locator(
            "button:visible, input:not([type=checkbox]):visible, select:visible, .capture-plan-today:visible"
        ).evaluate_all(
            "elements => elements.map(element => { const box = element.getBoundingClientRect(); return { width: box.width, height: box.height, label: element.getAttribute('aria-label') || element.textContent?.trim() }; })"
        )
        capture_overflow = capture.evaluate(
            "element => ({ scrollWidth: element.scrollWidth, clientWidth: element.clientWidth, horizontalOverflow: element.scrollWidth > element.clientWidth })"
        )
        capture.get_by_label("Name", exact=True).fill("Buy oat milk Friday")
        capture.get_by_role("button", name="Interpret dates, reserved time, recurrence, or use a starting point", exact=True).click()
        page.locator("#natural-task").wait_for(state="visible")
        assert page.locator("#natural-task").input_value() == "Buy oat milk Friday"
        checkpoint("capture-handoff-retained")
        page.get_by_role("button", name="Parse for review", exact=True).click()
        page.get_by_role("heading", name="Review parsed details", exact=True).wait_for()
        click_destination(page, "Capture")
        capture.wait_for(state="visible")
        capture.get_by_label("Name", exact=True).fill("Buy oat milk Monday")
        capture.get_by_role("button", name="Interpret dates, reserved time, recurrence, or use a starting point", exact=True).click()
        page.locator("#natural-task").wait_for(state="visible")
        assert page.locator("#natural-task").input_value() == "Buy oat milk Monday"
        assert page.locator(".capture-draft-panel").count() == 0
        page.get_by_role("button", name="Parse for review", exact=True).click()
        page.get_by_role("heading", name="Review parsed details", exact=True).wait_for()
        checkpoint("capture-same-mounted-handoff")
        click_destination(page, "Tasks")
        wait_for_target(page, "tasks", "list")
        page.locator(".task-workspace-heading").get_by_role("button", name="Capture", exact=True).click()
        capture.wait_for(state="visible")
        assert capture.get_by_label("Name", exact=True).input_value() == "Buy oat milk Monday"
        capture.get_by_role("button", name="Save to Inbox", exact=True).click()
        capture.wait_for(state="hidden")
        page.mouse.move(8, 8)
        page.locator("[data-sonner-toast]").wait_for(state="hidden", timeout=10_000)

        checkpoint("open-tasks")
        click_destination(page, "Tasks")
        wait_for_target(page, "tasks", "list")
        task_tabs = page.locator(".task-workspace-tabs")
        task_tabs.get_by_role("button", name="Inbox", exact=True).click()
        checkpoint("wait-inbox")
        wait_for_target(page, "tasks", "inbox")
        page.get_by_text("Clarify lease renewal", exact=True).wait_for()
        assert not page.get_by_text("Review calendar", exact=True).is_visible()
        inbox_location = current_location(page)

        task_tabs.get_by_role("button", name="Board", exact=True).click()
        checkpoint("wait-board")
        wait_for_target(page, "tasks", "board")
        lanes = page.locator(".task-lane")
        assert lanes.count() == 3
        if width <= 680:
            assert page.locator(".task-lane:visible").count() == 1
            assert page.locator(".task-lane-tabs button").count() == 3
        lane_surfaces = lanes.evaluate_all(
            "elements => elements.map(element => getComputedStyle(element).getPropertyValue('--lane-surface').trim())"
        )
        assert lane_surfaces == ["#2a405d", "#155b59", "#1d4b3d"], lane_surfaces
        target_metrics = page.locator(
            ".task-workspace button:visible, .task-workspace select:visible"
        ).evaluate_all(
            "elements => elements.map(element => { const box = element.getBoundingClientRect(); return { width: box.width, height: box.height, label: element.getAttribute('aria-label') || element.textContent?.trim() }; })"
        )
        functional_text_sizes = page.locator(
            ".task-workspace .canonical-task-keyline:visible, .task-workspace .filter-group button:visible, .task-workspace .task-lane-select:visible, .task-workspace .task-lane-tab b:visible, .task-workspace .task-lane-tab small:visible"
        ).evaluate_all(
            "elements => elements.map(element => Number.parseFloat(getComputedStyle(element).fontSize))"
        )
        assert functional_text_sizes and min(functional_text_sizes) >= 14, functional_text_sizes

        checkpoint("exercise-visible-reorder")
        update_requests_before = requests.count("planner.task.update")
        page.get_by_label("Move Clarify lease renewal down in To do", exact=True).click()
        page.get_by_text("Task order updated.", exact=True).wait_for()
        assert requests.count("planner.task.update") == update_requests_before + 1
        page.mouse.move(8, 8)
        page.locator("[data-sonner-toast]").wait_for(state="hidden", timeout=10_000)
        page.locator(".task-sort select").select_option("priority")
        wait_for_parameter(page, "taskSort", "priority")
        page.get_by_text("Move up and down use Manual order.", exact=False).wait_for()
        assert page.get_by_label("Move Clarify lease renewal down in To do", exact=True).is_disabled()
        click_destination(page, "Plan")
        wait_for_target(page, "plan", "daily")
        click_destination(page, "Tasks")
        wait_for_target(page, "tasks", "list")
        assert page.locator(".task-sort select").input_value() == "priority"
        page.locator(".task-workspace-tabs").get_by_role("button", name="Board", exact=True).click()
        wait_for_target(page, "tasks", "board")
        assert page.locator(".task-sort select").input_value() == "priority"

        checkpoint("open-search")
        click_destination(page, "Search")
        wait_for_target(page, "home", "search")
        search = page.get_by_label("Search this workspace", exact=True)
        search.fill("lease")
        checkpoint("wait-search-query")
        wait_for_parameter(page, "q", "lease")
        search_records = [
            ("task", "preview-task-inbox", "tasks", "list", "Clarify lease renewal"),
            ("goal", "preview-goal-search", "intentions", "outcomes", "Renew the lease intentionally"),
            ("project", "preview-project-search", "intentions", "projects", "Archived lease paperwork"),
            ("habit", "preview-habit-search", "habits", "due", "Review lease notes"),
            ("review", "preview-review-search", "review", "rituals", "Annual review · 2024-01-01 to 2024-12-31"),
        ]
        detail_target_metrics = []
        detail_overflow = []
        for entity, record_id, destination, view, title in search_records:
            if entity != "task":
                fixtures["planner.search.record"] = search_record_by_id[record_id]
            search_result = page.locator(f'[data-search-result-id="{entity}:{record_id}"]')
            search_result.wait_for(state="visible")
            search_result.click()
            checkpoint(f"wait-{entity}-detail")
            wait_for_target(page, destination, view)
            detail = page.get_by_role("dialog", name=title)
            detail.wait_for(state="visible")
            if entity == "task":
                page.wait_for_timeout(300)
                detail_target_metrics = detail.locator(
                    ".task-detail-form button:visible, .task-detail-form input:visible, .task-detail-form select:visible, .task-detail-form textarea:visible"
                ).evaluate_all(
                    "elements => elements.map(element => { const box = element.getBoundingClientRect(); return { width: box.width, height: box.height, label: element.getAttribute('aria-label') || element.textContent?.trim() }; })"
                )
                detail_overflow = detail.evaluate(
                    "element => ({ scrollWidth: element.scrollWidth, clientWidth: element.clientWidth, horizontalOverflow: element.scrollWidth > element.clientWidth })"
                )
            assert page.locator('[data-scroll-owner="destination"]').get_attribute(
                "data-selected-record"
            ) == record_id
            page.keyboard.press("Escape")
            checkpoint(f"wait-{entity}-search-return")
            wait_for_target(page, "home", "search")
            assert page.get_by_label("Search this workspace", exact=True).input_value() == "lease"
            page.wait_for_function(
                f"() => document.activeElement?.dataset?.searchResultId === '{entity}:{record_id}'"
            )

        metrics = overflow_metrics(page)
        undersized = [
            target for target in [*target_metrics, *capture_target_metrics, *detail_target_metrics]
            if target["width"] < 44 or target["height"] < 44
        ]
        screenshot = output / f"task-capture-search-{width}.png"
        checkpoint("capture-evidence")
        page.screenshot(path=str(screenshot), full_page=True)
        page.wait_for_timeout(100)
        runtime_errors[:] = [
            error for error in runtime_errors
            if error != "WebSocket closed without opened."
        ]
        result.update(
            {
                "status": "PASS",
                "inboxLocation": inbox_location,
                "laneSurfaces": lane_surfaces,
                "searchQueryRetained": True,
                "searchFocusRestored": True,
                "searchRecordTypesOpened": [record[0] for record in search_records],
                "captureThoughtRetained": True,
                "captureSameMountedHandoff": True,
                "visibleReorderExercised": True,
                "taskSortPersisted": True,
                "minimumFunctionalText": min(functional_text_sizes),
                "minimumTarget": {
                    "width": min((target["width"] for target in [*target_metrics, *capture_target_metrics, *detail_target_metrics]), default=44),
                    "height": min((target["height"] for target in [*target_metrics, *capture_target_metrics, *detail_target_metrics]), default=44),
                },
                "captureOverflow": capture_overflow,
                "detailOverflow": detail_overflow,
                "overflow": metrics,
                "screenshot": str(screenshot),
            }
        )
        assert not undersized, undersized
        assert not capture_overflow["horizontalOverflow"], capture_overflow
        assert not detail_overflow["horizontalOverflow"], detail_overflow
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
                    result = (
                        run_shell_navigation(browser, url, output, width)
                        if args.scenario == "shell-navigation"
                        else run_task_capture_search(browser, url, output, width)
                    )
                    results.append(result)
                    print(f"PASS {args.scenario} {width}px", flush=True)
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
                        f"FAIL {args.scenario} {width}px: {type(error).__name__}: {error}",
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
        help="Scenario to run.",
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
