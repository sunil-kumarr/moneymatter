const { Client } = require('pg');
const { execSync } = require('child_process');

// Run python to get the parsed PDF data as JSON
const pythonScript = `
import pdfplumber, json

def clean_val(v):
    if not v:
        return 0.0
    v = v.replace(',', '').replace(' ', '')
    try:
        return float(v)
    except:
        return v

def get_pdf_data(path):
    with pdfplumber.open(path) as pdf:
        table = pdf.pages[0].extract_table()
        headers = [c.strip() if c else '' for c in table[0]]
        months = headers[2:-1]
        
        row_dict = {}
        for row in table[1:]:
            desc = row[1].strip().replace('\\n', ' ') if len(row) > 1 and row[1] else ''
            if not desc:
                continue
            row_dict[desc] = [clean_val(c) for c in row[2:-1]]
        
        if len(pdf.pages) > 1:
            t2 = pdf.pages[1].extract_table()
            if t2:
                for row in t2[1:]:
                    desc = row[1].strip().replace('\\n', ' ') if len(row) > 1 and row[1] else ''
                    if desc:
                        row_dict[desc] = [clean_val(c) for c in row[2:-1]]

        result = {}
        for idx, m in enumerate(months):
            m_items = {}
            for k, vals in row_dict.items():
                if idx < len(vals):
                    val = vals[idx]
                    if isinstance(val, float) and val != 0:
                        m_items[k] = val
                    elif isinstance(val, str) and val not in ['0.0', '0', '']:
                        m_items[k] = val
            result[m] = m_items
        return result

data = {
    '2024-25': get_pdf_data('data-files/TI00039_TaxStatement_Mar2025.pdf'),
    '2025-26': get_pdf_data('data-files/TI00039_TaxStatement_Mar2026.pdf'),
    '2026-27': get_pdf_data('data-files/TI00039_TaxStatement_Apr2026.pdf')
}
print(json.dumps(data))
`;

async function main() {
  const pdfJson = execSync(`./scripts/hgb-import/.venv/bin/python -c "${pythonScript.replace(/"/g, '\\"')}"`, {
    maxBuffer: 10 * 1024 * 1024,
  }).toString();

  const taxData = JSON.parse(pdfJson);
  console.log('Successfully extracted PDF tax statements for 2024-25, 2025-26, 2026-27');

  const client = new Client({
    host: '127.0.0.1',
    port: 5433,
    user: 'username',
    password: 'IrjZoQkGrkTRbeOYusYJseofN4h86si',
    database: 'budget-tracker',
  });
  await client.connect();

  const sourceId = '01a0e386-a285-7537-bb7b-8716302fd9d7';

  const res = await client.query(
    `
    SELECT ic.id, ic."creditDate", ic."periodStart", ic."periodEnd", ic."grossAmount", ic."totalDeductions", ic."netAmount",
           t.id as tx_id, t.time, t.amount as tx_amount, t.note as tx_note, t."externalReference"
    FROM "IncomeCredits" ic
    LEFT JOIN "IncomeCreditLinks" icl ON icl."incomeCreditId" = ic.id
    LEFT JOIN "Transactions" t ON t.id = icl."transactionId"
    WHERE ic."incomeSourceId" = $1
    ORDER BY ic."creditDate" ASC
  `,
    [sourceId],
  );

  console.log(`\nFound ${res.rows.length} Trajector credits in database.`);
  for (let i = 0; i < res.rows.length; i++) {
    const r = res.rows[i];
    const cDate = r.creditDate ? r.creditDate.toISOString().slice(0, 10) : 'null';
    const txDate = r.time ? r.time.toISOString().slice(0, 10) : 'null';
    const net = (Number(r.netAmount) / 100).toFixed(2);
    console.log(
      `${(i + 1).toString().padStart(2)}. [${cDate} / Tx ${txDate}] ID: ${r.id} | Net: ₹${net} | Note: ${r.tx_note || ''}`,
    );
  }

  // Check existing components
  const compRes = await client.query(
    `
    SELECT icc.* 
    FROM "IncomeCreditComponents" icc
    JOIN "IncomeCredits" ic ON ic.id = icc."incomeCreditId"
    WHERE ic."incomeSourceId" = $1
  `,
    [sourceId],
  );
  console.log(`\nExisting IncomeCreditComponents count: ${compRes.rows.length}`);

  await client.end();
}

main().catch(console.error);
