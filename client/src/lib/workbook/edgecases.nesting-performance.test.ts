import { describe, it } from 'vitest'
import { createWorkbook, setCell } from './utils'
import { computeFormulas } from './api'

function makeNestedFormula(depth: number) {
  let inner = '1'
  for (let i = 0; i < depth; i++) {
    inner = `ABS(${inner})`
  }
  return `=${inner}`
}

describe('edge cases: nested depth performance (informational)', () => {
  const depths = [100, 200]

  for (const d of depths) {
    it(`measures compute time for depth ${d}`, async () => {
      const wb = createWorkbook(`Perf${d}`)
      const sheet = wb.sheets[0]
      setCell(wb, sheet.id, 'A1', { formula: makeNestedFormula(d), dataType: 'formula' })

      const t0 = Date.now()
      await computeFormulas(wb)
      const t1 = Date.now()
      const elapsed = t1 - t0
      // Log result for diagnosis; don't hard-fail but if extremely slow we warn
      // eslint-disable-next-line no-console
      console.info(`Nested depth ${d} compute time: ${elapsed}ms`)

      // Sanity check: should complete within 10s on dev machine; do not fail strictly
      if (elapsed > 10000) {
        // eslint-disable-next-line no-console
        console.warn(`Compute exceeded 10s for depth ${d}: ${elapsed}ms`)
      }
    })
  }
})
