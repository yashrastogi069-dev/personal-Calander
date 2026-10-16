"""Tasks verification (D3a List, T2a Inbox/Archive, T2b-1 Week board) against the local Vite dev server, on demo data only.

Every API, auth and remote request is intercepted by scripts/demo-fixtures.py, so nothing reaches a
live database. Shots of the Tasks List and the task detail sheet at 1440x900 and 390x844 in light and
dark, plus one reduced-motion run, go to --shots (outside the repository).

Checks per run: no horizontal page overflow, no runtime or console errors, no unexpected procedure or
API path, no "Plan for" text on recurring rows, checking a normal task records exactly one
planner.task.update, checking a recurring row records planner.occurrence.resolve (and no task update),
and opening a row shows the side sheet. T2b-1 adds: one header (one "Tasks" title, one Capture), List row titles
aligned on one left edge, toolbar labels not truncated, and visits to Inbox, Archive and the Board (Week lens, the
default, then the Status lens) with shots and the same overflow/error checks, plus one Board plan action (mouse
drag at 1440, the card menu at 390 and in the reduced-motion run) that records exactly one planner.task.update.

Start Vite first: npx vite --port 3100 --strictPort --host 127.0.0.1

  python scripts/preview-premium-tasks.py --shots DIR [--url http://127.0.0.1:3100/]
"""
import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import runpy
import sys
from urllib.parse import urlparse

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parent.resolve()
DEMO = runpy.run_path(str(ROOT / "demo-fixtures.py"))

RECURRING_ID = "task-linkedin-daily"
IGNORED_ERRORS = {"WebSocket closed without opened."}
# The shell's idempotent bootstrap; not a Tasks write.
BOOTSTRAP = {"planner.workspace.ensure"}

RUNS = [
    (1440, 900, "light", False),
    (1440, 900, "dark", False),
    (390, 844, "light", False),
    (390, 844, "dark", False),
    (1440, 900, "light", True),
]


def settle(page, ms=1200):
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
        page.wait_for_timeout(300)
    page.screenshot(path=str(path))
    if tall > height:
        page.set_viewport_size({"width": width, "height": height})
        page.wait_for_timeout(200)


def writes(backend, start: int) -> list[str]:
    return [name for name in backend.mutations[start:] if name not in BOOTSTRAP]


