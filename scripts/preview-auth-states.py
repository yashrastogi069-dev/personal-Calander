"""Offline browser preview. Intercepts auth modules/APIs; never uses real accounts."""
import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import subprocess
import sys
from urllib.parse import unquote, urlparse
from playwright.sync_api import sync_playwright, expect

USER = {"id": 1, "authUserId": "11111111-1111-4111-8111-111111111111", "name": "Preview account", "email": "preview@example.invalid", "role": "user"}
WORKSPACE = {"id": "preview-workspace-0001", "ownerUserId": 1, "name": "Preview planner", "timezone": "UTC", "dailyCapacityMinutes": 360, "weekStartsOn": 1, "planningDayStartsAt": "06:00", "workdayStartsAt": "09:00", "workdayEndsAt": "17:00", "defaultBreakMinutes": 30, "preferredShutdownAt": "17:30", "version": 1}
SIZES = {"desktop": {"width": 1440, "height": 1000}, "phone": {"width": 390, "height": 844}}
DEFAULT_OUTPUT = Path.home() / "personal-Calander-analysis"

def install_preview(context, url, state, fixtures=None):
    """Intercept every API and remote request, including module-level session setup."""
    requests, unexpected = [], []
    origin = urlparse(url).netloc
    session = None if state == "signed-out" else {"access_token": "offline-preview-token", "user": {"id": USER["authUserId"]}}
    module = """
let session = SESSION;
let callback = () => {};
export const supabase = {auth: {
  getSession: async () => ({data: {session}, error: null}),
  onAuthStateChange: fn => { callback = fn; queueMicrotask(() => fn('INITIAL_SESSION', session)); return {data: {subscription: {unsubscribe() {}}}}; },
  signOut: async () => { session = null; callback('SIGNED_OUT', null); return {error: null}; },
  signInWithOAuth: async () => ({data: {}, error: {message: 'Offline preview does not contact Google'}}),
  signInWithPassword: async () => ({data: {}, error: {message: 'Offline preview does not authenticate real accounts'}}),
  signUp: async () => ({data: {}, error: {message: 'Offline preview does not create accounts'}})
}};
export const requireSupabaseClient = () => supabase;
""".replace("SESSION", json.dumps(session))

    def intercept(route):
        parsed = urlparse(route.request.url)
        if parsed.netloc != origin:
            route.fulfill(status=200, content_type="application/javascript", body="")
            return
        if parsed.path == "/src/lib/supabase.ts":
            route.fulfill(status=200, content_type="application/javascript", body=module)
            return
        if parsed.path.startswith("/api/trpc/"):
            procedures = unquote(parsed.path.removeprefix("/api/trpc/")).split(",")
            response = []
            for procedure in procedures:
                requests.append(procedure)
                error = (state == "auth-error" and procedure == "auth.me") or (state == "workspace-error" and procedure == "auth.workspace")
                if error:
                    response.append({"error": {"json": {"message": "Simulated service failure", "code": -32603, "data": {"code": "INTERNAL_SERVER_ERROR", "httpStatus": 500, "path": procedure}}}})
                else:
                    if procedure == "auth.me": data = USER if session else None
                    elif procedure == "auth.workspace": data = None if state == "unlinked" else WORKSPACE
                    elif fixtures is not None and procedure in fixtures: data = fixtures[procedure]
                    else:
                        unexpected.append(procedure)
                        data = None
                    response.append({"result": {"data": {"json": data}}})
            route.fulfill(status=200, content_type="application/json", body=json.dumps(response))
            return
        if parsed.path == "/api/health":
            route.fulfill(status=200, content_type="application/json", body='{"ok":true}')
            return
        if parsed.path.startswith("/api/") or parsed.path.startswith("/_vercel/"):
            unexpected.append(parsed.path)
            route.fulfill(status=404, content_type="application/json", body="{}")
            return
        route.continue_()
    context.route("**/*", intercept)
    return requests, unexpected

def new_page(browser, size):
    context = browser.new_context(viewport=SIZES[size], device_scale_factor=1, color_scheme="dark", timezone_id="UTC", service_workers="block")
    page = context.new_page()
    page.clock.set_fixed_time(datetime(2026, 9, 6, 9, 0, tzinfo=timezone.utc))
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    return context, page, errors

def assert_layout(page, errors):
    # Vite's development-only HMR socket can close during a short headless
    # snapshot. It is not part of the application runtime.
    errors[:] = [error for error in errors if error != "WebSocket closed without opened."]
    assert not errors, errors
    assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth"), "Horizontal overflow"

def run_auth_preview(url, output):
    output.mkdir(parents=True, exist_ok=True)
    results = []
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        try:
            for size in SIZES:
                for state in ["signed-out", "auth-error", "unlinked", "workspace-error"]:
                    context, page, errors = new_page(browser, size)
                    requests, unexpected = install_preview(context, url, state)
                    page.goto(url, wait_until="networkidle")
                    if state == "signed-out":
                        expect(page.get_by_role("button", name="Continue with Google")).to_be_visible(timeout=20_000)
                        expect(page.get_by_label("Email", exact=True)).to_be_visible()
                        expect(page.get_by_label("Password", exact=True)).to_be_visible()
                    else:
                        headings = {"auth-error": "Your account could not load", "unlinked": "Your workspace is waiting to be connected", "workspace-error": "Your workspace could not load"}
                        expect(page.get_by_role("heading", name=headings[state])).to_be_visible(timeout=20_000)
                        expect(page.get_by_role("button", name="Sign out", exact=True)).to_be_visible()
                    assert not any(name.startswith("planner.") for name in requests), requests
                    assert not unexpected, unexpected
                    assert_layout(page, errors)
                    path = output / f"preview-{state}-{size}.png"
                    page.screenshot(path=str(path), full_page=True)
                    context.close()
                    errors[:] = [error for error in errors if error != "WebSocket closed without opened."]
                    assert not errors, errors
                    results.append({"state": state, "size": size, "screenshot": str(path), "requests": requests, "runtimeErrors": list(errors)})
        finally: browser.close()
    (output / "preview-auth-results.json").write_text(json.dumps(results, indent=2), encoding="utf8")
    print(json.dumps({"auth_states_passed": len(results), "output": str(output)}))

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default="http://localhost:14773")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--with-linked", action="store_true")
    args = parser.parse_args()
    if urlparse(args.url).hostname not in ["localhost", "127.0.0.1"]:
        parser.error("Only local preview servers are allowed")
    run_auth_preview(args.url, args.output)
    if args.with_linked:
        subprocess.run([sys.executable, str(Path(__file__).with_name("preview-linked-planner.py")), "--url", args.url, "--output", str(args.output)], check=True)

if __name__ == "__main__": main()
