"""Validate Phase 4 visual prototypes with synthetic auth and no real writes.

The harness permits loopback HTTP only, intercepts the authentication boundary,
and fails closed for every unexpected API or external request. Screenshots and
JSON evidence must be written outside the repository.
"""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import ipaddress
import json
import os
import subprocess
import sys
import tempfile
import threading
import time
import unittest
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import unquote, urljoin, urlparse
from urllib.request import HTTPRedirectHandler, Request, build_opener


REPOSITORY = Path(__file__).resolve().parents[1]
FIXTURE_SOURCE = REPOSITORY / "shared" / "phase4Prototype.ts"
VARIANTS = ("a", "b", "c")
CORE_VIEWPORTS = {
    "desktop": {"width": 1440, "height": 1000, "preview": "desktop"},
    "phone": {"width": 390, "height": 844, "preview": "phone"},
}
STRESS_VIEWPORTS = {
    "320-portrait": {"width": 320, "height": 844, "preview": "phone", "reduced_motion": False},
    "phone-landscape": {"width": 844, "height": 390, "preview": "phone", "reduced_motion": False},
    "tablet-768": {"width": 768, "height": 1024, "preview": "desktop", "reduced_motion": False},
    "reduced-motion": {"width": 390, "height": 844, "preview": "phone", "reduced_motion": True},
}
PAGE_TIMEOUT_MS = 20_000
ACTION_TIMEOUT_MS = 8_000
EXPECTED_NOTICE = "Prototype data — nothing here is saved"
SYNTHETIC_USER = {
    "id": 1,
    "authUserId": "11111111-1111-4111-8111-111111111111",
    "name": "Prototype reviewer",
    "email": "phase4@example.invalid",
    "role": "user",
}
SYNTHETIC_WORKSPACE = {
    "id": "phase4-prototype-workspace",
    "ownerUserId": 1,
    "name": "Phase 4 synthetic prototype",
    "timezone": "Asia/Kolkata",
    "dailyCapacityMinutes": 360,
    "weekStartsOn": 1,
    "planningDayStartsAt": "06:00",
    "workdayStartsAt": "09:00",
    "workdayEndsAt": "17:00",
    "defaultBreakMinutes": 30,
    "preferredShutdownAt": "17:30",
    "version": 1,
}


def assert_local_url(url: str) -> None:
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise ValueError("Only loopback HTTP(S) preview URLs are allowed")
    if parsed.username is not None or parsed.password is not None:
        raise ValueError("Credentials are not allowed in the preview URL")
    hostname = parsed.hostname.lower()
    if hostname != "localhost":
        try:
            if not ipaddress.ip_address(hostname).is_loopback:
                raise ValueError("Only loopback HTTP(S) preview URLs are allowed")
        except ValueError as error:
            if "Only loopback" in str(error):
                raise
            raise ValueError("Only loopback HTTP(S) preview URLs are allowed") from error
    try:
        parsed.port
    except ValueError as error:
        raise ValueError("The preview URL has an invalid port") from error


def assert_external_output(output: Path, repository: Path = REPOSITORY) -> Path:
    resolved = output.expanduser().resolve()
    root = repository.resolve()
    if resolved == root or resolved.is_relative_to(root):
        raise ValueError(f"Evidence must stay outside Git; choose a path outside {root}")
    return resolved


def build_scenario_matrix() -> list[dict]:
    scenarios: list[dict] = []
    for variant in VARIANTS:
        for viewport, dimensions in CORE_VIEWPORTS.items():
            scenarios.append({
                "id": f"{variant}-{viewport}",
                "kind": "core",
                "variant": variant,
                "viewport": viewport,
                **dimensions,
                "reduced_motion": False,
            })
    for variant in VARIANTS:
        for stress, dimensions in STRESS_VIEWPORTS.items():
            scenarios.append({
                "id": f"{variant}-{stress}",
                "kind": "stress",
                "variant": variant,
                "viewport": dimensions["preview"],
                "stress": stress,
                **dimensions,
            })
    return scenarios


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def git_value(*arguments: str) -> str | None:
    completed = subprocess.run(
        ["git", *arguments], cwd=REPOSITORY, capture_output=True, text=True, check=False
    )
    return completed.stdout.strip() if completed.returncode == 0 else None


def default_output() -> Path:
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    return Path(tempfile.gettempdir()) / f"personal-calendar-phase4-prototypes-{timestamp}-{os.getpid()}"


def check_playwright_prerequisite() -> None:
    try:
        from playwright.sync_api import sync_playwright
    except ImportError as error:
        raise RuntimeError(
            "Python Playwright is required. Install it with `python -m pip install playwright` "
            "and then run `python -m playwright install chromium`."
        ) from error
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True)
            browser.close()
    except Exception as error:
        raise RuntimeError(
            "Playwright Chromium could not start. Run `python -m playwright install chromium` "
            "and retry."
        ) from error


