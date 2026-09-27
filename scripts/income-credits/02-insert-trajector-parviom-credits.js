const { Client } = require('pg');
const { v7: uuidv7 } = require('uuid');

async function processSource(client, config) {
  const { sourceId, sourceLabel, txFilterQuery, txQueryParams } = config;
  console.log(`\n=== Processing ${sourceLabel} (${sourceId}) ===`);

  // 1. Verify income source
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
  console.log('Source found:', source);
  const userId = source.userId;
  const currencyCode = source.currencyCode;

  // 2. Fetch transactions
  const txRes = await client.query(txFilterQuery, txQueryParams);
  const transactions = txRes.rows;
  console.log(`Found ${transactions.length} matching transactions for ${sourceLabel}`);

  if (transactions.length === 0) {
    console.log(`No transactions found for ${sourceLabel}`);
    return;
  }

  // 3. Check for existing links
  const txIds = transactions.map((t) => t.id);
  const existingLinksRes = await client.query(
    `SELECT "transactionId" FROM "IncomeCreditLinks" WHERE "transactionId" = ANY($1)`,
    [txIds],
  );
  if (existingLinksRes.rows.length > 0) {
    throw new Error(
      `Some transactions are already linked: ${existingLinksRes.rows.map((r) => r.transactionId).join(', ')}`,
    );
  }

  // 4. Insert records
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

  console.log(`Inserted ${insertCount} salary credits for ${sourceLabel}. Total INR: ${Number(totalAmount) / 100}`);
}

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
    await client.query('BEGIN');
    console.log('Started DB transaction');

    // 1. Trajector
    await processSource(client, {
      sourceId: '01a0e386-a285-7537-bb7b-8716302fd9d7',
      sourceLabel: 'Trajector',
      txFilterQuery: `
        SELECT 
          t.id,
          t.time,
          t.time::date as date,
          t.amount,
          t."currencyCode",
          t.note,
          p.name as payee_name
        FROM "Transactions" t
        LEFT JOIN "Payees" p ON p.id = t."payeeId"
        WHERE t.note ILIKE '%trajector%'
          AND t."transactionType" = 'income'
          AND t."userId" = 1
        ORDER BY t.time ASC;
      `,
      txQueryParams: [],
    });

    // 2. Parviom (Park+)
    await processSource(client, {
      sourceId: '01a0e384-950d-7591-838a-a1f0fbc0f0f9',
      sourceLabel: 'Parviom (Park+)',
      txFilterQuery: `
        SELECT 
          t.id,
          t.time,
          t.time::date as date,
          t.amount,
          t."currencyCode",
          t.note,
          p.name as payee_name
        FROM "Transactions" t
        LEFT JOIN "Payees" p ON p.id = t."payeeId"
        WHERE t.note ILIKE '%parviom%'
          AND t."transactionType" = 'income'
          AND t."userId" = 1
        ORDER BY t.time ASC;
      `,
      txQueryParams: [],
    });

    await client.query('COMMIT');
    console.log('\nTransaction committed successfully!');
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
