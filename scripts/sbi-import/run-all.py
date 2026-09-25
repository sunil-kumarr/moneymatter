"""
End-to-end pipeline for turning one SBI account-statement xlsx into a CSV
ready for the app's "Import Transactions from CSV" wizard.

Steps: decrypt (if a password is given) -> parse -> classify -> export CSV.
No LLM/AI extraction involved anywhere in this pipeline.

Usage:
  python3 run-all.py <statement.xlsx> <output.csv> [--password PASS] [--skip-first N]

  --password PASS   Decrypt the xlsx first (skip if the file isn't protected).
  --skip-first N    Skip the first N chronological transaction rows (use this
                     when those rows were already imported some other way).

Intermediate files (decrypted xlsx, parsed json, classified json) are written
next to the output CSV with derived names, so re-runs are inspectable.

Before running, install the two Python deps (msoffcrypto-tool, openpyxl),
e.g. in a throwaway venv:
  python3 -m venv .venv && source .venv/bin/activate
  pip install msoffcrypto-tool openpyxl
"""
import argparse
import csv
import json
import os
import subprocess
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("input_xlsx")
    parser.add_argument("output_csv")
    parser.add_argument("--password", default=None)
    parser.add_argument("--skip-first", type=int, default=0)
    args = parser.parse_args()

    base = os.path.splitext(args.output_csv)[0]
    decrypted_xlsx = f"{base}.decrypted.xlsx"
    parsed_json = f"{base}.parsed.json"
    classified_json = f"{base}.classified.json"

    xlsx_to_parse = args.input_xlsx
    if args.password:
        subprocess.run(
            [sys.executable, os.path.join(SCRIPT_DIR, "decrypt-xlsx.py"),
             args.input_xlsx, args.password, decrypted_xlsx],
            check=True,
        )
        xlsx_to_parse = decrypted_xlsx

    with open(parsed_json, "w") as out:
        subprocess.run(
            [sys.executable, os.path.join(SCRIPT_DIR, "parse-sbi.py"), xlsx_to_parse],
            check=True, stdout=out,
        )

    subprocess.run(
        [sys.executable, os.path.join(SCRIPT_DIR, "classify-sbi.py"),
         parsed_json, str(args.skip_first), classified_json],
        check=True,
    )

    cat_names = json.load(open(os.path.join(SCRIPT_DIR, "category-names.json")))
    data = json.load(open(classified_json))
    rows = data["transactions"]

    with open(args.output_csv, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["Date", "Amount", "Description", "Category", "Tags"])
        for t in rows:
            amount = t["amount"]
            signed = amount if t["transactionType"] == "income" else -amount
            date = t["time"][:10]
            desc = t["note"] or ""
            category = cat_names.get(t.get("categoryId", ""), "")
            tags = ",".join(t.get("tagNames", []))
            w.writerow([date, f"{signed:.2f}", desc, category, tags])

    print(f"Wrote {len(rows)} rows to {args.output_csv}", file=sys.stderr)
    if data.get("newTagsNeeded"):
        print(f"New tags referenced ({len(data['newTagsNeeded'])}): {data['newTagsNeeded']}", file=sys.stderr)
        print("The CSV import wizard's tag-mapping step can create these.", file=sys.stderr)


if __name__ == "__main__":
    main()
