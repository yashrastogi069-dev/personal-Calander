# Web Push and iPhone Activation Runbook

**Status:** The application now has an installable manifest, service worker, explicit device opt-in, secure subscription persistence, local/browser plus server-side opt-out, subscription-refresh messaging, audited manual test delivery, and terminal-expiration handling. VAPID values are configured through secure secrets only. **Automatic daily or weekly sends are not enabled**: they require the person’s explicit cadence and local-time approval, an idempotent scheduled outbox, and separate production verification.

> **Important:** Browser permission is not delivery. A device must be installed and subscribed, the subscription must be stored, and a server must sign and send a Web Push request before a reminder can reach the phone.

## 1. Generate one VAPID key pair

Run the following command only on a machine you control. It creates one long-lived application identity, not a key pair per user or per device.

```bash
npx --yes web-push generate-vapid-keys --json
```

It returns a **public key** and a **private key**. Choose the third value, the VAPID subject, as a contact URI such as `mailto:you@example.com`. Keep the private key in a password manager or encrypted secret store. Never commit it, paste it into client code, or send it in an issue, chat log, or calendar feed.

| Value | Where it belongs | Exposure rule |
| --- | --- | --- |
| `VITE_VAPID_PUBLIC_KEY` | Vercel environment variable and client build | Safe to expose to the browser; it is passed to `PushManager.subscribe()`.
| `VAPID_PRIVATE_KEY` | Vercel environment variable only | Server secret; never use the `VITE_` prefix and never commit it.
| `VAPID_SUBJECT` | Vercel environment variable only | A contact URI such as `mailto:you@example.com` or your HTTPS URL.

VAPID’s public and private keys authenticate the application server. The browser associates the public key with its subscription; the server proves it owns the matching private key when it sends a push request.[1]

## 2. Add the values to Vercel

When the keys are available, supply them through the project’s secure secret-entry prompt. They will then be added to **Vercel → the Personal Calander project → Settings → Environment Variables** for **Production** and **Preview** without recording the private key in the repository. Add `VITE_VAPID_PUBLIC_KEY` before the build because Vite embeds `VITE_` variables at build time. Add the private key and subject as server-only values. Then redeploy the newest GitHub commit.

The planner also needs its production database connection as `DATABASE_URL`. It must point to the same type of MySQL-compatible database used in development and include TLS parameters required by that provider. Do not run the local global migration command against production because this project’s baseline database history was created manually; apply only reviewed, targeted SQL migrations.

## 3. Install the app on iPhone before asking for permission

On an iPhone running **iOS 16.4 or newer**, open the public HTTPS site in Safari, tap **Share**, choose **Add to Home Screen**, and open the new Personal Calander icon from the Home Screen. The manifest must remain reachable and its `display` mode must remain `standalone`. Apple supports Web Push for Home Screen web apps using the web standards; an Apple Developer Program membership is not required.[2] [3]

In the installed app, tap **Allow notifications on this device**. Permission must be requested from a direct user gesture. The app must then subscribe with the public VAPID key and send the returned endpoint plus encryption keys to the backend. Apple requires user-initiated permission and subscription, and Safari can revoke permission if pushes arrive without immediately presenting a visible notification.[2]

## 4. Implemented device and test-delivery flow

The device-control action is a direct user gesture. It requests permission, waits for the registered worker, subscribes with `registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })`, and stores the returned endpoint plus `p256dh` and `auth` keys through the workspace-scoped API. The browser only receives `VITE_VAPID_PUBLIC_KEY`; the private key is neither delivered to nor logged by the client.

The service worker always displays a visible notification and returns the person to the planner after a tap. It handles `pushsubscriptionchange` by creating a replacement subscription where possible and messaging an active client to upsert it. If no client is open, the next opt-in/reconciliation in the app safely restores the subscription; the worker does not store a workspace identifier or attempt an unauthenticated background write.

The backend uses `web-push` with the server-only VAPID details, writes a queued delivery audit record, sends only a short visible test payload, then records its provider outcome. A `404` or `410` response marks just that subscription expired and prompts re-enablement; it does not retry forever. Opt-out first calls `PushSubscription.unsubscribe()` on the current browser and then marks the associated saved device disabled. Each endpoint is a capability URL and is treated as sensitive.[1]

> **iPhone boundary:** The supported web experience is an installed Home Screen PWA for visible Web Push plus the private, revocable read-only Calendar subscription for schedule visibility. This browser app does **not** claim direct Apple Reminders synchronization. Apple’s documented Reminders modifications require native EventKit authorization in a native app; a possible iOS companion remains a future, separately approved integration.

## 5. Choose how reminders run

The planner’s daily and weekly reminders are deterministic. The sending job should run independently of an open browser, but it must remain user-controlled and write an idempotent outbox record before delivery. Push is asynchronous and resource-constrained, so it is not a guaranteed deadline engine or a replacement for an active in-app channel; reminder payloads should be concise, non-sensitive, and deduplicated.[5]

| Approach | What it does | Tradeoffs | Cost and setup |
| --- | --- | --- | --- |
| **Scheduled server endpoint** | A protected time-triggered endpoint evaluates due reminders and sends only to stored subscriptions. | Best fit for predictable daily and weekly planning reminders; must account for timezone, retries, and duplicate prevention. | A small amount of configuration; usually the lightest production path.
| **Managed background worker** | A persistent worker processes an outbox and retries failed sends. | Better for high volume, near-real-time events, or robust retry queues; more infrastructure than a personal planner needs initially. | Higher operating cost and setup complexity.
| **Manual “test reminder” only** | The app sends a user-triggered test notification after subscription. | Proves keys, installation, permission, and delivery without automatic reminders. | Lowest-risk first step; no recurring automation.

The recommended order is **manual test notification first**, then one daily-plan reminder and one weekly-review reminder. Do not enable a high-frequency schedule before those two flows are confirmed on the actual iPhone.

## 6. Test the full delivery chain

Use this exact order after deployment: first confirm the manifest and service worker are present; install to the iPhone Home Screen; grant permission inside the installed app; create a subscription; press **Send test notification**; lock the phone; and verify a visible notification. Then test opt-out, revoke the device permission in iOS Settings, simulate or observe a subscription refresh, and verify that a rejected or expired endpoint is marked disabled rather than retried forever.

Apple’s push service returns status codes that should control recovery: `201` means accepted; `410` means the device token expired; `403` often indicates a VAPID authentication error; `413` means the payload is too large; and `429` requires backoff.[2]

## References

[1] [MDN: Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)

[2] [Apple: Sending web push notifications in web apps and browsers](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers)

[3] [WebKit: Web Push for Web Apps on iOS and iPadOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)

[4] [web.dev: Push notifications overview](https://web.dev/articles/push-notifications-overview)

[5] [W3C: Push API](https://www.w3.org/TR/push-api/)
