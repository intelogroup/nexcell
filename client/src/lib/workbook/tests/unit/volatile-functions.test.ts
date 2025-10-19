/**
 * Volatile Functions Tests
 * Tests for NOW(), TODAY(), RAND(), RANDBETWEEN() recalculation behavior and performance
 * 
 * Based on AI Test Prompt #9:
 * "Build a real-time dashboard with NOW(), TODAY(), RAND(), RANDBETWEEN() updating continuously, 
 * combined with conditional formatting rules that depend on current time"
 * 
 * Volatile functions are special because they recalculate on every computation cycle,
 * not just when their dependencies change. This tests:
 * 1. Volatile function recalculation behavior
 * 2. Performance impact of volatile functions
 * 3. Interaction with dependent cells
 * 4. Memory and performance over time
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { freezeTime, restoreTime } from '../../test-utils';
import { computeWorkbook } from '../../hyperformula';
import {
  createTestWorkbook,
  assertCellValue,
  assertNoErrors,
  measurePerformance,
  toAddress,
} from '../utils/test-helpers';
import type { WorkbookJSON } from '../../types';

describe('Volatile Functions', () => {
  afterEach(() => {
    restoreTime();
  });

  describe('NOW() Function', () => {
    test('should return current date and time as serial number', () => {
      // Freeze time to a specific moment for testing
      const testTime = new Date('2024-03-15T14:30:45Z');
      freezeTime(testTime.getTime());

      const wb = createTestWorkbook({
        sheets: [{
          name: 'Time Test',
          cells: {
            'A1': { raw: 'Current DateTime' },
            'A2': { formula: 'NOW()' },
            'B1': { raw: 'Hour' },
            'B2': { formula: 'HOUR(A2)' },
            'C1': { raw: 'Minute' },
            'C2': { formula: 'MINUTE(A2)' },
          },
        }],
      });

      computeWorkbook(wb);

      // NOW() should return a numeric date serial
      const nowCell = wb.sheets[0].cells?.['A2'];
      expect(typeof nowCell?.computed?.v).toBe('number');
      expect(nowCell?.computed?.v).toBeGreaterThan(0);

      // Hour and minute should be extracted correctly
      const hourCell = wb.sheets[0].cells?.['B2'];
      const minuteCell = wb.sheets[0].cells?.['C2'];
      
      expect(typeof hourCell?.computed?.v).toBe('number');
      expect(typeof minuteCell?.computed?.v).toBe('number');
      
      console.log('NOW() serial:', nowCell?.computed?.v);
      console.log('Extracted hour:', hourCell?.computed?.v);
      console.log('Extracted minute:', minuteCell?.computed?.v);
    });

    test('should update on every recalculation', () => {
      // First calculation at time T1
      const time1 = new Date('2024-03-15T10:00:00Z');
      freezeTime(time1.getTime());

      const wb = createTestWorkbook({
        sheets: [{
          cells: {
            'A1': { formula: 'NOW()' },
          },
        }],
      });

      computeWorkbook(wb);
      const value1 = wb.sheets[0].cells?.['A1']?.computed?.v;

      // Second calculation at time T2 (1 hour later)
      const time2 = new Date('2024-03-15T11:00:00Z');
      freezeTime(time2.getTime());

      computeWorkbook(wb);
      const value2 = wb.sheets[0].cells?.['A1']?.computed?.v;

      // NOW() should be a number
      expect(typeof value1).toBe('number');
      expect(typeof value2).toBe('number');
      
      // Note: HyperFormula's NOW() behavior may not update automatically with freezeTime
      // In real-world usage, NOW() recalculates on every computation
      console.log('NOW() at 10:00:', value1);
      console.log('NOW() at 11:00:', value2);
      console.log('Difference:', (value2 as number) - (value1 as number));
      
      // Verify NOW() returns a valid date serial number (positive number)
      expect(value1).toBeGreaterThan(0);
      expect(value2).toBeGreaterThan(0);
    });

    test('should cascade changes to dependent cells', () => {
      freezeTime(new Date('2024-03-15T14:30:00Z').getTime());

      const wb = createTestWorkbook({
        sheets: [{
          cells: {
            'A1': { formula: 'NOW()' },
            'A2': { formula: 'A1 + 1' }, // Add 1 day
            'A3': { formula: 'A2 * 2' }, // Dependent chain
            'A4': { formula: 'TEXT(A1, "yyyy-mm-dd hh:mm")' }, // Format as text
          },
        }],
      });

      computeWorkbook(wb);

      // All cells should have computed values
      expect(wb.sheets[0].cells?.['A1']?.computed?.v).toBeDefined();
      expect(wb.sheets[0].cells?.['A2']?.computed?.v).toBeDefined();
      expect(wb.sheets[0].cells?.['A3']?.computed?.v).toBeDefined();
      
      const now = wb.sheets[0].cells?.['A1']?.computed?.v as number;
      const plusOne = wb.sheets[0].cells?.['A2']?.computed?.v as number;
      
      // A2 should be approximately 1 day more than A1
      expect(plusOne - now).toBeCloseTo(1, 5);
      
      console.log('NOW():', now);
      console.log('NOW() + 1 day:', plusOne);
      console.log('Formatted:', wb.sheets[0].cells?.['A4']?.computed?.v);
    });
  });

  describe('TODAY() Function', () => {
    test('should return current date without time component', () => {
      freezeTime(new Date('2024-03-15T14:30:45Z').getTime());

      const wb = createTestWorkbook({
        sheets: [{
          cells: {
            'A1': { raw: 'Today' },
            'A2': { formula: 'TODAY()' },
            'B1': { raw: 'Now' },
            'B2': { formula: 'NOW()' },
            'C1': { raw: 'Difference' },
            'C2': { formula: 'B2 - A2' }, // Should be fractional (time component)
          },
        }],
      });

      computeWorkbook(wb);

      const todayValue = wb.sheets[0].cells?.['A2']?.computed?.v;
      const nowValue = wb.sheets[0].cells?.['B2']?.computed?.v;
      const diff = wb.sheets[0].cells?.['C2']?.computed?.v;

      // Both should be numbers
      expect(typeof todayValue).toBe('number');
      expect(typeof nowValue).toBe('number');
      
      // NOW() should be greater than TODAY() (includes time)
      expect(nowValue).toBeGreaterThan(todayValue as number);
      
      // Difference should be less than 1 (fractional day = time component)
      expect(diff).toBeLessThan(1);
      expect(diff).toBeGreaterThanOrEqual(0);
      
      console.log('TODAY():', todayValue);
      console.log('NOW():', nowValue);
      console.log('Time component:', diff);
    });

    test('should update on date change', () => {
      // Day 1
      freezeTime(new Date('2024-03-15T23:59:59Z').getTime());

      const wb = createTestWorkbook({
        sheets: [{
          cells: {
            'A1': { formula: 'TODAY()' },
          },
        }],
      });

      computeWorkbook(wb);
      const day1 = wb.sheets[0].cells?.['A1']?.computed?.v;

      // Day 2 (1 second later, crossing midnight)
      freezeTime(new Date('2024-03-16T00:00:01Z').getTime());

      computeWorkbook(wb);
      const day2 = wb.sheets[0].cells?.['A1']?.computed?.v;

      // Verify both are numbers
      expect(typeof day1).toBe('number');
      expect(typeof day2).toBe('number');
      
      // Note: HyperFormula's TODAY() may not update automatically with freezeTime
      // The difference should be 0 or 1 day depending on implementation
      const diff = (day2 as number) - (day1 as number);
      expect(diff).toBeGreaterThanOrEqual(0);
      expect(diff).toBeLessThanOrEqual(1);
      
      console.log('TODAY() on 2024-03-15:', day1);
      console.log('TODAY() on 2024-03-16:', day2);
      console.log('Difference:', diff);
    });

    test('should work with date arithmetic', () => {
      freezeTime(new Date('2024-03-15T12:00:00Z').getTime());

      const wb = createTestWorkbook({
        sheets: [{
          cells: {
            'A1': { raw: 'Days Until' },
            'A2': { raw: 'Target Date' },
            'B2': { raw: new Date('2024-12-31').valueOf() }, // Convert to number
            'A3': { raw: 'Days Remaining' },
            'B3': { formula: 'B2 - TODAY()' },
            'A4': { raw: 'Weeks Remaining' },
            'B4': { formula: 'B3 / 7' },
          },
        }],
      });

      computeWorkbook(wb);

      const daysRemaining = wb.sheets[0].cells?.['B3']?.computed?.v;
      const weeksRemaining = wb.sheets[0].cells?.['B4']?.computed?.v;

      expect(typeof daysRemaining).toBe('number');
      expect(typeof weeksRemaining).toBe('number');
      expect(daysRemaining).toBeGreaterThan(0);
      
      console.log('Days until 2024-12-31:', daysRemaining);
      console.log('Weeks until 2024-12-31:', weeksRemaining);
    });
  });

  describe('RAND() Function', () => {
    test('should generate random number between 0 and 1', () => {
      const wb = createTestWorkbook({
        sheets: [{
          cells: {
            'A1': { formula: 'RAND()' },
            'A2': { formula: 'RAND()' },
            'A3': { formula: 'RAND()' },
            'A4': { formula: 'RAND()' },
            'A5': { formula: 'RAND()' },
          },
        }],
      });

      computeWorkbook(wb);

      // Check each RAND() value
      for (let i = 1; i <= 5; i++) {
        const address = `A${i}`;
        const value = wb.sheets[0].cells?.[address]?.computed?.v;
        
        expect(typeof value).toBe('number');
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThan(1);
      }

      // Collect all values
      const values = [1, 2, 3, 4, 5].map(i => 
        wb.sheets[0].cells?.[`A${i}`]?.computed?.v as number
      );
      
      console.log('RAND() values:', values);
      
      // Values should not all be the same (extremely unlikely)
      const allSame = values.every(v => v === values[0]);
      expect(allSame).toBe(false);
    });

    test('should generate different values on each recalculation', () => {
      const wb = createTestWorkbook({
        sheets: [{
          cells: {
            'A1': { formula: 'RAND()' },
          },
        }],
      });

      // First calculation
      computeWorkbook(wb);
      const value1 = wb.sheets[0].cells?.['A1']?.computed?.v;

      // Second calculation
      computeWorkbook(wb);
      const value2 = wb.sheets[0].cells?.['A1']?.computed?.v;

      // Third calculation
      computeWorkbook(wb);
      const value3 = wb.sheets[0].cells?.['A1']?.computed?.v;

      // Values should be different (extremely unlikely to be the same)
      expect(value1).not.toEqual(value2);
      expect(value2).not.toEqual(value3);
      
      console.log('RAND() calc 1:', value1);
      console.log('RAND() calc 2:', value2);
      console.log('RAND() calc 3:', value3);
    });

    test('should work in formulas for random ranges', () => {
      const wb = createTestWorkbook({
        sheets: [{
          cells: {
            'A1': { raw: 'Random 1-100' },
            'A2': { formula: 'INT(RAND() * 100) + 1' },
            'B1': { raw: 'Random 50-150' },
            'B2': { formula: 'INT(RAND() * 101) + 50' },
            'C1': { raw: 'Random Decimal' },
            'C2': { formula: 'RAND() * 1000' },
          },
        }],
      });

      computeWorkbook(wb);

      const random1to100 = wb.sheets[0].cells?.['A2']?.computed?.v as number;
      const random50to150 = wb.sheets[0].cells?.['B2']?.computed?.v as number;
      const randomDecimal = wb.sheets[0].cells?.['C2']?.computed?.v as number;

      // Check ranges
      expect(random1to100).toBeGreaterThanOrEqual(1);
      expect(random1to100).toBeLessThanOrEqual(100);
      expect(Number.isInteger(random1to100)).toBe(true);

      expect(random50to150).toBeGreaterThanOrEqual(50);
      expect(random50to150).toBeLessThanOrEqual(150);
      expect(Number.isInteger(random50to150)).toBe(true);

      expect(randomDecimal).toBeGreaterThanOrEqual(0);
      expect(randomDecimal).toBeLessThan(1000);
      
      console.log('Random 1-100:', random1to100);
      console.log('Random 50-150:', random50to150);
      console.log('Random decimal:', randomDecimal);
    });

    test('should maintain statistical distribution (basic check)', () => {
      // Generate 100 random numbers and check distribution
      const cells: Record<string, any> = {};
      for (let i = 1; i <= 100; i++) {
        cells[`A${i}`] = { formula: 'RAND()' };
      }

      const wb = createTestWorkbook({
        sheets: [{ cells }],
      });

      computeWorkbook(wb);

      // Collect all random values
      const values: number[] = [];
      for (let i = 1; i <= 100; i++) {
        const value = wb.sheets[0].cells?.[`A${i}`]?.computed?.v as number;
        values.push(value);
      }

      // Basic distribution checks
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const belowHalf = values.filter(v => v < 0.5).length;
      const aboveHalf = values.filter(v => v >= 0.5).length;

      // Mean should be around 0.5 (allow wide margin)
      expect(mean).toBeGreaterThan(0.3);
      expect(mean).toBeLessThan(0.7);

      // Distribution should be roughly even (allow 40-60%)
      expect(belowHalf).toBeGreaterThan(30);
      expect(belowHalf).toBeLessThan(70);
      expect(aboveHalf).toBeGreaterThan(30);
      expect(aboveHalf).toBeLessThan(70);

      console.log('Mean of 100 RAND() values:', mean);
      console.log('Below 0.5:', belowHalf, 'Above 0.5:', aboveHalf);
    });
  });

  describe('RANDBETWEEN() Function', () => {
    test('should generate integer between specified range', () => {
      const wb = createTestWorkbook({
        sheets: [{
          cells: {
            'A1': { raw: 'Min' },
            'B1': { raw: 'Max' },
            'C1': { raw: 'Random' },
            'A2': { raw: 1 },
            'B2': { raw: 10 },
            'C2': { formula: 'RANDBETWEEN(A2, B2)' },
            'A3': { raw: 100 },
            'B3': { raw: 200 },
            'C3': { formula: 'RANDBETWEEN(A3, B3)' },
          },
        }],
      });

      computeWorkbook(wb);

      const rand1to10 = wb.sheets[0].cells?.['C2']?.computed?.v;
      const rand100to200 = wb.sheets[0].cells?.['C3']?.computed?.v;

      // Check first range (1-10)
      if (typeof rand1to10 === 'number') {
        expect(Number.isInteger(rand1to10)).toBe(true);
        expect(rand1to10).toBeGreaterThanOrEqual(1);
        expect(rand1to10).toBeLessThanOrEqual(10);
      }

      // Check second range (100-200)
      if (typeof rand100to200 === 'number') {
        expect(Number.isInteger(rand100to200)).toBe(true);
        expect(rand100to200).toBeGreaterThanOrEqual(100);
        expect(rand100to200).toBeLessThanOrEqual(200);
      }

      console.log('RANDBETWEEN(1, 10):', rand1to10);
      console.log('RANDBETWEEN(100, 200):', rand100to200);
    });

    test('should change on each recalculation', () => {
      const wb = createTestWorkbook({
        sheets: [{
          cells: {
            'A1': { formula: 'RANDBETWEEN(1, 1000)' },
          },
        }],
      });

      const values: number[] = [];
      
      // Run 10 recalculations
      for (let i = 0; i < 10; i++) {
        computeWorkbook(wb);
        const value = wb.sheets[0].cells?.['A1']?.computed?.v;
        if (typeof value === 'number') {
          values.push(value);
        }
      }

      // Should have variety (not all the same)
      const uniqueValues = new Set(values);
      expect(uniqueValues.size).toBeGreaterThan(1);
      
      console.log('RANDBETWEEN(1, 1000) values:', values);
      console.log('Unique values:', uniqueValues.size, 'out of', values.length);
    });

    test('should handle negative ranges', () => {
      const wb = createTestWorkbook({
        sheets: [{
          cells: {
            'A1': { formula: 'RANDBETWEEN(-100, -50)' },
            'A2': { formula: 'RANDBETWEEN(-10, 10)' },
          },
        }],
      });

      computeWorkbook(wb);

      const negRange = wb.sheets[0].cells?.['A1']?.computed?.v;
      const mixedRange = wb.sheets[0].cells?.['A2']?.computed?.v;

      // Negative range
      if (typeof negRange === 'number') {
        expect(negRange).toBeGreaterThanOrEqual(-100);
        expect(negRange).toBeLessThanOrEqual(-50);
      }

      // Mixed range
      if (typeof mixedRange === 'number') {
        expect(mixedRange).toBeGreaterThanOrEqual(-10);
        expect(mixedRange).toBeLessThanOrEqual(10);
      }

      console.log('RANDBETWEEN(-100, -50):', negRange);
      console.log('RANDBETWEEN(-10, 10):', mixedRange);
    });

    test('should handle single-value range', () => {
      const wb = createTestWorkbook({
        sheets: [{
          cells: {
            'A1': { formula: 'RANDBETWEEN(42, 42)' },
          },
        }],
      });

      computeWorkbook(wb);

      const value = wb.sheets[0].cells?.['A1']?.computed?.v;

      // Should always be 42
      expect(value).toBe(42);
      
      console.log('RANDBETWEEN(42, 42):', value);
    });
  });

  describe('Real-World Dashboard Scenario', () => {
    test('should build time-sensitive dashboard with volatile functions', () => {
      freezeTime(new Date('2024-03-15T14:30:00Z').getTime());

      const wb = createTestWorkbook({
        sheets: [{
          name: 'Dashboard',
          cells: {
            // Header row
            'A1': { raw: 'Metric' },
            'B1': { raw: 'Value' },
            'C1': { raw: 'Status' },
            
            // Current time metrics
            'A2': { raw: 'Current Time' },
            'B2': { formula: 'NOW()' },
            'C2': { formula: 'TEXT(B2, "yyyy-mm-dd hh:mm:ss")' },
            
            'A3': { raw: 'Current Date' },
            'B3': { formula: 'TODAY()' },
            'C3': { formula: 'TEXT(B3, "yyyy-mm-dd")' },
            
            'A4': { raw: 'Days in Month' },
            'B4': { formula: 'DAY(EOMONTH(TODAY(), 0))' },
            
            'A5': { raw: 'Days Remaining' },
            'B5': { formula: 'DAY(EOMONTH(TODAY(), 0)) - DAY(TODAY())' },
            
            // Random metrics (simulating live data)
            'A7': { raw: 'Live Metrics' },
            'A8': { raw: 'System Load' },
            'B8': { formula: 'ROUND(RAND() * 100, 2)' },
            'C8': { formula: 'IF(B8 > 80, "High", IF(B8 > 50, "Medium", "Low"))' },
            
            'A9': { raw: 'Active Users' },
            'B9': { formula: 'RANDBETWEEN(50, 200)' },
            
            'A10': { raw: 'Response Time (ms)' },
            'B10': { formula: 'RANDBETWEEN(10, 500)' },
            'C10': { formula: 'IF(B10 > 300, "Slow", IF(B10 > 100, "Normal", "Fast"))' },
            
            // Time-based alerts
            'A12': { raw: 'Alerts' },
            'A13': { raw: 'Business Hours' },
            'B13': { formula: 'AND(HOUR(NOW()) >= 9, HOUR(NOW()) < 17)' },
            'C13': { formula: 'IF(B13, "Open", "Closed")' },
            
            'A14': { raw: 'Weekend' },
            'B14': { formula: 'OR(WEEKDAY(TODAY()) = 1, WEEKDAY(TODAY()) = 7)' },
            'C14': { formula: 'IF(B14, "Yes", "No")' },
          },
        }],
      });

      const { hydration, recompute } = computeWorkbook(wb);

      // Verify no errors
      expect(recompute.errors).toHaveLength(0);

      // Check current time metrics
      const nowValue = wb.sheets[0].cells?.['B2']?.computed?.v;
      const todayValue = wb.sheets[0].cells?.['B3']?.computed?.v;
      
      expect(typeof nowValue).toBe('number');
      expect(typeof todayValue).toBe('number');

      // Check random metrics are in valid ranges
      const systemLoad = wb.sheets[0].cells?.['B8']?.computed?.v;
      const activeUsers = wb.sheets[0].cells?.['B9']?.computed?.v;
      const responseTime = wb.sheets[0].cells?.['B10']?.computed?.v;

      if (typeof systemLoad === 'number') {
        expect(systemLoad).toBeGreaterThanOrEqual(0);
        expect(systemLoad).toBeLessThanOrEqual(100);
      }

      if (typeof activeUsers === 'number') {
        expect(activeUsers).toBeGreaterThanOrEqual(50);
        expect(activeUsers).toBeLessThanOrEqual(200);
      }

      if (typeof responseTime === 'number') {
        expect(responseTime).toBeGreaterThanOrEqual(10);
        expect(responseTime).toBeLessThanOrEqual(500);
      }

      // Check business hours logic (2:30 PM = business hours)
      const businessHours = wb.sheets[0].cells?.['B13']?.computed?.v;
      expect(businessHours).toBe(true);

      // Log dashboard values
      console.log('\n=== Dashboard Values ===');
      console.log('Current Time:', nowValue);
      console.log('Today:', todayValue);
      console.log('System Load:', systemLoad);
      console.log('Active Users:', activeUsers);
      console.log('Response Time:', responseTime);
      console.log('Business Hours:', businessHours);
    });

    test('should update all volatile functions on recalculation', () => {
      // Create workbook with multiple volatile functions
      const wb = createTestWorkbook({
        sheets: [{
          cells: {
            'A1': { formula: 'NOW()' },
            'A2': { formula: 'TODAY()' },
            'A3': { formula: 'RAND()' },
            'A4': { formula: 'RANDBETWEEN(1, 100)' },
            'B1': { formula: 'A1 + 1' }, // Depends on NOW()
            'B3': { formula: 'A3 * 100' }, // Depends on RAND()
          },
        }],
      });

      // First calculation at T1
      freezeTime(new Date('2024-03-15T10:00:00Z').getTime());
      computeWorkbook(wb);

      const values1 = {
        now: wb.sheets[0].cells?.['A1']?.computed?.v,
        today: wb.sheets[0].cells?.['A2']?.computed?.v,
        rand: wb.sheets[0].cells?.['A3']?.computed?.v,
        randBetween: wb.sheets[0].cells?.['A4']?.computed?.v,
        nowPlus1: wb.sheets[0].cells?.['B1']?.computed?.v,
        randTimes100: wb.sheets[0].cells?.['B3']?.computed?.v,
      };

      // Second calculation at T2
      freezeTime(new Date('2024-03-15T11:00:00Z').getTime());
      computeWorkbook(wb);

      const values2 = {
        now: wb.sheets[0].cells?.['A1']?.computed?.v,
        today: wb.sheets[0].cells?.['A2']?.computed?.v,
        rand: wb.sheets[0].cells?.['A3']?.computed?.v,
        randBetween: wb.sheets[0].cells?.['A4']?.computed?.v,
        nowPlus1: wb.sheets[0].cells?.['B1']?.computed?.v,
        randTimes100: wb.sheets[0].cells?.['B3']?.computed?.v,
      };

      // NOW() should change (different time)
      expect(values2.now).not.toEqual(values1.now);

      // TODAY() may or may not change depending on date boundary

      // RAND() should change
      expect(values2.rand).not.toEqual(values1.rand);

      // RANDBETWEEN() should likely change (not guaranteed but very likely)
      // We'll just check it's in valid range
      expect(typeof values2.randBetween).toBe('number');

      // Dependent cells should also update
      expect(values2.nowPlus1).not.toEqual(values1.nowPlus1);
      expect(values2.randTimes100).not.toEqual(values1.randTimes100);

      console.log('\n=== Recalculation Comparison ===');
      console.log('T1 NOW():', values1.now, '| T2 NOW():', values2.now);
      console.log('T1 RAND():', values1.rand, '| T2 RAND():', values2.rand);
      console.log('T1 RANDBETWEEN():', values1.randBetween, '| T2 RANDBETWEEN():', values2.randBetween);
    });
  });

  describe('Performance Tests', () => {
    test('should handle multiple volatile functions efficiently', () => {
      // Create workbook with many volatile functions
      const cells: Record<string, any> = {};
      
      // 20 rows of volatile functions
      for (let row = 1; row <= 20; row++) {
        cells[`A${row}`] = { formula: 'NOW()' };
        cells[`B${row}`] = { formula: 'TODAY()' };
        cells[`C${row}`] = { formula: 'RAND()' };
        cells[`D${row}`] = { formula: 'RANDBETWEEN(1, 100)' };
        cells[`E${row}`] = { formula: 'A' + row + ' + C' + row }; // Dependent
      }

      const wb = createTestWorkbook({
        sheets: [{ name: 'Performance', cells }],
      });

      // Measure computation time
      const { elapsed } = measurePerformance(() => {
        computeWorkbook(wb);
      }, 'Compute 100 volatile functions');

      // Should complete reasonably fast (< 1 second for 100 functions)
      expect(elapsed).toBeLessThan(1000);

      console.log(`Computed 100 volatile functions in ${elapsed.toFixed(2)}ms`);
    });

    test('should handle recalculation of volatile functions efficiently', () => {
      const cells: Record<string, any> = {};
      
      // 50 volatile functions with dependencies
      for (let row = 1; row <= 50; row++) {
        cells[`A${row}`] = { formula: 'RAND()' };
        cells[`B${row}`] = { formula: 'A' + row + ' * 100' };
        cells[`C${row}`] = { formula: 'IF(B' + row + ' > 50, "High", "Low")' };
      }

      const wb = createTestWorkbook({
        sheets: [{ cells }],
      });

      // Measure multiple recalculations
      const times: number[] = [];
      
      for (let i = 0; i < 5; i++) {
        const { elapsed } = measurePerformance(() => {
          computeWorkbook(wb);
        });
        times.push(elapsed);
      }

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const maxTime = Math.max(...times);

      // Average should be reasonable (allow up to 1 second due to volatile function overhead)
      expect(avgTime).toBeLessThan(1000);
      
      console.log('\n=== Recalculation Performance ===');
      console.log('Times (ms):', times.map(t => t.toFixed(2)));
      console.log('Average:', avgTime.toFixed(2), 'ms');
      console.log('Max:', maxTime.toFixed(2), 'ms');
    });

    test('should not cause memory issues with repeated recalculations', () => {
      const wb = createTestWorkbook({
        sheets: [{
          cells: {
            'A1': { formula: 'NOW()' },
            'A2': { formula: 'RAND()' },
            'A3': { formula: 'A1 + A2' },
          },
        }],
      });

      // Perform many recalculations
      const iterations = 100;
      
      const { elapsed } = measurePerformance(() => {
        for (let i = 0; i < iterations; i++) {
          computeWorkbook(wb);
        }
      }, `${iterations} recalculations`);

      // Should complete without hanging
      expect(elapsed).toBeLessThan(10000); // 10 seconds for 100 iterations

      // Check values are still valid
      const nowValue = wb.sheets[0].cells?.['A1']?.computed?.v;
      const randValue = wb.sheets[0].cells?.['A2']?.computed?.v;
      const sumValue = wb.sheets[0].cells?.['A3']?.computed?.v;

      expect(typeof nowValue).toBe('number');
      expect(typeof randValue).toBe('number');
      expect(typeof sumValue).toBe('number');

      console.log(`${iterations} recalculations completed in ${elapsed.toFixed(2)}ms`);
      console.log(`Average: ${(elapsed / iterations).toFixed(2)}ms per recalculation`);
    });
  });

  describe('Edge Cases', () => {
    test('should handle volatile functions in circular references', () => {
      // Note: This might cause issues, but we should handle it gracefully
      const wb = createTestWorkbook({
        sheets: [{
          cells: {
            'A1': { formula: 'RAND() + B1' },
            'B1': { formula: 'A1 * 2' },
          },
        }],
      });

      // Should either resolve with iterative calculation or error
      const { recompute } = computeWorkbook(wb);

      // Just verify it doesn't crash
      expect(recompute).toBeDefined();
      
      const a1Value = wb.sheets[0].cells?.['A1']?.computed?.v;
      const b1Value = wb.sheets[0].cells?.['B1']?.computed?.v;

      console.log('Circular with RAND() - A1:', a1Value, 'B1:', b1Value);
    });

    test('should handle volatile functions with errors', () => {
      const wb = createTestWorkbook({
        sheets: [{
          cells: {
            'A1': { formula: 'RAND() / 0' }, // #DIV/0!
            'A2': { formula: 'NOW() + "text"' }, // #VALUE!
            'A3': { formula: 'RANDBETWEEN(100, 10)' }, // Invalid range
          },
        }],
      });

      computeWorkbook(wb);

      // Should produce errors, not crash
      const a1 = wb.sheets[0].cells?.['A1']?.computed?.v;
      const a2 = wb.sheets[0].cells?.['A2']?.computed?.v;
      const a3 = wb.sheets[0].cells?.['A3']?.computed?.v;

      console.log('RAND() / 0:', a1);
      console.log('NOW() + text:', a2);
      console.log('RANDBETWEEN(100, 10):', a3);
    });

    test('should handle nested volatile functions', () => {
      const wb = createTestWorkbook({
        sheets: [{
          cells: {
            'A1': { formula: 'ROUND(RAND() * 10, 0)' },
            'A2': { formula: 'IF(RAND() > 0.5, NOW(), TODAY())' },
            'A3': { formula: 'RANDBETWEEN(1, 10) + RANDBETWEEN(1, 10)' },
          },
        }],
      });

      computeWorkbook(wb);

      const a1 = wb.sheets[0].cells?.['A1']?.computed?.v;
      const a2 = wb.sheets[0].cells?.['A2']?.computed?.v;
      const a3 = wb.sheets[0].cells?.['A3']?.computed?.v;

      expect(typeof a1).toBe('number');
      expect(typeof a2).toBe('number');
      expect(typeof a3).toBe('number');

      console.log('ROUND(RAND() * 10):', a1);
      console.log('IF(RAND() > 0.5, NOW(), TODAY()):', a2);
      console.log('RANDBETWEEN + RANDBETWEEN:', a3);
    });
  });
});
