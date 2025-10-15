# Sheet Management Implementation

## Overview
Added comprehensive sheet management functionality to Nexcell, allowing users to add, switch, rename, and delete sheets within a workbook. The implementation ensures full Excel compatibility while maintaining a clean, modern UI.

## Features Implemented

### 1. Sheet Tabs Component (`SheetTabs.tsx`)
- **Location**: `client/src/components/layout/SheetTabs.tsx`
- **Features**:
  - Visual tab representation for all sheets in the workbook
  - Active sheet highlighting
  - Inline sheet renaming with edit mode
  - Delete sheet functionality (prevents deletion of the last sheet)
  - Add new sheet button
  - Sheet count display
  - Compact design suitable for header/footer areas

### 2. Workbook API Enhancements

#### New Functions
- **`deleteSheet()`** - Added to `utils.ts` and exported via `api.ts`
  - Deletes a sheet by ID
  - Prevents deletion of the last sheet
  - Auto-updates `activeTab` if needed
  - Updates workbook modification timestamp

#### Enhanced `useWorkbook` Hook
- **`addNewSheet(name?: string): SheetJSON`** - Creates a new sheet
- **`switchSheet(sheetId: string): void`** - Switches to a different sheet
- **`renameSheet(sheetId: string, name: string): void`** - Renames a sheet
- **`deleteSheetById(sheetId: string): void`** - Deletes a sheet

### 3. Excel Compatibility

#### ActiveTab Property Management
The implementation ensures that the `workbookProperties.workbookView.activeTab` property is properly maintained:

1. **On Sheet Switch**: Updates `activeTab` to match the currently selected sheet index
2. **On Sheet Delete**: Adjusts `activeTab` if the deleted sheet was after the current active tab
3. **On Export**: Both SheetJS and ExcelJS adapters write the `activeTab` property to the Excel file
4. **On Import**: Both adapters read and restore the `activeTab` property

#### Adapter Updates

**SheetJS Adapter** (`sheetjs.ts`):
```typescript
// Export: Set activeTab in workbook
wb.Workbook.Views[0].activeTab = workbook.workbookProperties.workbookView.activeTab || 0;

// Import: Read activeTab from workbook
workbook.workbookProperties.workbookView.activeTab = view.activeTab || 0;
```

**ExcelJS Adapter** (`exceljs.ts`):
```typescript
// Export: Set activeTab in workbook views
wb.views = [{
  activeTab: workbook.workbookProperties.workbookView.activeTab || 0,
  firstSheet: workbook.workbookProperties.workbookView.firstSheet || 0,
  // ... other required properties
}];

// Import: Already reads activeTab from wb.views[0].activeTab
```

### 4. UI Integration

The `SheetTabs` component is integrated at the bottom of the canvas area in `MainLayout.tsx`:

```tsx
<div className="flex-1 flex flex-col overflow-hidden">
  <CanvasRenderer 
    data={cells}
    onCellEdit={handleCellEdit}
  />
  
  {/* Sheet Tabs */}
  <SheetTabs
    sheets={workbook.sheets}
    currentSheetId={currentSheetId}
    onSheetChange={switchSheet}
    onAddSheet={addNewSheet}
    onRenameSheet={renameSheet}
    onDeleteSheet={deleteSheetById}
  />
</div>
```

## Usage

### Adding a New Sheet
1. Click the "New Sheet" button (+ icon) in the sheet tabs bar
2. A new sheet is created with an auto-generated name (Sheet2, Sheet3, etc.)
3. The new sheet becomes active automatically

### Switching Sheets
1. Click on any sheet tab to switch to that sheet
2. The active sheet is visually highlighted
3. The `activeTab` property is updated for Excel compatibility

### Renaming a Sheet
1. Click the edit icon (pencil) on the active sheet tab
2. The sheet name becomes editable
3. Type the new name and press Enter or click the checkmark
4. Press Escape or click the X to cancel

### Deleting a Sheet
1. Click the delete icon (X) on the active sheet tab
2. Confirm the deletion in the dialog
3. Note: Cannot delete the last remaining sheet

## Excel Compatibility Testing

The implementation passes all workbook property tests:

```
✓ WorkbookProperties Initialization
✓ WorkbookProperties Clone
✓ WorkbookProperties Modification
✓ WorkbookProperties with Multiple Sheets
✓ WorkbookProperties Serialization
```

### Round-trip Testing
When exporting to Excel and re-importing:
1. Sheet order is preserved
2. Active sheet is restored correctly
3. All sheet names are maintained
4. Sheet visibility settings are preserved

## Technical Details

### State Management
- Sheet state is managed through the `useWorkbook` hook
- All operations update the workbook's `modifiedAt` timestamp
- Changes trigger formula recomputation if needed
- Undo/redo support for sheet operations (future enhancement)

### Performance
- Lazy loading of sheet data
- Only the active sheet's cells are rendered
- Virtual scrolling for large sheets
- Minimal re-renders on sheet switch

### Error Handling
- Prevents deletion of the last sheet
- Validates sheet names (no duplicates)
- Graceful handling of missing sheets
- Fallback to first sheet if current sheet is invalid

## Future Enhancements

1. **Drag-and-Drop Reordering**: Allow users to reorder sheets by dragging tabs
2. **Sheet Tab Colors**: Support for custom tab colors (already in schema)
3. **Sheet Visibility Toggle**: Hide/show sheets without deleting
4. **Sheet Protection**: Lock sheets to prevent editing
5. **Copy/Duplicate Sheet**: Create a copy of an existing sheet
6. **Sheet Templates**: Predefined sheet templates for common use cases
7. **Keyboard Shortcuts**: Ctrl+PageUp/PageDown to switch sheets
8. **Context Menu**: Right-click menu for additional sheet operations

## Testing

### Manual Testing Checklist
- [x] Create new sheet
- [x] Switch between sheets
- [x] Rename sheet
- [x] Delete sheet (with protection against deleting last sheet)
- [x] Export to Excel with multiple sheets
- [x] Import Excel file with multiple sheets
- [x] Verify activeTab is preserved in export/import
- [x] Test with existing workbook tests

### Automated Tests
The implementation integrates with existing tests:
- `workbook-properties.test.ts` - Tests activeTab management
- `roundtrip.test.ts` - Tests Excel export/import with multiple sheets
- `hyperformula.test.ts` - Tests formula computation across sheets

## Conclusion

The sheet management implementation provides a complete solution for managing multiple sheets in a workbook, with full Excel compatibility. The UI is clean and intuitive, positioned at the bottom of the canvas area for easy access without cluttering the main interface.

All changes are backward compatible with existing workbooks, and the implementation follows the established patterns in the codebase for state management and data persistence.
