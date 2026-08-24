# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The primary user is the workspace owner, using one board to coordinate personal life and work. They need to decide what deserves attention today while keeping projects, long-term goals, habits, calendar commitments, and review insights visible without losing the distinction between them.

## Product Purpose

Personal Calander makes comprehensive planning feel low-friction. It supports an equal balance between a prioritized task list and time-based calendar planning, then makes the result understandable through goal progress, workload, habit, and completion visualizations.

## Positioning

The workspace is a personal operating system, not merely a to-do list or calendar. Its defining mechanism is that a single source of planning truth renders deliberately different daily, weekly, monthly, quarterly, and yearly perspectives while explaining how daily actions support outcomes.

## Operating Context

The daily flow starts with quick capture, intentional prioritization, and placement of realistically achievable work. A person can then move through calendar, projects, goals, habits, and structured reviews without leaving the workspace. The initial release is single-user and guest-scoped; external services, phone notifications, and provider connections will be considered only after the completed core workspace is delivered.

## Capabilities and Constraints

The core product includes goals, projects, tasks, subtasks, dependencies, recurring tasks, habits, daily check-ins, calendar planning, saved views, analytics, reviews, reminders, optional AI-confirmed drafts, and responsive accessible interaction. Authentication is explicitly out of scope for the first release, but every planning record is isolated by a stable workspace identifier to support a later authenticated migration. The integration adapter boundary is retained, but active third-party connections and phone notifications are deferred.

## Brand Commitments

The user requires a premium, expensive-feeling, smooth, and polished experience. The approved direction is a quiet, technically precise planning studio with restrained color, rich but purposeful visualizations, and no generic or templated dashboard treatment.

## Evidence on Hand

The repository contains cited market research in `docs/MARKET_RESEARCH.md`, implementation contracts in `docs/ARCHITECTURE.md`, and a full planning schema in `drizzle/schema.ts`. There are no customer testimonials, external brand assets, verified performance claims, or real planning data to display; the product must not fabricate them.

## Product Principles

1. **Daily clarity and long-term direction coexist.** A person can make a confident decision about now while seeing the goal or project context behind it.
2. **Dates are meaningful contracts.** Due dates, scheduled dates, and timeblocks are separate because they answer different planning questions.
3. **Recovery is part of planning.** Misses, skips, reschedules, and conflicts are first-class states, not hidden failures.
4. **The core remains sovereign.** External information can inform the plan but cannot silently take control of personal tasks, goals, or habits.
5. **Visual polish serves comprehension.** Every visual cue, interaction, and animation must make a planning decision faster, clearer, or more reassuring.

## Accessibility & Inclusion

The workspace must be keyboard navigable, legible at varied viewport sizes, compatible with reduced-motion preferences, explicit beyond color alone, and usable with screen readers through semantic names, text alternatives, focus management, and status feedback.