class NoRedirectHandler(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def probe_server_once(url: str) -> dict:
    assert_local_url(url)
    opener = build_opener(NoRedirectHandler())
    request = Request(url, method="GET")
    try:
        with opener.open(request, timeout=1.0) as response:
            final_url = response.geturl()
            assert_local_url(final_url)
            return {"ready": response.status < 500, "status": response.status, "finalUrl": final_url}
    except HTTPError as error:
        if 300 <= error.code < 400:
            location = error.headers.get("Location")
            redirect = urljoin(url, location) if location else None
            if redirect:
                try:
                    assert_local_url(redirect)
                except ValueError:
                    return {"ready": False, "status": error.code, "blockedRedirect": redirect}
            return {"ready": False, "status": error.code, "redirect": redirect}
        return {"ready": False, "status": error.code, "error": str(error)}
    except (OSError, URLError) as error:
        return {"ready": False, "error": str(error)}


def wait_for_server(url: str, process: subprocess.Popen | None, timeout_seconds: float = 25.0) -> None:
    deadline = time.monotonic() + timeout_seconds
    last_error = "not contacted"
    while time.monotonic() < deadline:
        if process is not None and process.poll() is not None:
            raise RuntimeError(f"Preview server exited early with status {process.returncode}")
        probe = probe_server_once(url)
        if probe["ready"]:
            return
        last_error = json.dumps(probe, sort_keys=True)
        time.sleep(0.2)
    raise RuntimeError(f"Preview server was not ready within {timeout_seconds:.0f}s: {last_error}")


def build_server_command(url: str) -> list[str]:
    parsed = urlparse(url)
    port = parsed.port or (443 if parsed.scheme == "https" else 80)
    config_path = json.dumps(str(REPOSITORY / "vite.config.ts"))
    host = json.dumps(parsed.hostname or "127.0.0.1")
    program = f"""
import {{ createServer }} from "vite";
const server = await createServer({{
  configFile: {config_path},
  server: {{ host: {host}, port: {port}, strictPort: true, watch: null, hmr: false }}
}});
await server.listen();
server.printUrls();
await new Promise(() => {{}});
""".strip()
    return ["node", "--input-type=module", "--eval", program]


def start_preview_server(url: str, output: Path) -> tuple[subprocess.Popen, object]:
    if not (REPOSITORY / "node_modules" / "vite").is_dir():
        raise RuntimeError("The checked-in Vite package is missing; restore repository dependencies")
    log = (output / "preview-server.log").open("w", encoding="utf-8")
    process = subprocess.Popen(
        build_server_command(url),
        cwd=REPOSITORY,
        stdin=subprocess.DEVNULL,
        stdout=log,
        stderr=subprocess.STDOUT,
        creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
    )
    return process, log


def stop_process(process: subprocess.Popen | None) -> None:
    if process is None or process.poll() is not None:
        return
    process.terminate()
    try:
        process.wait(timeout=5)
    except subprocess.TimeoutExpired:
        process.kill()
        process.wait(timeout=5)


def classify_external_url(url: str) -> str | None:
    parsed = urlparse(url)
    if parsed.hostname == "fonts.googleapis.com" and parsed.path == "/css2":
        return "font-css"
    if parsed.hostname == "va.vercel-scripts.com" and parsed.path == "/v1/script.debug.js":
        return "telemetry-script"
    return None


def classify_expected_request(method: str, url: str, origin: str) -> str | None:
    if method != "GET":
        return None
    parsed = urlparse(url)
    if parsed.netloc == origin and parsed.path == "/api/health":
        return "health"
    if parsed.netloc == origin and parsed.path.startswith("/_vercel/"):
        return "local-telemetry"
    if parsed.netloc != origin:
        return classify_external_url(url)
    return None


def install_synthetic_boundary(context, url: str) -> tuple[list[dict], list[dict], list[dict]]:
    api_requests: list[dict] = []
    unexpected: list[dict] = []
    blocked_external: list[dict] = []
    origin = urlparse(url).netloc
    session = {"access_token": "phase4-local-only-token", "user": {"id": SYNTHETIC_USER["authUserId"]}}
    auth_module = """
let session = SESSION;
let callback = () => {};
export const supabase = {auth: {
  getSession: async () => ({data: {session}, error: null}),
  onAuthStateChange: fn => { callback = fn; queueMicrotask(() => fn('INITIAL_SESSION', session)); return {data: {subscription: {unsubscribe() {}}}}; },
  signOut: async () => { session = null; callback('SIGNED_OUT', null); return {error: null}; },
  signInWithOAuth: async () => ({data: {}, error: {message: 'Disabled in local prototype validation'}}),
  signInWithPassword: async () => ({data: {}, error: {message: 'Disabled in local prototype validation'}}),
  signUp: async () => ({data: {}, error: {message: 'Disabled in local prototype validation'}})
}};
export const requireSupabaseClient = () => supabase;
""".replace("SESSION", json.dumps(session))

    def intercept(route) -> None:
        request = route.request
        parsed = urlparse(request.url)
        record = {"method": request.method, "url": request.url}
        expected = classify_expected_request(request.method, request.url, origin)
        if request.method != "GET":
            unexpected.append({**record, "reason": "non-GET request blocked"})
            if parsed.netloc == origin:
                route.fulfill(status=418, content_type="application/json", body='{"error":"blocked"}')
            else:
                route.abort("blockedbyclient")
            return
        if parsed.netloc != origin:
            resource = expected
            if resource is not None:
                blocked_external.append({**record, "resource": resource, "result": "local empty stub; no network request sent"})
                route.fulfill(
                    status=200,
                    content_type="text/css" if resource == "font-css" else "application/javascript",
                    body="/* blocked by local-only Phase 4 harness */",
                )
                return
            unexpected.append({**record, "reason": "external request blocked"})
            route.abort("blockedbyclient")
            return
        if parsed.path == "/src/lib/supabase.ts":
            route.fulfill(status=200, content_type="application/javascript", body=auth_module)
            return
        if parsed.path.startswith("/api/trpc/"):
            procedures = unquote(parsed.path.removeprefix("/api/trpc/")).split(",")
            api_requests.extend({"method": request.method, "procedure": name} for name in procedures)
            if request.method != "GET" or any(name not in {"auth.me", "auth.workspace"} for name in procedures):
                unexpected.append({**record, "procedures": procedures, "reason": "unexpected or mutating tRPC request blocked"})
                route.fulfill(status=418, content_type="application/json", body='{"error":"blocked"}')
                return
            response = []
            for procedure in procedures:
                data = SYNTHETIC_USER if procedure == "auth.me" else SYNTHETIC_WORKSPACE
                response.append({"result": {"data": {"json": data}}})
            route.fulfill(status=200, content_type="application/json", body=json.dumps(response))
            return
        if expected == "health":
            api_requests.append({"method": request.method, "procedure": "api.health"})
            route.fulfill(status=200, content_type="application/json", body='{"ok":true}')
            return
        if expected == "local-telemetry":
            route.fulfill(status=204, body="")
            return
        if parsed.path.startswith("/api/"):
            unexpected.append({**record, "reason": "unexpected API request blocked"})
            route.fulfill(status=418, content_type="application/json", body='{"error":"blocked"}')
            return
        route.continue_()

    context.route("**/*", intercept)
    return api_requests, unexpected, blocked_external


def attach_page_observers(page) -> tuple[list[str], list[str]]:
    runtime_errors: list[str] = []
    console_errors: list[str] = []
    page.on("pageerror", lambda error: runtime_errors.append(str(error)))
    page.on(
        "console",
        lambda message: console_errors.append(message.text)
        if message.type == "error" and "favicon" not in message.text.lower()
        else None,
    )
    return runtime_errors, console_errors


def assert_notice(page) -> None:
    notice = page.get_by_test_id("prototype-notice")
    notice.wait_for(state="visible", timeout=ACTION_TIMEOUT_MS)
    text = " ".join(notice.inner_text().split())
    assert EXPECTED_NOTICE in text, text


def assert_no_page_overflow(page) -> dict:
    metrics = page.evaluate(
        """() => ({
          innerWidth: window.innerWidth,
          documentWidth: document.documentElement.scrollWidth,
          bodyWidth: document.body.scrollWidth
        })"""
    )
    assert metrics["documentWidth"] <= metrics["innerWidth"], metrics
    assert metrics["bodyWidth"] <= metrics["innerWidth"], metrics
    return metrics


def collect_accessibility_metrics(page, view: str, density: str) -> dict:
    return page.evaluate(
        r"""input => {
          const {view, density} = input;
          const visible = element => {
            const style = getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            return style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0;
          };
          const parse = value => {
            const match = value.match(/rgba?\(\s*([\d.]+)[, ]+([\d.]+)[, ]+([\d.]+)(?:\s*[,/]\s*([\d.]+))?/);
            return match ? [Number(match[1]), Number(match[2]), Number(match[3]), match[4] === undefined ? 1 : Number(match[4])] : null;
          };
          const composite = (top, bottom) => {
            const alpha = top[3] + bottom[3] * (1 - top[3]);
            if (!alpha) return [0, 0, 0, 0];
            return [0, 1, 2].map(index => (top[index] * top[3] + bottom[index] * bottom[3] * (1 - top[3])) / alpha).concat(alpha);
          };
          const background = element => {
            const layers = [];
            for (let node = element; node; node = node.parentElement) {
              const color = parse(getComputedStyle(node).backgroundColor);
              if (color && color[3]) layers.push(color);
            }
            return layers.reverse().reduce((result, layer) => composite(layer, result), [255, 255, 255, 1]);
          };
          const luminance = color => [0, 1, 2].map(index => {
            const channel = color[index] / 255;
            return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
          }).reduce((sum, channel, index) => sum + channel * [.2126, .7152, .0722][index], 0);
          const ratio = (first, second) => {
            const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
            return (values[0] + .05) / (values[1] + .05);
          };
          const targets = [...document.querySelectorAll('button, summary, input, textarea, select, a[href], [role="button"]')]
            .filter(visible).map(element => {
              const rect = element.getBoundingClientRect();
              return {label: element.getAttribute('aria-label') || element.textContent.trim().slice(0, 80), width: +rect.width.toFixed(2), height: +rect.height.toFixed(2)};
            });
          const text = [...document.querySelectorAll('button, summary, label, p, span, small, strong, em, h1, h2, h3, h4, time, dt, dd')]
            .filter(element => visible(element) && element.textContent.trim()).map(element => ({
              label: element.textContent.trim().slice(0, 80),
              px: parseFloat(getComputedStyle(element).fontSize)
            }));
          const sampleSelectors = {
            today: ['.p4-notice span:first-of-type', '.p4-page-intro>div:first-child>p:last-child', '.p4-recovery-entry p'],
            tasks: ['.p4-notice span:first-of-type', '.p4-board-task-main strong', '.p4-board-task-main small'],
            roadmap: ['.p4-notice span:first-of-type', '.p4-roadmap-label small', '.p4-undated article span'],
            settings: ['.p4-notice span:first-of-type', '.p4-settings-row small', '.p4-state-example.is-warning small']
          };
          const contrasts = (sampleSelectors[view] || []).flatMap(selector => {
            const element = document.querySelector(selector);
            if (!element || !visible(element)) return [];
            const foreground = parse(getComputedStyle(element).color);
            const back = background(element);
            return foreground ? [{selector, foreground: getComputedStyle(element).color, background: back.slice(0, 3).map(Math.round).join(','), ratio: +ratio(foreground, back).toFixed(3)}] : [];
          });
          const root = document.querySelector('.p4-prototype');
          const rootBackground = root ? parse(getComputedStyle(root).backgroundColor) : null;
          return {
            view,
            density,
            targetCount: targets.length,
            minimumTargetWidth: targets.length ? Math.min(...targets.map(item => item.width)) : null,
            minimumTargetHeight: targets.length ? Math.min(...targets.map(item => item.height)) : null,
            undersizedTargets: targets.filter(item => item.width < 44 || item.height < 44),
            minimumTextPx: text.length ? Math.min(...text.map(item => item.px)) : null,
            undersizedText: text.filter(item => item.px < 14),
            contrasts,
            rootBackgroundLuminance: rootBackground ? +luminance(rootBackground).toFixed(4) : null
          };
        }""",
        {"view": view, "density": density},
    )


def screenshot_requires_top(view: str) -> bool:
    return view in {"today", "tasks", "roadmap"}


def reset_scroll_container_script() -> str:
    return """element => {
      const previous = element.style.scrollBehavior;
      element.style.scrollBehavior = "auto";
      element.scrollTo({ top: 0, left: 0, behavior: "instant" });
      const position = { top: element.scrollTop, left: element.scrollLeft };
      element.style.scrollBehavior = previous;
      return position;
    }"""


def screenshot(page, output: Path, scenario_id: str, view: str) -> str:
    if screenshot_requires_top(view):
        main = page.locator(".p4-main")
        position = main.evaluate(reset_scroll_container_script())
        assert abs(position["top"]) < 1 and abs(position["left"]) < 1, position
    path = output / f"phase4-{scenario_id}-{view}.png"
    page.screenshot(path=str(path), full_page=True)
    return path.name


def desktop_destination(page, name: str):
    return page.locator(".p4-rail").get_by_role("button", name=name, exact=True)


def goto_view(page, preview: str, view: str) -> None:
    if view == "today":
        (page.get_by_test_id("view-today") if preview == "phone" else desktop_destination(page, "Home")).click()
    elif view == "tasks":
        (page.get_by_test_id("view-tasks") if preview == "phone" else desktop_destination(page, "Tasks")).click()
    elif view == "roadmap":
        (page.get_by_test_id("view-roadmap") if preview == "phone" else desktop_destination(page, "Plan")).click()
    elif view == "settings" and preview == "desktop":
        page.locator(".p4-account").click()
    else:
        page.locator(".p4-bottom-nav").get_by_role("button", name="More", exact=True).click()
        dialog = page.get_by_role("dialog", name="More")
        dialog.wait_for(state="visible", timeout=ACTION_TIMEOUT_MS)
        page.get_by_test_id("view-settings").click()
    ready = {
        "today": page.locator("#p4-agenda-title"),
        "tasks": page.locator('[aria-label="Task board"]'),
        "roadmap": page.locator("#p4-roadmap-heading"),
        "settings": page.locator("#p4-account-settings"),
    }[view]
    ready.wait_for(state="visible", timeout=ACTION_TIMEOUT_MS)
    assert_notice(page)


def assert_dialog_focus_and_escape(page, opener, dialog_name: str) -> None:
    opener.evaluate("element => { window.__phase4ReturnFocus = element; }")
    opener.click()
    dialog = page.get_by_role("dialog", name=dialog_name)
    dialog.wait_for(state="visible", timeout=ACTION_TIMEOUT_MS)
    assert dialog.evaluate("element => element.contains(document.activeElement)"), f"{dialog_name} did not receive focus"
    page.keyboard.press("Escape")
    dialog.wait_for(state="hidden", timeout=ACTION_TIMEOUT_MS)
    assert page.evaluate("document.activeElement === window.__phase4ReturnFocus"), f"{dialog_name} did not restore focus"


def settings_final_action(page) -> dict:
    footer = page.locator(".p4-signout-placement")
    footer.scroll_into_view_if_needed(timeout=ACTION_TIMEOUT_MS)
    footer.get_by_role("button", name="Preview only — sign out is not connected", exact=True).wait_for(
        state="visible", timeout=ACTION_TIMEOUT_MS
    )
    box = footer.bounding_box()
    viewport_height = page.evaluate("window.innerHeight")
    assert box and box["y"] < viewport_height and box["y"] + box["height"] > 0, box
    return {"boundingBox": box, "viewportHeight": viewport_height, "reachable": True}


def required_settings_state_testids() -> tuple[str, ...]:
    return (
        "state-loading",
        "state-error",
        "state-conflict",
        "state-disabled",
        "state-saved-locally",
        "state-unsupported-offline",
    )


def assert_settings_state_samples(page) -> list[str]:
    visible: list[str] = []
    for testid in required_settings_state_testids():
        page.get_by_test_id(testid).wait_for(state="visible", timeout=ACTION_TIMEOUT_MS)
        visible.append(testid)
    return visible


def measurement_findings(measurements: list[dict]) -> dict:
    return {
        "undersizedTargets": [
            {"view": metrics["view"], "density": metrics["density"], **target}
            for metrics in measurements
            for target in metrics["undersizedTargets"]
        ],
        "undersizedText": [
            {"view": metrics["view"], "density": metrics["density"], **text}
            for metrics in measurements
            for text in metrics["undersizedText"]
        ],
        "contrastBelow4_5": [
            {"view": metrics["view"], "density": metrics["density"], **sample}
            for metrics in measurements
            for sample in metrics["contrasts"]
            if sample["ratio"] < 4.5
        ],
    }


def assert_core_density_coverage(measurements: list[dict]) -> None:
    views = ("today", "tasks", "roadmap", "settings")
    expected = {(density, view) for density in ("comfortable", "compact") for view in views}
    actual = {(metrics.get("density"), metrics.get("view")) for metrics in measurements}
    assert actual == expected, {"expected": sorted(expected), "actual": sorted(actual)}


def assert_result_clean(result: dict) -> None:
    assert not result["unexpectedRequests"], result["unexpectedRequests"]
    assert not result["runtimeErrors"], result["runtimeErrors"]
    assert not result["consoleErrors"], result["consoleErrors"]
    for metrics in result["measurements"]:
        assert not metrics["undersizedText"], metrics["undersizedText"]
        for sample in metrics["contrasts"]:
            assert sample["ratio"] >= 4.5, sample
        assert not metrics["undersizedTargets"], metrics["undersizedTargets"]
    if result["kind"] == "core":
        assert_core_density_coverage(result["measurements"])


def finalize_scenario_result(result: dict) -> dict:
    assert_result_clean(result)
    invalid_api = [
        request
        for request in result["apiRequests"]
        if request.get("method") != "GET"
        or request.get("procedure") not in {"auth.me", "auth.workspace", "api.health"}
    ]
    assert not invalid_api, invalid_api
    procedures = {request["procedure"] for request in result["apiRequests"]}
    assert {"auth.me", "auth.workspace"}.issubset(procedures), result["apiRequests"]
    return json.loads(json.dumps(result))


def run_core(page, scenario: dict, output: Path, base_result: dict) -> dict:
    preview = scenario["viewport"]
    screenshots: list[str] = []
    measurements: list[dict] = []
    overflows: list[dict] = []

    page.locator(".p4-main").evaluate("element => { element.scrollTop = 0; }")
    measurements.append(collect_accessibility_metrics(page, "today", "comfortable"))
    overflows.append({"view": "today", "density": "comfortable", **assert_no_page_overflow(page)})
    screenshots.append(screenshot(page, output, scenario["id"], "today"))

    task_toggle = page.get_by_test_id("task-toggle-read-lease")
    task_toggle.click()
    assert task_toggle.get_attribute("aria-pressed") == "true"
    task_toggle.click()
    assert task_toggle.get_attribute("aria-pressed") == "false"

    assert_dialog_focus_and_escape(page, page.get_by_test_id("open-task-detail"), "Task detail")
    capture = page.get_by_test_id("phone-open-capture" if preview == "phone" else "open-capture")
    assert_dialog_focus_and_escape(page, capture, "Capture")

    recovery_opener = page.get_by_test_id("open-recovery")
    recovery_opener.evaluate("element => { window.__phase4RecoveryFocus = element; }")
    recovery_opener.click()
    recovery = page.get_by_role("dialog", name="Recovery")
    recovery.wait_for(state="visible", timeout=ACTION_TIMEOUT_MS)
    assert recovery.evaluate("element => element.contains(document.activeElement)")
    page.get_by_test_id("recovery-reduce").click()
    assert page.get_by_test_id("recovery-reduce").get_attribute("aria-pressed") == "true"
    recovery.get_by_text("No record changed. Closing preserves this flow for later.", exact=True).wait_for(state="visible")
    recovery.get_by_role("button", name="Keep preview and close", exact=True).click()
    recovery.wait_for(state="hidden", timeout=ACTION_TIMEOUT_MS)
    resume = page.get_by_test_id("resume-recovery")
    resume.wait_for(state="visible", timeout=ACTION_TIMEOUT_MS)
    assert page.evaluate("document.activeElement === window.__phase4RecoveryFocus")
    resume.evaluate("element => { window.__phase4ResumeFocus = element; }")
    resume.click()
    recovery.wait_for(state="visible", timeout=ACTION_TIMEOUT_MS)
    assert page.get_by_test_id("recovery-reduce").get_attribute("aria-pressed") == "true"
    page.keyboard.press("Escape")
    recovery.wait_for(state="hidden", timeout=ACTION_TIMEOUT_MS)
    assert page.evaluate("document.activeElement === window.__phase4ResumeFocus")

    goto_view(page, preview, "tasks")
    measurements.append(collect_accessibility_metrics(page, "tasks", "comfortable"))
    overflows.append({"view": "tasks", "density": "comfortable", **assert_no_page_overflow(page)})
    screenshots.append(screenshot(page, output, scenario["id"], "tasks"))

    goto_view(page, preview, "roadmap")
    page.get_by_test_id("preview-roadmap-move").click()
    page.get_by_text("Change preview", exact=True).wait_for(state="visible", timeout=ACTION_TIMEOUT_MS)
    assert page.get_by_text("Goal due date stays unchanged.", exact=False).is_visible()
    page.get_by_test_id("cancel-roadmap-move").click()
    page.get_by_test_id("cancel-roadmap-move").wait_for(state="detached", timeout=ACTION_TIMEOUT_MS)
    measurements.append(collect_accessibility_metrics(page, "roadmap", "comfortable"))
    overflows.append({"view": "roadmap", "density": "comfortable", **assert_no_page_overflow(page)})
    screenshots.append(screenshot(page, output, scenario["id"], "roadmap"))

    if preview == "phone":
        more = page.locator(".p4-bottom-nav").get_by_role("button", name="More", exact=True)
        assert_dialog_focus_and_escape(page, more, "More")
    goto_view(page, preview, "settings")
    settings_states = assert_settings_state_samples(page)
    final_action = settings_final_action(page)
    measurements.append(collect_accessibility_metrics(page, "settings", "comfortable"))
    overflows.append({"view": "settings", "density": "comfortable", **assert_no_page_overflow(page)})
    screenshots.append(screenshot(page, output, scenario["id"], "settings-final"))

    page.get_by_test_id("density-compact").click() if preview == "desktop" else page.locator(".p4-inline-segment").get_by_role("button", name="Compact", exact=True).click()
    assert page.get_by_test_id("prototype-shell").get_attribute("data-prototype-density") == "compact"
    compact_final_action = None
    for view in ("today", "tasks", "roadmap", "settings"):
        goto_view(page, preview, view)
        if view == "settings":
            assert_settings_state_samples(page)
            compact_final_action = settings_final_action(page)
        measurements.append(collect_accessibility_metrics(page, view, "compact"))
        overflows.append({"view": view, "density": "compact", **assert_no_page_overflow(page)})
    page.get_by_test_id("density-comfortable").click() if preview == "desktop" else page.locator(".p4-inline-segment").get_by_role("button", name="Comfortable", exact=True).click()
    assert page.get_by_test_id("prototype-shell").get_attribute("data-prototype-density") == "comfortable"
    assert_notice(page)

    result = {
        **base_result,
        "status": "PASS",
        "viewsOpened": ["today", "tasks", "roadmap", "settings"],
        "taskCompleteReopen": True,
        "captureAndDetail": True,
        "recoveryReduceResumeCancel": True,
        "roadmapPreviewCancel": True,
        "densities": ["comfortable", "compact"],
        "densitiesMeasured": ["comfortable", "compact"],
        "settingsStatesVisible": settings_states,
        "finalSettingsAction": final_action,
        "compactFinalSettingsAction": compact_final_action,
        "screenshots": screenshots,
        "overflow": overflows,
        "measurements": measurements,
        "measurementFindings": measurement_findings(measurements),
    }
    return result


def run_stress(page, scenario: dict, output: Path, base_result: dict) -> dict:
    preview = scenario["viewport"]
    measurements: list[dict] = []
    overflows: list[dict] = []
    screenshots: list[str] = []
    for view in ("today", "tasks", "roadmap", "settings"):
        if view != "today":
            goto_view(page, preview, view)
        measurements.append(collect_accessibility_metrics(page, view, "comfortable"))
        overflows.append({"view": view, "density": "comfortable", **assert_no_page_overflow(page)})
    settings_states = assert_settings_state_samples(page)
    final_action = settings_final_action(page)
    screenshots.append(screenshot(page, output, scenario["id"], "stress-settings"))
    reduced_motion_duration = None
    if scenario["reduced_motion"]:
        goto_view(page, preview, "today")
        opener = page.get_by_test_id("phone-open-capture" if preview == "phone" else "open-capture")
        opener.click()
        reduced_motion_duration = page.locator(".p4-dialog").evaluate(
            "element => parseFloat(getComputedStyle(element).animationDuration)"
        )
        assert reduced_motion_duration <= 0.0001, reduced_motion_duration
        page.keyboard.press("Escape")
    root_luminance = measurements[0]["rootBackgroundLuminance"]
    expected_scheme = "dark" if scenario["variant"] == "c" else "light"
    assert (root_luminance < 0.2) if expected_scheme == "dark" else (root_luminance > 0.5), root_luminance
    result = {
        **base_result,
        "status": "PASS",
        "viewsOpened": ["today", "tasks", "roadmap", "settings"],
        "representativeScheme": expected_scheme,
        "reducedMotionAnimationSeconds": reduced_motion_duration,
        "finalSettingsAction": final_action,
        "settingsStatesVisible": settings_states,
        "screenshots": screenshots,
        "overflow": overflows,
        "measurements": measurements,
        "measurementFindings": measurement_findings(measurements),
    }
    return result


def run_scenario(browser, url: str, output: Path, scenario: dict, fixture_checksum: str) -> dict:
    context = browser.new_context(
        viewport={"width": scenario["width"], "height": scenario["height"]},
        color_scheme="dark" if scenario["variant"] == "c" else "light",
        reduced_motion="reduce" if scenario["reduced_motion"] else "no-preference",
        timezone_id="Asia/Calcutta",
        service_workers="block",
    )
    page = context.new_page()
    page.set_default_timeout(ACTION_TIMEOUT_MS)
    page.set_default_navigation_timeout(PAGE_TIMEOUT_MS)
    runtime_errors, console_errors = attach_page_observers(page)
    api_requests, unexpected, blocked_external = install_synthetic_boundary(context, url)
    query_url = f"{url.rstrip('/')}/phase4-prototypes?variant={scenario['variant']}&viewport={scenario['viewport']}"
    base_result = {
        "id": scenario["id"],
        "kind": scenario["kind"],
        "variant": scenario["variant"],
        "viewport": scenario["viewport"],
        "width": scenario["width"],
        "height": scenario["height"],
        "stress": scenario.get("stress"),
        "fixtureChecksumSha256": fixture_checksum,
        "auth": "synthetic-only",
        "runtimeErrors": runtime_errors,
        "consoleErrors": console_errors,
        "unexpectedRequests": unexpected,
        "blockedExternalResources": blocked_external,
        "apiRequests": api_requests,
    }
    result = None
    try:
        page.goto(query_url, wait_until="domcontentloaded")
        shell = page.get_by_test_id("prototype-shell")
        shell.wait_for(state="visible", timeout=PAGE_TIMEOUT_MS)
        assert shell.get_attribute("data-prototype-variant") == scenario["variant"]
        assert shell.get_attribute("data-prototype-viewport") == scenario["viewport"]
        assert_notice(page)
        result = run_core(page, scenario, output, base_result) if scenario["kind"] == "core" else run_stress(page, scenario, output, base_result)
    finally:
        try:
            if not page.is_closed():
                page.wait_for_timeout(100)
        finally:
            context.close()
    assert result is not None
    return finalize_scenario_result(result)


def write_results(output: Path, manifest: dict, results: list[dict]) -> tuple[Path, Path]:
    result_path = output / "phase4-prototype-results.json"
    result_path.write_text(json.dumps({**manifest, "results": results}, indent=2), encoding="utf-8")
    checksums = {
        path.name: sha256_file(path)
        for path in sorted(output.iterdir())
        if path.is_file() and path.name != "artifact-checksums.json"
    }
    checksum_path = output / "artifact-checksums.json"
    checksum_path.write_text(json.dumps(checksums, indent=2, sort_keys=True), encoding="utf-8")
    return result_path, checksum_path


def validate(args) -> int:
    assert_local_url(args.url)
    output = assert_external_output(args.output or default_output())
    if output.exists() and any(output.iterdir()):
        raise ValueError(f"Output directory must be new or empty: {output}")
    if not FIXTURE_SOURCE.is_file():
        raise RuntimeError(f"Prototype fixture source is missing: {FIXTURE_SOURCE}")
    matrix = build_scenario_matrix()
    if args.dry_run:
        try:
            import playwright  # noqa: F401
        except ImportError as error:
            raise RuntimeError("Python Playwright is missing; install it before running the matrix") from error
        print(json.dumps({"status": "DRY-RUN PASS", "url": args.url, "output": str(output), "scenarios": matrix}, indent=2))
        return 0

    check_playwright_prerequisite()
    output.mkdir(parents=True, exist_ok=False)
    fixture_checksum = sha256_file(FIXTURE_SOURCE)
    server = None
    server_log = None
    results: list[dict] = []
    manifest = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "branch": git_value("branch", "--show-current"),
        "head": git_value("rev-parse", "HEAD"),
        "fixtureSource": str(FIXTURE_SOURCE.relative_to(REPOSITORY)),
        "fixtureChecksumSha256": fixture_checksum,
        "target": args.url,
        "server": "owned Vite transform server (watch disabled, HMR disabled)" if args.start_server else "caller-owned loopback server",
        "networkPolicy": "synthetic auth; auth.me/auth.workspace GET only; all unexpected API/external requests blocked",
    }
    try:
        if args.start_server:
            server, server_log = start_preview_server(args.url, output)
        wait_for_server(args.url, server)
        from playwright.sync_api import sync_playwright

        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True)
            try:
                for scenario in matrix:
                    try:
                        results.append(run_scenario(browser, args.url, output, scenario, fixture_checksum))
                        print(f"PASS {scenario['id']}", flush=True)
                    except Exception as error:
                        results.append({
                            "id": scenario["id"],
                            "kind": scenario["kind"],
                            "variant": scenario["variant"],
                            "viewport": scenario["viewport"],
                            "stress": scenario.get("stress"),
                            "status": "FAIL",
                            "error": f"{type(error).__name__}: {error}",
                            "fixtureChecksumSha256": fixture_checksum,
                        })
                        print(f"FAIL {scenario['id']}: {type(error).__name__}: {error}", flush=True)
            finally:
                browser.close()
    finally:
        stop_process(server)
        if server_log is not None:
            server_log.close()
        result_path, checksum_path = write_results(output, manifest, results)

    passed = sum(result["status"] == "PASS" for result in results)
    failed = len(results) - passed
    print(json.dumps({
        "status": "PASS" if failed == 0 else "FAIL",
        "passed": passed,
        "failed": failed,
        "corePassed": sum(result["status"] == "PASS" and result["kind"] == "core" for result in results),
        "stressPassed": sum(result["status"] == "PASS" and result["kind"] == "stress" for result in results),
        "output": str(output),
        "results": str(result_path),
        "checksums": str(checksum_path),
    }, indent=2))
    return 0 if failed == 0 else 1


