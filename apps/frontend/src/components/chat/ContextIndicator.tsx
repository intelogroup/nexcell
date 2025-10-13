/**
 * ContextIndicator Component
 * 
 * Shows what the AI can "see" - selected range, visible cells, current workbook context.
 * Updates in real-time when selection changes.
 */

import { useSelectedRange } from '../../stores/chat.store'
import { useCurrentWorkbook, useActiveSheet } from '../../stores/workbook.store'
import { Eye, Table, FileSpreadsheet } from 'lucide-react'

export function ContextIndicator() {
  const selectedRange = useSelectedRange()
  const currentWorkbook = useCurrentWorkbook()
  const activeSheet = useActiveSheet()
  
  const hasContext = selectedRange || activeSheet
  
  if (!hasContext) {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <Eye className="w-4 h-4" />
        <span>No context available</span>
      </div>
    )
  }
  
  return (
    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 rounded-lg p-3">
      <div className="flex items-center gap-2 mb-2">
        <Eye className="w-4 h-4 text-blue-500" />
        <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
          AI Context
        </span>
      </div>
      
      <div className="flex flex-wrap gap-2">
        {/* Workbook Name */}
        {currentWorkbook && (
          <div className="flex items-center gap-1 text-xs bg-blue-100 dark:bg-blue-800 px-2 py-1 rounded-full">
            <FileSpreadsheet className="w-3 h-3" />
            <span>{currentWorkbook.name}</span>
          </div>
        )}
        
        {/* Active Sheet */}
        {activeSheet && (
          <div className="flex items-center gap-1 text-xs bg-blue-100 dark:bg-blue-800 px-2 py-1 rounded-full">
            <Table className="w-3 h-3" />
            <span>Sheet: {activeSheet}</span>
          </div>
        )}
        
        {/* Selected Range */}
        {selectedRange && (
          <>
            <span className="text-xs bg-blue-100 dark:bg-blue-800 px-2 py-1 rounded-full">
              Selected: {selectedRange.range}
            </span>
            <span className="text-xs bg-blue-100 dark:bg-blue-800 px-2 py-1 rounded-full">
              {selectedRange.cellCount} cell{selectedRange.cellCount !== 1 ? 's' : ''}
            </span>
            {selectedRange.rowCount > 1 && selectedRange.colCount > 1 && (
              <span className="text-xs bg-blue-100 dark:bg-blue-800 px-2 py-1 rounded-full">
                {selectedRange.rowCount}×{selectedRange.colCount}
              </span>
            )}
          </>
        )}
      </div>
      
      <p className="text-xs text-gray-600 mt-2">
        AI has context of this {selectedRange ? 'selection' : 'sheet'}
      </p>
    </div>
  )
}
