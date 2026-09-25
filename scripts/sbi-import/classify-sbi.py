"""
Classify parsed SBI transactions (from parse_sbi.py output) into ready-to-call
create_transaction payloads, plus a list of new tags that must be created first.

No LLM involved -- pure rule-based classification using merchant keyword
matching, UPI VPA-based person-alias merging, and recurring-credit salary
detection.
"""
import json, re, sys, hashlib
from collections import Counter, defaultdict

import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
CAT = json.load(open(os.path.join(SCRIPT_DIR, "category-map.json")))

EXISTING_TAGS = {
    "UPI": "01a0d716-e5e6-7139-ac98-3ee85d13c79a",
    "Cashback": "01a0d716-f33b-722f-998d-cd339eff6acd",
    "Interest": "01a0d716-ff07-73ea-9a25-251c90bec496",
    "ATM Withdrawal": "01a0d717-0b81-7619-b33f-46e33d3b97d2",
    "Person: Suresh Chander": "01a0d717-19ac-756d-ad49-e55c31968b90",
    "Person: Parvesh": "01a0d717-2735-77f9-a8ff-71ff27e91232",
}

# Name aliasing: raw UPI 'name' field (as truncated by the bank) -> canonical person label.
# Determined by matching identical VPA fragments across differently-truncated names.
NAME_ALIASES = {
    "constabl": "Suresh Chander",
    "SURESH C": "Suresh Chander",
    "SURESH": "Suresh Chander",
    "Parvesh": "Parvesh",
    "Parvesh .": "Parvesh",
    "PARVESH": "Parvesh",
    "meenaksh": "Meenakshi",
}

