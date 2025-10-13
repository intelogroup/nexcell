/**
 * Chat Split Layout Demo/Test Page
 * 
 * Demonstrates the new split layout with mock data for testing.
 * Shows how the chat panel integrates with the workbook canvas.
 */

import { useEffect } from 'react'
import { WorkbookSplitLayout } from '../components/layout/WorkbookSplitLayout'
import { ChatPanel } from '../components/chat/ChatPanel'
import { useChatStore } from '../stores/chat.store'
import { useWorkbookStore } from '../stores/workbook.store'

export default function ChatLayoutDemo() {
  const addMessage = useChatStore((state) => state.addMessage)
  const setCurrentWorkbookId = useChatStore((state) => state.setCurrentWorkbookId)
  const setCurrentWorkbook = useWorkbookStore((state) => state.setCurrentWorkbook)
  const setWorkbookData = useWorkbookStore((state) => state.setWorkbookData)
  
  // Initialize demo data
  useEffect(() => {
    const demoWorkbookId = 'demo-workbook-123'
    
    // Set current workbook
    setCurrentWorkbookId(demoWorkbookId)
    setCurrentWorkbook({
      id: demoWorkbookId,
      name: 'Q4 Budget Demo',
      description: 'Demo workbook for testing chat layout',
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    
    // Set workbook data
    setWorkbookData({
      sheets: [
        {
          name: 'Sheet1',
          cells: {
            A1: { value: 'Category' },
            B1: { value: 'Amount' },
            A2: { value: 'Sales' },
            B2: { value: 1000 },
          },
        },
      ],
      metadata: {
        activeSheet: 'Sheet1',
      },
    })
    
    // Add some demo messages (only if none exist)
    const existingMessages = useChatStore.getState().chatsByWorkbook[demoWorkbookId]?.messages
    if (!existingMessages || existingMessages.length === 0) {
      // User message
      addMessage(demoWorkbookId, {
        role: 'user',
        content: 'Create a budget table with 5 columns',
      })
      
      // AI response
      setTimeout(() => {
        addMessage(demoWorkbookId, {
          role: 'assistant',
          content: 'I\'ve created a budget table with the following columns:\n\n• Category (Text)\n• Amount (Currency)\n• Date (Date)\n• Notes (Text)\n• Status (Dropdown)\n\nThe table is ready in cells A1:E1 with headers.',
          metadata: {
            tokensUsed: 150,
            confidence: 0.95,
            affectedRange: 'A1:E1',
          },
        })
      }, 500)
      
      // Another user message
      setTimeout(() => {
        addMessage(demoWorkbookId, {
          role: 'user',
          content: 'Can you add some sample data?',
        })
      }, 1000)
      
      // Another AI response
      setTimeout(() => {
        addMessage(demoWorkbookId, {
          role: 'assistant',
          content: 'I\'ve added 10 rows of sample budget data including:\n\n• Office Supplies - $450\n• Marketing - $2,500\n• Software Licenses - $1,200\n• Travel - $3,000\n• And more...\n\nAll entries have dates, notes, and status values.',
          metadata: {
            tokensUsed: 180,
            confidence: 0.92,
            affectedRange: 'A2:E11',
          },
        })
      }, 1500)
    }
  }, [addMessage, setCurrentWorkbookId, setCurrentWorkbook, setWorkbookData])
  
  return (
    <div className="h-screen flex flex-col">
      {/* Demo Header */}
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Chat Layout Demo</h1>
          <p className="text-sm opacity-90">
            Testing the new 35/65 split layout with workbook-contextual chat
          </p>
        </div>
        <div className="flex gap-2">
          <span className="bg-white/20 px-3 py-1 rounded-full text-sm">
            Sprint 1 MVP
          </span>
          <span className="bg-white/20 px-3 py-1 rounded-full text-sm">
            Responsive
          </span>
        </div>
      </div>
      
      {/* Split Layout Demo */}
      <div className="flex-1 overflow-hidden">
        <WorkbookSplitLayout
          chatPanel={<ChatPanel workbookId="demo-workbook-123" />}
          workbookCanvas={
            <div className="h-full flex items-center justify-center bg-gray-50">
              <div className="text-center px-8">
                <div className="w-32 h-32 mx-auto mb-6 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-2xl">
                  <svg className="w-16 h-16 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                  </svg>
                </div>
                <h2 className="text-3xl font-bold text-gray-900 mb-3">Workbook Canvas</h2>
                <p className="text-gray-600 mb-6 max-w-md mx-auto">
                  This is where your spreadsheet grid would appear. The chat panel on the left provides context-aware AI assistance.
                </p>
                <div className="inline-flex items-center gap-4 bg-white rounded-lg shadow-lg px-6 py-4">
                  <div className="text-left">
                    <div className="text-sm text-gray-500">Layout Ratio</div>
                    <div className="text-2xl font-bold text-purple-600">35% / 65%</div>
                  </div>
                  <div className="w-px h-12 bg-gray-300"></div>
                  <div className="text-left">
                    <div className="text-sm text-gray-500">Features</div>
                    <div className="text-sm font-semibold text-gray-900">Collapsible + Responsive</div>
                  </div>
                </div>
              </div>
            </div>
          }
          showCollapseToggle={true}
        />
      </div>
      
      {/* Demo Info Footer */}
      <div className="bg-gray-100 border-t border-gray-200 px-6 py-3">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-4">
            <span className="text-gray-600">
              💡 <strong>Tip:</strong> Try the collapse button in the top-left corner
            </span>
          </div>
          <div className="flex items-center gap-2 text-gray-500">
            <span>Built with Zustand + Tailwind CSS</span>
          </div>
        </div>
      </div>
    </div>
  )
}
