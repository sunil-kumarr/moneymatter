"""
Classify parsed HDFC transactions (from parse-hdfc.py output) into ready-to-export
CSV rows. Pure rule-based classification -- no LLM involved -- mirroring the
SBI classifier's approach (merchant keyword matching, counterparty-name person
tagging, recurring-credit salary detection), adapted for HDFC's narration shapes
(UPI-, NEFT CR-, IMPS-, RTGS DR-, ATW, FD THROUGH NET, INTEREST PAID, CBDT, ...).
"""
import json
import os
import re
import sys
from collections import Counter

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
CAT = json.load(open(os.path.join(SCRIPT_DIR, "category-map.json")))

# Name aliasing: raw counterparty 'name' (as truncated/formatted by the bank) ->
# canonical person label. "Meenakshi" matches the same person already tagged
# from the SBI statements.
NAME_ALIASES = {
    "MEENAKSHI MEENAKSHI": "Meenakshi",
}

# Merchant/service keyword -> (category_key, label). Matched case-insensitively
# against the extracted counterparty name.
MERCHANT_RULES = [
    (r"^MEESHO", "shopping", "Meesho order"),
    (r"^FASHNEAR TECHNOLOGIE", "shopping", "Meesho order (Fashnear Technologies)"),
    (r"^BLINKIT", "groceries", "Blinkit grocery delivery"),
    (r"^GROFERS", "groceries", "Grofers grocery delivery"),
    (r"^AMAZON PAY GROCERIES", "groceries", "Amazon grocery delivery"),
    (r"^AMAZON", "shopping", "Amazon purchase"),
    (r"^EKART", "shopping", "Flipkart/Ekart delivery payment"),
    (r"^NPCI BHIM", "other", "UPI cashback (BHIM)"),
    (r"^APPLE MEDIA SERVICES", "software_apps_games", "Apple subscription/media purchase"),
    (r"^GOOGLE CLOUD", "software_apps_games", "Google Cloud billing"),
    (r"^GOOGLE (INDIA DIGITAL|PAY)$", "software_apps_games", "Google Pay/refund"),
    (r"^CODEYETI SOFTWARE", "software_apps_games", "Software service payment (CodeYeti)"),
    (r"^OJAS SOFTECH", "software_apps_games", "Software service payment (Ojas Softech)"),
    (r"^STABLE BROKING", "financial_investments", "Stock broker transfer (Stable Broking)"),
    (r"^GR[O0]?WW", "financial_investments", "Groww investment"),
    (r"^SURYODAY", "savings", "Suryoday Small Finance Bank (FD/savings)"),
    (r"^SWIGGY", "restaurant_fastfood", "Swiggy food order"),
    (r"^AIRTEL", "phone_cellphone", "Airtel recharge/bill"),
    (r"^ASTROTALK|^INSTAASTRO", "life_entertainment", "Astrology consultation service"),
    (r"^RATTAN JEWELLERS", "jewels_accessories", "Jewellery purchase"),
    (r"^NYKAA", "health_beauty", "Nykaa cosmetics purchase"),
    (r"^R S HOSIERY|^AGGARWAL CLOTH EMPOR|^ENVOGUE STYLES", "clothes_shoes", "Clothing purchase"),
    (r"^PHONEPE$", "other", "PhonePe wallet reversal/refund"),
]

# Names that are NOT people despite recurring >= 3x -- self-transfers between the
# user's own accounts/VPAs, or automated bank-internal transfers.
NON_PERSON_NAMES = {"SUNIL KUMAR", "SUNINDUSSK1OKAXIS", "INES", "XXXXXX0195", "NA", "LITE"}

# "EarlySalary" is a personal-loan app; its NEFT narration literally contains the
# word "SALARY" ("EARLY SALARY SERVICES..."), which would otherwise false-match
# SALARY_PATTERN below and get miscoded as employment income.
EARLYSALARY_PATTERN = re.compile(r"EARLY\s*SALARY\s*SERVICES", re.IGNORECASE)
SALARY_PATTERN = re.compile(r"\bSALARY\b", re.IGNORECASE)
TRAJECTOR_PATTERN = re.compile(r"TRAJECTOR INDIA", re.IGNORECASE)


def to_iso(date_str):
    d, m, y = date_str.split("/")
    yyyy = f"20{y}" if len(y) == 2 else y
    return f"{yyyy}-{m}-{d}T00:00:00"


def classify(t, name_counts):
    """Return (payload_dict, tag_names) or None to skip."""
    amount = t["debit"] if t["debit"] else t["credit"]
    if amount is None:
        return None
    is_income = bool(t["credit"])
    tx_type = "income" if is_income else "expense"
    narration = t["narration"]
    kind = t["kind"]
    name = t["name"]

    tags = []
    category_key = None
    note = None
    payment_type = "bankTransfer"

    if kind == "UPI":
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
    elif kind == "FD":
        category_key = "savings"
        note = "Fixed deposit placement"
    elif kind == "TAX":
        category_key = "taxes"
        note = "Income tax payment (CBDT)"
    elif kind == "IMPS P2P":
        category_key = "charges_fees"
        note = "IMPS service charge"
    elif kind == "UPIRET":
        note = "UPI transaction return/reversal"
    elif EARLYSALARY_PATTERN.search(narration):
        note = "EarlySalary personal loan disbursement/repayment"
    elif SALARY_PATTERN.search(narration) and (is_income or TRAJECTOR_PATTERN.search(narration)):
        category_key = "wage_invoices"
        note = "Salary - Trajector India (NEFT)" if TRAJECTOR_PATTERN.search(narration) else "Salary (NEFT)"
        tags.append("Salary")
    elif name:
        canonical = NAME_ALIASES.get(name)
        matched_merchant = None
        for pattern, cat_key, label in MERCHANT_RULES:
            if re.search(pattern, name, re.IGNORECASE):
                matched_merchant = (cat_key, label)
                break

        direction = "from" if is_income else "to"
        if matched_merchant:
            category_key, note = matched_merchant
        elif canonical:
            tags.append(f"Person: {canonical}")
            note = f"Transfer {direction} {canonical}"
        elif name in ("SUNIL KUMAR", "SUNINDUSSK1OKAXIS", "XXXXXX0195"):
            note = f"Self transfer between own accounts ({kind})"
        else:
            count = name_counts.get(name, 0)
            if count >= 3 and name not in NON_PERSON_NAMES:
                tags.append(f"Person: {name}")
            note = f"Transfer {direction} {name} ({kind})"
    else:
        note = narration[:190]

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
    txns = json.load(open(parsed_path))
    txns = txns[skip_first:]

    all_txns = json.load(open(parsed_path))
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
