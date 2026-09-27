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

  try {
    const targetCreditId = '01a0e3b1-c6c3-746f-859d-a2f19d546815';

    // 1. Fetch current credit details
    const creditRes = await client.query(`SELECT * FROM "IncomeCredits" WHERE id = $1`, [targetCreditId]);

    if (creditRes.rows.length === 0) {
      throw new Error(`IncomeCredit ${targetCreditId} not found`);
    }

    const credit = creditRes.rows[0];
    console.log('Current Credit:', {
      id: credit.id,
      incomeSourceId: credit.incomeSourceId,
      creditDate: credit.creditDate,
      grossAmount: credit.grossAmount,
      totalDeductions: credit.totalDeductions,
      netAmount: credit.netAmount,
    });

    const userId = credit.userId;
    const now = new Date();

    const components = [
      { name: 'Basic + DA', kind: 'earning', amount: 3333350, sortOrder: 0 },
      { name: 'HRA', kind: 'earning', amount: 1666675, sortOrder: 1 },
      { name: 'Special Allowance', kind: 'earning', amount: 1666675, sortOrder: 2 },
      { name: 'PF Employee', kind: 'deduction', amount: 180000, sortOrder: 3 },
      { name: 'PF - Employer', kind: 'deduction', amount: 180000, sortOrder: 4 },
      { name: 'Total Income Tax', kind: 'deduction', amount: 147900, sortOrder: 5 },
    ];

    const totalGross = components.filter((c) => c.kind === 'earning').reduce((acc, c) => acc + c.amount, 0);
    const totalDeductions = components.filter((c) => c.kind === 'deduction').reduce((acc, c) => acc + c.amount, 0);
    const netAmount = totalGross - totalDeductions;

    console.log('Calculated Totals:', {
      totalGross,
      totalDeductions,
      netAmount,
    });

    if (BigInt(netAmount) !== BigInt(credit.netAmount)) {
      throw new Error(`Calculated netAmount (${netAmount}) does not match existing netAmount (${credit.netAmount})`);
    }

    // 2. Begin transaction
    await client.query('BEGIN');

    // 3. Delete existing components for this credit
    const delRes = await client.query(`DELETE FROM "IncomeCreditComponents" WHERE "incomeCreditId" = $1 RETURNING id`, [
      targetCreditId,
    ]);
    console.log(`Deleted ${delRes.rowCount} previous component(s)`);

    // 4. Insert new components
    for (const comp of components) {
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
        [
          compId,
          userId,
          targetCreditId,
          comp.name,
          comp.kind,
          comp.amount,
          comp.amount, // refAmount
          comp.sortOrder,
          null, // metaData
          now,
          now,
        ],
      );
      console.log(`Inserted component: ${comp.name} (${comp.kind}) - ${comp.amount / 100}`);
    }

    // 5. Update IncomeCredit record
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
      [totalGross, totalDeductions, netAmount, '2021-04-01', '2021-04-30', now, targetCreditId],
    );

    await client.query('COMMIT');
    console.log('Successfully committed updates to April 2021 salary credit breakdown!');

    // 6. Verification
    const verifyCredit = await client.query(
      `SELECT id, "incomeSourceId", "creditDate", "periodStart", "periodEnd", "grossAmount", "totalDeductions", "netAmount"
       FROM "IncomeCredits" WHERE id = $1`,
      [targetCreditId],
    );
    console.log('Updated Credit:', verifyCredit.rows[0]);

    const verifyComps = await client.query(
      `SELECT name, kind, amount, "refAmount", "sortOrder"
       FROM "IncomeCreditComponents"
       WHERE "incomeCreditId" = $1
       ORDER BY "sortOrder" ASC`,
      [targetCreditId],
    );
    console.log('Updated Components:', verifyComps.rows);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error during update:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run().catch(console.error);
