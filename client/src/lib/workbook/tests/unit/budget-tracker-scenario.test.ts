/**
 * Budget Tracker Scenario Test (Prompt 31)
 * 
 * Real-world quarterly budget tracker with:
 * - Single department budget with variance calculations
 * - Cross-sheet rollups and consolidation
 * - Variance analysis with conditional formulas
 * - Year-to-date calculations
 * - Complete end-to-end workflow
 * 
 * This test validates end-to-end workflow for a realistic business scenario.
 */

import { describe, it, expect } from 'vitest';
import { createWorkbook } from '../../utils';
import { hydrateHFFromWorkbook, recomputeAndPatchCache } from '../../hyperformula';

describe('Budget Tracker Scenario (Prompt 31)', () => {

  describe('Step 1: Simple Budget with Variance', () => {
    it('should calculate budget variance for single month', () => {
      const wb = createWorkbook('Budget');
      const sheet = wb.sheets[0];
      
      // Simple budget vs actual
      sheet.cells = {
        A1: { raw: 'Budget', dataType: 'string' } as any,
        A2: { raw: 50000, dataType: 'number' } as any,
        
        B1: { raw: 'Actual', dataType: 'string' } as any,
        B2: { raw: 52000, dataType: 'number' } as any,
        
        C1: { raw: 'Variance', dataType: 'string' } as any,
        C2: { formula: '=B2-A2', dataType: 'formula' } as any,
      };
      
      const hydration = hydrateHFFromWorkbook(wb);
      recomputeAndPatchCache(wb, hydration);
      
      expect(sheet.cells!['C2']?.computed?.v).toBe(2000);
      
      console.log('✓ Simple variance calculated: $2,000 over budget');
      hydration.hf.destroy();
    });

    it('should calculate variance percentage', () => {
      const wb = createWorkbook('Budget');
      const sheet = wb.sheets[0];
      
      sheet.cells = {
        A1: { raw: 50000, dataType: 'number' } as any,
        B1: { raw: 52000, dataType: 'number' } as any,
        C1: { formula: '=B1-A1', dataType: 'formula' } as any,
        D1: { formula: '=IF(A1=0,0,C1/A1)', dataType: 'formula' } as any,
      };
      
      const hydration = hydrateHFFromWorkbook(wb);
      recomputeAndPatchCache(wb, hydration);
      
      expect(sheet.cells!['C1']?.computed?.v).toBe(2000);
      expect(sheet.cells!['D1']?.computed?.v).toBeCloseTo(0.04, 4); // 4%
      
      console.log('✓ Variance percentage: 4.0%');
      hydration.hf.destroy();
    });
  });

  describe('Step 2: Monthly Budget Tracking', () => {
    it('should track multiple months with totals', () => {
      const wb = createWorkbook('Budget');
      const sheet = wb.sheets[0];
      
      sheet.cells = {
        // Headers
        A1: { raw: 'Month', dataType: 'string' } as any,
        B1: { raw: 'Budget', dataType: 'string' } as any,
        C1: { raw: 'Actual', dataType: 'string' } as any,
        D1: { raw: 'Variance', dataType: 'string' } as any,
        
        // January
        A2: { raw: 'January', dataType: 'string' } as any,
        B2: { raw: 50000, dataType: 'number' } as any,
        C2: { raw: 52000, dataType: 'number' } as any,
        D2: { formula: '=C2-B2', dataType: 'formula' } as any,
        
        // February
        A3: { raw: 'February', dataType: 'string' } as any,
        B3: { raw: 50000, dataType: 'number' } as any,
        C3: { raw: 48000, dataType: 'number' } as any,
        D3: { formula: '=C3-B3', dataType: 'formula' } as any,
        
        // March
        A4: { raw: 'March', dataType: 'string' } as any,
        B4: { raw: 50000, dataType: 'number' } as any,
        C4: { raw: 55000, dataType: 'number' } as any,
        D4: { formula: '=C4-B4', dataType: 'formula' } as any,
        
        // Q1 Total
        A5: { raw: 'Q1 Total', dataType: 'string' } as any,
        B5: { formula: '=SUM(B2:B4)', dataType: 'formula' } as any,
        C5: { formula: '=SUM(C2:C4)', dataType: 'formula' } as any,
        D5: { formula: '=C5-B5', dataType: 'formula' } as any,
      };
      
      const hydration = hydrateHFFromWorkbook(wb);
      recomputeAndPatchCache(wb, hydration);
      
      // Verify monthly variances
      expect(sheet.cells!['D2']?.computed?.v).toBe(2000); // Jan: +2k
      expect(sheet.cells!['D3']?.computed?.v).toBe(-2000); // Feb: -2k
      expect(sheet.cells!['D4']?.computed?.v).toBe(5000); // Mar: +5k
      
      // Verify totals
      expect(sheet.cells!['B5']?.computed?.v).toBe(150000); // Budget total
      expect(sheet.cells!['C5']?.computed?.v).toBe(155000); // Actual total
      expect(sheet.cells!['D5']?.computed?.v).toBe(5000); // Total variance
      
      console.log('✓ Q1 tracking: Budget $150k, Actual $155k, Variance +$5k');
      hydration.hf.destroy();
    });
  });

  describe('Step 3: Cross-Sheet Department Rollup', () => {
    it('should consolidate multiple department sheets', () => {
      const wb = createWorkbook('Budget');
      
      // Rename first sheet to Sales
      wb.sheets[0].name = 'Sales';
      wb.sheets[0].id = 'sales';
      wb.sheets[0].cells = {
        A1: { raw: 'Q1 Budget', dataType: 'string' } as any,
        A2: { raw: 150000, dataType: 'number' } as any,
        B1: { raw: 'Q1 Actual', dataType: 'string' } as any,
        B2: { raw: 155000, dataType: 'number' } as any,
      };
      
      // Add Marketing sheet
      wb.sheets.push({
        name: 'Marketing',
        id: 'marketing',
        cells: {
          A1: { raw: 'Q1 Budget', dataType: 'string' } as any,
          A2: { raw: 60000, dataType: 'number' } as any,
          B1: { raw: 'Q1 Actual', dataType: 'string' } as any,
          B2: { raw: 61000, dataType: 'number' } as any,
        },
      });
      
      // Add Operations sheet
      wb.sheets.push({
        name: 'Operations',
        id: 'operations',
        cells: {
          A1: { raw: 'Q1 Budget', dataType: 'string' } as any,
          A2: { raw: 90000, dataType: 'number' } as any,
          B1: { raw: 'Q1 Actual', dataType: 'string' } as any,
          B2: { raw: 90500, dataType: 'number' } as any,
        },
      });
      
      // Add Summary sheet with cross-sheet formulas
      wb.sheets.push({
        name: 'Summary',
        id: 'summary',
        cells: {
          A1: { raw: 'Department', dataType: 'string' } as any,
          B1: { raw: 'Budget', dataType: 'string' } as any,
          C1: { raw: 'Actual', dataType: 'string' } as any,
          D1: { raw: 'Variance', dataType: 'string' } as any,
          
          // Sales rollup
          A2: { raw: 'Sales', dataType: 'string' } as any,
          B2: { formula: '=Sales!A2', dataType: 'formula' } as any,
          C2: { formula: '=Sales!B2', dataType: 'formula' } as any,
          D2: { formula: '=C2-B2', dataType: 'formula' } as any,
          
          // Marketing rollup
          A3: { raw: 'Marketing', dataType: 'string' } as any,
          B3: { formula: '=Marketing!A2', dataType: 'formula' } as any,
          C3: { formula: '=Marketing!B2', dataType: 'formula' } as any,
          D3: { formula: '=C3-B3', dataType: 'formula' } as any,
          
          // Operations rollup
          A4: { raw: 'Operations', dataType: 'string' } as any,
          B4: { formula: '=Operations!A2', dataType: 'formula' } as any,
          C4: { formula: '=Operations!B2', dataType: 'formula' } as any,
          D4: { formula: '=C4-B4', dataType: 'formula' } as any,
          
          // Company Total
          A6: { raw: 'Company Total', dataType: 'string' } as any,
          B6: { formula: '=SUM(B2:B4)', dataType: 'formula' } as any,
          C6: { formula: '=SUM(C2:C4)', dataType: 'formula' } as any,
          D6: { formula: '=C6-B6', dataType: 'formula' } as any,
        },
      });
      
      const hydration = hydrateHFFromWorkbook(wb);
      recomputeAndPatchCache(wb, hydration);
      
      const summary = wb.sheets[3]; // Summary sheet
      
      // Verify cross-sheet rollups
      expect(summary.cells!['B2']?.computed?.v).toBe(150000); // Sales budget
      expect(summary.cells!['C2']?.computed?.v).toBe(155000); // Sales actual
      expect(summary.cells!['D2']?.computed?.v).toBe(5000); // Sales variance
      
      expect(summary.cells!['B3']?.computed?.v).toBe(60000); // Marketing budget
      expect(summary.cells!['C3']?.computed?.v).toBe(61000); // Marketing actual
      
      expect(summary.cells!['B4']?.computed?.v).toBe(90000); // Operations budget
      expect(summary.cells!['C4']?.computed?.v).toBe(90500); // Operations actual
      
      // Verify company totals
      expect(summary.cells!['B6']?.computed?.v).toBe(300000); // Total budget
      expect(summary.cells!['C6']?.computed?.v).toBe(306500); // Total actual
      expect(summary.cells!['D6']?.computed?.v).toBe(6500); // Total variance
      
      console.log('✓ Cross-sheet rollup: 3 departments consolidated');
      console.log(`  Company Budget: $${summary.cells!['B6']?.computed?.v?.toLocaleString()}`);
      console.log(`  Company Actual: $${summary.cells!['C6']?.computed?.v?.toLocaleString()}`);
      console.log(`  Total Variance: +$${summary.cells!['D6']?.computed?.v?.toLocaleString()} (+2.2%)`);
      
      hydration.hf.destroy();
    });
  });

  describe('Step 4: Year-to-Date Tracking', () => {
    it('should calculate cumulative YTD budget and actuals', () => {
      const wb = createWorkbook('YTD');
      const sheet = wb.sheets[0];
      
      sheet.cells = {
        // Headers
        A1: { raw: 'Month', dataType: 'string' } as any,
        B1: { raw: 'Budget', dataType: 'string' } as any,
        C1: { raw: 'Actual', dataType: 'string' } as any,
        D1: { raw: 'YTD Budget', dataType: 'string' } as any,
        E1: { raw: 'YTD Actual', dataType: 'string' } as any,
        
        // January
        A2: { raw: 'January', dataType: 'string' } as any,
        B2: { raw: 100000, dataType: 'number' } as any,
        C2: { raw: 100500, dataType: 'number' } as any,
        D2: { formula: '=B2', dataType: 'formula' } as any,
        E2: { formula: '=C2', dataType: 'formula' } as any,
        
        // February
        A3: { raw: 'February', dataType: 'string' } as any,
        B3: { raw: 100000, dataType: 'number' } as any,
        C3: { raw: 99500, dataType: 'number' } as any,
        D3: { formula: '=D2+B3', dataType: 'formula' } as any,
        E3: { formula: '=E2+C3', dataType: 'formula' } as any,
        
        // March
        A4: { raw: 'March', dataType: 'string' } as any,
        B4: { raw: 100000, dataType: 'number' } as any,
        C4: { raw: 106000, dataType: 'number' } as any,
        D4: { formula: '=D3+B4', dataType: 'formula' } as any,
        E4: { formula: '=E3+C4', dataType: 'formula' } as any,
      };
      
      const hydration = hydrateHFFromWorkbook(wb);
      recomputeAndPatchCache(wb, hydration);
      
      // Verify YTD calculations
      expect(sheet.cells!['D2']?.computed?.v).toBe(100000); // Jan YTD
      expect(sheet.cells!['E2']?.computed?.v).toBe(100500);
      
      expect(sheet.cells!['D3']?.computed?.v).toBe(200000); // Feb YTD
      expect(sheet.cells!['E3']?.computed?.v).toBe(200000);
      
      expect(sheet.cells!['D4']?.computed?.v).toBe(300000); // Mar YTD
      expect(sheet.cells!['E4']?.computed?.v).toBe(306000);
      
      console.log('✓ YTD tracking: Q1 Budget $300k, Q1 Actual $306k');
      hydration.hf.destroy();
    });
  });

  describe('Step 5: Conditional Variance Alerts', () => {
    it('should flag over-budget items with IF formulas', () => {
      const wb = createWorkbook('Alerts');
      const sheet = wb.sheets[0];
      
      sheet.cells = {
        A1: { raw: 'Category', dataType: 'string' } as any,
        B1: { raw: 'Budget', dataType: 'string' } as any,
        C1: { raw: 'Actual', dataType: 'string' } as any,
        D1: { raw: 'Status', dataType: 'string' } as any,
        
        // Travel - 10% over (WARNING)
        A2: { raw: 'Travel', dataType: 'string' } as any,
        B2: { raw: 5000, dataType: 'number' } as any,
        C2: { raw: 5500, dataType: 'number' } as any,
        D2: { formula: '=IF(C2>B2*1.1,"CRITICAL",IF(C2>B2,"WARNING","OK"))', dataType: 'formula' } as any,
        
        // Software - 15% over (CRITICAL)
        A3: { raw: 'Software', dataType: 'string' } as any,
        B3: { raw: 10000, dataType: 'number' } as any,
        C3: { raw: 11500, dataType: 'number' } as any,
        D3: { formula: '=IF(C3>B3*1.1,"CRITICAL",IF(C3>B3,"WARNING","OK"))', dataType: 'formula' } as any,
        
        // Training - under budget (OK)
        A4: { raw: 'Training', dataType: 'string' } as any,
        B4: { raw: 8000, dataType: 'number' } as any,
        C4: { raw: 7200, dataType: 'number' } as any,
        D4: { formula: '=IF(C4>B4*1.1,"CRITICAL",IF(C4>B4,"WARNING","OK"))', dataType: 'formula' } as any,
      };
      
      const hydration = hydrateHFFromWorkbook(wb);
      recomputeAndPatchCache(wb, hydration);
      
      // Verify status flags
      expect(sheet.cells!['D2']?.computed?.v).toBe('WARNING');
      expect(sheet.cells!['D3']?.computed?.v).toBe('CRITICAL');
      expect(sheet.cells!['D4']?.computed?.v).toBe('OK');
      
      console.log('✓ Conditional alerts: CRITICAL (Software), WARNING (Travel), OK (Training)');
      hydration.hf.destroy();
    });
  });

  describe('Step 6: Budget Allocation Percentages', () => {
    it('should calculate department allocation with absolute reference', () => {
      const wb = createWorkbook('Allocation');
      const sheet = wb.sheets[0];
      
      sheet.cells = {
        A1: { raw: 'Department', dataType: 'string' } as any,
        B1: { raw: 'Budget', dataType: 'string' } as any,
        C1: { raw: '% of Total', dataType: 'string' } as any,
        
        A2: { raw: 'Sales', dataType: 'string' } as any,
        B2: { raw: 150000, dataType: 'number' } as any,
        C2: { formula: '=B2/$B$5', dataType: 'formula' } as any,
        
        A3: { raw: 'Marketing', dataType: 'string' } as any,
        B3: { raw: 60000, dataType: 'number' } as any,
        C3: { formula: '=B3/$B$5', dataType: 'formula' } as any,
        
        A4: { raw: 'Operations', dataType: 'string' } as any,
        B4: { raw: 90000, dataType: 'number' } as any,
        C4: { formula: '=B4/$B$5', dataType: 'formula' } as any,
        
        A5: { raw: 'Total', dataType: 'string' } as any,
        B5: { formula: '=SUM(B2:B4)', dataType: 'formula' } as any,
        C5: { formula: '=SUM(C2:C4)', dataType: 'formula' } as any,
      };
      
      const hydration = hydrateHFFromWorkbook(wb);
      recomputeAndPatchCache(wb, hydration);
      
      // Verify total
      expect(sheet.cells!['B5']?.computed?.v).toBe(300000);
      
      // Verify allocation percentages
      expect(sheet.cells!['C2']?.computed?.v).toBeCloseTo(0.5, 4); // 50%
      expect(sheet.cells!['C3']?.computed?.v).toBeCloseTo(0.2, 4); // 20%
      expect(sheet.cells!['C4']?.computed?.v).toBeCloseTo(0.3, 4); // 30%
      expect(sheet.cells!['C5']?.computed?.v).toBeCloseTo(1.0, 4); // 100%
      
      console.log('✓ Budget allocation: Sales 50%, Marketing 20%, Operations 30%');
      hydration.hf.destroy();
    });
  });

  describe('Step 7: Complete Budget Tracker Workflow', () => {
    it('should demonstrate end-to-end budget tracking scenario', () => {
      const startTime = performance.now();
      
      const wb = createWorkbook('Complete Budget Tracker');
      
      // Department 1: Sales
      wb.sheets[0].name = 'Sales';
      wb.sheets[0].id = 'sales';
      wb.sheets[0].cells = {
        A1: { raw: 'Month', dataType: 'string' } as any,
        B1: { raw: 'Budget', dataType: 'string' } as any,
        C1: { raw: 'Actual', dataType: 'string' } as any,
        
        A2: { raw: 'January', dataType: 'string' } as any,
        B2: { raw: 50000, dataType: 'number' } as any,
        C2: { raw: 52000, dataType: 'number' } as any,
        
        A3: { raw: 'February', dataType: 'string' } as any,
        B3: { raw: 50000, dataType: 'number' } as any,
        C3: { raw: 48000, dataType: 'number' } as any,
        
        A4: { raw: 'March', dataType: 'string' } as any,
        B4: { raw: 50000, dataType: 'number' } as any,
        C4: { raw: 55000, dataType: 'number' } as any,
        
        A5: { raw: 'Q1 Total', dataType: 'string' } as any,
        B5: { formula: '=SUM(B2:B4)', dataType: 'formula' } as any,
        C5: { formula: '=SUM(C2:C4)', dataType: 'formula' } as any,
      };
      
      // Department 2: Marketing
      wb.sheets.push({
        name: 'Marketing',
        id: 'marketing',
        cells: {
          A1: { raw: 'Month', dataType: 'string' } as any,
          B1: { raw: 'Budget', dataType: 'string' } as any,
          C1: { raw: 'Actual', dataType: 'string' } as any,
          
          A2: { raw: 'January', dataType: 'string' } as any,
          B2: { raw: 20000, dataType: 'number' } as any,
          C2: { raw: 19500, dataType: 'number' } as any,
          
          A3: { raw: 'February', dataType: 'string' } as any,
          B3: { raw: 20000, dataType: 'number' } as any,
          C3: { raw: 21000, dataType: 'number' } as any,
          
          A4: { raw: 'March', dataType: 'string' } as any,
          B4: { raw: 20000, dataType: 'number' } as any,
          C4: { raw: 20500, dataType: 'number' } as any,
          
          A5: { raw: 'Q1 Total', dataType: 'string' } as any,
          B5: { formula: '=SUM(B2:B4)', dataType: 'formula' } as any,
          C5: { formula: '=SUM(C2:C4)', dataType: 'formula' } as any,
        },
      });
      
      // Department 3: Operations
      wb.sheets.push({
        name: 'Operations',
        id: 'operations',
        cells: {
          A1: { raw: 'Month', dataType: 'string' } as any,
          B1: { raw: 'Budget', dataType: 'string' } as any,
          C1: { raw: 'Actual', dataType: 'string' } as any,
          
          A2: { raw: 'January', dataType: 'string' } as any,
          B2: { raw: 30000, dataType: 'number' } as any,
          C2: { raw: 29000, dataType: 'number' } as any,
          
          A3: { raw: 'February', dataType: 'string' } as any,
          B3: { raw: 30000, dataType: 'number' } as any,
          C3: { raw: 30500, dataType: 'number' } as any,
          
          A4: { raw: 'March', dataType: 'string' } as any,
          B4: { raw: 30000, dataType: 'number' } as any,
          C4: { raw: 31000, dataType: 'number' } as any,
          
          A5: { raw: 'Q1 Total', dataType: 'string' } as any,
          B5: { formula: '=SUM(B2:B4)', dataType: 'formula' } as any,
          C5: { formula: '=SUM(C2:C4)', dataType: 'formula' } as any,
        },
      });
      
      // Summary sheet with cross-sheet rollup
      wb.sheets.push({
        name: 'Summary',
        id: 'summary',
        cells: {
          A1: { raw: 'Q1 Budget Summary', dataType: 'string' } as any,
          
          A2: { raw: 'Department', dataType: 'string' } as any,
          B2: { raw: 'Budget', dataType: 'string' } as any,
          C2: { raw: 'Actual', dataType: 'string' } as any,
          D2: { raw: 'Variance', dataType: 'string' } as any,
          E2: { raw: 'Variance %', dataType: 'string' } as any,
          
          A3: { raw: 'Sales', dataType: 'string' } as any,
          B3: { formula: '=Sales!B5', dataType: 'formula' } as any,
          C3: { formula: '=Sales!C5', dataType: 'formula' } as any,
          D3: { formula: '=C3-B3', dataType: 'formula' } as any,
          E3: { formula: '=IF(B3=0,0,D3/B3)', dataType: 'formula' } as any,
          
          A4: { raw: 'Marketing', dataType: 'string' } as any,
          B4: { formula: '=Marketing!B5', dataType: 'formula' } as any,
          C4: { formula: '=Marketing!C5', dataType: 'formula' } as any,
          D4: { formula: '=C4-B4', dataType: 'formula' } as any,
          E4: { formula: '=IF(B4=0,0,D4/B4)', dataType: 'formula' } as any,
          
          A5: { raw: 'Operations', dataType: 'string' } as any,
          B5: { formula: '=Operations!B5', dataType: 'formula' } as any,
          C5: { formula: '=Operations!C5', dataType: 'formula' } as any,
          D5: { formula: '=C5-B5', dataType: 'formula' } as any,
          E5: { formula: '=IF(B5=0,0,D5/B5)', dataType: 'formula' } as any,
          
          A7: { raw: 'Company Total', dataType: 'string' } as any,
          B7: { formula: '=SUM(B3:B5)', dataType: 'formula' } as any,
          C7: { formula: '=SUM(C3:C5)', dataType: 'formula' } as any,
          D7: { formula: '=C7-B7', dataType: 'formula' } as any,
          E7: { formula: '=IF(B7=0,0,D7/B7)', dataType: 'formula' } as any,
        },
      });
      
      // Compute entire workbook
      const hydration = hydrateHFFromWorkbook(wb);
      const result = recomputeAndPatchCache(wb, hydration);
      const computeTime = performance.now() - startTime;
      
      const summary = wb.sheets[3]; // Summary sheet
      
      // Verify all department totals
      expect(wb.sheets[0].cells!['B5']?.computed?.v).toBe(150000); // Sales budget
      expect(wb.sheets[0].cells!['C5']?.computed?.v).toBe(155000); // Sales actual
      expect(wb.sheets[1].cells!['B5']?.computed?.v).toBe(60000); // Marketing budget
      expect(wb.sheets[1].cells!['C5']?.computed?.v).toBe(61000); // Marketing actual
      expect(wb.sheets[2].cells!['B5']?.computed?.v).toBe(90000); // Operations budget
      expect(wb.sheets[2].cells!['C5']?.computed?.v).toBe(90500); // Operations actual
      
      // Verify summary rollup
      expect(summary.cells!['B7']?.computed?.v).toBe(300000); // Company budget
      expect(summary.cells!['C7']?.computed?.v).toBe(306500); // Company actual
      expect(summary.cells!['D7']?.computed?.v).toBe(6500); // Total variance
      
      const variancePct = summary.cells!['E7']?.computed?.v as number;
      expect(variancePct).toBeCloseTo(0.0217, 3); // 2.17%
      
      // Performance check
      expect(computeTime).toBeLessThan(1000); // Should complete in < 1s
      
      console.log('\n✅ PROMPT 31 COMPLETE: Quarterly Budget Tracker');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📊 Company Q1 Results:');
      console.log(`   Budget:   $${summary.cells!['B7']?.computed?.v?.toLocaleString()}`);
      console.log(`   Actual:   $${summary.cells!['C7']?.computed?.v?.toLocaleString()}`);
      console.log(`   Variance: +$${summary.cells!['D7']?.computed?.v?.toLocaleString()} (+${(variancePct * 100).toFixed(2)}%)`);
      console.log('\n📈 Department Performance:');
      console.log(`   Sales:      Budget $150k, Actual $155k (+$5k)`);
      console.log(`   Marketing:  Budget $60k, Actual $61k (+$1k)`);
      console.log(`   Operations: Budget $90k, Actual $90.5k (+$0.5k)`);
      console.log(`\n⚡ Computation: ${result.updatedCells} cells in ${computeTime.toFixed(2)}ms`);
      console.log(`📋 Workbook: 4 sheets, ${result.updatedCells} formulas`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      hydration.hf.destroy();
    });
  });
});
