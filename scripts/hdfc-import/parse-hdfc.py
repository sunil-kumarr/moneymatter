"""
Parse an HDFC account-statement .xls export into structured transaction rows.
HDFC statements are plain (not password-protected) old-style binary .xls files
read via xlrd, with a fixed column layout:
  Date, Narration, Chq./Ref.No., Value Dt, Withdrawal Amt., Deposit Amt., Closing Balance

Identifies the transaction table by locating the "Date"/"Narration" header row
(its position varies slightly between exports), then extracts a counterparty
"name" from common narration shapes (UPI-, NEFT CR-, NEFT DR-, IMPS-, RTGS DR-,
RTGS CR-) by positional splitting on "-", which is enough to drive rule-based
classification. No LLM call involved.
"""
import re
import sys
import json

import xlrd

DATE_RE = re.compile(r'^\d{2}/\d{2}/\d{2}$')


def clean(s):
    return re.sub(r'\s+', ' ', (s or '')).strip()


def to_amount(v):
    if v is None or v == '':
        return None
    if isinstance(v, (int, float)):
        return float(v)
    v = str(v).replace(',', '').strip()
    if not v:
        return None
    try:
        return float(v)
    except ValueError:
        return None


def classify_kind_and_name(narration):
    n = narration
    parts = n.split('-')

    if n.startswith('UPIRET'):
        return 'UPIRET', None
    if n.startswith('UPI-'):
        name = clean(parts[1]) if len(parts) > 1 else None
        return 'UPI', name
    if n.startswith('NEFT CR'):
        name = clean(parts[2]) if len(parts) > 2 else None
        return 'NEFT CR', name
    if n.startswith('NEFT DR'):
        name = clean(parts[2]) if len(parts) > 2 else None
        return 'NEFT DR', name
    if n.startswith('IMPS P2P'):
        return 'IMPS P2P', None
    if n.startswith('IMPS-'):
        name = clean(parts[2]) if len(parts) > 2 else None
        return 'IMPS', name
    if n.startswith('RTGS DR'):
        name = clean(parts[2]) if len(parts) > 2 else None
        return 'RTGS DR', name
    if n.startswith('RTGS CR'):
        name = clean(parts[2]) if len(parts) > 2 else None
        return 'RTGS CR', name
    if n.startswith('FD THROUGH NET') or n.startswith('FD PREMATURE'):
        return 'FD', None
    if n.startswith('ATW') or n.startswith('ATM'):
        return 'ATM', None
    if 'INTEREST PAID' in n.upper() or 'CREDIT INTEREST CAPITALISED' in n.upper():
        return 'INTEREST', None
    if n.startswith('CBDT'):
        return 'TAX', None
    return 'OTHER', None


def find_header_row(rows):
    for i, r in enumerate(rows):
        if str(r[0]).strip() == 'Date' and 'Narration' in str(r[1]):
            return i
    raise ValueError('Could not locate Date/Narration header row')


def parse_file(path):
    wb = xlrd.open_workbook(path)
    ws = wb.sheet_by_index(0)
    rows = [ws.row_values(r) for r in range(ws.nrows)]

    header_idx = find_header_row(rows)
    out = []
    for r in rows[header_idx + 1:]:
        date_raw = str(r[0]).strip()
        if not DATE_RE.match(date_raw):
            continue
        narration = clean(r[1])
        ref_no = clean(str(r[2])) if len(r) > 2 else None
        debit = to_amount(r[4]) if len(r) > 4 else None
        credit = to_amount(r[5]) if len(r) > 5 else None
        balance = to_amount(r[6]) if len(r) > 6 else None
        kind, name = classify_kind_and_name(narration)
        out.append({
            'date': date_raw,
            'narration': narration,
            'refNo': ref_no,
            'debit': debit,
            'credit': credit,
            'balance': balance,
            'kind': kind,
            'name': name,
        })
    return out


if __name__ == '__main__':
    path = sys.argv[1]
    txns = parse_file(path)
    print(f'Parsed {len(txns)} transaction rows from {path}', file=sys.stderr)
    print(json.dumps(txns, indent=None))
