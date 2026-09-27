# Income Credit Linking & Backfill Scripts

This directory contains standalone database update and migration scripts used to backfill and link bank salary transactions to their respective `IncomeSources`, `IncomeCredits`, and `IncomeCreditComponents`.

## Scripts Overview

| Script                                    | Target Employer              | IncomeSource ID                                                                  | Description                                                             | Count |  Total (INR)  |
| :---------------------------------------- | :--------------------------- | :------------------------------------------------------------------------------- | :---------------------------------------------------------------------- | :---: | :-----------: |
| `01-insert-credgenics-credits.js`         | Credgenics (Analog LegalHub) | `01a0e3aa-1d55-72d8-967b-1b0da0c36112`                                           | Initial 28 NEFT salary transactions                                     |  28   | ₹2,723,395.30 |
| `02-insert-trajector-parviom-credits.js`  | Trajector & Parviom (Park+)  | `01a0e386-a285-7537-bb7b-8716302fd9d7`<br>`01a0e384-950d-7591-838a-a1f0fbc0f0f9` | 15 Trajector India NEFTs + 13 Parviom bonus/reimbursement payouts       |  28   | ₹5,347,358.00 |
| `03-insert-park-companion-credits.js`     | Park+ (Parviom Technologies) | `01a0e384-950d-7591-838a-a1f0fbc0f0f9`                                           | 14 companion `Salary (NEFT)` payouts during two-part salary structure   |  14   | ₹1,745,547.00 |
| `04-insert-credgenics-missing-credits.js` | Credgenics (Analog LegalHub) | `01a0e3aa-1d55-72d8-967b-1b0da0c36112`                                           | 3 RTGS deposits via Kotak Mahindra (Mar, Apr, May 2023)                 |   3   |  ₹710,724.00  |
| `05-insert-trajector-missing-credits.js`  | Trajector                    | `01a0e386-a285-7537-bb7b-8716302fd9d7`                                           | 10 monthly salaries (Aug 2024 – May 2025) including first salary & RTGS |  10   | ₹2,976,188.00 |

## Execution Pattern

All scripts execute directly against PostgreSQL (`127.0.0.1:5433`, database `budget-tracker`) inside an atomic database transaction (`BEGIN ... COMMIT`).

To execute any script manually:

```bash
NODE_PATH=./node_modules node scripts/income-credits/<script-name>.js
```
