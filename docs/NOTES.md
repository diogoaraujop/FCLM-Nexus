# Engineering notes

## Architecture

src/fclm-nexus.user.js is a self-contained userscript with a pinned SheetJS 0.20.3 @require. Browser code uses a Shadow DOM panel and a native li.fcpn-head-item launcher in #fcpn-breadcrumb ul.fcpn-head-container. A MutationObserver handles delayed insertion. The panel starts hidden.

Pure helpers and the asynchronous processor are exported under CommonJS when loaded by tests. Tests use only Node built-ins and mocks; no application runtime dependency installation is needed for the test suite.

## Processing contract

The endpoint is taken from the original Python implementation, not a publicly verified API contract:

    POST /ajax//employee/updatePPATimeSegment

Reads omit assignment fields and require report.functionSegments. Writes target NXU7 with oldWarehouseId DIG1. Empty or success-only HTTP 200 write responses are accepted, but explicit JSON errors are rejected. After a write, a fresh NXU7 report must contain the same start/end boundaries and desired process ID before the output says updated. HTTP 200 alone is insufficient.

Only processName === null is eligible, matching the original Python. Existing assigned functions and empty-string names are not overwritten. Every imported row is processed in order, including repeated IDs; each station read retrieves current data. No preview or confirmation step is added.

Calendar bounds use the selected date and following day. Europe/Dublin determines seasonal segment offsets. Browser fetch uses the current same-origin authenticated session; cookies are not extracted. Custom Python Referer/User-Agent headers, insecure TLS settings, executable update checks, VET integration and login bootstrap are not ported.

## Limits

Updates are sequential and nontransactional. No automatic rollback, cross-tab lock, conditional server write, or mutation retry exists. A retrieval/write race remains. Verification can be unconfirmed because of boundary normalization or eventual consistency; inspect before rerunning. Stop cannot undo already committed changes.

The launcher depends on the portal's native DOM. Browser-only Excel decoding and live service behavior need manual acceptance. Download destination is controlled by browser settings. Reports and workbooks are not persisted in browser storage; downloaded reports contain employee information. The public package excludes workbooks, reports, historical references, machine paths and user-specific diagnosis notes.

## Change discipline

Make a focused change, add meaningful regression coverage for affected behavior, run node tests/run.cjs, inspect the diff, and repeat affected browser acceptance cases. Update the metadata version and changelog for script changes. Preserve the previous accepted version for code rollback; data corrections use normal portal controls.

## Import error handling — v0.3.6

Invalid populated employee IDs and unsupported nonblank roles are skipped without blocking valid rows. The loaded-row status shows the skipped error count. Each error includes its physical Excel row, affected column and reason. The Import errors section is appended after all run results, including failures and Stop, in the automatic timestamped download. Choosing another workbook or worksheet clears prior errors. If no valid rows remain, Run is disabled and an import error report downloads immediately. Blank rows, rows without IDs and blank assignment roles retain their existing handling.

## Processing errors — v0.3.7

A network/read/schema error skips the affected employee/station request and continues with the next station and employee. Malformed segment data skips that segment. Error details are appended under Processing errors after the segment results, followed by any Import errors. There is no automatic retry. Explicit authentication failures and user Stop still terminate processing. A failed or unconfirmed write may have committed: inspect before retrying. Connection-wide failures cannot be fixed by skipping records.

## Time totals by site ? v0.4.0

The automatic log ends with combined Total and Changed duration for DIG1 and NXU7, in minutes and decimal hours (two decimal places). There are no per-employee time totals. All valid retrieved segments contribute to Total, regardless of role/eligibility. Only updates confirmed by the target-station verification contribute to Changed.

Time is attributed to the station where the segment was first read, so a DIG1 segment moved to NXU7 is included under DIG1, rather than counted again under NXU7. Exact duplicates with the same employee ID and start/end interval are counted once across repeated rota rows, station reads and assignment changes. Different employees each contribute their own time. Open ends (null/empty/zero) share one duplicate identity.

Open segments use the Run start time, capped at the selected report day's end and the returned report end when available. This prevents historical open segments accumulating days beyond their report. Open duration also contributes to Changed when its update is confirmed. Closed durations use their actual end minus start. Invalid timestamps are excluded and recorded as processing errors. Calculation uses milliseconds and rounds only the displayed sums.

The footer is placed after processing/import errors and is included on completion, Stop and failure whenever processing began. It summarizes successfully retrieved and processed segments; unreadable records and work not reached after Stop are not included. The suite covers closed/open durations, duplicate rows, moved segments, independent employees, historic/summer day limits, confirmed versus unconfirmed updates, partial errors and footer ordering.

## Report layout ? v0.4.1

Displayed and downloaded results now start with site time totals, followed by Processing errors and Import errors when present, then employee/segment details. This supersedes earlier footer placement descriptions. The same report composer is used for the screen and download. Import-only reports also place errors first. Existing scroll-follow behavior is retained. 52 offline checks pass, including section ordering and empty-section omission.

## Log filenames ? v0.4.2

The date portion of each downloaded log is the selected rota date, not the current calendar date. A UTC clock-time suffix with milliseconds distinguishes runs. For rota date 2026-11-02, a filename is fclm-nexus-results-2026-11-02T12-34-56-789Z.txt. This applies to normal, failed, stopped and import-only downloads. Earlier full-current-timestamp filename descriptions are superseded.
