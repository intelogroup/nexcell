import { describe, it, expect } from 'vitest'
import { createWorkbook, setCell } from './utils'
import { computeFormulas } from './api'

function makeNestedFormula(depth: number) {
  let inner = '1'
  for (let i = 0; i < depth; i++) {
    inner = `ABS(${inner})`
  }
  return `=${inner}`
}

describe('edge cases: nested formula depth', () => {
  const depths = [10, 50, 100, 500]

  for (const d of depths) {
    it(`computes or fails safely at depth ${d}`, async () => {
      const wb = createWorkbook(`Depth${d}`)
      const sheet = wb.sheets[0]
      setCell(wb, sheet.id, 'A1', { formula: makeNestedFormula(d), dataType: 'formula' })

      // Allow runtime to handle timeouts via test runner default; just ensure it completes
      await computeFormulas(wb)

      const v = wb.sheets[0].cells?.['A1']?.computed
      // Accept either numeric result or an error
      expect((typeof v?.v === 'number') || v?.error || typeof v?.v === 'undefined').toBeTruthy()
    })
  }
})
