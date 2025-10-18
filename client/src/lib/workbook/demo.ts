/**
 * Workbook JSON Demo
 * Interactive demo to test the workbook functionality
 */

import {
  createWorkbook,
  addSheet,
  setCell,
  getCell,
  parseAddress,
  toAddress,
  getStats,
  SheetJSAdapter,
} from './index';

export async function runDemo() {
  console.log('=== Nexcell Workbook JSON Demo ===\n');

  // 1. Create workbook
  console.log('1️⃣  Creating workbook...');
  const wb = createWorkbook('Sales Report 2025');
  const sheet1 = wb.sheets[0];
  console.log(`   ✓ Created: ${wb.meta.title}`);
  console.log(`   ✓ Sheet: ${sheet1.name} (${sheet1.id})\n`);

  // 2. Add header row with styling
  console.log('2️⃣  Adding styled headers...');
  const headers = ['Product', 'Q1', 'Q2', 'Q3', 'Q4', 'Total'];
  headers.forEach((header, i) => {
    setCell(wb, sheet1.id, toAddress(1, i + 1), {
      raw: header,
      dataType: 'string',
      style: {
        bold: true,
        bgColor: '#4472C4',
        color: '#FFFFFF',
        fontSize: 12,
        alignment: { horizontal: 'center', vertical: 'middle' },
      },
    });
  });
  console.log(`   ✓ Added ${headers.length} headers\n`);

  // 3. Add data rows
  console.log('3️⃣  Adding sales data...');
  const products = [
    ['Widget A', 1200, 1350, 1100, 1450],
    ['Widget B', 850, 920, 1050, 980],
    ['Widget C', 2100, 2300, 2150, 2400],
  ];

  products.forEach((row, i) => {
    // Product name
    setCell(wb, sheet1.id, toAddress(i + 2, 1), {
      raw: row[0],
      dataType: 'string',
    });

    // Quarterly sales
    row.slice(1).forEach((value, j) => {
      setCell(wb, sheet1.id, toAddress(i + 2, j + 2), {
        raw: value as number,
        dataType: 'number',
        numFmt: '#,##0',
      });
    });

    // Total formula
    const totalFormula = `=SUM(B${i + 2}:E${i + 2})`;
    setCell(wb, sheet1.id, toAddress(i + 2, 6), {
      formula: totalFormula,
      dataType: 'formula',
      numFmt: '#,##0',
      computed: {
        v: (row.slice(1) as number[]).reduce((a, b) => a + b, 0),
        t: 'n',
        ts: new Date().toISOString(),
      },
    });
  });
  console.log(`   ✓ Added ${products.length} product rows\n`);

  // 4. Add totals row
  console.log('4️⃣  Adding totals row...');
  setCell(wb, sheet1.id, 'A5', {
    raw: 'TOTAL',
    dataType: 'string',
    style: { bold: true },
  });

  ['B', 'C', 'D', 'E', 'F'].forEach((col) => {
    setCell(wb, sheet1.id, `${col}5`, {
      formula: `=SUM(${col}2:${col}4)`,
      dataType: 'formula',
      numFmt: '#,##0',
      style: { bold: true, bgColor: '#D9E1F2' },
    });
  });
  console.log('   ✓ Added totals row\n');

  // 5. Add merge and comments
  console.log('5️⃣  Adding features...');
  sheet1.mergedRanges = ['A1:F1'];
  setCell(wb, sheet1.id, 'A1', {
    raw: 'Q1-Q4 Sales Report',
    dataType: 'string',
    style: {
      bold: true,
      fontSize: 16,
      alignment: { horizontal: 'center' },
    },
  });

  sheet1.comments = {
    C3: [
      {
        id: 'comment-1',
        author: 'Manager',
        text: 'Strong Q2 performance!',
        createdAt: new Date().toISOString(),
      },
    ],
  };
  console.log('   ✓ Added title merge');
  console.log('   ✓ Added comment on C3\n');

  // 6. Set column widths
  console.log('6️⃣  Setting column widths...');
  sheet1.cols = {
    1: { width: 120 }, // Product
    2: { width: 80 },  // Q1
    3: { width: 80 },  // Q2
    4: { width: 80 },  // Q3
    5: { width: 80 },  // Q4
    6: { width: 100 }, // Total
  };
  console.log('   ✓ Configured column widths\n');

  // 7. Add second sheet for charts metadata
  console.log('7️⃣  Adding Charts sheet...');
  const sheet2 = addSheet(wb, 'Charts');
  setCell(wb, sheet2.id, 'A1', {
    raw: 'Chart Definitions',
    dataType: 'string',
    style: { bold: true, fontSize: 14 },
  });

  sheet2.charts = [
    {
      id: 'chart-1',
      type: 'bar',
      title: 'Quarterly Sales by Product',
      dataRange: 'Sheet1!A2:E4',
      xAxis: { title: 'Product', range: 'Sheet1!A2:A4' },
      yAxis: { title: 'Sales ($)', range: 'Sheet1!B2:E4' },
      position: { anchor: 'A3', width: 600, height: 400 },
    },
  ];
  console.log('   ✓ Added Charts sheet with metadata\n');

  // 8. Display stats
  console.log('8️⃣  Workbook statistics:');
  const stats = getStats(wb);
  console.log(`   📊 Sheets: ${stats.sheets}`);
  console.log(`   📝 Cells: ${stats.cells}`);
  console.log(`   🧮 Formulas: ${stats.formulas}`);
  console.log(`   🎨 Styled: ${stats.styledCells}`);
  console.log(`   💾 Size: ${(stats.estimatedSize / 1024).toFixed(2)} KB\n`);

  // 9. Test address conversions
  console.log('9️⃣  Testing address conversions:');
  const tests = [
    { addr: 'A1' },
    { addr: 'Z10' },
    { addr: 'AA1' },
  ];
  tests.forEach(({ addr }) => {
    const parsed = parseAddress(addr);
    const back = toAddress(parsed.row, parsed.col);
    console.log(`   ${addr} → (${parsed.row},${parsed.col}) → ${back} ✓`);
  });
  console.log();

  // 10. Export to XLSX
  console.log('🔟 Exporting to XLSX...');
  try {
    const adapter = new SheetJSAdapter();
    const buffer = await adapter.export(wb);
    console.log(`   ✓ Exported: ${buffer.byteLength} bytes`);
    console.log(`   ✓ Features: formulas=${adapter.features.formulas}, merges=${adapter.features.merges}\n`);

    // 11. Re-import and verify
    console.log('1️⃣1️⃣  Re-importing to verify...');
    const imported = await adapter.import(buffer);
    console.log(`   ✓ Imported workbook ID: ${imported.workbookId}`);
    console.log(`   ✓ Sheets: ${imported.sheets.map((s: { name: string }) => s.name).join(', ')}`);
    
    const importedB2 = getCell(imported, imported.sheets[0].id, 'B2');
    console.log(`   ✓ B2 value: ${importedB2?.raw} (${importedB2?.dataType})`);
    
    const importedF2 = getCell(imported, imported.sheets[0].id, 'F2');
    console.log(`   ✓ F2 formula: ${importedF2?.formula}`);
    console.log(`   ✓ F2 computed: ${importedF2?.computed?.v}`);
    
    console.log(`   ✓ Merges: ${imported.sheets[0].mergedRanges?.join(', ')}\n`);

    // 12. Download option
    console.log('1️⃣2️⃣  Ready to download!');
    console.log('   To download the file, run:');
    console.log('   downloadWorkbook(workbookData, "sales-report.xlsx")\n');

    return { original: wb, buffer, imported };
  } catch (error) {
    console.error('   ✗ Export failed:', error);
    return { original: wb, buffer: null, imported: null };
  }
}

/**
 * Download workbook as XLSX file
 */
export function downloadWorkbook(buffer: ArrayBuffer, filename: string) {
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  console.log(`✓ Downloaded: ${filename}`);
}

/**
 * Quick test function for browser console
 */
export async function quickTest() {
  const result = await runDemo();
  
  if (result.buffer) {
    console.log('\n✅ ALL TESTS PASSED!\n');
    console.log('Try these commands:');
    console.log('  1. downloadWorkbook(workbookData.buffer, "test.xlsx")');
    console.log('  2. console.log(workbookData.original)');
    console.log('  3. console.log(workbookData.imported)');
    
    // Make available globally for console access
    (window as any).workbookData = result;
    (window as any).downloadWorkbook = downloadWorkbook;
  }
  
  return result;
}

// Auto-run if imported directly
if (import.meta.url === window.location.href) {
  quickTest();
}
