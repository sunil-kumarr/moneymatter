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
    const targetSourceId = '01a0e3aa-1d55-72d8-967b-1b0da0c36112';

    // 1. Verify target income source
    const sourceRes = await client.query(
      `SELECT id, "userId", name, "employerName", "currencyCode" 
       FROM "IncomeSources" 
       WHERE id = $1`,
      [targetSourceId],
    );

    if (sourceRes.rows.length === 0) {
      throw new Error(`IncomeSource ${targetSourceId} not found`);
    }

    const source = sourceRes.rows[0];
    console.log('Target Income Source:', source);
    const userId = source.userId;
    const currencyCode = source.currencyCode;

    // 2. Fetch matching transactions
    const txQuery = `
      SELECT 
        t.id,
        t.time,
        t.time::date as date,
        t.amount,
        t."currencyCode",
        t.note,
        p.name as payee_name
      FROM "Transactions" t
      JOIN "Payees" p ON p.id = t."payeeId"
      WHERE t.note ILIKE '%Analog%Legal%Hub%'
        AND p.name ILIKE '%salary%'
        AND t."userId" = $1
      ORDER BY t.time ASC;
    `;
    const txRes = await client.query(txQuery, [userId]);
    const transactions = txRes.rows;
    console.log(`Found ${transactions.length} matching transactions`);

    if (transactions.length === 0) {
      console.log('No transactions to process.');
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

    // 4. Begin transaction and insert
    await client.query('BEGIN');
    console.log('Started DB transaction');

    const now = new Date();
    let insertCount = 0;

    for (const tx of transactions) {
      const creditId = uuidv7();
      const componentId = uuidv7();
      const linkId = uuidv7();
      const creditDate = tx.date;
      const amount = tx.amount;

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
          targetSourceId,
          'regular_salary',
          creditDate,
          null, // periodStart
          null, // periodEnd
          currencyCode,
          amount,
          0, // totalDeductions
          amount, // netAmount
          0, // employerContributions
          currencyCode, // refCurrencyCode
          amount, // refGrossAmount
          0, // refTotalDeductions
          amount, // refNetAmount
          'none', // cashFlowMode
          null, // notes
          null, // metaData
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
    console.log(`Successfully inserted and committed ${insertCount} salary credits, components, and links!`);
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
