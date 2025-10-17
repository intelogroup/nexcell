# Plan Preview UI

This document describes the `PlanPreview` component used to preview AI-generated workbook operations before applying them.

Location
- Component: `client/src/components/ai/PlanPreview.tsx`
- Types: `client/src/lib/ai/planTypes.ts`

Usage
- In the chat UI, users can preview AI plans before applying. In development, the chat supports a `/plan <intent>` shortcut to open the preview with a mock plan.

Behavior
- Shows a grouped list of operations (by sheet)
- Displays Before / After values side-by-side
- Surfaces warnings and high-level reasoning from the AI
- Provides Approve / Reject actions

Integration notes
- Replace the mock plan generator in `ChatInterface.tsx` with your real `generateAIPlan` function and validate the plan with `validatePlanContext` before applying.
- When integrating with the backend or storage, record an audit trail for plan approvals and rejections.

Testing
- Unit test added: `client/src/components/ai/__tests__/PlanPreview.test.tsx` (Vitest + React Testing Library)
