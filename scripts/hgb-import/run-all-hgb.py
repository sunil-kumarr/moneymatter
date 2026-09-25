"""
End-to-end pipeline for turning one HGB (Haryana Gramin Bank) mPassbook PDF
into a CSV ready for the app's "Import Transactions from CSV" wizard.

Steps: decrypt -> parse -> classify -> export CSV. No LLM/AI extraction
anywhere.

Usage:
  python3 run-all-hgb.py <statement.pdf> <output.csv> [--skip-first N] [--password PW]

The PDF is password-protected; if --password is omitted it's derived from the
trailing numeric segment of the input filename (the account number).

Intermediate files (decrypted pdf, parsed json, classified json) are written
next to the output CSV with derived names, so re-runs are inspectable.

Before running, install pikepdf and pdfplumber, e.g. in a throwaway venv:
  python3 -m venv .venv && source .venv/bin/activate
  pip install pikepdf pdfplumber
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
    parser.add_argument("input_pdf")
    parser.add_argument("output_csv")
    parser.add_argument("--skip-first", type=int, default=0)
    parser.add_argument("--password", default=None)
    args = parser.parse_args()

    base = os.path.splitext(args.output_csv)[0]
    decrypted_pdf = f"{base}.decrypted.pdf"
    parsed_json = f"{base}.parsed.json"
    classified_json = f"{base}.classified.json"

    decrypt_cmd = [sys.executable, os.path.join(SCRIPT_DIR, "decrypt-pdf.py"), args.input_pdf, decrypted_pdf]
    if args.password:
        decrypt_cmd.append(args.password)
    subprocess.run(decrypt_cmd, check=True)

    with open(parsed_json, "w") as out:
        subprocess.run(
            [sys.executable, os.path.join(SCRIPT_DIR, "parse-hgb.py"), decrypted_pdf],
            check=True, stdout=out,
        )

    subprocess.run(
        [sys.executable, os.path.join(SCRIPT_DIR, "classify-hgb.py"),
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
