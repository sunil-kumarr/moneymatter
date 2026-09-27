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

  const companionTxIds = [
    '01a0d741-a128-755b-adca-6fab28255ea8',
    '01a0d741-a211-730a-806d-1aa8958eb08f',
    '01a0d741-a49f-71cc-9a48-1b9c8d95a0f5',
    '01a0d741-a790-7009-ab18-0490eeea96e8',
    '01a0d741-aa9f-7305-8828-25b6c3b661fa',
    '01a0d741-ada2-7538-91b5-c0f8b586fefc',
    '01a0d741-ae16-70c3-90fc-3c716f2e4034',
    '01a0d741-afe0-73d8-b241-ec83489da8c7',
    '01a0d741-b65f-72de-9b47-2b8852bde9ac',
    '01a0d741-b910-72ac-aeab-14fe29be90c8',
    '01a0d741-bc4f-760d-9299-da8bfc4ea94e',
    '01a0d741-bda0-752c-a2da-707bab9028f5',
    '01a0d741-c037-766e-8d0f-f40f1e410fad',
    '01a0d741-c4e5-754a-931d-41aecafdf8aa',
  ];

  try {
    const sourceId = '01a0e384-950d-7591-838a-a1f0fbc0f0f9'; // Park+ Senior Software Engineer
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
    console.log('Source:', source);
    const userId = source.userId;
    const currencyCode = source.currencyCode;

    // Fetch transactions
    const txRes = await client.query(
      `SELECT id, time, time::date as date, amount, "currencyCode", note
       FROM "Transactions"
       WHERE id = ANY($1)
       ORDER BY time ASC`,
      [companionTxIds],
    );
    const transactions = txRes.rows;
    console.log(`Fetched ${transactions.length} companion transactions`);

    if (transactions.length !== companionTxIds.length) {
      throw new Error(`Expected ${companionTxIds.length} transactions, but found ${transactions.length}`);
    }

    // Verify not already linked
    const existingLinksRes = await client.query(
      `SELECT "transactionId" FROM "IncomeCreditLinks" WHERE "transactionId" = ANY($1)`,
      [companionTxIds],
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
          sourceId,
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
      `Successfully inserted and committed ${insertCount} companion salary credits! Total INR: ${Number(totalAmount) / 100}`,
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
