/**
 * Vitest test setup
 * 
 * This file runs before all tests and sets up the test environment.
 */

// Add custom matchers or global test setup here
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// You can add custom matchers or global setup here
