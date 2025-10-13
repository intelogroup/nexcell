import { describe, it, expect, beforeEach } from 'vitest'
import { WorkbookValidationService, WORKBOOK_LIMITS } from './workbook-validation.service'

describe('WorkbookValidationService', () => {
  let service: WorkbookValidationService

  beforeEach(() => {
    service = new WorkbookValidationService()
  })

  describe('parseA1Notation', () => {
    it('should parse single letter columns correctly', () => {
      expect(service.parseA1Notation('A1')).toEqual({ row: 0, col: 0 })
      expect(service.parseA1Notation('B1')).toEqual({ row: 0, col: 1 })
      expect(service.parseA1Notation('Z1')).toEqual({ row: 0, col: 25 })
    })

    it('should parse double letter columns correctly', () => {
      expect(service.parseA1Notation('AA1')).toEqual({ row: 0, col: 26 })
      expect(service.parseA1Notation('AB1')).toEqual({ row: 0, col: 27 })
      expect(service.parseA1Notation('AZ1')).toEqual({ row: 0, col: 51 })
      expect(service.parseA1Notation('BA1')).toEqual({ row: 0, col: 52 })
      expect(service.parseA1Notation('BZ1')).toEqual({ row: 0, col: 77 })
      expect(service.parseA1Notation('ZZ1')).toEqual({ row: 0, col: 701 })
    })

    it('should parse triple letter columns correctly', () => {
      expect(service.parseA1Notation('AAA1')).toEqual({ row: 0, col: 702 })
      expect(service.parseA1Notation('AAB1')).toEqual({ row: 0, col: 703 })
    })

    it('should parse row numbers correctly', () => {
      expect(service.parseA1Notation('A1')).toEqual({ row: 0, col: 0 })
      expect(service.parseA1Notation('A2')).toEqual({ row: 1, col: 0 })
      expect(service.parseA1Notation('A10')).toEqual({ row: 9, col: 0 })
      expect(service.parseA1Notation('A99')).toEqual({ row: 98, col: 0 })
      expect(service.parseA1Notation('A100')).toEqual({ row: 99, col: 0 })
      expect(service.parseA1Notation('A5000')).toEqual({ row: 4999, col: 0 })
    })

    it('should handle complex cell references', () => {
      expect(service.parseA1Notation('Z99')).toEqual({ row: 98, col: 25 })
      expect(service.parseA1Notation('AA100')).toEqual({ row: 99, col: 26 })
      expect(service.parseA1Notation('CV5000')).toEqual({ row: 4999, col: 99 })
    })

    it('should return 0,0 for invalid format', () => {
      expect(service.parseA1Notation('')).toEqual({ row: 0, col: 0 })
      expect(service.parseA1Notation('123')).toEqual({ row: 0, col: 0 })
      expect(service.parseA1Notation('ABC')).toEqual({ row: 0, col: 0 })
      expect(service.parseA1Notation('1A')).toEqual({ row: 0, col: 0 })
    })
  })

  describe('toA1Notation', () => {
    it('should convert single digit columns correctly', () => {
      expect(service.toA1Notation(0, 0)).toBe('A1')
      expect(service.toA1Notation(0, 1)).toBe('B1')
      expect(service.toA1Notation(0, 25)).toBe('Z1')
    })

    it('should convert double letter columns correctly', () => {
      expect(service.toA1Notation(0, 26)).toBe('AA1')
      expect(service.toA1Notation(0, 27)).toBe('AB1')
      expect(service.toA1Notation(0, 51)).toBe('AZ1')
      expect(service.toA1Notation(0, 52)).toBe('BA1')
      expect(service.toA1Notation(0, 77)).toBe('BZ1')
      expect(service.toA1Notation(0, 701)).toBe('ZZ1')
    })

    it('should convert triple letter columns correctly', () => {
      expect(service.toA1Notation(0, 702)).toBe('AAA1')
      expect(service.toA1Notation(0, 703)).toBe('AAB1')
    })

    it('should convert row numbers correctly', () => {
      expect(service.toA1Notation(0, 0)).toBe('A1')
      expect(service.toA1Notation(1, 0)).toBe('A2')
      expect(service.toA1Notation(9, 0)).toBe('A10')
      expect(service.toA1Notation(98, 0)).toBe('A99')
      expect(service.toA1Notation(99, 0)).toBe('A100')
      expect(service.toA1Notation(4999, 0)).toBe('A5000')
    })

    it('should handle complex conversions', () => {
      expect(service.toA1Notation(98, 25)).toBe('Z99')
      expect(service.toA1Notation(99, 26)).toBe('AA100')
      expect(service.toA1Notation(4999, 99)).toBe('CV5000')
    })

    it('should be inverse of parseA1Notation', () => {
      const testCases = ['A1', 'Z1', 'AA1', 'AB27', 'ZZ999', 'AAA1', 'CV5000']
      
      for (const cellRef of testCases) {
        const { row, col } = service.parseA1Notation(cellRef)
        const converted = service.toA1Notation(row, col)
        expect(converted).toBe(cellRef)
      }
    })
  })

  describe('validate', () => {
    it('should validate valid minimal workbook', () => {
      const workbook = {
        sheets: [
          {
            name: 'Sheet1',
            cells: {
              'A1': { value: 'Hello' }
            }
          }
        ]
      }

      const result = service.validate(workbook)
      
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should validate workbook with multiple sheets', () => {
      const workbook = {
        sheets: [
          { name: 'Sheet1', cells: { 'A1': { value: 1 } } },
          { name: 'Sheet2', cells: { 'B2': { value: 2 } } },
          { name: 'Sheet3', cells: { 'C3': { value: 3 } } }
        ]
      }

      const result = service.validate(workbook)
      
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should validate workbook with formulas', () => {
      const workbook = {
        sheets: [
          {
            name: 'Sheet1',
            cells: {
              'A1': { value: 10 },
              'A2': { value: 20 },
              'A3': { formula: '=SUM(A1:A2)' }
            }
          }
        ]
      }

      const result = service.validate(workbook)
      
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should reject empty sheets array', () => {
      const workbook = {
        sheets: []
      }

      const result = service.validate(workbook)
      
      expect(result.isValid).toBe(false)
      expect(result.errors.some(e => e.includes('Array must contain at least 1 element'))).toBe(true)
    })

    it('should reject sheet name too long', () => {
      const longName = 'A'.repeat(WORKBOOK_LIMITS.MAX_SHEET_NAME_LENGTH + 1)
      const workbook = {
        sheets: [
          { name: longName, cells: {} }
        ]
      }

      const result = service.validate(workbook)
      
      expect(result.isValid).toBe(false)
      expect(result.errors.some(e => e.includes('String must contain at most'))).toBe(true)
    })

    it('should reject too many sheets', () => {
      const sheets = Array.from({ length: 11 }, (_, i) => ({
        name: `Sheet${i + 1}`,
        cells: {}
      }))

      const workbook = { sheets }

      const result = service.validate(workbook)
      
      expect(result.isValid).toBe(false)
      expect(result.errors.some(e => e.includes('Array must contain at most'))).toBe(true)
    })

    it('should reject formula without = prefix', () => {
      const workbook = {
        sheets: [
          {
            name: 'Sheet1',
            cells: {
              'A1': { formula: 'SUM(A1:A10)' } // Missing =
            }
          }
        ]
      }

      const result = service.validate(workbook)
      
      expect(result.isValid).toBe(false)
      expect(result.errors.some(e => e.includes("must start with '='"))).toBe(true)
    })

    it('should reject formula exceeding max length', () => {
      const longFormula = '=' + 'A'.repeat(WORKBOOK_LIMITS.MAX_FORMULA_LENGTH + 1)
      const workbook = {
        sheets: [
          {
            name: 'Sheet1',
            cells: {
              'A1': { formula: longFormula }
            }
          }
        ]
      }

      const result = service.validate(workbook)
      
      expect(result.isValid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors[0]).toContain('String must contain at most 1000 character(s)')
    })

    it('should warn when approaching cell limit', () => {
      const cells: Record<string, { value: number }> = {}
      const warningThreshold = Math.floor(WORKBOOK_LIMITS.MAX_CELLS * 0.8)
      
      // Create cells at threshold
      for (let i = 0; i < warningThreshold + 100; i++) {
        cells[`A${i + 1}`] = { value: i }
      }

      const workbook = {
        sheets: [{ name: 'Sheet1', cells }]
      }

      const result = service.validate(workbook)
      
      expect(result.warnings.some(w => w.includes('approaching maximum cell limit'))).toBe(true)
    })

    it('should validate cell with formatting', () => {
      const workbook = {
        sheets: [
          {
            name: 'Sheet1',
            cells: {
              'A1': {
                value: 'Formatted',
                format: {
                  bold: true,
                  italic: true,
                  color: '#FF0000',
                  backgroundColor: '#FFFF00'
                }
              }
            }
          }
        ]
      }

      const result = service.validate(workbook)
      
      expect(result.isValid).toBe(true)
    })

    it('should validate different value types', () => {
      const workbook = {
        sheets: [
          {
            name: 'Sheet1',
            cells: {
              'A1': { value: 'string' },
              'A2': { value: 123 },
              'A3': { value: true },
              'A4': { value: null },
              'A5': {} // No value
            }
          }
        ]
      }

      const result = service.validate(workbook)
      
      expect(result.isValid).toBe(true)
    })
  })

  describe('getStatistics', () => {
    it('should calculate statistics correctly', () => {
      const workbook = {
        sheets: [
          {
            name: 'Sheet1',
            cells: {
              'A1': { value: 1 },
              'A2': { value: 2 },
              'A3': { formula: '=SUM(A1:A2)' },
              'B1': { value: 'test' }
            }
          },
          {
            name: 'Sheet2',
            cells: {
              'A1': { value: 10 },
              'Z99': { formula: '=A1*2' }
            }
          }
        ]
      }

      const stats = service.getStatistics(workbook)
      
      expect(stats.totalSheets).toBe(2)
      expect(stats.totalCells).toBe(6)
      expect(stats.totalFormulas).toBe(2)
      expect(stats.maxRow).toBe(98) // Z99 -> row 98
      expect(stats.maxCol).toBe(25) // Z99 -> col 25
      expect(stats.estimatedSizeBytes).toBeGreaterThan(0)
    })

    it('should handle empty workbook', () => {
      const workbook = {
        sheets: [{ name: 'Sheet1', cells: {} }]
      }

      const stats = service.getStatistics(workbook)
      
      expect(stats.totalSheets).toBe(1)
      expect(stats.totalCells).toBe(0)
      expect(stats.totalFormulas).toBe(0)
      expect(stats.maxRow).toBe(0)
      expect(stats.maxCol).toBe(0)
    })
  })
})
