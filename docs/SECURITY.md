# Security and data safety

## Identity and access

The current planner uses Supabase bearer authentication and a server-owned workspace association. Protected tRPC procedures verify that the signed-in user owns the requested workspace before reading or changing planner data. Workspace IDs in requests are scope selectors, not proof of access. See [API](backend/API.md) and [database](backend/DATABASE.md).

The signed-out browser hides the account-scoped offline planner cache rather than deleting it. Confirmed deletion is a separate operation. The app must not show one account's cached workspace to another account.

## Planner integrity

Mutable records use version checks where supported. A stale write becomes a conflict that can be reviewed; it must not silently replace newer data. Offline task operations use durable queue/replay and retain unresolved or orphaned work until an explicit user decision. Archive is reversible for tasks, goals, projects, and habits; category deletion is separately confirmed and removes the label while retaining linked planner history.

Existing workspace IDs, record IDs, history, and populated tables are real. Never reset the database or replay a baseline. Apply additive migrations only through the reviewed guard described in [the handoff](INDEPENDENT_STACK_HANDOFF.md), after strict-TLS inventory, restore-tested backup, exact target/hash review, and separate owner approval. Do not bypass certificate validation to make a live audit pass.

Known implementation risk: `server/db.ts` currently configures its PostgreSQL pool with `rejectUnauthorized: false`. This is not equivalent to a verified server certificate. The separate strict-TLS live inventory failed with `SELF_SIGNED_CERT_IN_CHAIN`; certificate trust and the live audit remain unresolved. Do not cite runtime connectivity as proof that the migration target has been securely verified.

## Secrets, files, and integrations

Keep environment values and service keys out of Git, screenshots, logs, and documentation. Vercel and local runtime secrets are different surfaces; verify names without printing values. Private file storage migration remains deferred. Calendar feed tokens are private bearer-style links and should be revocable. Push permission and a saved subscription do not by themselves prove that a notification arrived on an iPhone.

Treat external calendar and future email connections as scoped adapters. Imported records must never overwrite core planner records by identity guesswork, and provider permissions should request only the access needed for the stated feature.

## Reporting a vulnerability

Do not put credentials or personal planner data in an issue. Reproduce with an isolated account/workspace and share the affected route, expected and actual behavior, and redacted request metadata through a private channel to the repository owner.
