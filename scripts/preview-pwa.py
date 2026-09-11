"""Verify the production PWA shell, offline recovery, and controlled upgrades.

The target must be a local static server rooted at dist/public. The script never
uses a real account and only modifies the generated dist/public/sw.js long enough
to force a browser update check; the original bytes are restored in finally.
"""

import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import Error as PlaywrightError
from playwright.sync_api import expect, sync_playwright


SIZES = {
    "desktop": {"width": 1440, "height": 1000},
    "phone": {"width": 390, "height": 844},
}
OWNED_CACHE_PREFIX = "personal-calander-"
SENTINEL_CACHE = "preview-unrelated-cache"


def assert_local_target(url: str) -> None:
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https") or parsed.hostname not in ("localhost", "127.0.0.1"):
        raise ValueError("Only local HTTP preview servers are allowed")


def attach_observers(page):
    errors = []
    console_errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.on(
        "console",
        lambda message: console_errors.append(message.text)
        if message.type == "error" and "favicon" not in message.text.lower()
        else None,
    )
    return errors, console_errors


def fulfill_health(context):
    context.route(
        "**/api/health",
        lambda route: route.fulfill(status=200, content_type="application/json", body='{"ok":true}'),
    )
    context.route(
        "**/_vercel/**",
        lambda route: route.fulfill(status=204, body=""),
    )


def wait_for_control(page):
    page.wait_for_function(
        """async () => {
          const registration = await navigator.serviceWorker.getRegistration('/');
          return Boolean(registration?.active);
        }""",
        timeout=20_000,
    )
    if not page.evaluate("Boolean(navigator.serviceWorker.controller)"):
        page.reload(wait_until="networkidle")
    page.wait_for_function("Boolean(navigator.serviceWorker.controller)", timeout=20_000)


def cache_evidence(page):
    return page.evaluate(
        """async prefix => {
          const names = await caches.keys();
          const owned = names.filter(name => name.startsWith(prefix));
          const entries = [];
          for (const name of owned) {
            const cache = await caches.open(name);
            for (const request of await cache.keys()) entries.push(request.url);
          }
          return {names, owned, entries};
        }""",
        OWNED_CACHE_PREFIX,
    )


def assert_public_cache(evidence):
    assert evidence["owned"], "No repository-owned PWA cache was created"
    private = [url for url in evidence["entries"] if "/api/" in url or "supabase" in url.lower()]
    assert not private, f"Private/API URLs reached Cache Storage: {private}"


def assert_layout(page, width):
    metrics = page.evaluate(
        """() => ({
          viewport: window.innerWidth,
          document: document.documentElement.scrollWidth,
          body: document.body.scrollWidth
        })"""
    )
    assert metrics["viewport"] == width, metrics
    assert metrics["document"] <= width and metrics["body"] <= width, metrics
    return metrics


def verify_offline_relaunch(browser, url, output, size_name, size):
    context = browser.new_context(
        viewport=size,
        color_scheme="dark",
        service_workers="allow",
        timezone_id="UTC",
    )
    fulfill_health(context)
    page = context.new_page()
    page.clock.set_fixed_time(datetime(2026, 9, 12, 9, 0, tzinfo=timezone.utc))
    errors, console_errors = attach_observers(page)
    page.goto(url, wait_until="networkidle")
    expect(page.get_by_role("button", name="Continue with Google")).to_be_visible(timeout=20_000)
    wait_for_control(page)
    online_cache = cache_evidence(page)
    assert_public_cache(online_cache)
    online_layout = assert_layout(page, size["width"])

    context.set_offline(True)
    page.reload(wait_until="domcontentloaded")
    expect(page.get_by_role("button", name="Continue with Google")).to_be_visible(timeout=20_000)
    expect(page.get_by_text("You’re offline", exact=True)).to_be_visible(timeout=10_000)
    offline_layout = assert_layout(page, size["width"])
    screenshot = output / f"pwa-offline-relaunch-{size_name}.png"
    page.screenshot(path=str(screenshot), full_page=True)
    context.set_offline(False)
    expected_network_errors = [error for error in console_errors if "ERR_INTERNET_DISCONNECTED" in error]
    console_errors[:] = [error for error in console_errors if "ERR_INTERNET_DISCONNECTED" not in error]
    assert not errors, errors
    assert not console_errors, console_errors
    context.close()
    return {
        "scenario": "cached-offline-relaunch",
        "size": size_name,
        "cache": online_cache,
        "onlineLayout": online_layout,
        "offlineLayout": offline_layout,
        "screenshot": str(screenshot),
        "runtimeErrors": errors,
        "consoleErrors": console_errors,
        "expectedOfflineNetworkErrors": expected_network_errors,
    }


