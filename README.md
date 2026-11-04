# FCLM Nexus

Tampermonkey tool for importing an Excel rota, updating unclassified FCLM segments, and downloading compact results automatically.

**Version 0.4.3** · **55 offline checks passing**

[Install userscript](https://raw.githubusercontent.com/diogoaraujop/FCLM-Nexus/main/src/fclm-nexus.user.js) · [User guide](docs/USER_GUIDE.md) · [Testing](docs/TESTING.md) · [Changelog](docs/CHANGELOG.md)

## Install

1. Install [Tampermonkey](https://www.tampermonkey.net/) in your browser.
2. Open the userscript link above and accept Tampermonkey's installation screen. If the browser displays code instead, open Tampermonkey Dashboard → Create a new script, replace the default contents with the code, and save.
3. Enable only one FCLM Nexus script. Allow its pinned SheetJS dependency to load.
4. Open or refresh the FCLM **PPA Time On Task** report while signed in.
5. Click **FCLM Nexus** in the top breadcrumb bar. Expand **Instructions · new users** for help.

The script runs only on:

    https://fclm-portal.amazon.com/reports/ppaTimeOnTask*

## Use

1. Select the rota date.
2. Click **Import Excel file**, choose an .xlsx or .xls workbook, and select the worksheet.
3. Click **Run**. Updates start immediately; there is no preview or separate Apply step.
4. Read the compact report. Results download automatically after completion, failure, or Stop.

Example output using fictional data:

    Example Person
    1. DIG1 · Picking Kaizen
    2. NXU7 · None → Picking Kaizen (updated)

Names come from **B**, employee IDs from **D**, and assigned functions from **H**. The importer detects an Employee ID header in D within the first 20 rows; otherwise it starts at row 5. Missing IDs are skipped. Blank roles remain available for reporting. Unsupported nonblank roles are skipped and recorded as import errors. Duplicate employee rows are processed in Excel order.

## Behavior

- Reads DIG1 and NXU7 for each imported employee row.
- Updates only segments whose processName is null, assigning the mapped rota function to NXU7.
- Lists all retrieved segments; records skip and failure reasons inline.
- Reports **(updated)** only after a target-station read confirms matching segment boundaries and process ID. Otherwise it reports **update not confirmed**.
- Pauses automatic scrolling when you scroll up; resumes when you return to the bottom.
- Downloads a timestamped text file automatically. The browser controls the destination; use Downloads as its default folder and disable Ask where to save for automatic saving.
- Stop cancels further processing but cannot undo completed changes. Closing the panel does not stop a run.

Workbooks are read locally using pinned SheetJS 0.20.3. No workbook is uploaded. Requests use the existing FCLM browser session. Reports contain employee information and should remain in an approved location; real workbooks and reports are excluded from this repository.

## Development

Requires Node.js for offline checks:

    node tests/run.cjs

The suite uses synthetic data and mocked browser/SheetJS interfaces. It does not call FCLM. Real Excel binary decoding, portal layout, and live API behavior require the manual checks in [TESTING.md](docs/TESTING.md). No live acceptance is claimed by the offline results.

See [engineering notes](docs/NOTES.md) for implementation assumptions. This browser version was adapted from an earlier Python workflow; the historical script is not part of the published package.

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
