"""
Parse a decrypted HGB (Haryana Gramin Bank) mPassbook PDF into structured
transaction rows.

The passbook's transaction table (Date, Instrument ID, Amount, Type, Balance,
Remarks) is extracted per-page via pdfplumber's table detection. The Remarks
column wraps onto a second physical line inside the same cell mid-word (the
column is too narrow for long UPI narrations/VPAs), so pdfplumber returns it
as a single string containing an embedded newline; those are rejoined with no
separator since the break falls inside a word/VPA, not between words.

Remarks narrations seen in this bank's exports:
  UPI/<ref>/<P2A|P2V>/<vpa-or-account>/<name>        -- UPI transfer, counterparty
                                                          name is the last '/'-
                                                          separated field (often
                                                          truncated by the column
                                                          width)
  UPI-REV/<ref>/...                                  -- UPI reversal/refund
  ATM/CWDR/...                                        -- ATM cash withdrawal
  Loan Account Payments For : <loan-account>          -- loan EMI debit
  D<digits>                                           -- same loan EMI debit,
                                                          under its standing-
                                                          instruction code
  <account> to <account> / <account>:Int.Pd:<range>  -- self/linked-account
                                                          transfer, or interest
                                                          credit
"""
import json
import re
import sys

import pdfplumber

DATE_RE = re.compile(r'^\d{2}-\d{2}-\d{4}$')
HEADER = ('Date', 'Instrument ID', 'Amount', 'Type', 'Balance', 'Remarks')


def clean_remarks(s):
    return re.sub(r'\s+', ' ', (s or '').replace('\n', '')).strip()


def to_amount(v):
    if v is None:
        return None
    v = str(v).replace(',', '').strip()
    if not v:
        return None
    try:
        return float(v)
    except ValueError:
        return None


def extract_upi_name(remarks):
    if not remarks.startswith('UPI/') and not remarks.startswith('UPI-REV/'):
        return None
    parts = remarks.split('/')
    name = parts[-1].strip() if parts else ''
    return name or None


def classify_kind(remarks):
    if remarks.startswith('UPI-REV/'):
        return 'UPI_REV'
    if remarks.startswith('UPI/'):
        return 'UPI'
    if remarks.startswith('ATM/CWDR'):
        return 'ATM'
    if remarks.startswith('Loan Account Payments For') or re.match(r'^D\d+$', remarks):
        return 'LOAN_EMI'
    if ':Int.Pd:' in remarks:
        return 'INTEREST'
    if re.match(r'^\d+\s+to\s+\S+$', remarks):
        return 'INTERNAL_TRANSFER'
    return 'OTHER'


def parse_file(path):
    out = []
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            for table in page.extract_tables():
                for row in table:
                    if tuple(c.strip() if c else c for c in row[:6]) == HEADER:
                        continue
                    date_raw = (row[0] or '').strip()
                    if not DATE_RE.match(date_raw):
                        continue
                    amount = to_amount(row[2])
                    txn_type = (row[3] or '').strip().upper()
                    balance = to_amount(row[4])
                    remarks = clean_remarks(row[5])
                    kind = classify_kind(remarks)
                    name = extract_upi_name(remarks) if kind in ('UPI', 'UPI_REV') else None
                    out.append({
                        'date': date_raw,
                        'amount': amount,
                        'type': txn_type,
                        'balance': balance,
                        'remarks': remarks,
                        'kind': kind,
                        'name': name,
                    })
    return out


if __name__ == '__main__':
    path = sys.argv[1]
    txns = parse_file(path)
    print(f'Parsed {len(txns)} transaction rows from {path}', file=sys.stderr)
    print(json.dumps(txns, indent=None))
