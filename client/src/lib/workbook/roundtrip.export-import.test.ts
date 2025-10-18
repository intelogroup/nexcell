import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { exportWorkbook, loadWorkbook, computeFormulas } from './api'
import { buildWorkbookFromFixture, compareCellsDetailed } from './test-utils'

describe('round-trip export/import', () => {
  it('exports and re-imports small fixture preserving raw values and formulas', async () => {
    const candidates = [
      path.resolve(__dirname, './fixtures/simple-workbook.json'),
      path.resolve(__dirname, './__tests__/fixtures/simple-workbook.json'),
    ]
    let fixturePath: string | undefined
    for (const c of candidates) {
      if (fs.existsSync(c)) { fixturePath = c; break }
    }
    if (!fixturePath) throw new Error(`Fixture not found; looked in: ${candidates.join(', ')}`)
    const json = JSON.parse(fs.readFileSync(fixturePath, 'utf8'))

  // Normalize fixture into full WorkbookJSON shape
  const wb = buildWorkbookFromFixture(json)

    // Ensure formulas are computed so we have cached computed.v entries for comparison
    await computeFormulas(wb)

    // Export to XLSX buffer using the project's API (SheetJSAdapter under the hood)
    const xlsxBuffer = await exportWorkbook(wb)

    // Re-import the buffer using the project's import API
    const imported = await loadWorkbook(xlsxBuffer)
    await computeFormulas(imported)

    // Prepare accessor helpers for compareCells (sheetId, addr)
    const getCellA = (sheetId: string, addr: string) => {
      const s = (wb.sheets || []).find((sh: any) => sh.id === sheetId || sh.name === sheetId)
      return s?.cells?.[addr]
    }
    const getCellB = (sheetId: string, addr: string) => {
      const s = (imported.sheets || []).find((sh: any) => sh.id === sheetId || sh.name === sheetId)
      return s?.cells?.[addr]
    }

    const checks = [
      { sheetId: 'Sheet1', addr: 'A1' },
      { sheetId: 'Sheet1', addr: 'A2' },
      { sheetId: 'Sheet1', addr: 'B1' }
    ]

  const res = compareCellsDetailed(getCellA, getCellB, checks, { compareFormula: true, compareRaw: true, compareMetadata: ['arrayRange', 'spilledFrom'] })
  expect(res.passed).toBe(true)
    if (!res.passed) {
      // eslint-disable-next-line no-console
      console.error('Round-trip mismatches:', res.failures)
    }
  })
})
