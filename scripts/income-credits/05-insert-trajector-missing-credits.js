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
    '01a0d741-cb9f-752d-ab16-755ac284fa0c', // 2024-08-30: 560018
    '01a0d741-ced9-73af-a56e-87d20bf8a9c3', // 2024-09-30: 260705
    '01a0d741-d270-75fd-aeb3-fb5ca3d90471', // 2024-10-30: 260705
    '01a0d741-d560-754f-b349-0ba80f8c12ac', // 2024-11-29: 260705
    '01a0d741-dcd1-72da-9d1d-1b545bef46af', // 2024-12-31: 259145
    '01a0d741-e119-708a-88a9-959e3abd40dc', // 2025-01-31: 258364
    '01a0d741-e56c-756c-a92a-ddcf052c7daa', // 2025-02-28: 258363
    '01a0d741-eace-713d-8328-10c95ced5ab4', // 2025-03-28: 258364
    '01a0dc8c-6d72-77be-92d4-912d15441eaa', // 2025-04-30: 266865 (RTGS)
    '01a0dc8c-7254-74aa-afb6-acbf55725a34', // 2025-05-30: 332954
  ];

  try {
    const trajectorSourceId = '01a0e386-a285-7537-bb7b-8716302fd9d7';
    const salaryPayeeId = '01a0d737-b2ce-773d-a38c-63022c6dc77d';
    const wageCategoryId = '01a0d412-323f-741d-b9ee-edcc7f1b3d86';

    const sourceRes = await client.query(
      `SELECT id, "userId", name, "employerName", "currencyCode" 
       FROM "IncomeSources" 
       WHERE id = $1`,
      [trajectorSourceId],
    );

    if (sourceRes.rows.length === 0) {
      throw new Error(`IncomeSource ${trajectorSourceId} not found`);
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

      // If this is the 2025-04-30 RTGS transaction, update its note, payee, and category
      if (tx.id === '01a0dc8c-6d72-77be-92d4-912d15441eaa') {
        await client.query(
          `UPDATE "Transactions"
           SET note = 'Salary - Trajector India (RTGS)',
               "payeeId" = $1,
               "categoryId" = $2,
               "updatedAt" = $3
           WHERE id = $4`,
          [salaryPayeeId, wageCategoryId, now, tx.id],
        );
      }

      // Insert IncomeCredits
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
          trajectorSourceId,
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

      // Insert IncomeCreditComponents
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

      // Insert IncomeCreditLinks
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
      `Successfully committed ${insertCount} salary credits for Trajector! Total INR: ${Number(totalAmount) / 100}`,
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
