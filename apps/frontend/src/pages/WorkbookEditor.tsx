import { useParams, useBlocker } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { Grid } from '../components/grid/Grid'
import { useWorkbook, useSaveWorkbook, useExportWorkbook } from '../services/workbook.service'
import { useWorkbookStore } from '../stores/workbook.store'
import { Loader2, Download, Sparkles } from 'lucide-react'
import { showToast, getErrorMessage } from '../lib/toast'
import { WorkbookSplitLayout } from '../components/layout/WorkbookSplitLayout'
import { ChatPanel } from '../components/chat/ChatPanel'
import { useSyncChatWithWorkbook, useBackgroundChatSync } from '../hooks/useChat'

export default function WorkbookEditor() {
  // Sync chat with workbook when it loads
  useSyncChatWithWorkbook()
  
  // Enable background sync every 60 seconds
  useBackgroundChatSync(60000)
  const { id } = useParams<{ id: string }>()
  const { isLoading, error } = useWorkbook(id)
  const currentWorkbook = useWorkbookStore(state => state.currentWorkbook)
  const workbookData = useWorkbookStore(state => state.workbookData)
  const hasUnsavedChanges = useWorkbookStore(state => state.hasUnsavedChanges)
  const setSaving = useWorkbookStore(state => state.setSaving)
  const setUnsavedChanges = useWorkbookStore(state => state.setUnsavedChanges)
  const isSaving = useWorkbookStore(state => state.isSaving)
  
  const saveWorkbook = useSaveWorkbook(id || '')
  const exportWorkbook = useExportWorkbook()
  const [isExporting, setIsExporting] = useState(false)
  const [isAiSidebarOpen, setIsAiSidebarOpen] = useState(false)

  // Warn on navigation with unsaved changes
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      hasUnsavedChanges &&
      currentLocation.pathname !== nextLocation.pathname
  )

  // Warn on page reload/close with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault()
        e.returnValue = ''
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasUnsavedChanges])

  const handleSave = async () => {
    if (!id || !workbookData || !currentWorkbook) return
    
    setSaving(true)
    try {
      await saveWorkbook.mutateAsync({
        name: currentWorkbook.name,
        description: currentWorkbook.description || undefined,
        data: workbookData
      })
      setUnsavedChanges(false)
      showToast.success('Workbook saved successfully!')
    } catch (err) {
      console.error('Failed to save workbook:', err)
      showToast.error(`Failed to save: ${getErrorMessage(err)}`)
    } finally {
      setSaving(false)
    }
  }

  const handleExport = async () => {
    if (!id || !currentWorkbook) return
    
    setIsExporting(true)
    try {
      await exportWorkbook.mutateAsync({
        id,
        filename: currentWorkbook.name
      })
      showToast.success('Workbook exported successfully!')
    } catch (err) {
      console.error('Failed to export workbook:', err)
      showToast.error(`Failed to export: ${getErrorMessage(err)}`)
    } finally {
      setIsExporting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-2">Error Loading Workbook</h2>
          <p className="text-gray-600">{(error as Error).message}</p>
        </div>
      </div>
    )
  }

  if (!currentWorkbook) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600">Workbook not found</p>
      </div>
    )
  }

  return (
    <>
      {/* Navigation Blocker Dialog */}
      {blocker.state === 'blocked' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Unsaved Changes</h3>
            <p className="text-sm text-gray-600 mb-6">
              You have unsaved changes. Are you sure you want to leave?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => blocker.reset()}
                className="flex-1 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setUnsavedChanges(false)
                  blocker.proceed()
                }}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Leave Without Saving
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col h-screen">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">{currentWorkbook.name}</h1>
          {currentWorkbook.description && (
            <p className="text-sm text-gray-600">{currentWorkbook.description}</p>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {hasUnsavedChanges && (
            <span className="text-sm text-gray-500 italic">Unsaved changes</span>
          )}
          <button className="px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded">
            Share
          </button>
          <button 
            onClick={() => setIsAiSidebarOpen(!isAiSidebarOpen)}
            className={`px-3 py-1.5 text-sm font-medium rounded flex items-center gap-2 ${
              isAiSidebarOpen
                ? 'bg-purple-600 text-white hover:bg-purple-700'
                : 'text-purple-600 bg-purple-50 hover:bg-purple-100'
            }`}
          >
            <Sparkles className="h-4 w-4" />
            AI Assistant
          </button>
          <button 
            onClick={handleExport}
            disabled={isExporting}
            className="px-3 py-1.5 text-sm text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded disabled:bg-gray-100 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isExporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {isExporting ? 'Exporting...' : 'Download as Excel'}
          </button>
          <button 
            onClick={handleSave}
            disabled={!hasUnsavedChanges || isSaving}
            className="px-3 py-1.5 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

        {/* Main Content Area with Split Layout */}
        <div className="flex-1 overflow-hidden">
          {isAiSidebarOpen ? (
            <WorkbookSplitLayout
              chatPanel={<ChatPanel workbookId={id!} />}
              workbookCanvas={<Grid />}
              showCollapseToggle={true}
            />
          ) : (
            <Grid />
          )}
        </div>
      </div>
    </>
  )
}
