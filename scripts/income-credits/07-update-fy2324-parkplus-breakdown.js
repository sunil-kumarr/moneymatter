const { Client } = require('pg');
const { v7: uuidv7 } = require('uuid');

async function run() {
  const client = new Client({
    host: '127.0.0.1',
    port: 5433,
    user: 'username',
    password: 'IrjZoQkGrkTRbeOYusYJseofN4h86si',
    database: 'budget-tracker',
  });

  await client.connect();
  console.log('Connected to PostgreSQL');

  const sourceId = '01a0e384-950d-7591-838a-a1f0fbc0f0f9'; // Park+

  const sourceRes = await client.query(
    `SELECT id, "userId", name, "employerName", "currencyCode" 
     FROM "IncomeSources" 
     WHERE id = $1`,
    [sourceId],
  );

  if (sourceRes.rows.length === 0) {
    throw new Error(`IncomeSource ${sourceId} not found`);
  }

  const source = sourceRes.rows[0];
  console.log('Source found:', source.name, `(${source.id})`);
  const userId = source.userId;
  const currencyCode = source.currencyCode;
  const now = new Date();

  // Definition of updates for each of the 20 credits in FY 23-24
  const creditUpdates = [
    // ----------------- July 2023 -----------------
    // Tx 1: 2023-08-01 - 146,139 (Salary NEFT)
    {
      id: '01a0e3bf-e1f7-7092-b941-6789f2434144',
      month: 'July 2023 (Part 1 - NEFT)',
      creditDate: '2023-07-31',
      periodStart: '2023-07-01',
      periodEnd: '2023-07-31',
      components: [
        { name: 'Basic', kind: 'earning', amount: 7569900, sortOrder: 0 },
        { name: 'Special Allowance', kind: 'earning', amount: 7224000, sortOrder: 1 },
        { name: 'Provident Fund', kind: 'deduction', amount: 180000, sortOrder: 2 },
      ],
    },
    // Tx 2: 2023-08-10 - 39,628 (Salary NEFT)
    {
      id: '01a0e3bf-e1f9-7768-b75f-665d94d6ec18',
      month: 'July 2023 (Part 2 - NEFT)',
      creditDate: '2023-07-31',
      periodStart: '2023-07-01',
      periodEnd: '2023-07-31',
      components: [
        { name: 'HRA', kind: 'earning', amount: 3784900, sortOrder: 0 },
        { name: 'Special Allowance', kind: 'earning', amount: 177900, sortOrder: 1 },
      ],
    },

    // ----------------- August 2023 -----------------
    // Tx: 2023-09-01 - 182,948 (Salary NEFT)
    {
      id: '01a0e3bf-e1fb-74b9-b415-04e20690fa0a',
      month: 'August 2023 (NEFT)',
      creditDate: '2023-08-31',
      periodStart: '2023-08-01',
      periodEnd: '2023-08-31',
      components: [
        { name: 'Basic', kind: 'earning', amount: 10666700, sortOrder: 0 },
        { name: 'HRA', kind: 'earning', amount: 5333300, sortOrder: 1 },
        { name: 'Special Allowance', kind: 'earning', amount: 4353300, sortOrder: 2 },
        { name: 'NPS', kind: 'employer_contribution', amount: 1066700, sortOrder: 3 },
        { name: 'Provident Fund', kind: 'deduction', amount: 180000, sortOrder: 4 },
        { name: 'TDS', kind: 'deduction', amount: 1878500, sortOrder: 5 },
      ],
    },

    // ----------------- September 2023 -----------------
    // Tx 1: 2023-09-30 - 152,066 (Salary NEFT)
    {
      id: '01a0e3bf-e1fc-721d-b2a9-911dfb48af11',
      month: 'September 2023 (Salary NEFT)',
      creditDate: '2023-09-30',
      periodStart: '2023-09-01',
      periodEnd: '2023-09-30',
      components: [
        { name: 'Basic', kind: 'earning', amount: 10666700, sortOrder: 0 },
        { name: 'HRA', kind: 'earning', amount: 5333300, sortOrder: 1 },
        { name: 'NPS', kind: 'employer_contribution', amount: 810000, sortOrder: 2 },
        { name: 'Regular Perquisites', kind: 'employer_contribution', amount: 270000, sortOrder: 3 },
        { name: 'Provident Fund', kind: 'deduction', amount: 180000, sortOrder: 4 },
        { name: 'TDS', kind: 'deduction', amount: 613400, sortOrder: 5 },
      ],
    },
    // Tx 2: 2023-09-30 - 103,157 (Parviom Technologies - Flexi)
    {
      id: '01a0e3b4-d1f2-777e-84bf-83c46c91beac',
      month: 'September 2023 (Parviom Flexi)',
      creditDate: '2023-09-30',
      periodStart: '2023-09-01',
      periodEnd: '2023-09-30',
      components: [{ name: 'Flexi Benefit', kind: 'earning', amount: 10315700, sortOrder: 0 }],
    },

    // ----------------- October 2023 -----------------
    // Tx 1: 2023-11-01 - 169,890 (Salary NEFT)
    {
      id: '01a0e3bf-e1fd-745b-b723-721f858caecc',
      month: 'October 2023 (Salary NEFT)',
      creditDate: '2023-10-31',
      periodStart: '2023-10-01',
      periodEnd: '2023-10-31',
      components: [
        { name: 'Basic', kind: 'earning', amount: 10666700, sortOrder: 0 },
        { name: 'HRA', kind: 'earning', amount: 5333300, sortOrder: 1 },
        { name: 'Special Allowance', kind: 'earning', amount: 1782400, sortOrder: 2 },
        { name: 'NPS', kind: 'employer_contribution', amount: 810000, sortOrder: 3 },
        { name: 'Regular Perquisites', kind: 'employer_contribution', amount: 270000, sortOrder: 4 },
        { name: 'Provident Fund', kind: 'deduction', amount: 180000, sortOrder: 5 },
        { name: 'TDS', kind: 'deduction', amount: 613400, sortOrder: 6 },
      ],
    },
    // Tx 2: 2023-11-01 - 47,243 (Parviom Technologies - Flexi)
    {
      id: '01a0e3b4-d1f3-71de-aaad-3daec25e6402',
      month: 'October 2023 (Parviom Flexi 1)',
      creditDate: '2023-10-31',
      periodStart: '2023-10-01',
      periodEnd: '2023-10-31',
      components: [{ name: 'Flexi Benefit', kind: 'earning', amount: 4724300, sortOrder: 0 }],
    },
    // Tx 3: 2023-11-04 - 32,640 (Parviom Technologies - Flexi)
    {
      id: '01a0e3b4-d1f4-74ba-b4dc-a5b14f7760ea',
      month: 'October 2023 (Parviom Flexi 2)',
      creditDate: '2023-10-31',
      periodStart: '2023-10-01',
      periodEnd: '2023-10-31',
      components: [{ name: 'Flexi Benefit', kind: 'earning', amount: 3264000, sortOrder: 0 }],
    },

    // ----------------- November 2023 -----------------
    // Tx 1: 2023-12-01 - 152,066 (Salary NEFT)
    {
      id: '01a0e3bf-e1fe-7359-9665-4873eabc9972',
      month: 'November 2023 (Salary NEFT)',
      creditDate: '2023-11-30',
      periodStart: '2023-11-01',
      periodEnd: '2023-11-30',
      components: [
        { name: 'Basic', kind: 'earning', amount: 10666700, sortOrder: 0 },
        { name: 'HRA', kind: 'earning', amount: 5333300, sortOrder: 1 },
        { name: 'NPS', kind: 'employer_contribution', amount: 810000, sortOrder: 2 },
        { name: 'Regular Perquisites', kind: 'employer_contribution', amount: 270000, sortOrder: 3 },
        { name: 'Provident Fund', kind: 'deduction', amount: 180000, sortOrder: 4 },
        { name: 'TDS', kind: 'deduction', amount: 613400, sortOrder: 5 },
      ],
    },
    // Tx 2: 2023-12-01 - 51,360 (Parviom Technologies - Flexi)
    {
      id: '01a0e3b4-d1f5-76dd-9b34-15488517b1c5',
      month: 'November 2023 (Parviom Flexi)',
      creditDate: '2023-11-30',
      periodStart: '2023-11-01',
      periodEnd: '2023-11-30',
      components: [{ name: 'Flexi Benefit', kind: 'earning', amount: 5136000, sortOrder: 0 }],
    },
    // Tx 3: 2023-12-05 - 23,000 (Salary NEFT)
    {
      id: '01a0e3bf-e1ff-76ef-a086-2c80a3451daf',
      month: 'November 2023 (Salary NEFT Additional)',
      creditDate: '2023-11-30',
      periodStart: '2023-11-01',
      periodEnd: '2023-11-30',
      components: [{ name: 'Special Allowance', kind: 'earning', amount: 2300000, sortOrder: 0 }],
    },

    // ----------------- December 2023 -----------------
    // Tx 1: 2024-01-01 - 152,066 (Salary NEFT)
    {
      id: '01a0e3bf-e200-738d-bbb3-3b7b2b2b80b3',
      month: 'December 2023 (Salary NEFT)',
      creditDate: '2023-12-31',
      periodStart: '2023-12-01',
      periodEnd: '2023-12-31',
      components: [
        { name: 'Basic', kind: 'earning', amount: 10666700, sortOrder: 0 },
        { name: 'HRA', kind: 'earning', amount: 5333300, sortOrder: 1 },
        { name: 'NPS', kind: 'employer_contribution', amount: 810000, sortOrder: 2 },
        { name: 'Regular Perquisites', kind: 'employer_contribution', amount: 270000, sortOrder: 3 },
        { name: 'Provident Fund', kind: 'deduction', amount: 180000, sortOrder: 4 },
        { name: 'TDS', kind: 'deduction', amount: 613400, sortOrder: 5 },
      ],
    },
    // Tx 2: 2024-01-01 - 66,655 (Parviom Technologies - Flexi)
    {
      id: '01a0e3b4-d1f6-720c-ad30-30e2e98b7993',
      month: 'December 2023 (Parviom Flexi)',
      creditDate: '2023-12-31',
      periodStart: '2023-12-01',
      periodEnd: '2023-12-31',
      components: [{ name: 'Flexi Benefit', kind: 'earning', amount: 6665500, sortOrder: 0 }],
    },

    // ----------------- January 2024 -----------------
    // Tx 1: 2024-02-01 - 138,145 (Salary NEFT)
    {
      id: '01a0e3bf-e201-7286-a9b9-aa82fc75e9c2',
      month: 'January 2024 (Salary NEFT)',
      creditDate: '2024-01-31',
      periodStart: '2024-01-01',
      periodEnd: '2024-01-31',
      components: [
        { name: 'Basic', kind: 'earning', amount: 9634400, sortOrder: 0 },
        { name: 'HRA', kind: 'earning', amount: 4817200, sortOrder: 1 },
        { name: 'NPS', kind: 'employer_contribution', amount: 731600, sortOrder: 2 },
        { name: 'Regular Perquisites', kind: 'employer_contribution', amount: 270000, sortOrder: 3 },
        { name: 'Provident Fund', kind: 'deduction', amount: 180000, sortOrder: 4 },
        { name: 'TDS', kind: 'deduction', amount: 457100, sortOrder: 5 },
      ],
    },
    // Tx 2: 2024-02-01 - 80,227 (Parviom Technologies - Flexi)
    {
      id: '01a0e3b4-d1f7-710e-bdfa-366dd73839d3',
      month: 'January 2024 (Parviom Flexi)',
      creditDate: '2024-01-31',
      periodStart: '2024-01-01',
      periodEnd: '2024-01-31',
      components: [{ name: 'Flexi Benefit', kind: 'earning', amount: 8022700, sortOrder: 0 }],
    },

    // ----------------- February 2024 -----------------
    // Tx 1: 2024-03-01 - 72,399 (Salary NEFT)
    {
      id: '01a0e3bf-e202-76ac-9c3f-bfde02f97c61',
      month: 'February 2024 (Salary NEFT)',
      creditDate: '2024-02-29',
      periodStart: '2024-02-01',
      periodEnd: '2024-02-29',
      components: [
        { name: 'Basic', kind: 'earning', amount: 10666700, sortOrder: 0 },
        { name: 'Basic Arrears', kind: 'earning', amount: 1032300, sortOrder: 1 },
        { name: 'HRA', kind: 'earning', amount: 5333300, sortOrder: 2 },
        { name: 'HRA Arrears', kind: 'earning', amount: 516100, sortOrder: 3 },
        { name: 'NPS', kind: 'employer_contribution', amount: 888400, sortOrder: 4 },
        { name: 'Regular Perquisites', kind: 'employer_contribution', amount: 270000, sortOrder: 5 },
        { name: 'Provident Fund', kind: 'deduction', amount: 180000, sortOrder: 6 },
        { name: 'TDS', kind: 'deduction', amount: 10128500, sortOrder: 7 },
      ],
    },
    // Tx 2: 2024-03-01 - 60,791 (Parviom Technologies - Flexi)
    {
      id: '01a0e3b4-d1f9-745f-9756-3514c5d491b4',
      month: 'February 2024 (Parviom Flexi 1)',
      creditDate: '2024-02-29',
      periodStart: '2024-02-01',
      periodEnd: '2024-02-29',
      components: [{ name: 'Flexi Benefit', kind: 'earning', amount: 6079100, sortOrder: 0 }],
    },
    // Tx 3: 2024-03-01 - 719 (Parviom Technologies - Flexi)
    {
      id: '01a0e3b4-d1f8-75df-a51b-7f6a39d36e61',
      month: 'February 2024 (Parviom Flexi 2)',
      creditDate: '2024-02-29',
      periodStart: '2024-02-01',
      periodEnd: '2024-02-29',
      components: [{ name: 'Flexi Benefit', kind: 'earning', amount: 71900, sortOrder: 0 }],
    },

    // ----------------- March 2024 -----------------
    // Tx 1: 2024-04-02 - 75,906 (Salary NEFT)
    {
      id: '01a0e3bf-e203-7734-bcae-dfa7895bf665',
      month: 'March 2024 (Salary NEFT)',
      creditDate: '2024-03-31',
      periodStart: '2024-03-01',
      periodEnd: '2024-03-31',
      components: [
        { name: 'Basic', kind: 'earning', amount: 10666700, sortOrder: 0 },
        { name: 'HRA', kind: 'earning', amount: 5333300, sortOrder: 1 },
        { name: 'NPS', kind: 'employer_contribution', amount: 810000, sortOrder: 2 },
        { name: 'Regular Perquisites', kind: 'employer_contribution', amount: 270000, sortOrder: 3 },
        { name: 'Provident Fund', kind: 'deduction', amount: 180000, sortOrder: 4 },
        { name: 'TDS', kind: 'deduction', amount: 8229400, sortOrder: 5 },
      ],
    },
    // Tx 2: 2024-04-02 - 86,295 (Parviom Technologies - Flexi)
    {
      id: '01a0e3b4-d1fa-7653-afc1-e97c7044de3f',
      month: 'March 2024 (Parviom Flexi)',
      creditDate: '2024-03-31',
      periodStart: '2024-03-01',
      periodEnd: '2024-03-31',
      components: [{ name: 'Flexi Benefit', kind: 'earning', amount: 8629500, sortOrder: 0 }],
    },
  ];

  try {
    await client.query('BEGIN');
    console.log('Started database transaction');

    for (const update of creditUpdates) {
      console.log(`\nProcessing ${update.month} (${update.id})...`);

      // 1. Fetch current credit details
      const creditRes = await client.query(`SELECT * FROM "IncomeCredits" WHERE id = $1`, [update.id]);
      if (creditRes.rows.length === 0) {
        throw new Error(`IncomeCredit ${update.id} not found`);
      }
      const existing = creditRes.rows[0];

      // 2. Calculate totals from components
      const totalGross = update.components.filter((c) => c.kind === 'earning').reduce((sum, c) => sum + c.amount, 0);

      const totalDeductions = update.components
        .filter((c) => c.kind === 'deduction')
        .reduce((sum, c) => sum + c.amount, 0);

      const employerContributions = update.components
        .filter((c) => c.kind === 'employer_contribution')
        .reduce((sum, c) => sum + c.amount, 0);

      const netAmount = totalGross - totalDeductions;

      if (BigInt(netAmount) !== BigInt(existing.netAmount)) {
        throw new Error(
          `Net amount mismatch for ${update.month}: calculated ${netAmount} vs existing ${existing.netAmount}`,
        );
      }

      // 3. Delete existing components
      const delRes = await client.query(
        `DELETE FROM "IncomeCreditComponents" WHERE "incomeCreditId" = $1 RETURNING id`,
        [update.id],
      );
      console.log(`  Deleted ${delRes.rowCount} previous component(s)`);

      // 4. Insert new components
      for (const comp of update.components) {
        const compId = uuidv7();
        await client.query(
          `INSERT INTO "IncomeCreditComponents" (
            id, "userId", "incomeCreditId", name, kind,
            amount, "refAmount", "sortOrder", "metaData",
            "createdAt", "updatedAt"
          ) VALUES (
            $1, $2, $3, $4, $5,
            $6, $7, $8, $9,
            $10, $11
          )`,
          [compId, userId, update.id, comp.name, comp.kind, comp.amount, comp.amount, comp.sortOrder, null, now, now],
        );
        console.log(`  Inserted: ${comp.name} (${comp.kind}) = ₹${comp.amount / 100}`);
      }

      // 5. Update IncomeCredit record
      await client.query(
        `UPDATE "IncomeCredits"
         SET "creditDate" = $1,
             "periodStart" = $2,
             "periodEnd" = $3,
             "grossAmount" = $4,
             "totalDeductions" = $5,
             "netAmount" = $6,
             "employerContributions" = $7,
             "refGrossAmount" = $4,
             "refTotalDeductions" = $5,
             "refNetAmount" = $6,
             "updatedAt" = $8
         WHERE id = $9`,
        [
          update.creditDate,
          update.periodStart,
          update.periodEnd,
          totalGross,
          totalDeductions,
          netAmount,
          employerContributions,
          now,
          update.id,
        ],
      );
      console.log(
        `  Updated IncomeCredit: gross=₹${totalGross / 100}, ded=₹${totalDeductions / 100}, net=₹${netAmount / 100}, employerContrib=₹${employerContributions / 100}`,
      );
    }

    await client.query('COMMIT');
    console.log('\nAll 20 credits updated and committed successfully!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error during update, rolled back:', err);
    throw err;
  } finally {
    await client.end();
  }
}

run().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
