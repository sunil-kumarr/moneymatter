"""
End-to-end pipeline for turning one HDFC account-statement .xls into a CSV
ready for the app's "Import Transactions from CSV" wizard.

Steps: parse -> classify -> export CSV. No LLM/AI extraction anywhere.
HDFC statements aren't password-protected, so there's no decrypt step (unlike
the SBI pipeline).

Usage:
  python3 run-all-hdfc.py <statement.xls> <output.csv> [--skip-first N]

Intermediate files (parsed json, classified json) are written next to the
output CSV with derived names, so re-runs are inspectable.

Before running, install xlrd (the only dependency, for reading old-style .xls),
e.g. in a throwaway venv:
  python3 -m venv .venv && source .venv/bin/activate
  pip install xlrd
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
    parser.add_argument("input_xls")
    parser.add_argument("output_csv")
    parser.add_argument("--skip-first", type=int, default=0)
    args = parser.parse_args()

    base = os.path.splitext(args.output_csv)[0]
    parsed_json = f"{base}.parsed.json"
    classified_json = f"{base}.classified.json"

    with open(parsed_json, "w") as out:
        subprocess.run(
            [sys.executable, os.path.join(SCRIPT_DIR, "parse-hdfc.py"), args.input_xls],
            check=True, stdout=out,
        )

    subprocess.run(
        [sys.executable, os.path.join(SCRIPT_DIR, "classify-hdfc.py"),
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