def verify_cold_offline(browser, url):
    context = browser.new_context(service_workers="allow")
    context.set_offline(True)
    page = context.new_page()
    failed_as_expected = False
    error_text = ""
    try:
        page.goto(url, wait_until="domcontentloaded", timeout=8_000)
    except PlaywrightError as error:
        failed_as_expected = True
        error_text = str(error).splitlines()[0]
    finally:
        context.close()
    assert failed_as_expected, "A brand-new browser unexpectedly loaded without network or a prior cache"
    return {
        "scenario": "cold-offline-without-prior-cache",
        "expected": "browser network failure before an app service worker exists",
        "passed": True,
        "evidence": error_text,
    }


def verify_controlled_update(browser, url, output, worker_path):
    original = worker_path.read_bytes()
    context = browser.new_context(
        viewport=SIZES["phone"],
        color_scheme="dark",
        service_workers="allow",
        timezone_id="UTC",
    )
    fulfill_health(context)
    page = context.new_page()
    errors, console_errors = attach_observers(page)
    try:
        page.goto(url, wait_until="networkidle")
        wait_for_control(page)
        page.evaluate("name => caches.open(name).then(cache => cache.put('/sentinel', new Response('keep'))) ", SENTINEL_CACHE)

        worker_path.write_bytes(original + b"\n// preview update fixture\n")
        page.evaluate(
            """async () => {
              const registration = await navigator.serviceWorker.getRegistration('/');
              await registration.update();
            }"""
        )
        page.wait_for_function(
            """async () => Boolean((await navigator.serviceWorker.getRegistration('/'))?.waiting)""",
            timeout=20_000,
        )
        expect(page.get_by_role("button", name="Update now")).to_be_visible(timeout=10_000)
        ready_shot = output / "pwa-update-ready-phone.png"
        page.screenshot(path=str(ready_shot), full_page=True)

        page.get_by_role("button", name="Update now").click()
        page.wait_for_load_state("domcontentloaded")
        page.wait_for_function("Boolean(navigator.serviceWorker.controller)", timeout=20_000)
        cache_names = page.evaluate("caches.keys()")
        assert SENTINEL_CACHE in cache_names, cache_names
        assert len([name for name in cache_names if name.startswith(OWNED_CACHE_PREFIX) and "shell" in name]) == 1, cache_names
        assert_public_cache(cache_evidence(page))
        assert_layout(page, SIZES["phone"]["width"])
        assert not errors, errors
        assert not console_errors, console_errors
        return {
            "scenario": "waiting-update-explicit-activation",
            "screenshot": str(ready_shot),
            "cacheNamesAfterActivation": cache_names,
            "unrelatedCachePreserved": True,
            "runtimeErrors": errors,
            "consoleErrors": console_errors,
        }
    finally:
        worker_path.write_bytes(original)
        context.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default="http://127.0.0.1:14777")
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--worker", type=Path, default=Path("dist/public/sw.js"))
    args = parser.parse_args()
    assert_local_target(args.url)
    if not args.worker.is_file():
        parser.error(f"Generated service worker not found: {args.worker}")
    args.output.mkdir(parents=True, exist_ok=True)

    results = []
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        try:
            for size_name, size in SIZES.items():
                results.append(verify_offline_relaunch(browser, args.url, args.output, size_name, size))
            results.append(verify_cold_offline(browser, args.url))
            results.append(verify_controlled_update(browser, args.url, args.output, args.worker.resolve()))
        finally:
            browser.close()

    result_path = args.output / "preview-pwa-results.json"
    result_path.write_text(json.dumps(results, indent=2), encoding="utf8")
    print(json.dumps({"pwa_scenarios_passed": len(results), "evidence": str(result_path)}))


if __name__ == "__main__":
    main()
