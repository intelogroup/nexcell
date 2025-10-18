#!/usr/bin/env node
/**
 * Scan a directory of workbook JSON files and list workbooks that contain
 * computed entries with hfVersion different from the running HyperFormula.version.
 *
 * Usage: node scripts/list-stale-hfversion.js ./client/tmp/workbooks
 */
const fs = require('fs');
const path = require('path');
const HF = require('hyperformula');

const args = process.argv.slice(2);
const dir = args[0] || path.join(__dirname, '..', 'client', 'tmp', 'workbooks');

function isJsonFile(fn) {
  return fn.endsWith('.json');
}

function findStaleInWorkbook(json, currentVersion) {
  const stale = [];
  if (!json.sheets) return stale;

  for (const sheet of json.sheets) {
    const cells = sheet.cells || {};
    for (const [addr, cell] of Object.entries(cells)) {
      if (cell.computed && cell.computed.hfVersion && cell.computed.hfVersion !== currentVersion) {
        stale.push({ sheet: sheet.name, address: addr, hfVersion: cell.computed.hfVersion });
      }
    }
  }
  return stale;
}

function main() {
  const currentVersion = HF.version;
  console.log('HyperFormula version:', currentVersion);

  if (!fs.existsSync(dir)) {
    console.error('Directory not found:', dir);
    process.exit(2);
  }

  const files = fs.readdirSync(dir).filter(isJsonFile);
  if (files.length === 0) {
    console.log('No JSON files found in', dir);
    return;
  }

  for (const f of files) {
    const full = path.join(dir, f);
    try {
      const txt = fs.readFileSync(full, 'utf8');
      const json = JSON.parse(txt);
      const stale = findStaleInWorkbook(json, currentVersion);
      if (stale.length > 0) {
        console.log(`Workbook: ${f} (id=${json.workbookId || 'unknown'}) - ${stale.length} stale entries:`);
        for (const s of stale) {
          console.log(`  - ${s.sheet}!${s.address} (hfVersion=${s.hfVersion})`);
        }
      }
    } catch (err) {
      console.warn('Failed to read', full, err.message);
    }
  }
}

main();
