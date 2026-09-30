#!/usr/bin/env node
/**
 * Backfill original bank narrations for SBI transactions in the database.
 *
 * Format: "<Friendly Note> | <Original Bank Narration>"
 *
 * Usage:
 *   NODE_PATH=./node_modules node scripts/sbi-import/backfill-sbi-narrations.js            # Dry-run mode
 *   NODE_PATH=./node_modules node scripts/sbi-import/backfill-sbi-narrations.js --apply   # Apply updates
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const MAPPING_FILE = path.join(__dirname, 'sbi-backfill-mapping.json');

const DB_CONFIG = {
  host: process.env.APPLICATION_DB_HOST || '127.0.0.1',
  port: parseInt(process.env.MAP_DB_PORT_TO_OS_PORT || process.env.APPLICATION_DB_PORT || '5433', 10),
  user: process.env.APPLICATION_DB_USERNAME || 'username',
  password: process.env.APPLICATION_DB_PASSWORD || 'IrjZoQkGrkTRbeOYusYJseofN4h86si',
  database: process.env.APPLICATION_DB_DATABASE || 'budget-tracker',
};

async function main() {
  const isApply = process.argv.includes('--apply');
  console.log(`=== SBI Bank Narration Backfill Script [${isApply ? 'APPLY MODE' : 'DRY RUN'}] ===\n`);

  if (!fs.existsSync(MAPPING_FILE)) {
    console.error(`Error: Mapping file not found at ${MAPPING_FILE}`);
    console.error(`Please run generate-backfill-mapping.py first.`);
    process.exit(1);
  }

  const mappingRecords = JSON.parse(fs.readFileSync(MAPPING_FILE, 'utf-8'));
  console.log(`Loaded ${mappingRecords.length} records from sbi-backfill-mapping.json`);

  const client = new Client(DB_CONFIG);
  try {
    await client.connect();
    console.log(`Connected to PostgreSQL database '${DB_CONFIG.database}' at ${DB_CONFIG.host}:${DB_CONFIG.port}`);
  } catch (err) {
    console.error(`Failed to connect to database:`, err.message);
    process.exit(1);
  }

  try {
    // 1. Resolve SBI Account ID
    const accRes = await client.query(
      `SELECT id, name FROM "Accounts" WHERE id = '01a0d415-2a9f-733d-a25a-935b4504260c' OR name ILIKE '%State Bank of India%' LIMIT 1`,
    );

    if (accRes.rows.length === 0) {
      throw new Error('State Bank of India account not found in database.');
    }

    const sbiAccount = accRes.rows[0];
    console.log(`Target Account: ${sbiAccount.name} (${sbiAccount.id})\n`);

    // 2. Fetch all DB transactions for the SBI account in chronological order
    const txRes = await client.query(
      `SELECT 
         id, 
         to_char(time AT TIME ZONE 'UTC', 'YYYY-MM-DD') as date,
         amount, 
         "transactionType", 
         note,
         "createdAt"
       FROM "Transactions" 
       WHERE "accountId" = $1 
       ORDER BY time ASC, "createdAt" ASC, id ASC`,
      [sbiAccount.id],
    );

    const dbTransactions = txRes.rows;
    console.log(`Found ${dbTransactions.length} transactions for SBI account in DB.\n`);

    // 3. Match DB transactions to mapping records
    // Index DB transactions by (date, amount, transactionType) preserving order
    const dbBucket = new Map();
    for (const tx of dbTransactions) {
      const key = `${tx.date}|${tx.amount}|${tx.transactionType}`;
      if (!dbBucket.has(key)) {
        dbBucket.set(key, []);
      }
      dbBucket.get(key).push({ ...tx, matched: false });
    }

    let matchCount = 0;
    let alreadyBackfilledCount = 0;
    let needsUpdateCount = 0;
    let unmatchedMappingCount = 0;
    const updates = [];
    const sampleDiffs = [];

    for (const record of mappingRecords) {
      const key = `${record.date}|${record.amountCents}|${record.transactionType}`;
      const candidates = dbBucket.get(key);

      if (!candidates || candidates.length === 0) {
        unmatchedMappingCount++;
        continue;
      }

      // Find best candidate:
      // Priority 1: Unmatched candidate with exact currentNote
      // Priority 2: Unmatched candidate that already contains newNote
      // Priority 3: First unmatched candidate in bucket
      let bestIdx = candidates.findIndex((c) => !c.matched && c.note === record.currentNote);
      if (bestIdx === -1) {
        bestIdx = candidates.findIndex((c) => !c.matched && c.note === record.newNote);
      }
      if (bestIdx === -1) {
        bestIdx = candidates.findIndex((c) => !c.matched);
      }

      if (bestIdx === -1) {
        unmatchedMappingCount++;
        continue;
      }

      const matchedTx = candidates[bestIdx];
      matchedTx.matched = true;
      matchCount++;

      // Check if update is needed
      if (matchedTx.note === record.newNote) {
        alreadyBackfilledCount++;
      } else {
        needsUpdateCount++;
        updates.push({
          id: matchedTx.id,
          oldNote: matchedTx.note,
          newNote: record.newNote,
          date: record.date,
          amount: record.signedAmount,
        });

        if (sampleDiffs.length < 8) {
          sampleDiffs.push({
            date: record.date,
            amount: record.signedAmount,
            oldNote: matchedTx.note,
            newNote: record.newNote,
          });
        }
      }
    }

    const unmatchedDbCount = dbTransactions.length - matchCount;

    console.log(`--- MATCHING RESULTS ---`);
    console.log(`Total Mapping Records:    ${mappingRecords.length}`);
    console.log(`Total DB Transactions:    ${dbTransactions.length}`);
    console.log(
      `Successfully Matched:     ${matchCount} (${((matchCount / mappingRecords.length) * 100).toFixed(2)}%)`,
    );
    console.log(`Needs Note Update:        ${needsUpdateCount}`);
    console.log(`Already Has Narration:    ${alreadyBackfilledCount}`);
    console.log(`Unmatched Mapping Rows:   ${unmatchedMappingCount}`);
    console.log(`Unmatched DB Rows:        ${unmatchedDbCount}`);

    if (sampleDiffs.length > 0) {
      console.log(`\n--- SAMPLE UPDATES (First ${sampleDiffs.length}) ---`);
      for (const [idx, s] of sampleDiffs.entries()) {
        console.log(`\n[${idx + 1}] Date: ${s.date}, Amount: ₹${s.amount}`);
        console.log(`    BEFORE: "${s.oldNote}"`);
        console.log(`    AFTER:  "${s.newNote}"`);
      }
    }

    // 4. Apply updates if requested
    if (isApply) {
      if (updates.length === 0) {
        console.log(`\nNo updates needed. Everything is already up to date.`);
      } else {
        console.log(`\nStarting database transaction to update ${updates.length} rows...`);
        await client.query('BEGIN');

        const BATCH_SIZE = 500;
        for (let i = 0; i < updates.length; i += BATCH_SIZE) {
          const chunk = updates.slice(i, i + BATCH_SIZE);
          for (const u of chunk) {
            await client.query(`UPDATE "Transactions" SET note = $1, "updatedAt" = NOW() WHERE id = $2`, [
              u.newNote,
              u.id,
            ]);
          }
          process.stdout.write(`Updated ${Math.min(i + BATCH_SIZE, updates.length)} / ${updates.length} rows...\r`);
        }

        await client.query('COMMIT');
        console.log(`\nSuccessfully applied all ${updates.length} updates and committed transaction!`);
      }
    } else {
      console.log(`\n[DRY RUN COMPLETE] To apply these updates to the database, run:`);
      console.log(`  NODE_PATH=./node_modules node scripts/sbi-import/backfill-sbi-narrations.js --apply\n`);
    }
  } catch (err) {
    if (isApply) {
      await client.query('ROLLBACK').catch(() => {});
      console.error('Transaction rolled back due to error.');
    }
    console.error('Execution error:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
