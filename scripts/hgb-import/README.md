# HGB (Haryana Gramin Bank) mPassbook -> CSV import pipeline

Turns an HGB mPassbook PDF export into a CSV shaped for the app's "Import
Transactions from CSV" wizard. Pure rule-based parsing/classification -- no
AI/LLM extraction, no external API calls. Sibling pipeline to
`../hdfc-import/` and `../sbi-import/`, adapted for this bank's
password-protected PDF passbook format.

## Setup (one-time)

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install pikepdf pdfplumber
```

## Usage

```bash
python3 run-all-hgb.py <statement.pdf> <output.csv> [--skip-first N] [--password PW]
```

The PDF is password-protected; if `--password` is omitted, it's derived from
the trailing numeric segment of the input filename (the account number),
e.g. `HGB_mPassbook_1-5-2025_30-4-2026_82511900044623.pdf` -> `82511900044623`.

- `--skip-first N` -- skip the first N chronological transaction rows, e.g. if
  those were already entered some other way and you don't want duplicates.

Intermediate files (`<output>.decrypted.pdf`, `<output>.parsed.json`,
`<output>.classified.json`) are written alongside the CSV for
inspection/debugging.

Import order matters when you have multiple statement files covering
different date ranges -- import them oldest-first so duplicate detection and
the running balance stay sane.

## How classification works

- `decrypt-pdf.py` -- removes the PDF password.
- `parse-hgb.py` -- extracts the `Date`/`Instrument ID`/`Amount`/`Type`/
  `Balance`/`Remarks` table via `pdfplumber`'s table detection (one table per
  page). The narrow Remarks column wraps mid-word onto a second line inside
  the same cell, so wrapped fragments are rejoined with no separator. For
  `UPI/` and `UPI-REV/` narrations, the counterparty `name` is the last
  `/`-separated field (often truncated by the column width).
- `classify-hgb.py` -- pure rule-based classification:
  - `Loan Account Payments For` / a bare `D<code>` remark -> loan EMI debit.
  - `<account>:Int.Pd:<range>` -> interest credit.
  - `ATM/CWDR/...` -> ATM cash withdrawal.
  - `<account> to <account>` -> internal transfer to a linked account (e.g.
    the loan account on the same customer ID).
  - Most UPI counterparty names on this account resolve to the account
    holder's own name (self-transfers between their own linked
    accounts/VPAs) -- excluded from person-tagging via `NON_PERSON_NAMES`.
    A recurring _different_ name (>=3 occurrences) gets an auto-generated
    `Person: <name>` tag.
  - Anything else (an unrecognized merchant/person, or a UPI narration
    truncated before a name appears) is left uncategorized rather than
    guessed.

## Extending for a new statement period

Same workflow as the HDFC/SBI pipelines: run `run-all-hgb.py`, inspect
`<output>.parsed.json` for any new/unrecognized `name` or `remarks` shape,
and add a rule to `MERCHANT_RULES` or `NON_PERSON_NAMES` in `classify-hgb.py`.

## CSV format produced

Same schema as the other pipelines: `Date, Amount, Description, Category, Tags`.

- `Date` is ISO `YYYY-MM-DD`.
- `Amount` is signed (negative = expense, positive = income) -- pick
  "determine by amount sign" for transaction type in the wizard.
- `Category` holds exact display names matching the app's existing
  categories; blank means intentionally left uncategorized.
- `Tags` is comma-separated per cell.

## Known gap

Comparing the two 2026 statement files processed so far, the account
balance jumps from 1,565.00 (last transaction 21-04-2026, in the
`1-5-2025_30-4-2026` file) to 17,254.00 (first transaction 08-05-2026, in
the `1-5-2026_24-9-2026` file) with no transaction shown in either file to
explain the +15,689.00 difference. Neither file's stated period covers
22-04-2026 through 07-05-2026, so at least one transaction from that window
is missing from both exports -- worth re-checking with the bank/app if
those dates matter.
