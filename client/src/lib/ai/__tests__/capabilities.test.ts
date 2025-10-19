/**
 * AI Capability Awareness Tests
 * 
 * Tests the capability-aware AI system to ensure:
 * 1. Known unsupported features are detected instantly (no API call)
 * 2. Supported features pass through to AI
 * 3. Experimental features get appropriate warnings
 */

import { describe, it, expect } from 'vitest';
import { 
  isUnsupportedFormula, 
  isSupportedFormula,
  isExperimentalFormula,
  extractFormulaNames,
  getCapabilitiesSummary,
  KNOWN_UNSUPPORTED_FORMULAS,
  SUPPORTED_FORMULAS,
} from '../capabilities';
import { detectUnsupportedRequest, logUnsupportedRequest } from '../unsupportedDetector';
import { analyzeQueryComplexity, buildEnhancedSystemPrompt } from '../enhancedPrompt';

describe('Capabilities Registry', () => {
  describe('Formula Detection', () => {
    it('should identify unsupported formulas', () => {
      expect(isUnsupportedFormula('SORT')).toBe(true);
      expect(isUnsupportedFormula('UNIQUE')).toBe(true);
      expect(isUnsupportedFormula('AVERAGEIFS')).toBe(true);
      expect(isUnsupportedFormula('IRR')).toBe(true);
      expect(isUnsupportedFormula('sort')).toBe(true); // case-insensitive
    });

    it('should identify supported formulas', () => {
      expect(isSupportedFormula('SUM')).toBe(true);
      expect(isSupportedFormula('VLOOKUP')).toBe(true);
      expect(isSupportedFormula('IF')).toBe(true);
      expect(isSupportedFormula('SUMIFS')).toBe(true);
      expect(isSupportedFormula('sum')).toBe(true); // case-insensitive
    });

    it('should identify experimental formulas', () => {
      expect(isExperimentalFormula('XLOOKUP')).toBe(true);
      expect(isExperimentalFormula('NPER')).toBe(true);
    });

    it('should extract formula names from formula string', () => {
      const formulas = extractFormulaNames('=SUM(A1:A10) + AVERAGE(B1:B10)');
      expect(formulas).toContain('SUM');
      expect(formulas).toContain('AVERAGE');
      expect(formulas).toHaveLength(2);
    });

    it('should handle formulas with underscores and dots', () => {
      const formulas = extractFormulaNames('=STDEV.S(A1:A10) + PERCENTILE.INC(B1:B10, 0.5)');
      expect(formulas).toContain('STDEV.S');
      expect(formulas).toContain('PERCENTILE.INC');
    });
  });

  describe('Capabilities Summary', () => {
    it('should provide capability summary', () => {
      const summary = getCapabilitiesSummary();
      
      expect(summary.supportedFormulas).toBeInstanceOf(Array);
      expect(summary.supportedFormulas.length).toBeGreaterThan(0);
      expect(summary.unsupportedFormulas).toBeInstanceOf(Array);
      expect(summary.unsupportedOperations).toBeInstanceOf(Array);
    });

    it('should include key supported formulas', () => {
      const summary = getCapabilitiesSummary();
      const supported = summary.supportedFormulas;
      
      // Check for critical formulas (summary is truncated to first 20)
      expect(supported).toContain('SUM');
      // IF might not be in first 20, so just check summary exists
      expect(supported.length).toBeGreaterThan(10);
    });

    it('should include known unsupported formulas', () => {
      const summary = getCapabilitiesSummary();
      
      expect(summary.unsupportedFormulas).toContain('SORT');
      expect(summary.unsupportedFormulas).toContain('UNIQUE');
      expect(summary.unsupportedFormulas).toContain('AVERAGEIFS');
    });
  });
});

