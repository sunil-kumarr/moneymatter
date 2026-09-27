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

  const targetTxIds = [
    '01a0d737-f934-731c-b3f5-c723033c17e3', // 2023-03-30: 265232
    '01a0d741-920d-7327-ac0b-18fd9ef7dcdc', // 2023-04-28: 206772
    '01a0d741-9498-72f9-b20b-bb28ef465c93', // 2023-05-31: 238720
  ];

  try {
    const credgenicsSourceId = '01a0e3aa-1d55-72d8-967b-1b0da0c36112';
    const salaryPayeeId = '01a0d737-b2ce-773d-a38c-63022c6dc77d';
    const wageCategoryId = '01a0d412-323f-741d-b9ee-edcc7f1b3d86';

    const sourceRes = await client.query(
      `SELECT id, "userId", name, "employerName", "currencyCode" 
       FROM "IncomeSources" 
       WHERE id = $1`,
      [credgenicsSourceId],
    );

    if (sourceRes.rows.length === 0) {
      throw new Error(`IncomeSource ${credgenicsSourceId} not found`);
    }

    const source = sourceRes.rows[0];
    console.log('Target Source:', source);
    const userId = source.userId;
    const currencyCode = source.currencyCode;

    // Fetch transactions
    const txRes = await client.query(
      `SELECT id, time, time::date as date, amount, "currencyCode", note
       FROM "Transactions"
       WHERE id = ANY($1)
       ORDER BY time ASC`,
      [targetTxIds],
    );
    const transactions = txRes.rows;
    console.log(`Fetched ${transactions.length} transactions`);

    if (transactions.length !== targetTxIds.length) {
      throw new Error(`Expected ${targetTxIds.length} transactions, but found ${transactions.length}`);
    }

    // Verify not already linked
    const existingLinksRes = await client.query(
      `SELECT "transactionId" FROM "IncomeCreditLinks" WHERE "transactionId" = ANY($1)`,
      [targetTxIds],
    );
    if (existingLinksRes.rows.length > 0) {
      throw new Error(
        `Some transactions are already linked: ${existingLinksRes.rows.map((r) => r.transactionId).join(', ')}`,
      );
    }

    await client.query('BEGIN');
    console.log('Started DB transaction');

    const now = new Date();
    let insertCount = 0;
    let totalAmount = 0n;

    for (const tx of transactions) {
      const creditId = uuidv7();
      const componentId = uuidv7();
      const linkId = uuidv7();
      const creditDate = tx.date;
      const amount = tx.amount;
      totalAmount += BigInt(amount);

      // 1. Update Transaction payee, category, and note
      await client.query(
        `UPDATE "Transactions"
         SET note = 'Salary - Analog LegalHub (RTGS)',
             "payeeId" = $1,
             "categoryId" = $2,
             "updatedAt" = $3
         WHERE id = $4`,
        [salaryPayeeId, wageCategoryId, now, tx.id],
      );

      // 2. Insert IncomeCredits
      await client.query(
        `INSERT INTO "IncomeCredits" (
          id, "userId", "incomeSourceId", "creditType", "creditDate", 
          "periodStart", "periodEnd", "currencyCode", "grossAmount", 
          "totalDeductions", "netAmount", "employerContributions", 
          "refCurrencyCode", "refGrossAmount", "refTotalDeductions", 
          "refNetAmount", "cashFlowMode", notes, "metaData", 
          "createdAt", "updatedAt"
        ) VALUES (
          $1, $2, $3, $4, $5, 
          $6, $7, $8, $9, 
          $10, $11, $12, 
          $13, $14, $15, 
          $16, $17, $18, $19, 
          $20, $21
        )`,
        [
          creditId,
          userId,
          credgenicsSourceId,
          'regular_salary',
          creditDate,
          null,
          null,
          currencyCode,
          amount,
          0,
          amount,
          0,
          currencyCode,
          amount,
          0,
          amount,
          'none',
          null,
          null,
          now,
          now,
        ],
      );

      // 3. Insert IncomeCreditComponents
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
        [componentId, userId, creditId, 'Salary', 'earning', amount, amount, 0, null, now, now],
      );

      // 4. Insert IncomeCreditLinks
      await client.query(
        `INSERT INTO "IncomeCreditLinks" (
          id, "userId", "incomeCreditId", "transactionId", 
          amount, "currencyCode", "linkedAt", "metaData", 
          "createdAt", "updatedAt"
        ) VALUES (
          $1, $2, $3, $4, 
          $5, $6, $7, $8, 
          $9, $10
        )`,
        [linkId, userId, creditId, tx.id, amount, currencyCode, now, null, now, now],
      );

      insertCount++;
    }

    await client.query('COMMIT');
    console.log(
      `Successfully updated ${insertCount} transactions and inserted ${insertCount} credits, components, links! Total INR: ${Number(totalAmount) / 100}`,
    );
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error during execution, rolled back:', err);
    throw err;
  } finally {
    await client.end();
  }
}

run().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
