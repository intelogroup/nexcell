// Edge-case tests for fillRange and setRange converters
// Reuse helper functions from previous harness
function columnLetterToNumber(letter) {
  let col = 0;
  for (let i = 0; i < letter.length; i++) {
    col = col * 26 + (letter.charCodeAt(i) - 64);
  }
  return col;
}

function numberToColumnLetter(n) {
  let s = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function parseAddress(addr) {
  const m = String(addr).match(/^([A-Z]+)(\d+)$/i);
  if (!m) throw new Error('Invalid address: ' + addr);
  return { col: columnLetterToNumber(m[1].toUpperCase()), row: parseInt(m[2], 10) };
}

function toAddress(row, col) {
  return `${numberToColumnLetter(col)}${row}`;
}

function cellFromValue(value) {
  if (typeof value === 'string' && value.startsWith('=')) return { formula: value, dataType: 'formula' };
  if (typeof value === 'number') return { raw: value, dataType: 'number' };
  if (typeof value === 'boolean') return { raw: value, dataType: 'boolean' };
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return { raw: value, dataType: 'date' };
  return { raw: value, dataType: 'string' };
}

function convertFillRange(action) {
  const operations = [];
  const rangeObj = action.target || action.range;
  if (rangeObj && typeof rangeObj === 'object' && action.values) {
    const { start, end } = rangeObj;
    const startPos = parseAddress(start);
    const endPos = end ? parseAddress(end) : startPos;
    const isSingleColumn = startPos.col === endPos.col;
    if (isSingleColumn) {
      action.values.forEach((value, r) => {
        const actualValue = Array.isArray(value) ? value[0] : value;
        const address = toAddress(startPos.row + r, startPos.col);
        operations.push({ address, cell: cellFromValue(actualValue) });
      });
    } else {
      action.values.forEach((row, r) => {
        if (Array.isArray(row)) {
          row.forEach((value, c) => {
            const address = toAddress(startPos.row + r, startPos.col + c);
            operations.push({ address, cell: cellFromValue(value) });
          });
        }
      });
    }
  } else {
    operations.push({ error: 'Invalid or missing range/values' });
  }
  return operations;
}

function convertSetRange(action) {
  const operations = [];
  if (action.range && action.values) {
    const { start } = action.range;
    try {
      const startPos = parseAddress(start);
      if (Array.isArray(action.values)) {
        action.values.forEach((row, r) => {
          if (Array.isArray(row)) {
            row.forEach((value, c) => {
              const address = toAddress(startPos.row + r, startPos.col + c);
              operations.push({ address, cell: cellFromValue(value) });
            });
          } else {
            const address = toAddress(startPos.row + r, startPos.col);
            operations.push({ address, cell: cellFromValue(row) });
          }
        });
      }
    } catch (e) {
      operations.push({ error: 'Invalid start address: ' + start });
    }
  } else if (action.cells && typeof action.cells === 'object') {
    for (const [addr, value] of Object.entries(action.cells)) {
      try {
        parseAddress(addr);
        operations.push({ address: addr, cell: cellFromValue(value) });
      } catch (e) {
        operations.push({ error: 'Invalid cell address: ' + addr });
      }
    }
  } else {
    operations.push({ error: 'Missing range/values or cells' });
  }
  return operations;
}

const tests = [];

// 1. values provided as flat array for a single-column range (should handle)
tests.push({
  name: 'single-column flat values',
  action: { type: 'fillRange', range: { start: 'E3', end: 'E7' }, values: [1,2,3,4,5] }
});

// 2. values as nested arrays with single elements (common AI output)
tests.push({
  name: 'single-column nested arrays',
  action: { type: 'fillRange', target: { start: 'F3', end: 'F7' }, values: [[1],[2],[3],[4],[5]] }
});

// 3. missing end in rangeObj (should treat as single cell start? current logic uses start only)
tests.push({
  name: 'missing end in range',
  action: { type: 'fillRange', target: { start: 'G3' }, values: [["x"], ["y"]] }
});

// 4. very large range but short values (should only create ops for provided values)
tests.push({
  name: 'large range small values',
  action: { type: 'fillRange', target: { start: 'H3', end: 'H100' }, values: [["a"],["b"]] }
});

// 5. malformed address in range
tests.push({
  name: 'malformed start address',
  action: { type: 'setRange', range: { start: 'INVALID', end: 'A2' }, values: [[1]] }
});

// 6. cells object with invalid addresses
tests.push({
  name: 'cells with invalid addresses',
  action: { type: 'setRange', cells: { 'A1': 'ok', 'ZZZ': 'bad' } }
});

for (const t of tests) {
  try {
    let ops = [];
    if (t.action.type === 'fillRange') ops = convertFillRange(t.action);
    else if (t.action.type === 'setRange') ops = convertSetRange(t.action);
    console.log(`Test: ${t.name} → ops:`, ops);
  } catch (e) {
    console.log(`Test: ${t.name} → threw`, e.message);
  }
}

console.log('Edge-case tests finished');
