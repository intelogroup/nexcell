// Minimal test harness to validate fillRange and setRange conversion logic
// This duplicates the necessary helper functions from openrouter.ts

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
  // addr like 'A1' or 'AA10'
  const m = addr.match(/^([A-Z]+)(\d+)$/i);
  if (!m) throw new Error('Invalid address: ' + addr);
  return { col: columnLetterToNumber(m[1].toUpperCase()), row: parseInt(m[2], 10) };
}

function toAddress(row, col) {
  return `${numberToColumnLetter(col)}${row}`;
}

function cellFromValue(value) {
  if (typeof value === 'string' && value.startsWith('=')) {
    return { formula: value, dataType: 'formula' };
  }
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
  }
  return operations;
}

function convertSetRange(action) {
  const operations = [];
  if (action.range && action.values) {
    const { start } = action.range;
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
  } else if (action.cells && typeof action.cells === 'object') {
    for (const [addr, value] of Object.entries(action.cells)) {
      if (value && typeof value === 'object' && ('raw' in value || 'formula' in value || 'dataType' in value)) {
        const cellObj = {};
        if ('formula' in value) {
          let formula = value.formula;
          if (typeof formula === 'string' && !formula.startsWith('=')) formula = '=' + formula;
          cellObj.formula = formula; cellObj.dataType = 'formula';
        }
        if ('raw' in value) {
          cellObj.raw = value.raw;
          if (value.dataType) cellObj.dataType = value.dataType;
          else cellObj.dataType = typeof value.raw === 'number' ? 'number' : 'string';
        }
        if (value.style) cellObj.style = value.style;
        operations.push({ address: addr, cell: cellObj });
      } else {
        operations.push({ address: addr, cell: cellFromValue(value) });
      }
    }
  }
  return operations;
}

// Test 1: simulate AI fillRange single-column actions for A3:A12
const fillActions = [
  { type: 'fillRange', target: { start: 'A3', end: 'A12' }, values: [['Original Text Sample'], ['Original Text Sample'], ['Original Text Sample'], ['Original Text Sample'], ['Original Text Sample'], ['Original Text Sample'], ['Original Text Sample'], ['Original Text Sample'], ['Original Text Sample'], ['Original Text Sample']] },
  { type: 'fillRange', target: { start: 'B3', end: 'B12' }, values: [['Kreyol Text Sample'], ['Kreyol Text Sample'], ['Kreyol Text Sample'], ['Kreyol Text Sample'], ['Kreyol Text Sample'], ['Kreyol Text Sample'], ['Kreyol Text Sample'], ['Kreyol Text Sample'], ['Kreyol Text Sample'], ['Kreyol Text Sample']] },
  { type: 'fillRange', target: { start: 'C3', end: 'C12' }, values: [['Source Info'], ['Source Info'], ['Source Info'], ['Source Info'], ['Source Info'], ['Source Info'], ['Source Info'], ['Source Info'], ['Source Info'], ['Source Info']] },
  { type: 'fillRange', target: { start: 'D3', end: 'D12' }, values: [['Context Info'], ['Context Info'], ['Context Info'], ['Context Info'], ['Context Info'], ['Context Info'], ['Context Info'], ['Context Info'], ['Context Info'], ['Context Info']] },
];

let totalOps = 0;
fillActions.forEach((a, i) => {
  const ops = convertFillRange(a);
  console.log(`fillAction ${i+1}: produced ${ops.length} operations; sample:`, ops.slice(0,3));
  totalOps += ops.length;
});
console.log('Total fillRange operations expected 40:', totalOps);

// Test 2: fillRange multi-column
const multiAction = {
  type: 'fillRange',
  range: { start: 'A20', end: 'C22' },
  values: [
    ['a1','b1','c1'],
    ['a2','b2','c2'],
    ['a3','b3','c3']
  ]
};
const multiOps = convertFillRange(multiAction);
console.log('multi-column fillRange ops:', multiOps.length, multiOps.slice(0,6));

// Test 3: setRange 2x4 block starting at A5
const setRangeAction = {
  type: 'setRange',
  range: { start: 'A5', end: 'D6' },
  values: [ [1,2,3,4], [5,6,7,8] ]
};
const setOps = convertSetRange(setRangeAction);
console.log('setRange ops:', setOps.length, setOps);

// Done
console.log('Finished tests');