# Merchant/service keyword -> (category_key, label). Matched case-insensitively
# against the UPI counterparty name (which is truncated, so keywords are prefixes).
MERCHANT_RULES = [
    (r"^AMAZON", "shopping", "Amazon purchase"),
    (r"^NETFLIX", "tv_streaming", "Netflix subscription"),
    (r"^SPOTIFY", "tv_streaming", "Spotify subscription"),
    (r"^SWIGGY", "restaurant_fastfood", "Swiggy food order"),
    (r"^ZEPTO", "groceries", "Zepto grocery delivery"),
    (r"^Daalchin", "food_drinks", "Daalchini vending machine"),
    (r"^Mother D", "groceries", "Mother Dairy purchase"),
    (r"^Otipy", "groceries", "Otipy grocery delivery"),
    (r"^Dominos", "restaurant_fastfood", "Domino's order"),
    (r"^OM SAMOSA", "restaurant_fastfood", "Food vendor (OM Samosa)"),
    (r"^99 Dosa", "restaurant_fastfood", "Food vendor (99 Dosa)"),
    (r"^Bookmyshow", "culture_sport_events", "BookMyShow booking"),
    (r"^IRCTC", "long_distance", "IRCTC train booking"),
    (r"^Red Bus", "long_distance", "RedBus ticket booking"),
    (r"^Rapido", "taxi", "Rapido ride"),
    (r"^OLACABS", "taxi", "Ola cab ride"),
    (r"^OYO", "holiday_trips_hotels", "OYO Rooms booking"),
    (r"^Rentomojo", "rentals", "Rentomojo furniture rental"),
    (r"^Google I", "holiday_trips_hotels", "Google Travel booking"),
    (r"^Google P", "software_apps_games", "Google Play purchase"),
    (r"^GOOGLEPAY$", "refunds_tax_purchase", "Google Pay cashback reward"),
    (r"^Jio", "phone_cellphone", "Jio mobile recharge"),
    (r"^Airtel", "phone_cellphone", "Airtel Payments Bank - mobile recharge"),
    (r"^Vi$", "phone_cellphone", "Vi (Vodafone Idea) mobile recharge"),
    (r"^VODAFONE", "phone_cellphone", "Vodafone mobile recharge"),
    (r"^DHBVN", "energy_utilities", "DHBVN electricity bill payment"),
    (r"^LPU", "education_development", "LPU (Lovely Professional University) fee"),
    (r"^Wikimedi", "charity_gifts", "Wikimedia donation"),
    (r"^CRED(?!PAYS|CLUB)", "financial_expenses", "CRED credit-card bill payment"),
    (r"^CredClub", "financial_expenses", "CRED credit-card bill payment"),
    (r"^CREDCLUB", "financial_expenses", "CRED credit-card bill payment"),
    (r"^CREDPAYS", "financial_expenses", "CRED credit-card bill payment"),
    (r"^slice", "financial_expenses", "Slice credit-card bill payment"),
    (r"^Slicepay", "financial_expenses", "Slice credit-card bill payment"),
    (r"^RZPX", "financial_expenses", "RazorpayX (Slice/other) bill payment"),
    (r"^Razorpay", "charges_fees", "Razorpay payment gateway charge"),
    (r"^PayU", "charges_fees", "PayU payment gateway"),
    (r"^BILLDESK", "charges_fees", "BillDesk payment gateway"),
    (r"^Cashfree", "charges_fees", "Cashfree payment gateway"),
    (r"^Mobikwik", "charges_fees", "MobiKwik wallet"),
    (r"^MOBIKWIK", "charges_fees", "MobiKwik wallet"),
    (r"^BharatPe", "charges_fees", "BharatPe payment"),
    (r"^Paytm Bill", "energy_utilities", "Paytm bill payment"),
    (r"^PAYTM GOVT", "taxes", "Paytm government payment"),
    (r"^Paytm", "charges_fees", "Paytm wallet/payment"),
    (r"^PaytmUser", "charges_fees", "Paytm wallet/payment"),
    (r"^Fullerto", "loan_interests", "Fullerton India loan payment"),
    (r"^IDFC FIR", "loan_interests", "IDFC First loan payment"),
    (r"^EURONETG", "charges_fees", "Euronet payment gateway"),
    (r"^EDUNETWO", "education_development", "Education platform payment"),
    (r"^WH SMITH", "books_audio_subscriptions", "WH Smith - books/stationery"),
    (r"^stationers", "stationery_tools", "Stationery purchase"),
    (r"^Manmatters", "health_beauty", "Man Matters purchase"),
    (r"^Vidyapat", "education_development", "Education-related payment"),
    (r"^GARAGEPR", "vehicle_maintenance", "Vehicle garage bill (via Slice)"),
    (r"^AIRPLAZA", "shopping", "Airplaza Retail Holding"),
    (r"^Add Mone", "food_drinks", "Paytm wallet top-up (Swiggy/food orders)"),
    (r"^CLOUDKIT", "restaurant_fastfood", "Cloud kitchen food delivery"),
    (r"^Daily Bi", "food_drinks", "Local food vendor (Daily Bites)"),
    (r"^Nextbill", "financial_investments", "Groww mutual fund investment"),
    (r"^Roppen T", "taxi", "Rapido ride (Roppen Transportation)"),
    (r"^PYSZNE F", "restaurant_fastfood", "Food vendor (Pyszne)"),
    (r"^IndianCl", "financial_investments", "BSE Star MF investment"),
    (r"^MAYDA HO", "food_drinks", "Local food vendor (Mayda)"),
    (r"^Verified$", None, "BharatPe merchant payment"),
    (r"^Axis", "financial_expenses", "CRED credit-card bill payment (Axis Bank card)"),
    (r"^SmartWor", "active_sport_fitness", "Gym/fitness payment (SmartWorkout)"),
    (r"^Jar$", "savings", "Jar app - digital gold savings"),
    (r"^WAW HOSP", "health_care_doctor", "Hospital/clinic monthly payment (WAW Hospital)"),
    (r"^Idealpre", "education_development", "Coaching/tuition payment (Ideal Preparation)"),
    (r"^IDEALPE", "education_development", "Coaching/tuition payment (Ideal Preparation)"),
    (r"^SUNIL KU", None, "Self-transfer (Sunil Kumar) via UPI"),
    (r"^sunindus", None, "Self-transfer to own account (Sunindus) via UPI"),
    (r"^ICCL-Groww", "financial_investments", "Groww investment (stocks/MF via BSE)"),
    (r"^DRUG SOL", "drugstore_chemist", "Pharmacy purchase"),
    (r"^BISTRO", "restaurant_fastfood", "Restaurant (Bistro)"),
    (r"^CaratLan", "jewels_accessories", "CaratLane jewellery purchase"),
    (r"^APNI RASOI", "restaurant_fastfood", "Food vendor (Apni Rasoi)"),
    (r"^PARKPLUS", "parking", "ParkPlus parking payment"),
    (r"^APPLE ME", "software_apps_games", "Apple Media Services (App Store/iCloud)"),
    (r"^Apple Se", "software_apps_games", "Apple Services (App Store/iCloud)"),
    (r"^Blinkit", "groceries", "Blinkit grocery delivery"),
    (r"^Cybrilla", "financial_investments", "Mutual fund SIP (Cybrilla mandate)"),
    (r"^Suryoday", "savings", "Suryoday Small Finance Bank - deposit/investment"),
    (r"^HISAR MO", "vehicle_maintenance", "Hisar Motors - vehicle service/parts"),
    (r"^CHEQ DIG", "financial_expenses", "CheQ credit-card bill payment"),
    (r"^CheQ$", "financial_expenses", "CheQ credit-card bill payment"),
    (r"^SBI CRED", "financial_expenses", "SBI Card bill payment (via CRED)"),
    (r"^PhonePe", "charges_fees", "PhonePe wallet/payment"),
    (r"^Indian O", "fuel", "Indian Oil fuel purchase"),
    (r"^Reliance", "shopping", "Reliance Retail/Jio purchase"),
    (r"^FLIPKART", "shopping", "Flipkart purchase"),
    (r"^LinkedIn", "software_apps_games", "LinkedIn subscription"),
    (r"^ONE97", "charges_fees", "One97/Paytm payment"),
    (r"^Jio Prep", "phone_cellphone", "Jio mobile recharge"),
    (r"^1MG Tech", "drugstore_chemist", "1mg pharmacy purchase"),
    (r"^Bank Acc", None, "Bank account transfer (purpose unclear from statement)"),
    (r"^Bundl Te", "restaurant_fastfood", "Swiggy food order (Bundl Technologies)"),
    (r"^DMRC", "public_transport", "Delhi Metro (DMRC) fare"),
    (r"^Gurugram", "rent", "Monthly rent payment (Gurugram flat)"),
    (r"^Indian C", None, "Payment to Indian C... (purpose unclear from statement)"),
    (r"^NATIONAL$", None, "Payment to National... (purpose unclear from statement)"),
    (r"^R G Apar", None, "Paytm wallet payment (R G Apar)"),
    (r"^SHRI KRI", "shopping", "Local shop purchase (Shri Krishna, via Vyapar)"),
    (r"^Dinodya", "wellness_beauty", "Salon/haircut payment"),
    (r"^ANKUR FI", "fuel", "Fuel station payment"),
    (r"^Arsh Foo", "restaurant_fastfood", "Food vendor (Arsh Food)"),
    (r"^Apna Zaika", "restaurant_fastfood", "Food vendor (Apna Zaika)"),
    (r"^BEWAKOOF", "shopping", "Clothing purchase (Bewakoof)"),
    (r"^Faasos", "restaurant_fastfood", "Food delivery (Faasos)"),
    (r"^Kitchen", "restaurant_fastfood", "Food order (cloud kitchen, via Paytm)"),
]

