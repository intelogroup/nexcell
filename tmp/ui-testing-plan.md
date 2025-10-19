# Live UI Automated Testing Plan

This document outlines how to programmatically drive the NexCel application UI to test AI workflows end-to-end.

## Approach 1: Playwright E2E Testing (Recommended)

### Setup
```powershell
# Install Playwright
cd client
npm install -D @playwright/test
npx playwright install
```

### Test Script Structure
```typescript
// client/e2e/ai-workflows.spec.ts
import { test, expect } from '@playwright/test';

test.describe('AI Workbook Operations', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173');
    // Wait for app to load
    await page.waitForSelector('[data-testid="workbook-grid"]');
  });

  test('should fill A3:D12 with training data', async ({ page }) => {
    // Open AI chat
    await page.click('[data-testid="ai-chat-button"]');
    
    // Type prompt
    await page.fill('[data-testid="ai-input"]', 
      'Add sample training data to cells A3:D12 with columns: Name, Age, Department, Salary');
    
    // Send message
    await page.press('[data-testid="ai-input"]', 'Enter');
    
    // Wait for AI response
    await page.waitForSelector('[data-testid="ai-message"]:last-child', { timeout: 30000 });
    
    // Wait for operations to apply
    await page.waitForTimeout(1000);
    
    // Verify cell A3 contains data
    const cellA3 = await page.textContent('[data-cell-address="A3"]');
    expect(cellA3).toBeTruthy();
    
    // Verify cell D12 contains data
    const cellD12 = await page.textContent('[data-cell-address="D12"]');
    expect(cellD12).toBeTruthy();
    
    // Take screenshot
    await page.screenshot({ path: 'test-results/training-data.png' });
  });

  test('should create budget table with formulas', async ({ page }) => {
    await page.click('[data-testid="ai-chat-button"]');
    await page.fill('[data-testid="ai-input"]', 
      'Create a monthly budget table starting at A1 with categories: Rent, Groceries, Utilities');
    await page.press('[data-testid="ai-input"]', 'Enter');
    
    await page.waitForSelector('[data-testid="ai-message"]:last-child', { timeout: 30000 });
    await page.waitForTimeout(1000);
    
    // Verify headers
    const cellA1 = await page.textContent('[data-cell-address="A1"]');
    expect(cellA1).toContain('Category');
    
    // Verify formula in D2
    await page.click('[data-cell-address="D2"]');
    const formulaBar = await page.textContent('[data-testid="formula-bar"]');
    expect(formulaBar).toContain('=');
    
    await page.screenshot({ path: 'test-results/budget-table.png' });
  });

  test('should handle plan mode workflow', async ({ page }) => {
    // Switch to Plan mode
    await page.click('[data-testid="mode-selector"]');
    await page.click('[data-testid="plan-mode-option"]');
    
    // Create plan
    await page.fill('[data-testid="ai-input"]', 
      'Create a sales dashboard with headers, sample products, and totals');
    await page.press('[data-testid="ai-input"]', 'Enter');
    
    await page.waitForSelector('[data-testid="ai-message"]:last-child', { timeout: 30000 });
    
    // Verify no operations applied yet (still in plan mode)
    const cellA1 = await page.textContent('[data-cell-address="A1"]');
    expect(cellA1).toBeFalsy();
    
    // Switch to Act mode
    await page.click('[data-testid="mode-selector"]');
    await page.click('[data-testid="act-mode-option"]');
    
    // Should prompt to execute plan
    await expect(page.locator('[data-testid="execute-plan-prompt"]')).toBeVisible();
    
    // Confirm execution
    await page.click('[data-testid="confirm-execute"]');
    
    await page.waitForTimeout(1000);
    
    // Verify operations applied
    const cellA1After = await page.textContent('[data-cell-address="A1"]');
    expect(cellA1After).toBeTruthy();
    
    await page.screenshot({ path: 'test-results/plan-to-act.png' });
  });
});
```

## Approach 2: Puppeteer Direct API Testing

