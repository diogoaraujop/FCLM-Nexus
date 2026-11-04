# Testing

## Offline gate

Run from the repository root with Node.js:

    node tests/run.cjs

Expected: 55 checks passed and exit code 0. Coverage includes calendar/DST handling, eligibility, payload target, headers and roles, duplicate row ordering, direct processing, compact output, verification failures, authentication/cancellation paths, automatic downloads and scroll position preservation.

The suite uses synthetic values and mocked browser/SheetJS interfaces. It does not test the real Excel binary decoder, rendered portal CSS, browser download permissions, or live API compatibility.

## Manual acceptance

1. Install the current script and disable duplicates. Confirm only the PPA Time On Task report URL activates it. The native FCLM Nexus launcher opens a hidden-by-default panel. Instructions should expand and collapse without affecting processing.
2. Import known .xlsx and .xls files. Check names in B, IDs in D, roles in H, row-3/row-4 headers, blank rows, duplicate IDs and worksheet changes. Missing roles must not prevent segment reporting. Import alone must issue no FCLM requests.
3. On an authorized small test set, capture original assignments and the intended result before Run. Run starts writes immediately. Confirm DIG1/NXU7 reads and NXU7 write destination, with correct role ID and selected-date bounds.
4. Verify all segments are listed using name and numbered function lines, with no report timestamps or tracking metadata. Classified segments remain unchanged. A matching target read is required for (updated); a 200 with no assignment change must say update not confirmed. Independently inspect the portal UI.
5. Confirm a visible portal-table employee absent from the imported rota is reported but not updated. This check only covers loaded table rows.
6. During a long run, scroll up and verify new lines preserve position. Scroll partway down: following stays paused. Reach the bottom: following resumes.
7. Confirm one timestamped download after normal completion, failure and Stop. Test the browser's default download directory and save-prompt setting. Confirm the manual export button is absent.
8. Exercise Stop and authentication/failure behavior only on approved test records. Inspect uncertain writes before retries. Closing the panel must not stop a run.

## Rollback

Stop and disable the current script, restore a previously accepted version, then refresh. This reverses code only. Correct data separately using captured originals and normal portal controls.

## Validation record

2026-11-01: 55 offline checks passed via the bundled Node runtime. No live FCLM reads or writes performed during validation. Browser rendering, actual Excel decoding and live acceptance remain pending. Record future checks with version/date/tester/results and unresolved issues. Use synthetic or sanitized data in committed fixtures.

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

Displayed and downloaded results now start with site time totals, followed by Processing errors and Import errors when present, then employee/segment details. This supersedes earlier footer placement descriptions. The same report composer is used for the screen and download. Import-only reports also place errors first. Existing scroll-follow behavior is retained. 55 offline checks pass, including section ordering and empty-section omission.

## Log filenames ? v0.4.2

The date portion of each downloaded log is the selected rota date, not the current calendar date. A UTC clock-time suffix with milliseconds distinguishes runs. For rota date 2026-11-02, a filename is fclm-nexus-results-2026-11-02T12-34-56-789Z.txt. This applies to normal, failed, stopped and import-only downloads. Earlier full-current-timestamp filename descriptions are superseded.

## Report header and dividers ? v0.4.3

Reports begin with FCLM Nexus Report, the selected rota date and the run start date/time in Europe/London (GMT/BST). The run date/time is captured once at Run start. TIME TOTALS follows immediately, showing unique SAs and total/confirmed changed durations for each site. An SA is counted once per attributed site if at least one valid timed segment was found. Duplicate rows and migrated segments do not inflate counts; an SA with distinct original segments at both sites can appear in both counts. ERRORS separates processing/import errors when present. CHANGES AND SEGMENT RESULTS separates all employee/segment details. This order applies to displayed and automatically downloaded reports. Import-only downloads use their import-report creation time.
