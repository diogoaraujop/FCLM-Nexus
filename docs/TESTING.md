# Testing

## Offline gate

Run from the repository root with Node.js:

    node tests/run.cjs

Expected: 37 checks passed and exit code 0. Coverage includes calendar/DST handling, eligibility, payload target, headers and roles, duplicate row ordering, direct processing, compact output, verification failures, authentication/cancellation paths, automatic downloads and scroll position preservation.

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

2026-11-01: 37 offline checks passed via the bundled Node runtime. No live FCLM reads or writes performed during validation. Browser rendering, actual Excel decoding and live acceptance remain pending. Record future checks with version/date/tester/results and unresolved issues. Use synthetic or sanitized data in committed fixtures.

## Import error handling — v0.3.6

Invalid populated employee IDs and unsupported nonblank roles are skipped without blocking valid rows. The loaded-row status shows the skipped error count. Each error includes its physical Excel row, affected column and reason. The Import errors section is appended after all run results, including failures and Stop, in the automatic timestamped download. Choosing another workbook or worksheet clears prior errors. If no valid rows remain, Run is disabled and an import error report downloads immediately. Blank rows, rows without IDs and blank assignment roles retain their existing handling.

## Processing errors — v0.3.7

A network/read/schema error skips the affected employee/station request and continues with the next station and employee. Malformed segment data skips that segment. Error details are appended under Processing errors after the segment results, followed by any Import errors. There is no automatic retry. Explicit authentication failures and user Stop still terminate processing. A failed or unconfirmed write may have committed: inspect before retrying. Connection-wide failures cannot be fixed by skipping records.
