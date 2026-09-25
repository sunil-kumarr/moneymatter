"""
Classify parsed HGB transactions (from parse-hgb.py output) into ready-to-export
CSV rows. Pure rule-based classification -- no LLM involved -- mirroring the
HDFC/SBI classifiers' approach (merchant keyword matching, counterparty-name
person tagging), adapted for this bank's passbook narration shapes (UPI/,
UPI-REV/, ATM/CWDR, Loan Account Payments For, D<code>, <acct>:Int.Pd:<range>,
<acct> to <acct>).

Most counterparty names on this account resolve to the account holder's own
name (self-transfers between their own linked accounts/VPAs), since the
statement narration always shows the sender's registered name regardless of
direction -- these are excluded from person-tagging via NON_PERSON_NAMES.
"""
import json
import os
import re
import sys
from collections import Counter

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
CAT = json.load(open(os.path.join(SCRIPT_DIR, "category-map.json")))

# Names that are NOT people despite recurring >= 3x -- this bank's narration
# shows the account holder's own registered name on both sides of
# self-transfers between their own accounts/VPAs, truncated to varying
# lengths by the Remarks column width.
NON_PERSON_NAMES = {"SUNIL KUMAR", "SUNIL KU", "SUNILKUMAR", "SUNIL", "SUN", "NA"}

MERCHANT_RULES = []


def to_iso(date_str):
    d, m, y = date_str.split("-")
    return f"{y}-{m}-{d}T00:00:00"


def classify(t, name_counts):
    """Return (payload_dict, tag_names) or None to skip."""
    amount = t["amount"]
    if amount is None:
        return None
    is_income = t["type"] == "CR"
    tx_type = "income" if is_income else "expense"
    remarks = t["remarks"]
    kind = t["kind"]
    name = t["name"]

    tags = []
    category_key = None
    note = None
    payment_type = "bankTransfer"

    if kind in ("UPI", "UPI_REV"):
        payment_type = "mobilePayment"
        tags.append("UPI")

    if kind == "INTEREST":
        category_key = "interests_dividends"
        note = "Savings account interest credit"
        tags.append("Interest")
    elif kind == "ATM":
        note = "ATM cash withdrawal"
        tags.append("ATM Withdrawal")
        payment_type = "cash"
    elif kind == "LOAN_EMI":
        note = "Loan EMI payment"
        tags.append("Loan EMI")
    elif kind == "INTERNAL_TRANSFER":
        note = f"Internal transfer between own/linked accounts ({remarks})"
    elif kind == "UPI_REV":
        note = "UPI transaction return/reversal"
    elif name:
        matched_merchant = None
        for pattern, cat_key, label in MERCHANT_RULES:
            if re.search(pattern, name, re.IGNORECASE):
                matched_merchant = (cat_key, label)
                break

        direction = "from" if is_income else "to"
        if matched_merchant:
            category_key, note = matched_merchant
        elif name in NON_PERSON_NAMES:
            note = f"Self transfer between own accounts ({kind})"
        elif name[0].isdigit():
            note = f"Transfer {direction} account/reference {name} ({kind})"
        else:
            count = name_counts.get(name, 0)
            if count >= 3 and name not in NON_PERSON_NAMES:
                tags.append(f"Person: {name}")
            note = f"Transfer {direction} {name} ({kind})"
    else:
        note = remarks[:190]

    payload = {
        "amount": amount,
        "transactionType": tx_type,
        "paymentType": payment_type,
        "transferNature": "not_transfer",
        "time": to_iso(t["date"]),
        "note": note,
    }
    if category_key:
        payload["categoryId"] = CAT[category_key]
    return payload, tags


def main(parsed_path, skip_first, out_path):
    all_txns = json.load(open(parsed_path))
    txns = all_txns[skip_first:]

    name_counts = Counter()
    for t in all_txns:
        if t["name"]:
            name_counts[t["name"]] += 1

    new_tags = set()
    results = []
    for t in txns:
        classified = classify(t, name_counts)
        if classified is None:
            continue
        payload, tags = classified
        for tag in tags:
            new_tags.add(tag)
        payload["tagNames"] = tags
        results.append(payload)

    out = {
        "newTagsNeeded": sorted(new_tags),
        "transactions": results,
    }
    json.dump(out, open(out_path, "w"), indent=None)
    print(f"Total remaining: {len(results)}", file=sys.stderr)
    print(f"New tags needed ({len(new_tags)}): {sorted(new_tags)}", file=sys.stderr)


if __name__ == "__main__":
    main(sys.argv[1], int(sys.argv[2]), sys.argv[3])
