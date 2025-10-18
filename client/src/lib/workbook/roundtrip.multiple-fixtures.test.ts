import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { buildWorkbookFromFixture, compareCellsDetailed } from './test-utils'
import { computeFormulas, exportWorkbook, loadWorkbook } from './api'

async function loadFixture(name: string) {
  const candidates = [
    path.resolve(__dirname, './fixtures', name),
    path.resolve(__dirname, './__tests__/fixtures', name),
  ]
  let p: string | undefined
  for (const c of candidates) {
    if (fs.existsSync(c)) { p = c; break }
  }
  if (!p) throw new Error(`Fixture not found; looked in: ${candidates.join(', ')}`)
  const json = JSON.parse(fs.readFileSync(p, 'utf8'))
  return buildWorkbookFromFixture(json)
}

describe('round-trip multiple fixtures (named ranges, arrays, merges)', () => {
  it('preserves named ranges after export/import', async () => {
    const wb = await loadFixture('fixture-namedranges.json')
    await computeFormulas(wb)
    const buf = await exportWorkbook(wb)
    const imported = await loadWorkbook(buf)
    // Named ranges should be present on import
    expect(imported.namedRanges && Object.keys(imported.namedRanges).length > 0).toBe(true)
    // Compare A1 and A2 values
    const getA = (sheetId: string, addr: string) => {
      const s = (wb.sheets || []).find((sh: any) => sh.id === sheetId || sh.name === sheetId)
      return s?.cells?.[addr]
    }
    const getB = (sheetId: string, addr: string) => {
      const s = (imported.sheets || []).find((sh: any) => sh.id === sheetId || sh.name === sheetId)
      return s?.cells?.[addr]
    }
  const res = compareCellsDetailed(getA, getB, [{ sheetId: 'Sheet1', addr: 'A1' }, { sheetId: 'Sheet1', addr: 'A2' }], { compareRaw: true, compareFormula: true })
  expect(res.passed).toBe(true)
  })

  it('preserves arrayRange metadata and array formulas', async () => {
    const wb = await loadFixture('fixture-arrayformula.json')
    await computeFormulas(wb)
    const buf = await exportWorkbook(wb)
    const imported = await loadWorkbook(buf)

    // Check that the anchor cell still has arrayRange metadata after import and formula preserved
    const importedSheet = imported.sheets.find((s: any) => s.name === 'Sheet1')
    const anchor = importedSheet?.cells?.['B1']
    expect(anchor && (anchor.arrayRange || anchor.arrayFormula)).toBeTruthy()
    // Also compare formula/raw for the anchor
    const anchorRes = compareCellsDetailed(
      (sid, addr) => wb.sheets.find((s: any) => s.name === sid)?.cells?.[addr],
      (sid, addr) => imported.sheets.find((s: any) => s.name === sid)?.cells?.[addr],
      [{ sheetId: 'Sheet1', addr: 'B1' }],
      { compareFormula: true, compareRaw: true, compareMetadata: ['arrayRange'] }
    )
    expect(anchorRes.passed).toBe(true)
  })

  it('preserves merged ranges', async () => {
    const wb = await loadFixture('fixture-mergedranges.json')
    await computeFormulas(wb)
    const buf = await exportWorkbook(wb)
    const imported = await loadWorkbook(buf)

  const importedSheet2 = imported.sheets.find((s: any) => s.name === 'Sheet1')
  expect(Array.isArray(importedSheet2?.mergedRanges) && importedSheet2.mergedRanges.includes('A1:B2')).toBe(true)
  })
})