```javascript
// tmp/puppeteer-ui-test.js
import puppeteer from 'puppeteer';

async function testAIWorkflow() {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  
  // Enable console logging
  page.on('console', msg => {
    console.log('Browser Console:', msg.text());
  });
  
  // Navigate to app
  await page.goto('http://localhost:5173');
  await page.waitForSelector('[data-testid="workbook-grid"]');
  
  // Test training data scenario
  console.log('Testing: Training Data Fill');
  await page.click('[data-testid="ai-chat-button"]');
  await page.type('[data-testid="ai-input"]', 
    'Add sample training data to cells A3:D12 with columns: Name, Age, Department, Salary');
  await page.keyboard.press('Enter');
  
  // Wait for response
  await page.waitForSelector('[data-testid="ai-message"]:last-child', { timeout: 30000 });
  await page.waitForTimeout(2000);
  
  // Capture console logs
  const logs = await page.evaluate(() => {
    return window.__testLogs || [];
  });
  
  console.log('AI Logs:', logs);
  
  // Take screenshot
  await page.screenshot({ path: 'test-results/training-data-ui.png', fullPage: true });
  
  await browser.close();
}

testAIWorkflow().catch(console.error);
```

## Approach 3: Inject Test Helper into App

Add this to `client/src/main.tsx`:

```typescript
// Expose test helpers in development
if (import.meta.env.DEV) {
  (window as any).__testHelpers = {
    sendAIPrompt: async (prompt: string) => {
      // Trigger AI chat with prompt
      const event = new CustomEvent('test:ai-prompt', { detail: { prompt } });
      window.dispatchEvent(event);
    },
    getCellValue: (address: string) => {
      // Get cell value from workbook
      const event = new CustomEvent('test:get-cell', { detail: { address } });
      window.dispatchEvent(event);
    },
    getActionLog: () => {
      // Return action log
      return (window as any).__actionLog || [];
    }
  };
}
```

Then test with:

```javascript
// tmp/test-via-helpers.js
const page = await browser.newPage();
await page.goto('http://localhost:5173');

// Use exposed helpers
await page.evaluate(async () => {
  await window.__testHelpers.sendAIPrompt('Add sample data to A1:B5');
  await new Promise(resolve => setTimeout(resolve, 3000));
  const cellA1 = window.__testHelpers.getCellValue('A1');
  const actionLog = window.__testHelpers.getActionLog();
  console.log('Cell A1:', cellA1);
  console.log('Action Log:', actionLog);
});
```

## Approach 4: MSW (Mock Service Worker) for API Testing

```typescript
// client/src/test/mocks/handlers.ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.post('/api/chat/completions', async ({ request }) => {
    const body = await request.json();
    const prompt = body.messages[body.messages.length - 1].content;
    
    // Return mock AI responses based on prompt
    if (prompt.includes('training data')) {
      return HttpResponse.json({
        choices: [{
          message: {
            content: `<actions>[{"type":"fillRange","target":{"start":"A3","end":"D12"},"values":...}]</actions>`
          }
        }]
      });
    }
    
    return HttpResponse.json({
      choices: [{
        message: { content: "I'll help with that." }
      }]
    });
  })
];
```

## Current Status

✅ **Programmatic action testing complete** - All converter logic validated  
🔄 **UI testing** - Requires:
1. Dev server running (`npm run dev`)
2. Test framework installed (Playwright or Puppeteer)
3. Test data attributes added to components
4. Mock API responses (or real OpenRouter API key)

## Recommendations

1. **Start with Playwright** - Most robust for UI testing
2. **Add data-testid attributes** - Make elements easily selectable
3. **Use MSW for API mocking** - Avoid real API calls in tests
4. **Capture screenshots** - Visual validation of results
5. **Monitor console logs** - Track action extraction and conversion

## Next Steps

```powershell
# 1. Install Playwright
cd client
npm install -D @playwright/test
npx playwright install

# 2. Create test file
mkdir e2e
# Copy test script above to client/e2e/ai-workflows.spec.ts

# 3. Add test data attributes to components
# Update ChatSidebar.tsx, WorkbookGrid.tsx, etc.

# 4. Run tests
npm run dev  # In one terminal
npx playwright test  # In another terminal
```

## Benefits of UI Testing

1. **End-to-end validation** - Tests entire pipeline including UI updates
2. **Visual verification** - Screenshots show actual results
3. **User perspective** - Tests what users actually see
4. **Regression prevention** - Catches UI breakage
5. **Documentation** - Screenshots serve as visual docs

## Limitations

1. **Fragile** - UI changes break tests
2. **Slow** - Slower than unit tests
3. **Complex setup** - Requires running dev server
4. **API dependency** - Needs API mocking or real credentials

For now, the programmatic testing validates all converter logic. UI testing would add confidence in the complete user flow but is optional.
