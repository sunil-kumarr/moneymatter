"""
Generate sbi-backfill-mapping.json by matching each imported CSV row with
its exact corresponding row in the decrypted SBI account statements (XLSX).
"""
import msoffcrypto, io, openpyxl, glob, re, csv, json, os

PASSWORD = '53440221197'
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.abspath(os.path.join(SCRIPT_DIR, '..', '..'))

MAPPING_FILES = [
    ('data-files/processed/AccountStatement_26092026_121748.xlsx', 'data-files/processed/sbi_import_file5.csv', 0, None),
    ('data-files/processed/AccountStatement_25092026_120333.xlsx', 'data-files/processed/sbi_import_file4.csv', 0, None),
    ('data-files/processed/AccountStatement_25092026_103336.xlsx', 'data-files/processed/sbi_import_file1.csv', 30, None),
    ('data-files/processed/AccountStatement_25092026_103426.xlsx', 'data-files/processed/sbi_import_file2.csv', 0, None),
    ('data-files/processed/AccountStatement_26092026_123532.xlsx', 'data-files/processed/sbi_import_file6.deduped.csv', 0, 'dedup_file6'),
    ('data-files/processed/AccountStatement_25092026_103541.xlsx', 'data-files/processed/sbi_import_file3.csv', 0, None),
]

DATE_RE = re.compile(r'^\d{2}/\d{2}/\d{4}$')
def clean(s):
    return re.sub(r'\s+', ' ', (s or '')).strip()

def main():
    all_records = []

    for rel_xlsx, rel_csv, skip_n, special in MAPPING_FILES:
        xlsx_path = os.path.join(PROJECT_DIR, rel_xlsx)
        csv_path = os.path.join(PROJECT_DIR, rel_csv)

        dec = io.BytesIO()
        with open(xlsx_path, 'rb') as fp:
            of = msoffcrypto.OfficeFile(fp)
            of.load_key(password=PASSWORD)
            of.decrypt(dec)
        dec.seek(0)
        wb = openpyxl.load_workbook(dec, data_only=True)
        ws = wb.worksheets[0]

        xlsx_rows = []
        for r in ws.iter_rows(values_only=True):
            if r[0] and DATE_RE.match(str(r[0])):
                d, m, y = str(r[0]).split('/')
                iso_date = f'{y}-{m}-{d}'
                debit = float(str(r[3]).replace(',', '').strip()) if r[3] else 0.0
                credit = float(str(r[4]).replace(',', '').strip()) if r[4] else 0.0
                signed_amt = credit if credit > 0 else -debit
                xlsx_rows.append({
                    'date': iso_date,
                    'signed_amt': signed_amt,
                    'raw_details': clean(r[1]),
                    'ref_no': clean(r[2]),
                    'balance': float(str(r[5]).replace(',', '').strip()) if r[5] else None
                })

        xlsx_sliced = xlsx_rows[skip_n:]

        with open(csv_path, 'r', encoding='utf-8') as f:
            csv_rows = list(csv.DictReader(f))

        if special == 'dedup_file6':
            matched_xlsx = []
            x_idx = 0
            for cr in csv_rows:
                csv_amt = float(cr['Amount'])
                while x_idx < len(xlsx_sliced):
                    xr = xlsx_sliced[x_idx]
                    if xr['date'] == cr['Date'] and abs(xr['signed_amt'] - csv_amt) < 0.01:
                        matched_xlsx.append(xr)
                        x_idx += 1
                        break
                    x_idx += 1
            xlsx_sliced = matched_xlsx

        assert len(xlsx_sliced) == len(csv_rows), f'Length mismatch in {csv_path}: {len(xlsx_sliced)} vs {len(csv_rows)}'

        for i in range(len(csv_rows)):
            xr = xlsx_sliced[i]
            cr = csv_rows[i]
            csv_amt = float(cr['Amount'])
            assert xr['date'] == cr['Date']
            assert abs(xr['signed_amt'] - csv_amt) < 0.01

            current_desc = cr['Description'].strip()
            raw_det = xr['raw_details']

            if not current_desc:
                new_note = raw_det
            elif current_desc == raw_det or raw_det.startswith(current_desc):
                new_note = raw_det
            elif raw_det in current_desc:
                new_note = current_desc
            else:
                new_note = f'{current_desc} | {raw_det}'

            all_records.append({
                'date': xr['date'],
                'amountCents': int(round(abs(xr['signed_amt']) * 100)),
                'signedAmount': xr['signed_amt'],
                'transactionType': 'income' if xr['signed_amt'] > 0 else 'expense',
                'currentNote': current_desc,
                'rawNarration': raw_det,
                'newNote': new_note,
                'balance': xr['balance'],
                'sourceFile': rel_csv
            })

    output_path = os.path.join(SCRIPT_DIR, 'sbi-backfill-mapping.json')
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(all_records, f, indent=2)

    print(f'Wrote {len(all_records)} mapped records to {output_path}')

if __name__ == '__main__':
    main()
