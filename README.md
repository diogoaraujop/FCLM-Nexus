# FCLM Nexus

Tampermonkey tool for importing an Excel rota, updating unclassified FCLM segments, and downloading compact results automatically.

**Version 0.3.7** · **37 offline checks passing**

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
