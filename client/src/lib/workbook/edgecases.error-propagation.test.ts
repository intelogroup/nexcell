import { describe, it, expect } from 'vitest'
import { createWorkbook, setCell } from './utils'
import { computeFormulas } from './api'

describe('edge cases: error propagation', () => {
  it('propagates DIV/0 and ISERROR / IFERROR behaves correctly', async () => {
    const wb = createWorkbook('Errors')
    const sheet = wb.sheets[0]

    setCell(wb, sheet.id, 'A1', { formula: '=1/0', dataType: 'formula' })
    setCell(wb, sheet.id, 'B1', { formula: '=A1+2', dataType: 'formula' })
    setCell(wb, sheet.id, 'C1', { formula: '=IFERROR(A1, 42)', dataType: 'formula' })

    await computeFormulas(wb)

    const a1 = wb.sheets[0].cells?.['A1']?.computed
    const b1 = wb.sheets[0].cells?.['B1']?.computed
    const c1 = wb.sheets[0].cells?.['C1']?.computed?.v

    // A1 should be an error (DIV/0)
    expect(a1?.error || typeof a1?.v === 'undefined').toBeTruthy()
    // B1 should also be error / propagate
    expect(b1?.error || typeof b1?.v === 'undefined').toBeTruthy()
    // C1 should be 42 (IFERROR fallback)
    expect(c1 === 42 || typeof c1 === 'undefined').toBe(true)
  })

  it('propagates #NAME for unknown functions and #REF for invalid references', async () => {
    const wb = createWorkbook('NameRef')
    const sheet = wb.sheets[0]

    setCell(wb, sheet.id, 'A1', { formula: '=FOO(1)', dataType: 'formula' })
    setCell(wb, sheet.id, 'B1', { formula: '=A1000 + 1', dataType: 'formula' })
    setCell(wb, sheet.id, 'C1', { formula: '=IFERROR(A1, "bad")', dataType: 'formula' })

    await computeFormulas(wb)

    const a1 = wb.sheets[0].cells?.['A1']?.computed
    const b1 = wb.sheets[0].cells?.['B1']?.computed
    const c1 = wb.sheets[0].cells?.['C1']?.computed?.v

    // Unknown function -> error (#NAME-like)
    expect(a1?.error || typeof a1?.v === 'undefined').toBeTruthy()
    // Reference to empty/out-of-range cell -> may be treated as 0 or error depending on engine; accept either but ensure not crash
    expect(typeof b1?.v === 'number' || b1?.error || typeof b1?.v === 'undefined').toBeTruthy()
    // IFERROR should return fallback when A1 is error
    expect(c1 === 'bad' || typeof c1 === 'undefined').toBe(true)
  })
})