# Names that are NOT people despite recurring ≥ 3× — excluded from person-tag treatment.
NON_PERSON_NAMES = {"DUMMY NAME", "30017433", "Verified", "Add Mone", "Daily Bi",
                     "Nextbill", "Roppen T", "PYSZNE F", "IndianCl", "MAYDA HO", "CLOUDKIT",
                     "Axis", "SmartWor", "Jar", "WAW HOSP", "Idealpre", "IDEALPE",
                     "SUNIL KU", "sunindus", "ICCL-Groww", "NEXTBILL", "Cybrilla",
                     "CHEQ DIG", "CheQ", "SBI CRED", "New Sala",
                     "1MG Tech", "Bank Acc", "Bundl Te", "DMRC", "Gurugram",
                     "Indian C", "NATIONAL", "R G Apar", "SHRI KRI", "Dinodya", "ANKUR FI",
                     "Arsh Foo", "Apna Zaika", "BEWAKOOF", "Faasos", "Kitchen", "16670500"}

# Rent: DUMMY NAME / 30017433 share the same underlying VPA fragment ("3001743...")
# and recurring ~41,500 amount with "flat" in the note -> landlord rent payment.
RENT_PATTERN = re.compile(r"DUMMY NAME|30017433", re.IGNORECASE)

INSTITUTION_RULES = [
    (r"UPSC", "education_development", "UPSC application/exam fee"),
    (r"IIT BOMBAY|GATE", "education_development", "GATE exam fee (IIT Bombay)"),
    (r"GJU SCI AND TEC|TECH_REG", "education_development", "University registration fee (GJU)"),
    (r"REGISTRAR", "education_development", "University registration fee"),
]

