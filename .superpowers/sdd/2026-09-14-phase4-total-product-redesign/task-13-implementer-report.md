# Task 13 implementation and release gate

Status: code complete on `dev/personal-calendar-workbench`; independent Sol 6 High review PASS. Commits: `98137cf`, `60adc34`, `68b550c`, `0b7f219`, `a0ec67d`. No live migration, database write, or `main` merge.

## Contract

- `planner.recovery.resolve` records Done, Reschedule, Reduce, Pause, and Abandon with owned references, exact versions, operation-id idempotency, immutable resolution evidence, and one transaction. Insert/update failure rolls back the entire decision. Due dates and parent recurrence rules are preserved unless a separate explicit task edit changes them.
- A recurring occurrence is resolved alone, never the parent series. Additive `0005_carried_commitments.sql` gives moved work a distinct carry ID, so a natural occurrence and multiple carries can coexist on one date. A subsequent decision targets the exact carry/version; Reduce stores the successor scope, Done/Abandon affect only that carry, and Pause stays manually actionable while the latest versioned return date controls automatic resurfacing.
- Generic task/Focus outcome paths cannot bypass outstanding-history safeguards. On a database with `0004`, legacy daily-plan outcomes either delegate to immutable recovery or refuse unsupported shortcuts. Pre-`0004` paths remain compatible. Compound recovery is not added to the offline task queue.
- Today and the recovery projection expose each carry by its own identity, including overdue work, without task/date deduplication. The full interactive Recovery UI and accountability preference belong to Task 14.

## Verification

- Final local `npm test`: 82 files, 513 passed, 3 expected skips. `npm run check`, `npm run build`, and offline PostgreSQL Drizzle generation (`No schema changes`) passed.
- Isolated PGlite tests cover baseline/pre-`0004`, `0004`-only, and `0004`+`0005`; migration SQL/schema/meta parity; owner/version conflicts; idempotent retry and changed-payload rejection; hard prerequisites; final-task guard; recurring and same-day identity; multiple carries; pause-repeat ordering; and forced rollback.
- Independent Sol 6 High review of the final `a0ec67d` diff passed. Local/synthetic checks are not live Supabase or physical-iPhone verification.

## Migration and rollback gate

`0004` SHA-256 remains `a685febea7ea56aaedc5e179dcbb7d47566da9a7be00a2339c820677496bb12b`. `0005` SHA-256 is `dfe2833646f865fb4267f370ebaa1d6ec66f73a666f6cb62fb568662bf0e571c`. Both are additive and unapplied live. The `0004` default controller remains not ready to apply; `0005` has no guarded live apply controller. Read-only live inventory, strict-TLS CA, restore-tested backup, exact target/hash approval, and a deployment/rollback plan are still required. After carry rows exist, a pre-`0005` reader cannot be used as a simple code rollback because it would hide unfinished carries; use a compatible reader or data-preserving conversion. Never delete resolution/carry history to roll back.

## Next

Task 14 supplies the resumable Recovery UI and accountability settings, then Tasks 15-22 continue the whole-app UI/UX redesign. Branch push/Preview inspection is separate from the live migration gate.
