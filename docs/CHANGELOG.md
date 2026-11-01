# Changelog

## 0.3.5 — 2026-11-01

Added a collapsed Instructions section beneath the panel title with Excel layout, direct-run behavior, results, scrolling, Stop and automatic downloads. Processing logic unchanged.

## 0.3.4 — 2026-11-01

Report follows new output only when already at the bottom. Scrolling up preserves the reading position; returning fully to the bottom resumes following. Added four scrolling regression checks; 34 offline checks pass.

## 0.3.3 — 2026-11-01

Removed manual export button. Every completed, failed or stopped run automatically downloads compact results with a UTC timestamp including milliseconds. 30 offline checks passed, including one timestamped download per browser run.

## 0.3.2 — 2026-11-01

Compact name/number/function report with inline update/skip/failure results. Removed dates, times, metadata and totals. Detect visible portal employees absent from the imported rota. Require a matching NXU7 assignment read before reporting updated; HTTP 200 alone is insufficient. 29 offline checks passed.

## 0.3.1 — 2026-11-01

Fixed conflicting-role import failure by retaining every valid employee row in Excel order, matching Python. Removed obsolete paste parser. Added four duplicate-row regression checks; 28 checks pass.

## 0.3.0 — 2026-11-01

Replaced preview/apply with immediate Run matching Python flow. Log every segment, names, station, times, tracking, IDs, changes and failures. Retain employees without roles for reporting. Fix write responses incorrectly requiring a segment report. Simplify the visible form. 24 tests cover the revised workflow including browser response regressions.

## 0.2.1 — 2026-11-01

Fixed import to detect Employee ID headers rather than require a fixed row. Skip incomplete rows with counts, preserve Excel row diagnostics, and explain absent H roles. Replaced oversized floating chevron with the portal’s native breadcrumb list item. Removed Sandbox from script metadata/panel. 36 offline checks passed; live alignment remains pending.

## 0.2.0 — 2026-11-01

Replaced paste input with local .xlsx/.xls file import and worksheet selection. Added pinned SheetJS 0.20.3 dependency. Added a breadcrumb-style navigation launcher with a hidden-by-default panel, close/Escape support and top fallback. Imported worksheet/date changes invalidate the plan. Added import size/row limits and disabled import controls during runs. Expanded offline regression suite to 31 checks; real-file, visual and live validation pending.

## 0.1.0 — 2026-11-01

Initial sandbox browser port of Python v2.1.0. Added Excel paste, validated role mapping, preview and confirmation, duplicate suppression, stale segment check, sequential writes, post-write verification, Stop and log export. Fixed selected-date end bounds and seasonal offsets. Added 21 offline checks, manual regression steps and implementation notes. Live validation pending.