class HarnessContractTests(unittest.TestCase):
    """Fast contracts for safety and the browser scenario matrix."""

    def test_core_matrix_has_every_variant_at_phone_and_desktop(self) -> None:
        scenarios = build_scenario_matrix()
        core = [scenario for scenario in scenarios if scenario["kind"] == "core"]
        self.assertEqual(
            [(item["variant"], item["viewport"]) for item in core],
            [
                ("a", "desktop"),
                ("a", "phone"),
                ("b", "desktop"),
                ("b", "phone"),
                ("c", "desktop"),
                ("c", "phone"),
            ],
        )

    def test_stress_matrix_covers_every_required_mode_per_variant(self) -> None:
        scenarios = build_scenario_matrix()
        stress = [scenario for scenario in scenarios if scenario["kind"] == "stress"]
        self.assertEqual(len(stress), 12)
        for variant in "abc":
            self.assertEqual(
                {item["stress"] for item in stress if item["variant"] == variant},
                {"320-portrait", "phone-landscape", "tablet-768", "reduced-motion"},
            )

    def test_non_loopback_urls_are_rejected(self) -> None:
        for unsafe in (
            "https://example.com",
            "http://192.168.1.2:14774",
            "file:///tmp/index.html",
            "http://user:secret@127.0.0.1:14774",
        ):
            with self.subTest(url=unsafe), self.assertRaises(ValueError):
                assert_local_url(unsafe)

    def test_output_must_be_outside_repository(self) -> None:
        repository = Path(__file__).resolve().parents[1]
        with self.assertRaises(ValueError):
            assert_external_output(repository / "artifacts", repository)

    def test_owned_server_is_vite_transform_mode_with_watching_disabled(self) -> None:
        command = build_server_command("http://127.0.0.1:14774")
        self.assertEqual(command[:3], ["node", "--input-type=module", "--eval"])
        self.assertIn("watch: null", command[3])
        self.assertNotIn('"preview"', command)

    def test_only_known_non_data_external_resources_receive_local_stubs(self) -> None:
        self.assertEqual(classify_external_url("https://fonts.googleapis.com/css2?family=Onest"), "font-css")
        self.assertEqual(classify_external_url("https://va.vercel-scripts.com/v1/script.debug.js"), "telemetry-script")
        self.assertIsNone(classify_external_url("https://example.com/api/planner"))

    def test_loopback_readiness_redirect_to_external_is_never_followed(self) -> None:
        requests = []

        class RedirectHandler(BaseHTTPRequestHandler):
            def do_GET(self) -> None:
                requests.append(self.path)
                self.send_response(302)
                self.send_header("Location", "https://example.com/should-not-be-requested")
                self.end_headers()

            def log_message(self, _format: str, *_args) -> None:
                return

        server = ThreadingHTTPServer(("127.0.0.1", 0), RedirectHandler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            probe = probe_server_once(f"http://127.0.0.1:{server.server_port}/")
        finally:
            server.shutdown()
            server.server_close()
            thread.join(timeout=2)

        self.assertFalse(probe["ready"])
        self.assertEqual(probe["blockedRedirect"], "https://example.com/should-not-be-requested")
        self.assertEqual(requests, ["/"])

    def test_expected_request_classification_is_get_only(self) -> None:
        origin = "127.0.0.1:14774"
        cases = [
            ("GET", "https://fonts.googleapis.com/css2?family=Onest", "font-css"),
            ("POST", "https://fonts.googleapis.com/css2?family=Onest", None),
            ("GET", "https://va.vercel-scripts.com/v1/script.debug.js", "telemetry-script"),
            ("PUT", "https://va.vercel-scripts.com/v1/script.debug.js", None),
            ("GET", f"http://{origin}/api/health", "health"),
            ("POST", f"http://{origin}/api/health", None),
        ]
        for method, url, expected in cases:
            with self.subTest(method=method, url=url):
                self.assertEqual(classify_expected_request(method, url, origin), expected)

    def test_late_event_causes_finalization_failure(self) -> None:
        result = {
            "kind": "stress",
            "runtimeErrors": [],
            "consoleErrors": ["late console error"],
            "unexpectedRequests": [],
            "apiRequests": [
                {"method": "GET", "procedure": "auth.me"},
                {"method": "GET", "procedure": "auth.workspace"},
            ],
            "measurements": [],
        }
        with self.assertRaises(AssertionError):
            finalize_scenario_result(result)

    def test_any_undersized_actionable_target_causes_finalization_failure(self) -> None:
        result = {
            "kind": "stress",
            "viewport": "desktop",
            "runtimeErrors": [],
            "consoleErrors": [],
            "unexpectedRequests": [],
            "apiRequests": [
                {"method": "GET", "procedure": "auth.me"},
                {"method": "GET", "procedure": "auth.workspace"},
            ],
            "measurements": [
                {
                    "undersizedTargets": [{"label": "Example", "width": 43.99, "height": 44}],
                    "undersizedText": [],
                    "contrasts": [],
                }
            ],
        }
        with self.assertRaises(AssertionError):
            finalize_scenario_result(result)

    def test_core_density_coverage_requires_every_view_in_both_densities(self) -> None:
        comfortable_only = [
            {"view": view, "density": "comfortable"}
            for view in ("today", "tasks", "roadmap", "settings")
        ]
        with self.assertRaises(AssertionError):
            assert_core_density_coverage(comfortable_only)

    def test_phone_visual_screenshots_reset_content_views_but_not_final_settings(self) -> None:
        self.assertTrue(screenshot_requires_top("today"))
        self.assertTrue(screenshot_requires_top("tasks"))
        self.assertTrue(screenshot_requires_top("roadmap"))
        self.assertFalse(screenshot_requires_top("settings-final"))
        self.assertIn('scrollBehavior = "auto"', reset_scroll_container_script())
        self.assertIn('behavior: "instant"', reset_scroll_container_script())

    def test_settings_state_contract_lists_every_required_sample(self) -> None:
        self.assertEqual(
            required_settings_state_testids(),
            (
                "state-loading",
                "state-error",
                "state-conflict",
                "state-disabled",
                "state-saved-locally",
                "state-unsupported-offline",
            ),
        )


def run_self_tests() -> int:
    suite = unittest.defaultTestLoader.loadTestsFromTestCase(HarnessContractTests)
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    return 0 if result.wasSuccessful() else 1


if __name__ == "__main__":
    if "--self-test" in sys.argv:
        raise SystemExit(run_self_tests())
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default="http://127.0.0.1:14774")
    parser.add_argument("--output", type=Path)
    parser.add_argument(
        "--start-server",
        action="store_true",
        help="Own a dedicated no-watch Vite preview server and terminate it after the run.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate safety/prerequisites and print the scenario matrix without opening a browser.",
    )
    parsed_args = parser.parse_args()
    try:
        raise SystemExit(validate(parsed_args))
    except (ValueError, RuntimeError) as error:
        parser.error(str(error))
