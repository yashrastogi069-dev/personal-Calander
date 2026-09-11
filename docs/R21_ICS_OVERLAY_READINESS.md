# R21 ICS Overlay Readiness

## Delivered boundary

The application now recognises the presence of `PERSONAL_CALENDAR_ICS_OVERLAY_URL` **only on the server**. The workspace snapshot returns a small status object—`unconfigured`, `ready`, or `invalid`—with a generic label and recovery message. It never returns the configured URL, host path, token, raw calendar text, or source payload.

The supported configuration shape is a **HTTPS Google Calendar ICS address** on `calendar.google.com`, with no username, password, or explicit port and an `.ics` path. Invalid, unconfigured, or unsupported values leave the planner local and show clear unavailable status. The Calendar execution grid uses the same secret-safe status when no imported busy event is present.

## Parser contract and security constraints

`shared/icsOverlay.ts` provides a bounded, pure read-only parser for non-recurring `VEVENT` busy context. It caps input at 1.5 MB and 500 events, unfolds standard ICS lines, accepts UTC/all-day or valid-IANA floating timestamps, ignores cancelled/repeating/malformed records, normalises title data, and returns no raw event payload. It does not fetch a feed, persist a URL, make an external calendar writable, or alter a task.

> **Activation remains intentionally deferred.** An actual server-side refresh must first be explicitly authorised and configured. It must resolve and validate public destination addresses on every connection/redirect, enforce the approved host allowlist, use a bounded timeout and response size, prevent DNS rebinding, upsert only normalised busy events, and return generic status/error information. No browser-side URL input, direct client fetch, OAuth start, external write, polling loop, cron job, or hidden sync has been added.

## Visible state

The dedicated Connections surface now distinguishes a secure ICS route from the separate optional OAuth route, explains the read-only task boundary, and disables refresh honestly while no validated server-side activation exists. Browser verification at phone width showed no source address or token in rendered text. The automated suite covers configuration validation plus UTC, all-day, cancelled, repeated, malformed, and bounded parser cases.
