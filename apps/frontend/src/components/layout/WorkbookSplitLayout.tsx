/**
 * WorkbookSplitLayout Component
 * 
 * Manages the split layout between chat panel and workbook canvas.
 * - 35% chat panel (left)
 * - 65% workbook canvas (right)
 * - Collapsible chat panel
 * - Responsive design
 */

import type { ReactNode } from 'react'
import { useChatStore } from '../../stores/chat.store'
import { MessageSquare } from 'lucide-react'

interface WorkbookSplitLayoutProps {
  /** Content for the chat panel (left side) */
  chatPanel: ReactNode
  /** Content for the workbook canvas (right side) */
  workbookCanvas: ReactNode
  /** Whether to show the collapse toggle button */
  showCollapseToggle?: boolean
}

export function WorkbookSplitLayout({
  chatPanel,
  workbookCanvas,
  showCollapseToggle = true,
}: WorkbookSplitLayoutProps) {
  const isCollapsed = useChatStore((state) => state.uiState.isCollapsed)
  const toggleChatCollapsed = useChatStore((state) => state.toggleChatCollapsed)

  return (
    <div className="flex h-full w-full overflow-hidden relative">
      {/* Chat Panel (35% width, collapsible) */}
      <div
        className={`
          flex-shrink-0 h-full
          transition-all duration-300 ease-in-out
          ${isCollapsed ? 'w-0' : 'w-[35%]'}
          ${isCollapsed ? 'opacity-0' : 'opacity-100'}
        `}
        style={{
          minWidth: isCollapsed ? '0' : '320px',
          maxWidth: isCollapsed ? '0' : '600px',
        }}
      >
        <div className={`h-full ${isCollapsed ? 'invisible' : 'visible'}`}>
          {chatPanel}
        </div>
      </div>

      {/* Collapse Toggle Button */}
      {showCollapseToggle && (
        <button
          onClick={toggleChatCollapsed}
          className={`
            absolute top-4 z-10
            transition-all duration-300
            ${isCollapsed ? 'left-4' : 'left-[calc(35%-1rem)]'}
            p-2 rounded-lg
            bg-white border border-gray-300 shadow-lg
            hover:bg-gray-50 hover:shadow-xl
            focus:outline-none focus:ring-2 focus:ring-purple-500
            group
          `}
          aria-label={isCollapsed ? 'Expand chat' : 'Collapse chat'}
          title={isCollapsed ? 'Expand chat' : 'Collapse chat'}
        >
          <MessageSquare
            className={`
              h-5 w-5 text-gray-600 group-hover:text-purple-600
              transition-transform duration-300
              ${isCollapsed ? '' : 'rotate-180'}
            `}
          />
        </button>
      )}

      {/* Workbook Canvas (65% width, expands when chat is collapsed) */}
      <div
        className={`
          flex-1 h-full
          transition-all duration-300 ease-in-out
          ${isCollapsed ? 'ml-0' : ''}
        `}
      >
        {workbookCanvas}
      </div>
    </div>
  )
}