def run(browser, args, width, height, theme, reduced, shots: Path) -> dict:
    tag = f"{width}x{height}-{theme}{'-reduced' if reduced else ''}"
    context = browser.new_context(
        viewport={"width": width, "height": height}, device_scale_factor=1, color_scheme=theme,
        reduced_motion="reduce" if reduced else "no-preference", timezone_id=args.tz, service_workers="block", locale="en-NZ",
    )
    backend = DEMO["install_demo"](context, args.url, now=datetime.now(timezone.utc), tz=args.tz)
    page = context.new_page()
    errors: list[str] = []
    console_errors: list[str] = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.on("console", lambda message: console_errors.append(message.text) if message.type == "error" else None)
    checks: dict = {}
    failures: list[str] = []

    def check(name, fn):
        try:
            value = fn()
            checks[name] = value if value is not None else True
        except Exception as error:  # record and keep going so one run reports every problem
            checks[name] = False
            failures.append(f"{name}: {error}")

    page.goto(args.url.rstrip("/") + "/?destination=tasks&view=list", wait_until="domcontentloaded")
    settle(page, 1800)

    def list_rendered():
        expect(page.locator(".tk-header")).to_be_visible(timeout=15000)
        expect(page.locator(".tk-toolbar")).to_be_visible()
        expect(page.locator(".tk-sections .tk-row").first).to_be_visible()
        sections = page.locator(".tk-section").evaluate_all("els => els.map(e => e.dataset.section)")
        assert "today" in sections, sections
        assert page.locator(".task-workspace-tabs").count() == 0, "legacy tab strip still rendered"
        return {"sections": sections, "rows": page.locator(".tk-sections .tk-row").count()}
    check("listRendered", list_rendered)
    shoot(page, shots / f"{tag}-tasks-list.png", width, height)

    def one_header():
        titles = page.locator("main h1, main h2").evaluate_all(
            "els => els.filter(e => e.offsetParent && e.textContent.trim() === 'Tasks').length")
        captures = page.locator("main button").evaluate_all(
            "els => els.filter(e => e.offsetParent && e.textContent.trim().startsWith('Capture')).length")
        assert titles == 1, f"{titles} Tasks titles"
        assert captures <= 1, f"{captures} Capture buttons in the page"
        assert page.locator(".tk-header button", has_text="Capture").count() == 0, "TaskHeader still has Capture"
        return {"titles": titles, "captures": captures}
    check("oneHeader", one_header)

    def rows_aligned():
        lefts = page.locator(".tk-sections .tk-section:not(.is-collapsed) .tk-row .tk-row-title").evaluate_all(
            "els => els.filter(e => e.offsetParent).map(e => Math.round(e.getBoundingClientRect().left))")
        assert lefts, "no row titles"
        assert max(lefts) - min(lefts) <= 1, f"title left edges differ: {sorted(set(lefts))}"
        return {"left": lefts[0], "rows": len(lefts)}
    check("listTitlesAligned", rows_aligned)

    def toolbar_fits():
        clipped = page.locator(".tk-lens .pc-seg-label, .tk-quick .pc-chip").evaluate_all(
            "els => els.filter(e => e.scrollWidth > e.clientWidth + 1).map(e => e.textContent)")
        assert not clipped, f"truncated: {clipped}"
        hidden = page.locator(".tk-quick").evaluate_all(
            "els => els.map(e => [...e.children].filter(c => c.getBoundingClientRect().right > window.innerWidth - 8).map(c => c.textContent))")
        assert not any(hidden), f"quick chips cut off: {hidden}"
        return True
    check("toolbarFits", toolbar_fits)

    def recurring_copy():
        row = page.locator(f'.tk-row[data-task-record-id="{RECURRING_ID}"]')
        expect(row).to_have_count(1)
        text = row.inner_text()
        labels = " ".join(row.locator("[aria-label]").evaluate_all("els => els.map(e => e.getAttribute('aria-label'))"))
        titles = " ".join(row.locator("[title]").evaluate_all("els => els.map(e => e.getAttribute('title'))"))
        combined = f"{text} {labels} {titles}"
        assert "Plan for" not in combined, combined
        return {"text": " ".join(text.split())}
    check("recurringRowHasNoPlanFor", recurring_copy)

    def open_sheet():
        row = page.locator(".tk-sections .tk-row:not(.is-complete)").first
        title = row.locator(".tk-row-title").inner_text()
        row.locator(".tk-row-title").click()
        sheet = page.locator(".tk-d-sheet")
        expect(sheet).to_be_visible(timeout=5000)
        page.wait_for_timeout(500)
        box = sheet.bounding_box()
        assert box, "sheet has no box"
        if width >= 1024:
            # Side variant: docked right, full height, not a centred dialog.
            assert box["x"] + box["width"] >= width - 2 and box["x"] > width / 3, box
            assert box["height"] >= height * 0.9, box
        assert "selectedRecord" in page.url or "record" in page.url, page.url
        page.screenshot(path=str(shots / f"{tag}-tasks-detail.png"))
        page.keyboard.press("Escape")
        expect(sheet).to_be_hidden(timeout=5000)
        return {"title": title, "box": {key: round(value) for key, value in box.items()}}
    check("rowOpensSideSheet", open_sheet)

    def check_normal():
        candidates = page.locator(f'.tk-sections .tk-row:not(.is-complete):not([data-task-record-id="{RECURRING_ID}"])')
        target = None
        for index in range(candidates.count()):
            row = candidates.nth(index)
            button = row.locator(".tk-check")
            if button.get_attribute("aria-disabled") is None and "is-checked" not in (button.get_attribute("class") or ""):
                target = row
                break
        assert target is not None, "no completable normal row"
        record = target.get_attribute("data-task-record-id")
        start = len(backend.mutations)
        target.locator(".tk-check").click()
        page.wait_for_timeout(1200)
        sent = writes(backend, start)
        assert sent.count("planner.task.update") == 1, sent
        assert "planner.occurrence.resolve" not in sent, sent
        return {"task": record, "writes": sent}
    check("normalCheckIsOneTaskUpdate", check_normal)

    def check_recurring():
        row = page.locator(f'.tk-row[data-task-record-id="{RECURRING_ID}"]')
        start = len(backend.mutations)
        row.locator(".tk-check").click()
        page.wait_for_timeout(1200)
        sent = writes(backend, start)
        assert "planner.occurrence.resolve" in sent, sent
        assert "planner.task.update" not in sent, sent
        return {"writes": sent}
    check("recurringCheckResolvesOccurrence", check_recurring)

    def no_overflow(name):
        assert not page.evaluate("document.documentElement.scrollWidth > window.innerWidth"), f"{name}: horizontal page overflow"

    def visit(view):
        page.goto(args.url.rstrip("/") + f"/?destination=tasks&view={view}", wait_until="domcontentloaded")
        settle(page, 1500)
        expect(page.locator(".tk-header")).to_be_visible(timeout=15000)

    def inbox_view():
        visit("inbox")
        expect(page.locator(".tk-inbox")).to_be_visible(timeout=8000)
        shoot(page, shots / f"{tag}-tasks-inbox.png", width, height)
        no_overflow("inbox")
        return True
    check("inboxView", inbox_view)

    def archive_view():
        visit("archive")
        expect(page.locator(".tk-arch").first).to_be_visible(timeout=8000)
        shoot(page, shots / f"{tag}-tasks-archive.png", width, height)
        no_overflow("archive")
        return True
    check("archiveView", archive_view)

    def board_view():
        visit("board")
        expect(page.locator('.tk-board[data-lens="week"]')).to_be_visible(timeout=8000)
        zones = page.locator(".tk-col").evaluate_all("els => els.map(e => e.dataset.zone)")
        assert zones[0] == "day:none" and len(zones) == 8, zones
        assert page.locator(".task-lane-grid").count() == 0, "legacy lanes still rendered"
        clipped = page.locator(".tk-board-lens .pc-seg-label, .tk-board-week").evaluate_all(
            "els => els.filter(e => e.scrollWidth > e.clientWidth + 1).map(e => e.textContent)")
        assert not clipped, f"truncated: {clipped}"
        shoot(page, shots / f"{tag}-tasks-board.png", width, height)
        no_overflow("board")
        return {"columns": zones, "cards": page.locator(".tk-wcard").count()}
    check("boardWeekView", board_view)

    def board_plan():
        cards = page.locator(".tk-wcard")
        target = None
        for index in range(cards.count()):
            card = cards.nth(index)
            if card.locator(".tk-wcard-face.is-done").count():
                continue
            if card.locator('[aria-label$="for a day"]').count() == 0:
                continue
            if card.locator(".tk-wcard-title").bounding_box() is None:
                continue
            target = card
            break
        assert target is not None, "no plannable card"
        record = target.get_attribute("data-task-record-id")
        source_zone = target.evaluate("el => el.closest('.tk-col').dataset.zone")
        start = len(backend.mutations)
        method = "menu"
        if width >= 1024 and not reduced:
            method = "drag"
            zones = page.locator(".tk-col").evaluate_all("els => els.map(e => e.dataset.zone)")
            today_index = page.locator(".tk-col").evaluate_all("els => els.findIndex(e => e.classList.contains('is-today'))")
            dest = zones[min(today_index + 1, len(zones) - 1)]
            if dest == source_zone:
                dest = zones[today_index]
            target.scroll_into_view_if_needed()
            box = target.locator(".tk-wcard-title").bounding_box()
            col = page.locator(f'.tk-col[data-zone="{dest}"]').bounding_box()
            page.mouse.move(box["x"] + 10, box["y"] + 6)
            page.mouse.down()
            page.mouse.move(box["x"] + 30, box["y"] + 20, steps=4)
            page.mouse.move(col["x"] + col["width"] / 2, col["y"] + 60, steps=12)
            page.wait_for_timeout(250)
            assert page.locator(f'.tk-col[data-zone="{dest}"].is-over').count() == 1, "target column not highlighted"
            assert page.locator(".tk-wcard-face.is-lifted").count() == 1, "card not lifted"
            page.screenshot(path=str(shots / f"{tag}-tasks-board-drag.png"))
            page.mouse.up()
        else:
            target.scroll_into_view_if_needed()
            target.hover()
            target.locator('[aria-label$="for a day"]').click()
            menu = page.locator(".tk-menu")
            expect(menu).to_be_visible(timeout=4000)
            item = menu.locator(".tk-menu-item", has_text="Plan tomorrow")
            if item.count() == 0:
                item = menu.locator(".tk-menu-item", has_text="Plan today")
            item.first.click()
        page.wait_for_timeout(600)
        asked = page.locator(".tk-late").count()
        if asked:
            page.screenshot(path=str(shots / f"{tag}-tasks-board-late.png"))
            page.locator(".tk-late .tk-late-btn", has_text="Plan anyway").click()
        page.wait_for_timeout(1200)
        sent = writes(backend, start)
        assert sent == ["planner.task.update"], sent
        toasts = page.locator("[data-sonner-toast]").all_inner_texts()
        assert any("Planned for" in text and "Undo" in text for text in toasts), toasts
        page.screenshot(path=str(shots / f"{tag}-tasks-board-planned.png"))
        no_overflow("board after plan")
        return {"task": record, "from": source_zone, "method": method, "lateAsked": bool(asked), "writes": sent}
    check("boardPlanIsOneTaskUpdate", board_plan)

    def board_status():
        page.locator('.tk-board-lens [role="tab"]', has_text="Status").click()
        page.wait_for_timeout(500)
        expect(page.locator('.tk-board[data-lens="status"]')).to_be_visible(timeout=4000)
        labels = [label.strip() for label in page.locator(".tk-col-title").all_inner_texts()]
        assert labels == ["To do", "Doing", "Done"], labels
        assert "taskLens=status" in page.url, page.url
        shoot(page, shots / f"{tag}-tasks-board-status.png", width, height)
        no_overflow("board status")
        return {"columns": labels}
    check("boardStatusLens", board_status)

    settle(page, 600)
    overflow = page.evaluate("document.documentElement.scrollWidth > window.innerWidth")
    runtime = [error for error in errors if error not in IGNORED_ERRORS]
    console = sorted(set(console_errors))
    unexpected = sorted(set(backend.unexpected))
    if overflow:
        failures.append("horizontal page overflow")
    if runtime:
        failures.append(f"runtime errors: {runtime[:5]}")
    if console:
        failures.append(f"console errors: {console[:5]}")
    if unexpected:
        failures.append(f"unexpected network: {unexpected}")
    context.close()
    return {
        "run": tag, "passed": not failures, "failures": failures, "checks": checks,
        "horizontalOverflow": overflow, "runtimeErrors": runtime, "consoleErrors": console[:20],
        "unexpected": unexpected, "mutations": [name for name in backend.mutations if name not in BOOTSTRAP],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--url", default="http://127.0.0.1:3100/")
    parser.add_argument("--tz", default="Pacific/Auckland")
    parser.add_argument("--shots", type=Path, required=True, help="screenshot folder outside the repository")
    args = parser.parse_args()
    if urlparse(args.url).hostname not in ("localhost", "127.0.0.1"):
        parser.error("Only local preview servers are allowed")
    shots = args.shots.resolve()
    if shots.is_relative_to(REPO):
        parser.error("Keep screenshots outside the repository")
    shots.mkdir(parents=True, exist_ok=True)

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        try:
            reports = [run(browser, args, width, height, theme, reduced, shots) for width, height, theme, reduced in RUNS]
        finally:
            browser.close()
    summary = {"passed": sum(report["passed"] for report in reports), "total": len(reports), "data": "demo fixtures only", "liveWrites": 0, "runs": reports}
    (shots / "preview-premium-tasks-report.json").write_text(json.dumps(summary, indent=2), encoding="utf8")
    print(json.dumps(summary, indent=2))
    sys.exit(0 if summary["passed"] == summary["total"] else 1)


if __name__ == "__main__":
    main()
