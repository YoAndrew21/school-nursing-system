# Local student import

Selecting a CSV/XLS/XLSX file now parses and validates it in an ephemeral local Web
Worker. The current database is unchanged until **Confirm import**. The preview
shows filename, nonempty data rows, unique valid students, rows with errors,
rows with warnings, and separate RUN/IPE counts after duplicate resolution. Only
valid rows are committed; same-type duplicates keep the last valid row, with a
warning. Cancel, closing the dialog, choosing another file, deleting the database
or clearing all local data invalidates pending work and discards the preview.

## Application safety limits

Named constants in `js/student-import.js`:

| Constant | Value | Reason |
| --- | --- | --- |
| MAX_FILE_BYTES | 5,242,880 bytes (5 MiB) | Allows a normal school roster and formatted template while bounding file reads. |
| MAX_STUDENT_ROWS | 5,000 nonempty data rows | Covers large schools; errors and duplicate rows also count. |
| MAX_WORKSHEET_ROWS | 10,000 absolute worksheet rows | Allows title/header rows and template padding; rejects inflated ranges. |
| MAX_WORKSHEET_COLUMNS | 64 absolute worksheet columns | Allows extra school columns while bounding range conversion. |
| MAX_CELL_CHARS | 1,024 characters per header/recognized value | Prevents oversized diagnostic strings; existing shorter field lengths still apply. |
| MAX_PARSE_MS | 30,000 ms | Terminates stalled, malformed or unusually expensive parsing off the UI thread. |

These are technical application limits, not Chilean requirements. File size is
checked before reading and again before parsing. SheetJS reads at most 10,001 rows
per sheet and the selected sheet's full range is checked before conversion. The
preferred sheet is Estudiantes; otherwise the first sheet is used, as before.
Worker isolation and timeout keep the UI responsive, but these limits are not a
complete memory sandbox against malicious compressed archives. Use trusted school
files. HTTPS/localhost and browser Web Worker support are required; failures are
reported without replacing the current database. There is no synchronous fallback.

## Validation and compatibility

The existing database storage key/schema and old RUN-only records remain supported.
RUN normalization and its existing check-digit algorithm are unchanged. A missing
identification type means RUN; invalid RUN never becomes IPE. IPE uses the existing
separate 1–30 digit rule, without RUN checksum; text leading zeroes are preserved.

For backward compatibility, a row needs at least a name or paternal surname, not
every column marked required in the template. Optional columns may be absent or
blank. Provided optional values must be valid. Errors exclude the entire row:

- Missing/invalid identification, unknown type, conflicting RUN/Identificación values.
- Both name and paternal surname missing.
- Fields exceeding their existing form lengths (never truncated).
- Invalid sex values, nonnumeric or unsafe numeric commune codes, impossible or
  malformed birth dates, date values containing trailing text or time components.
- Formula/error cells in recognized fields and unsafe numeric identification values.

Birth dates accept complete ISO-like year/month/day or day/month/year strings with
`-`, `/` or `.` separators, and whole Excel serial dates, respecting the workbook's
1904 date system. The nonexistent 1900-02-29 date is rejected. Invalid optional
dates are not silently replaced with empty strings.

Warnings explicitly report transformations without excluding otherwise valid rows:

- Surrounding/repeated whitespace normalization and noncanonical RUN formatting.
  Recognized sex mapping and valid date conversion to ISO are routine parsing and
  do not produce warnings, including Excel serial dates and supported text dates.
- Numeric identifiers: review leading zeroes. An Excel numeric display consisting
  of zero-padded digits is retained; zeroes already lost in the source cannot be
  reconstructed. Use text identification cells.
- Unusual numeric text fields converted to text, populated unrecognized columns omitted,
  and same-type duplicates resolved by retaining the last valid row.

Duplicate/equivalent recognized column headers reject the file as ambiguous. Blank
padding is ignored. The preview distinguishes errors and warnings by text, not just
color, and displays the first eight notices of each type plus an overflow count.
The total counters cover every row even when the notice list is abbreviated. A row
may have both errors and warnings; warnings never override errors or permit that row.

Commune codes are optional digit strings, preserving every digit and text leading
zero. Codes such as 10101 are accepted; only the general 1,024-character cell safety
limit applies, not an assumed official code length. Numeric integer cells such as
10101 are routine and accepted without warnings; unsafe/fractional numeric cells
are errors. The earlier importer accepted longer codes by truncating to three
digits. That truncation and the subsequent three-digit rejection are corrected.
The unchanged official PDF still displays only the first three digits in its three
existing cells; the form explains this document limitation separately.

Every selection advances a generation token. Old reads/results cannot change the
current preview or commit. Running workers are terminated on replacement, cancellation,
timeout and completion. Confirmation verifies the current pending generation and
successful localStorage persistence precedes updating the in-memory database.
File bytes, worksheets and pending records are never uploaded or cached by the
service worker. Closing/cancelling releases pending records and rendered notices.

## Verification in a browser

1. On HTTPS/localhost, use fictional CSV, XLS and XLSX rosters in ES, EN and JA.
   Verify preview wrapping, keyboard focus, live status and Cancel/Confirm labels.
2. With an existing database, parse another file and verify autocomplete still uses
   the existing database. Cancel and reload: the original database must be unchanged.
   Repeat and confirm: only valid students from the new file must replace it.
3. Preview a mixed RUN/IPE file, including text IPE 000123. Verify counts and the
   value after confirmation, autocomplete and reload. Test a legacy RUN-only file.
4. Include invalid RUN/IPE, unknown type, empty name/surname, overlong values,
   impossible optional dates, formulas, duplicates and unknown populated columns.
   Review row errors/warnings and verify no silent truncation.
5. Select a second file quickly while the first is reading. Only the second preview
   may be confirmed. Test Cancel while reading, Escape/close, and Clear all local data
   from a ready preview. Confirming a stale preview must be impossible.
6. Try a file over 5 MiB, over 5,000 data rows or outside worksheet bounds. The
   existing database must remain intact. Check storage-quota failure in a disposable
   profile; the preview must remain available for retry or cancellation.
7. After installing the updated shell and reopening all application windows, go
   offline, reload and import local files. Check worker loading, autocomplete,
   Spanish PDF preview/download and local drafts. Follow docs/PWA.md for updates.
