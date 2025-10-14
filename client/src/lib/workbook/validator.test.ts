/**
 * Workbook Validator Tests
 * Tests JSON Schema validation functionality
 */

import { validateWorkbookObject } from "./validator";
import sampleWorkbook from "./samples/simple.json";

describe("Workbook Validator", () => {
  test("should validate correct workbook", async () => {
    const result = await validateWorkbookObject(sampleWorkbook);

    expect(result.valid).toBe(true);
    expect(result.errors).toBeUndefined();
  });

  test("should reject invalid workbook", async () => {
    const invalidWorkbook = {
      ...sampleWorkbook,
      schemaVersion: 1.0, // Should be string, not number
    };

    const result = await validateWorkbookObject(invalidWorkbook);

    expect(result.valid).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors!.length).toBeGreaterThan(0);
  });

  test("should reject workbook without required fields", async () => {
    const invalidWorkbook = {
      schemaVersion: "1.0",
      // Missing workbookId, meta, sheets
    };

    const result = await validateWorkbookObject(invalidWorkbook);

    expect(result.valid).toBe(false);
    expect(result.errors).toBeDefined();
  });
});