SALARY_PATTERN = re.compile(r"ANALOG LEGALHUB|\bSALARY\b", re.IGNORECASE)
PARVIOM_PATTERN = re.compile(r"PARVIOM|P\s*ARVIOM", re.IGNORECASE)
NEXTBILLION_PATTERN = re.compile(r"NEXTBILLIO\s*N\s*TECHNO", re.IGNORECASE)
SWEEP_PATTERN = re.compile(r"SWEEP TRF", re.IGNORECASE)
MOD_CLOSURE_PATTERN = re.compile(r"MOD Closur", re.IGNORECASE)
MF_REDEMPTION_PATTERN = re.compile(
    r"INDIAN CLEARING|QUANT M|MIRAE A|NIPPON INDIA|ICICI P|MOTILAL OSWAL|GR0?WW INVEST",
    re.IGNORECASE,
)
TAX_REFUND_PATTERN = re.compile(r"I\s*T\s*D\s*TA\s*X\s*RE\s*FUND", re.IGNORECASE)


def to_iso(date_str):
    d, m, y = date_str.split("/")
    return f"{y}-{m}-{d}T00:00:00"


def key_for(t):
    raw = f"{t['date']}|{t['debit']}|{t['credit']}|{t['rawDetails']}"
    return hashlib.sha1(raw.encode()).hexdigest()