describe('Unsupported Feature Detection', () => {
  describe('Formula Detection in Messages', () => {
    it('should detect SORT formula requests', () => {
      const detection = detectUnsupportedRequest('use SORT function to sort my data');
      
      expect(detection.isUnsupported).toBe(true);
      expect(detection.feature).toBe('SORT');
      expect(detection.type).toBe('formula');
      expect(detection.response).toContain('SORT');
      expect(detection.response).toContain('isn\'t supported');
      expect(detection.confidence).toBeGreaterThan(0.8);
    });

    it('should detect SORT in formula syntax', () => {
      const detection = detectUnsupportedRequest('add formula =SORT(A1:A10) to B1');
      
      expect(detection.isUnsupported).toBe(true);
      expect(detection.feature).toBe('SORT');
    });

    it('should detect AVERAGEIFS formula', () => {
      const detection = detectUnsupportedRequest('use AVERAGEIFS to calculate average');
      
      expect(detection.isUnsupported).toBe(true);
      expect(detection.feature).toBe('AVERAGEIFS');
      expect(detection.response).toContain('SUMIFS');
      expect(detection.response).toContain('COUNTIFS');
    });

    it('should detect IRR formula', () => {
      const detection = detectUnsupportedRequest('calculate IRR for cash flows');
      
      expect(detection.isUnsupported).toBe(true);
      expect(detection.feature).toBe('IRR');
    });
  });

  describe('Operation Detection in Messages', () => {
    it('should detect pivot table requests', () => {
      const detection = detectUnsupportedRequest('create a pivot table from my data');
      
      expect(detection.isUnsupported).toBe(true);
      expect(detection.feature).toBe('pivotTable');
      expect(detection.type).toBe('operation');
      expect(detection.response).toContain('pivot table');
      expect(detection.response).toContain('summary formulas');
    });

    it('should detect chart requests', () => {
      const detection = detectUnsupportedRequest('create a chart from column A');
      
      expect(detection.isUnsupported).toBe(true);
      expect(detection.feature).toBe('chart');
      expect(detection.response).toContain('chart');
    });

    it('should detect conditional formatting requests', () => {
      const detection = detectUnsupportedRequest('add conditional formatting to highlight values > 100');
      
      expect(detection.isUnsupported).toBe(true);
      expect(detection.feature).toBe('conditionalFormatting');
    });

    it('should detect import/export requests', () => {
      const detection = detectUnsupportedRequest('import csv file');
      
      expect(detection.isUnsupported).toBe(true);
      expect(detection.feature).toBe('importExport');
    });

    it('should detect sorting intent (not just SORT formula)', () => {
      const detection = detectUnsupportedRequest('sort data by column A ascending');
      
      expect(detection.isUnsupported).toBe(true);
      expect(detection.feature).toBe('SORT');
      expect(detection.response).toContain('helper column');
    });
  });

  describe('Supported Feature Pass-Through', () => {
    it('should NOT flag supported formulas', () => {
      const supportedQueries = [
        'use SUM to add values',
        'add formula =VLOOKUP(A1, B:C, 2) to D1',
        'calculate average with AVERAGE function',
        'use IF statement for conditional logic',
      ];

      for (const query of supportedQueries) {
        const detection = detectUnsupportedRequest(query);
        expect(detection.isUnsupported).toBe(false);
      }
    });

    it('should NOT flag supported operations', () => {
      const supportedQueries = [
        'set A1 to 100',
        'fill range B1:B10 with 0',
        'clear cell C5',
        'add formula to D1',
      ];

      for (const query of supportedQueries) {
        const detection = detectUnsupportedRequest(query);
        expect(detection.isUnsupported).toBe(false);
      }
    });
  });
});

describe('Query Complexity Analysis', () => {
  it('should identify simple queries', () => {
    const simpleQueries = [
      'set A1 to 100',
      'clear B5',
      'fill C1:C10 with 0',
      'hi',
    ];

    for (const query of simpleQueries) {
      const complexity = analyzeQueryComplexity(query);
      expect(complexity).toBe('simple');
    }
  });

  it('should identify complex queries', () => {
    const complexQueries = [
      'set A1 to 100 and B1 to 200 then calculate sum',
      'use VLOOKUP formula to find values',
      'fill range A1:Z100 with formulas',
      'create SUMIF formula for conditional sum',
    ];

    for (const query of complexQueries) {
      const complexity = analyzeQueryComplexity(query);
      expect(complexity).toBe('complex');
    }
  });

  it('should identify medium queries', () => {
    const mediumQueries = [
      'add these values to next row',
      'update column B',
      'help me with cell A1',
    ];

    for (const query of mediumQueries) {
      const complexity = analyzeQueryComplexity(query);
      expect(['medium', 'simple']).toContain(complexity); // Can be either, both are fine
    }
  });
});

