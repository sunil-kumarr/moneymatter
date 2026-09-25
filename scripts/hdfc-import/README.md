# HDFC statement -> CSV import pipeline

Turns an HDFC account-statement `.xls` export into a CSV shaped for the app's
"Import Transactions from CSV" wizard. Pure rule-based parsing/classification
— no AI/LLM extraction, no external API calls. Sibling pipeline to
`../sbi-import/`, adapted for HDFC's statement format (plain `.xls`, no
password, different narration shapes).

## Setup (one-time)

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install xlrd
```

## Usage

```bash
python3 run-all-hdfc.py <statement.xls> <output.csv> [--skip-first N]
```

HDFC statements aren't password-protected, so there's no `--password` flag
(unlike the SBI pipeline).

- `--skip-first N` — skip the first N chronological transaction rows, e.g. if
  those were already entered some other way and you don't want duplicates.

Intermediate files (`<output>.parsed.json`, `<output>.classified.json`) are
written alongside the CSV for inspection/debugging.

Import order matters when you have multiple statement files covering
different date ranges — import them oldest-first so duplicate detection and
the running balance stay sane.

## How classification works

- `parse-hdfc.py` — locates the `Date`/`Narration` header row (position
  varies between exports), then reads rows matching the `DD/MM/YY` date
  column. For narrations starting with `UPI-`, `NEFT CR-`, `NEFT DR-`,
  `IMPS-`, `RTGS DR-`, `RTGS CR-`, it extracts a counterparty `name` by
  positional splitting on `-` (e.g. for `UPI-`, the name is always the 2nd
  dash-separated field; for `NEFT CR-`/`IMPS-`/`RTGS DR-`, the 3rd). This is
  simpler than a full regex and works because HDFC's narration fields are
  consistently ordered even though merchant/VPA names themselves can contain
  spaces or hyphens.
- `classify-hdfc.py` — pure rule-based classification, mirroring
  `../sbi-import/classify-sbi.py`'s approach:
  - Known merchant/service name patterns (`MERCHANT_RULES`) map to one of the
    app's existing categories (see `category-map.json` / `category-names.json`
    — copies of the same snapshot used by the SBI pipeline, since categories
    are shared across accounts).
  - Recurring counterparty names (>=3 occurrences in the file) get an
    auto-generated `Person: <name>` tag, unless listed in `NON_PERSON_NAMES`
    (the user's own name/VPA showing up as the "counterparty" on self-transfers
    between their own accounts, and other non-person noise).
  - `NAME_ALIASES` merges a name as HDFC formats it with the canonical label
    already used by the SBI pipeline (e.g. `MEENAKSHI MEENAKSHI` -> `Meenakshi`).
  - Salary (NEFT CR from "TRAJECTOR INDIA"), interest credits, ATM withdrawals,
    FD placements, CBDT tax payments, and IMPS P2P service charges each have a
    dedicated rule. Notably, `EARLYSALARY_PATTERN` must be checked _before_ the
    generic salary regex, because "EARLY SALARY SERVICES..." (a personal-loan
    app) contains the literal word "SALARY" and would otherwise be
    miscategorized as employment income.
- `run-all-hdfc.py` — glues parse -> classify -> CSV export together.

## Extending for a new statement period

Every new statement tends to surface new merchant/counterparty names.
Workflow (same as the SBI pipeline):

1. Run `run-all-hdfc.py`, note the "New tags needed" list it prints.
2. For any name you don't recognize, run:
   ```bash
   python3 inspect-names.py <file>.parsed.json '<Name>'
   ```
   to see every row for that name (kind, amount, full narration) — usually
   enough to tell a merchant from a real person from a self-transfer.
3. Add a rule to `MERCHANT_RULES` (merchant/category), `NAME_ALIASES` (person
   name merge), or `NON_PERSON_NAMES` (exclude from auto person-tagging) in
   `classify-hdfc.py`, then re-run.
4. `name-freq.py <file>.parsed.json` lists all counterparty names by
   frequency, useful for spotting what's worth a dedicated rule.

## CSV format produced

Same schema as the SBI pipeline: `Date, Amount, Description, Category, Tags`.

- `Date` is ISO `YYYY-MM-DD` (HDFC's 2-digit year is expanded to `20YY`).
- `Amount` is signed (negative = expense, positive = income) — pick
  "determine by amount sign" for transaction type in the wizard.
- `Category` holds exact display names matching the app's existing
  categories; blank means intentionally left uncategorized (ambiguous
  entries, person-to-person transfers, unclear NBFC credits) rather than
  guessed.
- `Tags` is comma-separated per cell; the wizard's tag-mapping step lets you
  link to existing tags or create new ones for names it hasn't seen before.
