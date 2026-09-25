"""
Parse a decrypted SBI account-statement xlsx into structured transaction rows.
Identifies transaction rows by the DD/MM/YYYY date pattern in col A, extracts
UPI metadata (direction, ref no, counterparty, bank handle, VPA fragment),
and classifies a suggested category/tag set — all without any LLM call.
"""
import openpyxl, re, sys, json

DATE_RE = re.compile(r'^\d{2}/\d{2}/\d{4}$')
UPI_RE = re.compile(
    r'UPI/(?P<dir>DR|CR)/(?P<ref>\d+)/(?P<name>[^/]+)/(?P<bank>[^/]+)/(?P<vpa>[^/]+)/(?P<note>.*)',
    re.DOTALL,
)

def clean(s):
    return re.sub(r'\s+', ' ', (s or '')).strip()

def parse_details(details):
    d = clean(details)
    kind = None
    if d.startswith('WDL TFR'):
        kind = 'WDL TFR'
    elif d.startswith('DEP TFR'):
        kind = 'DEP TFR'
    elif 'INTEREST' in d.replace(' ', ''):
        kind = 'INTEREST CREDIT'
    elif d.startswith('INB'):
        kind = 'INB'

    m = UPI_RE.search(d)
    upi = None
    if m:
        upi = {
            'direction': m.group('dir'),
            'refNo': m.group('ref'),
            'name': clean(m.group('name')),
            'bank': clean(m.group('bank')),
            'vpa': clean(m.group('vpa')),
            'note': clean(m.group('note'))[:40],
        }
    return kind, upi, d

def to_amount(v):
    if v is None:
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

def parse_file(path):
    wb = openpyxl.load_workbook(path, data_only=True)
    ws = wb.worksheets[0]
    rows = list(ws.iter_rows(values_only=True))
    out = []
    for r in rows:
        date_raw = r[0]
        if not date_raw or not DATE_RE.match(str(date_raw)):
            continue
        details = r[1]
        debit = to_amount(r[3])
        credit = to_amount(r[4])
        balance = to_amount(r[5])
        kind, upi, clean_details = parse_details(details)
        out.append({
            'date': date_raw,
            'kind': kind,
            'debit': debit,
            'credit': credit,
            'balance': balance,
            'upi': upi,
            'rawDetails': clean_details,
        })
    return out

if __name__ == '__main__':
    path = sys.argv[1]
    txns = parse_file(path)
    print(f'Parsed {len(txns)} transaction rows from {path}', file=sys.stderr)
    print(json.dumps(txns, indent=None))
