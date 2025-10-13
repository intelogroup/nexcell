# Testing POST /workbooks/:id/ops Endpoint

## Overview
This document provides manual testing instructions for the new operations endpoint.

## Prerequisites
1. Backend server running (`pnpm dev`)
2. Valid authentication token (JWT from Clerk)
3. A workbook ID that you own

## Endpoint Details

**URL:** `POST /api/workbooks/:id/ops`

**Headers:**
```
Authorization: Bearer <your-jwt-token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "operations": [
    {
      "kind": "set_cell",
      "sheet": "Sheet1",
      "cell": "C1",
      "value": "Email"
    },
    {
      "kind": "set_cell",
      "sheet": "Sheet1",
      "cell": "C2",
      "formula": "=CONCATENATE(A2, \"@example.com\")"
    }
  ],
  "description": "Added email column with formula"
}
```

## Example Test Cases

### Test Case 1: Set Cell Values
```json
{
  "operations": [
    {
      "kind": "set_cell",
      "sheet": "Sheet1",
      "cell": "A1",
      "value": "Hello"
    },
    {
      "kind": "set_cell",
      "sheet": "Sheet1",
      "cell": "B1",
      "value": "World"
    }
  ],
  "description": "Set two cell values"
}
```

### Test Case 2: Fill Range
```json
{
  "operations": [
    {
      "kind": "fill_range",
      "sheet": "Sheet1",
      "range": "A1:A10",
      "value": 0
    }
  ],
  "description": "Initialize column A with zeros"
}
```

### Test Case 3: Insert and Format
```json
{
  "operations": [
    {
      "kind": "insert_rows",
      "sheet": "Sheet1",
      "startRow": 1,
      "count": 1
    },
    {
      "kind": "format_range",
      "sheet": "Sheet1",
      "range": "A1:Z1",
      "format": {
        "bold": true,
        "backgroundColor": "#f0f0f0",
        "fontSize": 14
      }
    }
  ],
  "description": "Insert header row with formatting"
}
```

### Test Case 4: Multiple Sheet Operations
```json
{
  "operations": [
    {
      "kind": "add_sheet",
      "name": "Data"
    },
    {
      "kind": "set_cell",
      "sheet": "Data",
      "cell": "A1",
      "value": "New Sheet Data"
    }
  ],
  "description": "Create new sheet and add data"
}
```

### Test Case 5: Complex Formula Example
```json
{
  "operations": [
    {
      "kind": "fill_range",
      "sheet": "Sheet1",
      "range": "A1:A5",
      "value": 100
    },
    {
      "kind": "set_cell",
      "sheet": "Sheet1",
      "cell": "A6",
      "formula": "=SUM(A1:A5)"
    },
    {
      "kind": "format_range",
      "sheet": "Sheet1",
      "range": "A6:A6",
      "format": {
        "bold": true,
        "numberFormat": "$#,##0.00"
      }
    }
  ],
  "description": "Create sum formula with formatting"
}
```

## Expected Response

### Success Response (200)
```json
{
  "success": true,
  "appliedOps": 2,
  "errors": [],
  "diff": [
    {
      "opIndex": 0,
      "kind": "set_cell",
      "sheet": "Sheet1",
      "changes": "Set C1 to \"Email\""
    },
    {
      "opIndex": 1,
      "kind": "set_cell",
      "sheet": "Sheet1",
      "changes": "Set C2 to =CONCATENATE(A2, \"@example.com\")"
    }
  ],
  "workbook": {
    "id": "clxxx...",
    "version": 2,
    "updatedAt": "2025-10-12T20:45:00.000Z"
  },
  "actionId": "clyyy..."
}
```

### Error Response (400)
```json
{
  "error": "Operation Error",
  "message": "Some operations failed to apply",
  "errors": [
    {
      "opIndex": 1,
      "operation": { /* operation details */ },
      "error": "Sheet not found: NonExistent"
    }
  ],
  "appliedOps": 1,
  "partialResult": {
    "diff": [ /* successful operations */ ]
  }
}
```

## Testing with cURL

```bash
# Replace with your actual values
WORKBOOK_ID="your-workbook-id"
JWT_TOKEN="your-jwt-token"

curl -X POST "http://localhost:3000/api/workbooks/$WORKBOOK_ID/ops" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "operations": [
      {
        "kind": "set_cell",
        "sheet": "Sheet1",
        "cell": "A1",
        "value": "Test"
      }
    ],
    "description": "Test operation"
  }'
```

## Verification Steps

1. **Check workbook version incremented:**
   - GET `/api/workbooks/:id`
   - Verify `version` field increased by 1

2. **Check action record created:**
   - Query actions table: `SELECT * FROM actions WHERE workbookId = :id ORDER BY createdAt DESC LIMIT 1`
   - Verify `type = 'operations'`, `applied = true`

3. **Check workbook data updated:**
   - GET `/api/workbooks/:id`
   - Verify `data` field contains the changes

4. **Check old/new snapshots stored:**
   - Query action record
   - Verify `oldSnapshot` contains previous state
   - Verify `newSnapshot` contains new state

## Error Scenarios to Test

1. **Invalid sheet name:**
   ```json
   {
     "operations": [
       {
         "kind": "set_cell",
         "sheet": "NonExistentSheet",
         "cell": "A1",
         "value": "Test"
       }
     ]
   }
   ```
   Expected: 400 error with "Sheet not found"

2. **Invalid cell reference:**
   ```json
   {
     "operations": [
       {
         "kind": "set_cell",
         "sheet": "Sheet1",
         "cell": "InvalidCell",
         "value": "Test"
       }
     ]
   }
   ```
   Expected: 400 error with validation error

3. **Formula without equals:**
   ```json
   {
     "operations": [
       {
         "kind": "set_cell",
         "sheet": "Sheet1",
         "cell": "A1",
         "formula": "SUM(A1:A10)"
       }
     ]
   }
   ```
   Expected: 400 error with "must start with '='"

4. **Unauthorized access:**
   - Try to access workbook owned by another user
   Expected: 404 error

## Notes

- All operations are applied sequentially
- If one operation fails, subsequent operations still attempt to execute
- The endpoint continues on error and collects all errors
- Version is incremented even if some operations fail (partial success)
- Action records are created for successful operations
- Old and new snapshots enable undo/redo functionality
