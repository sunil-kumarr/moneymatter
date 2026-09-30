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

  const sourceId = '01a0e386-a285-7537-bb7b-8716302fd9d7';

  // Base pre-hike salary components (FY 25-26 Apr-Sep)
  const preHikeBaseEarnings = [
    { name: 'Basic Pay', amount: 16666700 },
    { name: 'House Rent Allowance', amount: 6666700 },
    { name: 'Special Allowance', amount: 8730000 },
    { name: 'Mobile and Internet', amount: 300000 },
    { name: 'Books and Periodicals', amount: 300000 },
    { name: 'Driver Salary', amount: 90000 },
    { name: 'Fuel and Vehicle', amount: 180000 },
    { name: 'Food Coupon', amount: 220000 },
  ];

  // Base post-hike salary components (FY 25-26 Oct onwards & FY 26-27)
  const postHikeBaseEarnings = [
    { name: 'Basic Pay', amount: 18500000 },
    { name: 'House Rent Allowance', amount: 7400000 },
    { name: 'Special Allowance', amount: 9830000 },
    { name: 'Mobile and Internet', amount: 300000 },
    { name: 'Books and Periodicals', amount: 300000 },
    { name: 'Driver Salary', amount: 90000 },
    { name: 'Fuel and Vehicle', amount: 180000 },
    { name: 'Food Coupon', amount: 220000 },
  ];

  // Standard deductions for flexi food coupon months
  const standardFlexiDeductions = (tdsAmount) => [
    { name: 'Provident Fund', kind: 'deduction', amount: 180000 },
    { name: 'Food Coupon Recovery', kind: 'deduction', amount: 220000 },
    { name: 'Tax Deducted at Source (TDS)', kind: 'deduction', amount: tdsAmount },
  ];

  /**
   * Definition of all 25 Trajector monthly credits with exact breakdowns
   */
  const creditBreakdowns = [
    // -------------------------------------------------------------
    // FY 2024-25 (TI00039_TaxStatement_Mar2025.pdf)
    // -------------------------------------------------------------
    {
      id: '01a0e3c5-0c24-75ee-967f-d78d3e734619',
      periodStart: '2024-07-29',
      periodEnd: '2024-08-31',
      components: [
        { name: 'Basic Pay', kind: 'earning', amount: 18279600 }, // 16129 (Jul) + 166667 (Aug)
        { name: 'House Rent Allowance', kind: 'earning', amount: 7311900 }, // 6452 (Jul) + 66667 (Aug)
        { name: 'Special Allowance', kind: 'earning', amount: 10770300 }, // 9503 (Jul) + 98200 (Aug)
        { name: 'Sign-on Bonus', kind: 'earning', amount: 20000000 },
        { name: 'Provident Fund', kind: 'deduction', amount: 360000 }, // 1800 (Jul) + 1800 (Aug)
      ],
    },
    {
      id: '01a0e3c5-0c28-7338-a9b7-0f49651537f0',
      periodStart: '2024-09-01',
      periodEnd: '2024-09-30',
      components: [
        { name: 'Basic Pay', kind: 'earning', amount: 16666700 },
        { name: 'House Rent Allowance', kind: 'earning', amount: 6666700 },
        { name: 'Special Allowance', kind: 'earning', amount: 9820000 },
        { name: 'Provident Fund', kind: 'deduction', amount: 180000 },
        { name: 'Tax Deducted at Source (TDS)', kind: 'deduction', amount: 6902900 },
      ],
    },
    {
      id: '01a0e3c5-0c2b-71bd-a83a-a532c9f8b7d0',
      periodStart: '2024-10-01',
      periodEnd: '2024-10-31',
      components: [
        { name: 'Basic Pay', kind: 'earning', amount: 16666700 },
        { name: 'House Rent Allowance', kind: 'earning', amount: 6666700 },
        { name: 'Special Allowance', kind: 'earning', amount: 9820000 },
        { name: 'Provident Fund', kind: 'deduction', amount: 180000 },
        { name: 'Tax Deducted at Source (TDS)', kind: 'deduction', amount: 6902900 },
      ],
    },
    {
      id: '01a0e3c5-0c2d-73be-a748-24cb682dc955',
      periodStart: '2024-11-01',
      periodEnd: '2024-11-30',
      components: [
        { name: 'Basic Pay', kind: 'earning', amount: 16666700 },
        { name: 'House Rent Allowance', kind: 'earning', amount: 6666700 },
        { name: 'Special Allowance', kind: 'earning', amount: 9820000 },
        { name: 'Provident Fund', kind: 'deduction', amount: 180000 },
        { name: 'Tax Deducted at Source (TDS)', kind: 'deduction', amount: 6902900 },
      ],
    },
    {
      id: '01a0e3c5-0c2f-761e-8ca5-d7f90547da66',
      periodStart: '2024-12-01',
      periodEnd: '2024-12-31',
      components: [
        { name: 'Basic Pay', kind: 'earning', amount: 16666700 },
        { name: 'House Rent Allowance', kind: 'earning', amount: 6666700 },
        { name: 'Special Allowance', kind: 'earning', amount: 9820000 },
        { name: 'Provident Fund', kind: 'deduction', amount: 180000 },
        { name: 'Tax Deducted at Source (TDS)', kind: 'deduction', amount: 7058900 },
      ],
    },
    {
      id: '01a0e3c5-0c30-77e1-b0b7-0f322c858c86',
      periodStart: '2025-01-01',
      periodEnd: '2025-01-31',
      components: [
        { name: 'Basic Pay', kind: 'earning', amount: 16666700 },
        { name: 'House Rent Allowance', kind: 'earning', amount: 6666700 },
        { name: 'Special Allowance', kind: 'earning', amount: 9820000 },
        { name: 'Provident Fund', kind: 'deduction', amount: 180000 },
        { name: 'Tax Deducted at Source (TDS)', kind: 'deduction', amount: 7137000 },
      ],
    },
    {
      id: '01a0e3c5-0c31-734a-84ca-298527c5ef43',
      periodStart: '2025-02-01',
      periodEnd: '2025-02-28',
      components: [
        { name: 'Basic Pay', kind: 'earning', amount: 16666700 },
        { name: 'House Rent Allowance', kind: 'earning', amount: 6666700 },
        { name: 'Special Allowance', kind: 'earning', amount: 9820000 },
        { name: 'Provident Fund', kind: 'deduction', amount: 180000 },
        { name: 'Tax Deducted at Source (TDS)', kind: 'deduction', amount: 7137100 },
      ],
    },
    {
      id: '01a0e3c5-0c32-75d5-8b58-65e176cb908f',
      periodStart: '2025-03-01',
      periodEnd: '2025-03-31',
      components: [
        { name: 'Basic Pay', kind: 'earning', amount: 16666700 },
        { name: 'House Rent Allowance', kind: 'earning', amount: 6666700 },
        { name: 'Special Allowance', kind: 'earning', amount: 9820000 },
        { name: 'Provident Fund', kind: 'deduction', amount: 180000 },
        { name: 'Tax Deducted at Source (TDS)', kind: 'deduction', amount: 7137000 },
      ],
    },

    // -------------------------------------------------------------
    // FY 2025-26 (TI00039_TaxStatement_Mar2026.pdf)
    // -------------------------------------------------------------
    {
      id: '01a0e3c5-0c33-7498-8dd6-17d7377f1c12', // 2025-04
      periodStart: '2025-04-01',
      periodEnd: '2025-04-30',
      components: [...preHikeBaseEarnings.map((c) => ({ ...c, kind: 'earning' })), ...standardFlexiDeductions(6066900)],
    },
    {
      id: '01a0e3c5-0c36-75c8-8b01-307c99b07510', // 2025-05
      periodStart: '2025-05-01',
      periodEnd: '2025-05-31',
      components: [
        ...preHikeBaseEarnings.map((c) => ({ ...c, kind: 'earning' })),
        { name: 'Quarterly Bonus', kind: 'earning', amount: 10000000 },
        ...standardFlexiDeductions(9458000),
      ],
    },
    {
      id: '01a0e3b4-d1d6-731a-9281-a3e942eab9b8', // 2025-06
      periodStart: '2025-06-01',
      periodEnd: '2025-06-30',
      components: [...preHikeBaseEarnings.map((c) => ({ ...c, kind: 'earning' })), ...standardFlexiDeductions(6338000)],
    },
    {
      id: '01a0e3b4-d1d9-70cc-a27c-419c60d29f73', // 2025-07
      periodStart: '2025-07-01',
      periodEnd: '2025-07-31',
      components: [...preHikeBaseEarnings.map((c) => ({ ...c, kind: 'earning' })), ...standardFlexiDeductions(6338000)],
    },
    {
      id: '01a0e3b4-d1dd-751e-9f9f-1fa5b136da5c', // 2025-08
      periodStart: '2025-08-01',
      periodEnd: '2025-08-31',
      components: [
        ...preHikeBaseEarnings.map((c) => ({ ...c, kind: 'earning' })),
        { name: 'Quarterly Bonus', kind: 'earning', amount: 10000000 },
        { name: 'Reimbursement / Adjustment', kind: 'earning', amount: 500000 },
        ...standardFlexiDeductions(9614000),
      ],
    },
    {
      id: '01a0e3b4-d1df-7701-afed-14390d3d9e79', // 2025-09
      periodStart: '2025-09-01',
      periodEnd: '2025-09-30',
      components: [...preHikeBaseEarnings.map((c) => ({ ...c, kind: 'earning' })), ...standardFlexiDeductions(6338000)],
    },
    {
      id: '01a0e3b4-d1e1-73f9-9ee4-60d034fb2b0c', // 2025-10
      periodStart: '2025-10-01',
      periodEnd: '2025-10-31',
      components: [
        ...postHikeBaseEarnings.map((c) => ({ ...c, kind: 'earning' })),
        ...standardFlexiDeductions(7539200),
      ],
    },
    {
      id: '01a0e3b4-d1e3-719f-a7ef-5a2a886a9ba4', // 2025-11
      periodStart: '2025-11-01',
      periodEnd: '2025-11-30',
      components: [
        ...postHikeBaseEarnings.map((c) => ({ ...c, kind: 'earning' })),
        { name: 'Quarterly Bonus', kind: 'earning', amount: 10000000 },
        ...standardFlexiDeductions(10659200),
      ],
    },
    {
      id: '01a0e3b4-d1e5-7250-9989-f61d5a2b010d', // 2025-12
      periodStart: '2025-12-01',
      periodEnd: '2025-12-31',
      components: [
        ...postHikeBaseEarnings.map((c) => ({ ...c, kind: 'earning' })),
        ...standardFlexiDeductions(7470400),
      ],
    },
    {
      id: '01a0e3b4-d1e6-7671-a314-cd6cf79dd132', // 2026-01
      periodStart: '2026-01-01',
      periodEnd: '2026-01-31',
      components: [
        ...postHikeBaseEarnings.map((c) => ({ ...c, kind: 'earning' })),
        ...standardFlexiDeductions(15208200),
      ],
    },
    {
      id: '01a0e3b4-d1e7-7022-8b06-9e39e448b887', // 2026-02
      periodStart: '2026-02-01',
      periodEnd: '2026-02-28',
      components: [
        ...postHikeBaseEarnings.map((c) => ({ ...c, kind: 'earning' })),
        ...standardFlexiDeductions(16836800),
      ],
    },
    {
      id: '01a0e3b4-d1e8-773f-9233-ef176e90c99d', // 2026-03
      periodStart: '2026-03-01',
      periodEnd: '2026-03-31',
      components: [
        ...postHikeBaseEarnings.map((c) => ({ ...c, kind: 'earning' })),
        { name: 'Quarterly Bonus', kind: 'earning', amount: 11100000 },
        ...standardFlexiDeductions(20300000),
      ],
    },

    // -------------------------------------------------------------
    // FY 2026-27 (TI00039_TaxStatement_Apr2026.pdf)
    // -------------------------------------------------------------
    {
      id: '01a0e3b4-d1e9-753d-87ab-9bbf789b2ea7', // 2026-04
      periodStart: '2026-04-01',
      periodEnd: '2026-04-30',
      components: [
        ...postHikeBaseEarnings.map((c) => ({ ...c, kind: 'earning' })),
        ...standardFlexiDeductions(7652800),
      ],
    },
    {
      id: '01a0e3b4-d1ea-746e-88ec-8ac53b11fdf6', // 2026-05
      periodStart: '2026-05-01',
      periodEnd: '2026-05-31',
      components: [
        ...postHikeBaseEarnings.map((c) => ({ ...c, kind: 'earning' })),
        { name: 'Quarterly Bonus', kind: 'earning', amount: 10000000 },
        ...standardFlexiDeductions(10218000),
      ],
    },
    {
      id: '01a0e3b4-d1eb-7329-8511-34e408810644', // 2026-06
      periodStart: '2026-06-01',
      periodEnd: '2026-06-30',
      components: [
        ...postHikeBaseEarnings.map((c) => ({ ...c, kind: 'earning' })),
        ...standardFlexiDeductions(7652900),
      ],
    },
    {
      id: '01a0e3b4-d1ec-73b0-b8a9-b2809c64384a', // 2026-07
      periodStart: '2026-07-01',
      periodEnd: '2026-07-31',
      components: [
        ...postHikeBaseEarnings.map((c) => ({ ...c, kind: 'earning' })),
        { name: 'Quarterly Bonus', kind: 'earning', amount: 10000000 },
        ...standardFlexiDeductions(9861100),
      ],
    },
    {
      id: '01a0e3b4-d1ed-751b-a58d-0933d655309e', // 2026-08
      periodStart: '2026-08-01',
      periodEnd: '2026-08-31',
      components: [
        ...postHikeBaseEarnings.map((c) => ({ ...c, kind: 'earning' })),
        { name: 'Reimbursement / Adjustment', kind: 'earning', amount: 357600 },
        ...standardFlexiDeductions(7652800),
      ],
    },
  ];

  console.log(`Verifying ${creditBreakdowns.length} credits before starting update...`);

  // Verify all credits exist and net amounts match
  for (const item of creditBreakdowns) {
    const res = await client.query(`SELECT * FROM "IncomeCredits" WHERE id = $1`, [item.id]);
    if (res.rows.length === 0) {
      throw new Error(`Credit ${item.id} not found in DB`);
    }
    const currentCredit = res.rows[0];

    let calcGross = 0;
    let calcDed = 0;
    for (const c of item.components) {
      if (c.kind === 'earning') {
        calcGross += c.amount;
      } else if (c.kind === 'deduction') {
        calcDed += c.amount;
      }
    }
    const calcNet = calcGross - calcDed;

    if (BigInt(calcNet) !== BigInt(currentCredit.netAmount)) {
      throw new Error(
        `Net mismatch for credit ${item.id} (${item.periodStart}): calculated ${calcNet}, current DB ${currentCredit.netAmount}`,
      );
    }
  }

  console.log('All 25 credits verified mathematically against database netAmount!');

  await client.query('BEGIN');
  console.log('Started DB Transaction');

  const now = new Date();
  let totalCompsInserted = 0;

  for (const item of creditBreakdowns) {
    const currentCreditRes = await client.query(`SELECT "userId" FROM "IncomeCredits" WHERE id = $1`, [item.id]);
    const userId = currentCreditRes.rows[0].userId;

    // Delete existing components
    const delRes = await client.query(`DELETE FROM "IncomeCreditComponents" WHERE "incomeCreditId" = $1`, [item.id]);

    let calcGross = 0;
    let calcDed = 0;

    for (let i = 0; i < item.components.length; i++) {
      const comp = item.components[i];
      if (comp.kind === 'earning') {
        calcGross += comp.amount;
      } else if (comp.kind === 'deduction') {
        calcDed += comp.amount;
      }

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
        [compId, userId, item.id, comp.name, comp.kind, comp.amount, comp.amount, i, null, now, now],
      );
      totalCompsInserted++;
    }

    const calcNet = calcGross - calcDed;

    // Update IncomeCredits record
    await client.query(
      `UPDATE "IncomeCredits"
       SET "grossAmount" = $1,
           "totalDeductions" = $2,
           "netAmount" = $3,
           "employerContributions" = 0,
           "refGrossAmount" = $1,
           "refTotalDeductions" = $2,
           "refNetAmount" = $3,
           "periodStart" = $4,
           "periodEnd" = $5,
           "updatedAt" = $6
       WHERE id = $7`,
      [calcGross, calcDed, calcNet, item.periodStart, item.periodEnd, now, item.id],
    );
  }

  await client.query('COMMIT');
  console.log(`\nSuccessfully updated all 25 credits with ${totalCompsInserted} components!`);

  // Final summary
  const summaryRes = await client.query(
    `
    SELECT 
      CASE 
        WHEN ic."periodStart" >= '2024-04-01' AND ic."periodStart" <= '2025-03-31' THEN 'FY 2024-25'
        WHEN ic."periodStart" >= '2025-04-01' AND ic."periodStart" <= '2026-03-31' THEN 'FY 2025-26'
        WHEN ic."periodStart" >= '2026-04-01' AND ic."periodStart" <= '2027-03-31' THEN 'FY 2026-27'
        ELSE 'Other'
      END as fy,
      COUNT(ic.id) as count,
      SUM(ic."grossAmount") as total_gross,
      SUM(ic."totalDeductions") as total_deductions,
      SUM(ic."netAmount") as total_net
    FROM "IncomeCredits" ic
    WHERE ic."incomeSourceId" = $1
    GROUP BY fy
    ORDER BY fy ASC
  `,
    [sourceId],
  );

  console.log('\n=== Financial Year Summaries ===');
  for (const row of summaryRes.rows) {
    console.log(
      `${row.fy}: ${row.count} credits | Gross: ₹${(Number(row.total_gross) / 100).toLocaleString('en-IN')} | Deductions: ₹${(Number(row.total_deductions) / 100).toLocaleString('en-IN')} | Net: ₹${(Number(row.total_net) / 100).toLocaleString('en-IN')}`,
    );
  }

  await client.end();
}

run().catch((err) => {
  console.error('Fatal error during update:', err);
  process.exit(1);
});
