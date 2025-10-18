/**
 * Workbook JSON Validator
 * Uses JSON Schema validation with Ajv
 */


import schema from "./schema.json";

export interface ValidationResult {
  valid: boolean;
  errors?: ValidationError[];
}

export interface ValidationError {
  path: string;
  message: string;
  severity: "error" | "warning";
}

let ajv: any = null;

async function getAjv() {
  if (!ajv) {
    const Ajv = (await import("ajv")).default;
    const addFormats = (await import("ajv-formats")).default;
  // Allow union type keyword in schema (some schema definitions use union types).
  ajv = new Ajv({ allErrors: true, verbose: true, allowUnionTypes: true });
    addFormats(ajv); // Register date-time and other standard formats
  }
  return ajv;
}

export async function validateWorkbook(workbook: unknown): Promise<ValidationResult> {
  const ajvInstance = await getAjv();

  // Compile schema if not already compiled
  const validate = ajvInstance.compile(schema);

  const valid = validate(workbook);

  if (valid) {
    return { valid: true };
  }

  // Convert Ajv errors to our format
  const errors: ValidationError[] = (validate.errors || []).map((error: any) => ({
    path: error.instancePath || error.dataPath || "/",
    message: error.message || "Validation error",
    severity: "error" as const,
  }));

  return { valid: false, errors };
}

export async function validateWorkbookFile(filePath: string): Promise<ValidationResult> {
  // Browser environment - can't read files directly
  if (typeof window !== 'undefined') {
    return {
      valid: false,
      errors: [{
        path: "/",
        message: "File validation not supported in browser environment. Use validateWorkbookObject() instead.",
        severity: "error",
      }],
    };
  }

  try {
    // Read file (in Node.js environment)
    const fs = await import("fs");
    const content = fs.readFileSync(filePath, "utf8");
    const workbook = JSON.parse(content);
    return validateWorkbook(workbook);
  } catch (error) {
    return {
      valid: false,
      errors: [{
        path: "/",
        message: `Failed to read/parse file: ${error}`,
        severity: "error",
      }],
    };
  }
}

export async function validateWorkbookString(jsonString: string): Promise<ValidationResult> {
  try {
    const workbook = JSON.parse(jsonString);
    return validateWorkbook(workbook);
  } catch (error) {
    return {
      valid: false,
      errors: [{
        path: "/",
        message: `Failed to parse JSON: ${error}`,
        severity: "error",
      }],
    };
  }
}

// CLI interface for Node.js
export async function runValidatorCLI() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log("Usage: validator <file.json> [file2.json ...]");
    console.log("Validates workbook JSON files against schema");
    process.exit(1);
  }

  let hasErrors = false;

  for (const filePath of args) {
    console.log(`\nValidating ${filePath}...`);

    const result = await validateWorkbookFile(filePath);

    if (result.valid) {
      console.log("✅ Valid");
    } else {
      hasErrors = true;
      console.log("❌ Invalid");
      result.errors?.forEach(error => {
        console.log(`  ${error.path}: ${error.message}`);
      });
    }
  }

  if (hasErrors) {
    process.exit(1);
  } else {
    console.log("\n🎉 All files valid!");
  }
}

// For browser usage - validate from object
export async function validateWorkbookObject(workbook: unknown): Promise<ValidationResult> {
  return validateWorkbook(workbook);
}