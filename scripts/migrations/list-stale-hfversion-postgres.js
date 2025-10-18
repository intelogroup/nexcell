#!/usr/bin/env node
/**
 * Draft migration helper for Postgres.
 * Scans a `workbooks` table that stores workbook JSON in a `data` JSONB column
 * and lists rows that contain computed entries with an hfVersion different from
 * the current HyperFormula.version. This script is non-destructive and only logs results.
 *
 * Usage:
 *   node scripts/migrations/list-stale-hfversion-postgres.js --conn "postgres://user:pass@host/db"
 *
 * NOTE: Adjust SQL, table and column names to match your schema.
 */
const { Client } = require('pg');
const HF = require('hyperformula');

async function main() {
  const args = process.argv.slice(2);
  const connArgIndex = args.findIndex(a => a === '--conn');
  if (connArgIndex === -1 || !args[connArgIndex + 1]) {
    console.error('Please pass --conn "postgres://user:pass@host/db"');
    process.exit(2);
  }
  const conn = args[connArgIndex + 1];

  const client = new Client({ connectionString: conn });
  await client.connect();

  const currentHF = HF.version;
  console.log('Running stale hfVersion scan (HF.version=', currentHF, ')');

  // NOTE: This example assumes a table 'workbooks' with columns: id (pk), data (jsonb)
  const res = await client.query('SELECT id, data->>\'workbookId\' AS workbookId, data FROM workbooks');
  for (const row of res.rows) {
    const id = row.id;
    const data = row.data; // JSON object
    let staleCount = 0;
    if (data && data.sheets) {
      for (const s of data.sheets) {
        const cells = s.cells || {};
        for (const [addr, cell] of Object.entries(cells)) {
          if (cell && cell.computed && cell.computed.hfVersion && cell.computed.hfVersion !== currentHF) {
            staleCount++;
          }
        }
      }
    }
    if (staleCount > 0) {
      console.log(`Row id=${id} workbookId=${row.workbookid || 'unknown'} staleCount=${staleCount}`);
    }
  }

  await client.end();
  console.log('Scan complete.');
}

main().catch(err => {
  console.error('Error running migration scan:', err);
  process.exit(1);
});