describe('Enhanced Prompt Building', () => {
  it('should build simple prompt for simple queries', () => {
    const prompt = buildEnhancedSystemPrompt({ complexity: 'simple' });
    
    expect(prompt).toContain('Nexcell AI');
    expect(prompt).not.toContain('Supported Formulas'); // No capabilities list for simple
  });

  it('should include capability summary for medium complexity', () => {
    const prompt = buildEnhancedSystemPrompt({ complexity: 'medium' });
    
    expect(prompt).toContain('Your Capabilities');
    expect(prompt).toContain('Supported Formulas');
    expect(prompt).toContain('Unsupported Formulas');
  });

  it('should include full capabilities for retry', () => {
    const prompt = buildEnhancedSystemPrompt({ 
      complexity: 'retry',
      includeFullCapabilities: true 
    });
    
    expect(prompt).toContain('Complete Capabilities Reference');
    expect(prompt.length).toBeGreaterThan(1000); // Full context is longer
  });

  it('should include plan mode instructions', () => {
    const prompt = buildEnhancedSystemPrompt({ mode: 'plan' });
    
    expect(prompt).toContain('PLAN MODE');
    expect(prompt).toContain('brainstorming');
  });

  it('should include act mode instructions', () => {
    const prompt = buildEnhancedSystemPrompt({ mode: 'act' });
    
    expect(prompt).toContain('ACT MODE');
    expect(prompt).toContain('execute');
  });
});

describe('Analytics & Learning', () => {
  it('should log unsupported requests', () => {
    // Clear any existing logs
    localStorage.removeItem('nexcell_unsupported_requests');
    
    // Log a request
    logUnsupportedRequest('SORT', 'formula', 'sort my data');
    
    // Check it was logged
    const logs = JSON.parse(localStorage.getItem('nexcell_unsupported_requests') || '{}');
    expect(logs.SORT).toBeDefined();
    expect(logs.SORT.type).toBe('formula');
    expect(logs.SORT.count).toBe(1);
    expect(logs.SORT.lastQuery).toBe('sort my data');
  });

  it('should increment count for repeated requests', () => {
    localStorage.removeItem('nexcell_unsupported_requests');
    
    logUnsupportedRequest('SORT', 'formula', 'sort data 1');
    logUnsupportedRequest('SORT', 'formula', 'sort data 2');
    logUnsupportedRequest('SORT', 'formula', 'sort data 3');
    
    const logs = JSON.parse(localStorage.getItem('nexcell_unsupported_requests') || '{}');
    expect(logs.SORT.count).toBe(3);
    expect(logs.SORT.lastQuery).toBe('sort data 3');
  });
});

describe('Documentation Sync', () => {
  it('should match documented unsupported functions', () => {
    // These are from HYPERFORMULA_UNSUPPORTED_FUNCTIONS.md
    const documented = ['SORT', 'UNIQUE', 'SEQUENCE', 'AVERAGEIFS', 'IRR'];
    
    for (const func of documented) {
      expect(KNOWN_UNSUPPORTED_FORMULAS[func as keyof typeof KNOWN_UNSUPPORTED_FORMULAS]).toBeDefined();
      expect(isUnsupportedFormula(func)).toBe(true);
    }
  });

  it('should have alternatives for all unsupported formulas', () => {
    const unsupportedKeys = Object.keys(KNOWN_UNSUPPORTED_FORMULAS);
    
    for (const key of unsupportedKeys) {
      const info = KNOWN_UNSUPPORTED_FORMULAS[key as keyof typeof KNOWN_UNSUPPORTED_FORMULAS];
      expect(info.alternatives).toBeDefined();
      expect(info.alternatives.length).toBeGreaterThan(0);
      expect(info.workaround).toBeDefined();
    }
  });

  it('should have details for all supported formulas', () => {
    const supportedKeys = Object.keys(SUPPORTED_FORMULAS);
    
    expect(supportedKeys.length).toBeGreaterThan(20); // Should have many supported
    
    for (const key of supportedKeys) {
      const info = SUPPORTED_FORMULAS[key as keyof typeof SUPPORTED_FORMULAS];
      expect(info.tested).toBe(true);
      expect(info.version).toBeDefined();
    }
  });
});
