# UX restructure interview log

Method: `grill-me`. One question per turn, each with a recommended answer. Codebase facts are settled before asking. Go depth-first, one page at a time. Record every question here, in order, as:

`Q<n> [page/branch]`: question · **Recommended:** … · **Owner:** … (date) · **Locked decision:** …

Copy locked decisions into `docs/DECISIONS.md` as well.

## Order of pages
1. Tasks: Board, List, Inbox, Saved views, Archived
2. Today
3. Calendar
4. Plan: daily and weekly
5. Roadmap
6. Goals & Projects
7. Habits
8. Review and Analytics
9. Navigation and More, Settings

## Log
Inputs: `01-structure-map.md` (Opus, 40 surfaces) and `02-competitor-patterns.md` (Opus, 76 images).

**Q1 [Tasks › Inbox]**
- **Question:** what should the Inbox mean? Today it mixes new thoughts with dated tasks: 6 of the 9 demo Inbox tasks have deadlines, one overdue since Oct 14.
- **Recommended:** undecided only.
- **Owner (2026-10-15):** "Undecided only".
- **Locked decision:**
  - A task waits in the Inbox only until ONE decision is made: a date, a project or Someday. Then it leaves automatically. Dated tasks never sit in the Inbox.
  - The Inbox becomes a short to-sort pile with a premium triage card: Today / This week / Pick date / Project / Someday / Delete.
  - The goal is an empty Inbox. Notifications never go there.
