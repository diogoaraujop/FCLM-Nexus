# User guide

## Prepare the rota

Use the worksheet containing employee rows. Columns: B = name, D = employee ID, H = desired function. Keep an Employee ID header in D within the first 20 rows when possible. Data starts immediately after that header; otherwise row 5 is assumed. Empty rows and rows without IDs are skipped. Invalid populated IDs are skipped and recorded with their Excel row number.

Supported H values:

| Function | Process ID |
| --- | --- |
| Admin Home Area | 100200 |
| ICQA ProblemSolve | 100231 |
| ICQA Kaizen | 100232 |
| Lead/PA-Receive | 100234 |
| Flow SLAM Lead/PA | 100244 |
| Pack Water Spider | 100245 |
| Picking Kaizen | 100250 |
| Transship Transport | 100287 |
| Transfer In 5S | 100289 |
| TransOut WaterSpider | 100292 |
| Transfer Out Kaizen | 100293 |

Role matching ignores case and outer whitespace. Blank-role rows are reported without updates; unsupported nonblank roles are skipped with an import error. Repeated IDs are retained in worksheet order. Import supports .xlsx/.xls up to 20 MB and worksheet extents up to 100,000 data rows.

## Run

Open FCLM Nexus on the PPA Time On Task page. Choose the rota date, import the workbook, select its worksheet, and click Run. That starts changes immediately. DIG1 and NXU7 segments are read for every employee row. Only a null processName is eligible for assignment to NXU7.

## Read results

Each employee heading is followed by numbered station/function lines. Already classified functions are listed without a change message. Eligible rows show the new function with (updated) only after verification. No rota role, unsupported role, failed, and update not confirmed explain why a change was skipped or could not be confirmed.

Not in imported rota means an employee in the currently loaded portal table is absent from the imported rows. This compares visible loaded table records, not the complete site roster. It does not add employees to the run.

An unconfirmed update may have committed: inspect the portal before rerunning. Boundary normalization or delayed server visibility can prevent exact verification. No automatic write retry occurs.

## Scrolling, stopping and downloads

Scroll up in the report to pause following new output. Return to the bottom to resume. Stop aborts future work and attempts to cancel the active request. Completed assignments remain, and an in-flight request may already be committed. Closing the panel leaves the run active.

On completion, failure, or Stop, the script requests a download named fclm-nexus-results-YYYY-MM-DDTHH-MM-SS-sssZ.txt. The timestamp is UTC. Set Downloads as the browser's default destination and disable Ask where to save to avoid a save prompt. Browser policy can block downloads; a requested download is not proof it was saved. Refreshing or closing the tab before finalization can prevent the final download. Keep downloaded reports in approved locations.

## Troubleshooting

- No launcher: confirm the exact supported report URL, refresh, and check Tampermonkey is enabled. Regional hostnames are not included in the current match rule. The native breadcrumb container must be present.
- Excel reader unavailable: confirm the SheetJS dependency was permitted to load during installation/update.
- Wrong results or missing roles: check worksheet, D IDs and H functions. Verify the saved file is the one imported.
- Authentication failure: sign in normally, inspect any uncertain updates, then rerun as appropriate.
- Failed or unconfirmed update: keep the automatically downloaded report and inspect the normal portal record before retrying.

## Import error handling — v0.3.6

Invalid populated employee IDs and unsupported nonblank roles are skipped without blocking valid rows. The loaded-row status shows the skipped error count. Each error includes its physical Excel row, affected column and reason. The Import errors section is appended after all run results, including failures and Stop, in the automatic timestamped download. Choosing another workbook or worksheet clears prior errors. If no valid rows remain, Run is disabled and an import error report downloads immediately. Blank rows, rows without IDs and blank assignment roles retain their existing handling.
