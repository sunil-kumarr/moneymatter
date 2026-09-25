# SBI statement -> CSV import pipeline

Turns a (possibly password-protected) SBI account-statement `.xlsx` export
into a CSV shaped for the app's "Import Transactions from CSV" wizard.
Pure rule-based parsing/classification — no AI/LLM extraction, no external
API calls.

## Setup (one-time)

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install msoffcrypto-tool openpyxl
```

## Usage

```bash
python3 run-all.py <statement.xlsx> <output.csv> [--password PASS] [--skip-first N]
```

- `--password` — only needed if the xlsx is password-protected (SBI statements
  are usually protected with the account holder's PAN + DOB or similar).
- `--skip-first N` — skip the first N chronological transaction rows, e.g. if
  those were already entered some other way and you don't want duplicates.

Intermediate files (`<output>.decrypted.xlsx`, `<output>.parsed.json`,
`<output>.classified.json`) are written alongside the CSV for inspection/debugging.

Import order matters when you have multiple statement files covering
different date ranges — import them oldest-first so duplicate detection and
the running balance stay sane.

## How classification works

- `parse-sbi.py` — identifies transaction rows by the `DD/MM/YYYY` date
  column, and where the description matches SBI's `UPI/<DR|CR>/<ref>/<name>/<bank>/<vpa>/<note>`
  shape, extracts structured UPI metadata.
- `classify-sbi.py` — pure rule-based classification:
  - Known merchant/service name patterns (`MERCHANT_RULES`) map to one of the
    app's existing categories (see `category-map.json` / `category-names.json`,
    which are just a snapshot of `get_categories` — update them if your
    category set differs).
  - Recurring UPI counterparty names (>=3 occurrences in the file) get an
    auto-generated `Person: <name>` tag, unless explicitly listed in
    `NON_PERSON_NAMES` (merchants/services that happen to recur too).
  - `NAME_ALIASES` merges counterparty names that are really the same person
    shown differently by the bank (matched by shared VPA fragments — check
    with `inspect-names.py` before trusting a merge).
  - Salary, rent, ATM withdrawals, interest credits, tax refunds, mutual fund
    SIPs/redemptions, and bank-internal sweep/FD-closure noise all get
    dedicated pattern rules — see the regexes near the top of the file.
- `run-all.py` — glues decrypt -> parse -> classify -> CSV export together.

## Extending for a new statement period

Every new statement tends to surface new merchant names. Workflow:

1. Run `run-all.py`, note the "New tags referenced" list it prints.
2. For any UPI name you don't recognize, run:
   ```bash
   python3 inspect-names.py <file>.parsed.json '<Name>' '<Other Name>'
   ```
   to see its VPA, bank, amounts and note fragments — usually enough to tell
   a merchant from a real person from a self-transfer.
3. Add a rule to `MERCHANT_RULES` (merchant/category) or `NAME_ALIASES`
   (person-name merge) or `NON_PERSON_NAMES` (exclude from auto person-tagging)
   in `classify-sbi.py`, then re-run.
4. `name-freq.py <file>.parsed.json` lists all UPI counterparty names by
   frequency, useful for spotting what's worth a dedicated rule vs. leaving
   as a generic person tag.

## CSV format produced

Columns: `Date, Amount, Description, Category, Tags`

- `Date` is ISO `YYYY-MM-DD` (avoids the wizard's day/month ambiguity setting).
- `Amount` is signed (negative = expense, positive = income) — pick
  "determine by amount sign" for transaction type in the wizard.
- `Category` holds exact display names matching the app's existing
  categories; blank means intentionally left uncategorized (mostly
  person-to-person transfers and ambiguous entries) rather than guessed.
- `Tags` is comma-separated per cell; the wizard's tag-mapping step lets you
  link to existing tags or create new ones for names it hasn't seen before.
