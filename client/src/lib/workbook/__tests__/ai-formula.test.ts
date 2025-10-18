import { createWorkbook, applyOperations, hydrateHFFromWorkbook, recomputeAndPatchCache } from "../index";
import { convertToWorkbookActions } from "@/lib/ai/openrouter";

test('AI-converted formula cells compute correctly (headless)', () => {
  const wb = createWorkbook('TestAI');
  const sheet = wb.sheets[0];

  const actions: any[] = [];
  const headers = ['Product','Category','Price','Quantity','Total','Date','Region'];
  headers.forEach((h,i)=> actions.push({ type: 'setCellValue', target: String.fromCharCode(65+i)+'1', value: h }));

  const sample = [
    ['Laptop Pro','Electronics',1299.99,3,'=C2*D2','2024-01-15','North'],
    ['Wireless Mouse','Accessories',29.99,12,'=C3*D3','2024-01-16','South'],
  ];

  for (let r=0;r<sample.length;r++){
    const row = 2 + r;
    for (let c=0;c<sample[r].length;c++){
      const addr = String.fromCharCode(65+c) + row;
      const val = sample[r][c];
      if (typeof val === 'string' && val.startsWith('=')) {
        actions.push({ type: 'setCellFormula', target: addr, formula: val });
      } else {
        actions.push({ type: 'setCellValue', target: addr, value: val });
      }
    }
  }

  const ops = convertToWorkbookActions(actions, { currentSheet: { cells: sheet.cells, grid: sheet.grid } });
  const editOps = ops.map((o:any)=>({ type: 'editCell', sheetId: sheet.id, address: o.address, cell: o.cell }));

  const res = applyOperations(wb, editOps, { hydration: undefined });
  expect(res.success).toBe(true);

  const hydration = hydrateHFFromWorkbook(wb);
  const recompute = recomputeAndPatchCache(wb, hydration);
  expect(recompute.errors.length).toBe(0);

  const e2 = wb.sheets[0].cells['E2']?.computed?.v;
  const e3 = wb.sheets[0].cells['E3']?.computed?.v;
  expect(typeof e2).toBe('number');
  expect(typeof e3).toBe('number');
  expect(e2).toBeCloseTo(1299.99 * 3, 6);
  expect(e3).toBeCloseTo(29.99 * 12, 6);
});
