/**
 * Sheet Tabs Component
 * 
 * Displays and manages multiple sheets in a workbook.
 * Compact design that works in the header area.
 */

import { useState } from 'react';
import { Plus, X, Edit2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SheetJSON } from '@/lib/workbook';

interface SheetTabsProps {
  sheets: SheetJSON[];
  currentSheetId: string;
  onSheetChange: (sheetId: string) => void;
  onAddSheet: () => void;
  onRenameSheet: (sheetId: string, name: string) => void;
  onDeleteSheet?: (sheetId: string) => void;
}

export function SheetTabs({
  sheets,
  currentSheetId,
  onSheetChange,
  onAddSheet,
  onRenameSheet,
  onDeleteSheet,
}: SheetTabsProps) {
  const [editingSheetId, setEditingSheetId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const handleStartEdit = (sheet: SheetJSON, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSheetId(sheet.id);
    setEditingName(sheet.name);
  };

  const handleCommitEdit = () => {
    if (editingSheetId && editingName.trim()) {
      onRenameSheet(editingSheetId, editingName.trim());
    }
    setEditingSheetId(null);
    setEditingName('');
  };

  const handleCancelEdit = () => {
    setEditingSheetId(null);
    setEditingName('');
  };

  const handleDeleteSheet = (sheetId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (sheets.length <= 1) {
      alert('Cannot delete the last sheet');
      return;
    }
    if (confirm('Are you sure you want to delete this sheet?')) {
      onDeleteSheet?.(sheetId);
    }
  };

  return (
    <div className="flex items-center gap-1 px-2 py-1 bg-gray-100 border-t border-gray-200 overflow-x-auto min-h-[40px]">
      {/* Sheet Tabs */}
      {sheets.map((sheet) => {
        const isActive = sheet.id === currentSheetId;
        const isEditing = editingSheetId === sheet.id;

        return (
          <div
            key={sheet.id}
            className={cn(
              'flex items-center gap-1 px-3 py-1.5 rounded-t cursor-pointer transition-colors min-w-[100px] max-w-[200px]',
              isActive
                ? 'bg-white border border-b-0 border-gray-300'
                : 'bg-gray-200 hover:bg-gray-250 border border-transparent'
            )}
            onClick={() => !isEditing && onSheetChange(sheet.id)}
          >
            {isEditing ? (
              <div className="flex items-center gap-1 flex-1" onClick={(e) => e.stopPropagation()}>
                <input
                  type="text"
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCommitEdit();
                    if (e.key === 'Escape') handleCancelEdit();
                  }}
                  className="flex-1 px-1 py-0.5 text-sm border border-blue-500 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  autoFocus
                  onFocus={(e) => e.target.select()}
                />
                <button
                  onClick={handleCommitEdit}
                  className="p-0.5 hover:bg-green-100 rounded"
                  title="Save"
                >
                  <Check className="h-3 w-3 text-green-600" />
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="p-0.5 hover:bg-red-100 rounded"
                  title="Cancel"
                >
                  <X className="h-3 w-3 text-red-600" />
                </button>
              </div>
            ) : (
              <>
                <span className="text-sm font-medium truncate flex-1">
                  {sheet.name}
                </span>
                {isActive && (
                  <div className="flex items-center gap-0.5">
                    <button
                      onClick={(e) => handleStartEdit(sheet, e)}
                      className="p-0.5 hover:bg-gray-200 rounded"
                      title="Rename sheet"
                    >
                      <Edit2 className="h-3 w-3 text-gray-600" />
                    </button>
                    {onDeleteSheet && sheets.length > 1 && (
                      <button
                        onClick={(e) => handleDeleteSheet(sheet.id, e)}
                        className="p-0.5 hover:bg-red-100 rounded"
                        title="Delete sheet"
                      >
                        <X className="h-3 w-3 text-red-600" />
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}

      {/* Add Sheet Button */}
      <button
        onClick={() => onAddSheet()}
        className="flex items-center gap-1 px-2 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded transition-colors"
        title="Add new sheet"
      >
        <Plus className="h-4 w-4" />
        <span className="hidden sm:inline">New Sheet</span>
      </button>

      {/* Sheet Count Info */}
      <div className="ml-auto px-2 py-1 text-xs text-gray-500">
        {sheets.length} sheet{sheets.length !== 1 ? 's' : ''}
      </div>
    </div>
  );
}
