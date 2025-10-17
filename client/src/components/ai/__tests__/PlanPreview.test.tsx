import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import PlanPreview from '../PlanPreview';

const mockPlan = {
  planId: 'test-plan',
  operations: [
    { type: 'SET_CELL', sheetId: 'Sheet1', address: 'A1', before: 'old', after: 'new' },
  ],
  reasoning: 'Test reasoning',
  warnings: ['Test warning'],
};

describe('PlanPreview', () => {
  it('renders changes, warnings, reasoning and calls callbacks', () => {
    const onApprove = vi.fn();
    const onReject = vi.fn();
    const onClose = vi.fn();

    render(
      <PlanPreview plan={mockPlan as any} onApprove={onApprove} onReject={onReject} onClose={onClose} />
    );

    // Warnings
    expect(screen.getByText(/Warnings/i)).toBeTruthy();
    expect(screen.getByText(/Test warning/)).toBeTruthy();

    // Reasoning
    expect(screen.getByText(/Reasoning/)).toBeTruthy();
    expect(screen.getByText(/Test reasoning/)).toBeTruthy();

    // Change entries
    expect(screen.getByText(/A1/)).toBeTruthy();
    expect(screen.getByText(/old/)).toBeTruthy();
    expect(screen.getByText(/new/)).toBeTruthy();

    // Buttons
    const approve = screen.getByText(/Approve & Apply/);
    fireEvent.click(approve);
    expect(onApprove).toHaveBeenCalled();

    const reject = screen.getByText(/Reject/);
    fireEvent.click(reject);
    expect(onReject).toHaveBeenCalled();

    const close = screen.getByText(/Close/);
    fireEvent.click(close);
    expect(onClose).toHaveBeenCalled();
  });
});