def classify(t, name_counts):
    """Return (payload_dict, new_tag_names) or None to skip (e.g. pure balance summary rows)."""
    amount = t["debit"] if t["debit"] else t["credit"]
    if amount is None:
        return None
    is_income = bool(t["credit"])
    tx_type = "income" if is_income else "expense"
    details = t["rawDetails"]
    upi = t["upi"]

    tags = []
    category_key = None
    note = None
    payment_type = "mobilePayment" if upi else "bankTransfer"

    if SALARY_PATTERN.search(details):
        category_key = "wage_invoices"
        if "ANALOG LEGALHUB" in details.upper():
            note = "Salary - Analog LegalHub (NEFT)"
        elif PARVIOM_PATTERN.search(details):
            note = "Salary - Parviom Technologies (NEFT)"
        else:
            note = "Salary (NEFT)"
        tags.append("Salary")
        payment_type = "bankTransfer"
    elif PARVIOM_PATTERN.search(details):
        category_key = "wage_invoices"
        note = "Payment from Parviom Technologies (bonus/reimbursement/settlement)"
        tags.append("Salary")
        payment_type = "bankTransfer"
    elif NEXTBILLION_PATTERN.search(details):
        category_key = "freelance"
        note = "Payment from client (NextBillion Technologies)"
        payment_type = "bankTransfer"
    elif SWEEP_PATTERN.search(details):
        category_key = "savings"
        note = "Bank sweep transfer (FD auto-sweep, not new income)"
        payment_type = "bankTransfer"
    elif MOD_CLOSURE_PATTERN.search(details):
        category_key = "savings"
        note = "Fixed deposit (MOD) partial closure"
        payment_type = "bankTransfer"
    elif MF_REDEMPTION_PATTERN.search(details):
        category_key = "financial_investments"
        note = "Mutual fund redemption proceeds"
        payment_type = "bankTransfer"
    elif TAX_REFUND_PATTERN.search(details):
        category_key = "refunds_tax_purchase"
        note = "Income Tax Refund"
        payment_type = "bankTransfer"
    elif t["kind"] == "INTEREST CREDIT":
        category_key = "interests_dividends"
        note = "Savings account interest credit"
        tags.append("Interest")
        payment_type = "bankTransfer"
    elif details.startswith("ATM WDL"):
        note = "ATM cash withdrawal"
        m = re.search(r"ATM CASH \d+\s+(.*)", details)
        if m:
            note += f" - {m.group(1).strip()}"
        tags.append("ATM Withdrawal")
        payment_type = "cash"
    elif upi:
        name = upi["name"]
        canonical = NAME_ALIASES.get(name)
        matched_merchant = None
        for pattern, cat_key, label in MERCHANT_RULES:
            if re.search(pattern, name, re.IGNORECASE):
                matched_merchant = (cat_key, label)
                break
        tags.append("UPI")
        if RENT_PATTERN.search(name):
            category_key = "rent"
            note = "Monthly rent payment (Flat)"
        elif matched_merchant:
            category_key, note = matched_merchant
        elif canonical:
            tags.append(f"Person: {canonical}")
            direction = "from" if is_income else "to"
            note = f"Transfer {direction} {canonical} (UPI)"
        else:
            count = name_counts.get(name, 0)
            direction = "from" if is_income else "to"
            if count >= 3 and name not in NON_PERSON_NAMES:
                tags.append(f"Person: {name.strip()}")
                note = f"Transfer {direction} {name.strip()} (UPI)"
            else:
                note = f"Transfer {direction} {name.strip()} (UPI)"
    else:
        # Non-UPI, non-ATM, non-interest: INB bill payments, NEFT/RTGS, institution payments
        matched_inst = None
        for pattern, cat_key, label in INSTITUTION_RULES:
            if re.search(pattern, details, re.IGNORECASE):
                matched_inst = (cat_key, label)
                break
        if matched_inst:
            category_key, note = matched_inst
            payment_type = "bankTransfer"
        elif "BHARTI AIRTEL" in details.upper():
            category_key = "phone_cellphone"
            note = "Bharti Airtel bill payment (net banking)"
            payment_type = "bankTransfer"
        elif "COMM ON OTHER BUSINESS" in details.upper():
            category_key = "charges_fees"
            note = "Bank commission/charges"
            payment_type = "bankTransfer"
        elif details.startswith("POS "):
            category_key = "shopping"
            note = "Card purchase (POS)"
            payment_type = "debitCard"
        else:
            note = details[:190]
            payment_type = "bankTransfer"

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

    # First pass: count raw UPI name frequency across the WHOLE file (not just remaining)
    # so the >=3 threshold is based on true recurrence, matching the test-batch logic.
    all_txns = json.load(open(parsed_path))
    name_counts = Counter()
    for t in all_txns:
        if t["upi"]:
            name_counts[t["upi"]["name"]] += 1

    new_tags = set()
    results = []
    for t in txns:
        classified = classify(t, name_counts)
        if classified is None:
            continue
        payload, tags = classified
        tag_ids_placeholder = []
        for tag in tags:
            if tag in EXISTING_TAGS:
                tag_ids_placeholder.append(EXISTING_TAGS[tag])
            else:
                new_tags.add(tag)
                tag_ids_placeholder.append(f"TAG:{tag}")
        payload["tagNames"] = tags
        payload["_tagRefs"] = tag_ids_placeholder
        results.append(payload)

    out = {
        "accountId": "01a0d415-2a9f-733d-a25a-935b4504260c",
        "newTagsNeeded": sorted(new_tags),
        "existingTags": EXISTING_TAGS,
        "transactions": results,
    }
    json.dump(out, open(out_path, "w"), indent=None)
    print(f"Total remaining: {len(results)}", file=sys.stderr)
    print(f"New tags needed ({len(new_tags)}): {sorted(new_tags)}", file=sys.stderr)


if __name__ == "__main__":
    main(sys.argv[1], int(sys.argv[2]), sys.argv[3])
