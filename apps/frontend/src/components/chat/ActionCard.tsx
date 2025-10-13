/**
 * ActionCard Component
 * 
 * Displays AI-proposed actions with Apply/Preview/Cancel buttons.
 * Shows affected range, confidence level, and preview of changes.
 * 
 * Features:
 * - Expandable/collapsible preview section
 * - Color-coded confidence levels
 * - Keyboard shortcuts (Enter to apply, Esc to cancel)
 * - Loading states during action execution
 * - Cell-by-cell diff visualization
 * - Smooth animations
 */

import { useState, useEffect } from 'react'
import type { ChatAction } from '../../types/chat.types'
import { CheckCircle, XCircle, Eye, EyeOff, Loader2, ChevronDown, ChevronUp, Zap } from 'lucide-react'

interface ActionCardProps {
  action: ChatAction
  onApply: () => void | Promise<void>
  onCancel: () => void
  onPreview?: () => void
  isApplying?: boolean
}

export function ActionCard({ action, onApply, onCancel, onPreview, isApplying = false }: ActionCardProps) {
  const { description, affectedRange, metadata, preview } = action
  const [isPreviewExpanded, setIsPreviewExpanded] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  
  // Determine confidence color and icon
  const getConfidenceData = (confidence?: number) => {
    if (!confidence) return { color: 'text-gray-600', bg: 'bg-gray-100', label: 'Unknown' }
    if (confidence >= 0.9) return { color: 'text-green-600', bg: 'bg-green-100', label: 'High' }
    if (confidence >= 0.7) return { color: 'text-yellow-600', bg: 'bg-yellow-100', label: 'Medium' }
    return { color: 'text-orange-600', bg: 'bg-orange-100', label: 'Low' }
  }
  
  const confidenceData = getConfidenceData(metadata?.confidence)
  const confidencePercent = metadata?.confidence ? Math.round(metadata?.confidence * 100) : null
  
  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if card is visible
      if (e.key === 'Enter' && e.ctrlKey) {
        e.preventDefault()
        handleApply()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        onCancel()
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onCancel])
  
  const handleApply = async () => {
    setIsProcessing(true)
    try {
      await onApply()
    } finally {
      setIsProcessing(false)
    }
  }
  
  return (
    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 rounded-xl p-4 animate-fadeIn shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm">
          {isProcessing || isApplying ? (
            <Loader2 className="w-5 h-5 text-white animate-spin" />
          ) : (
            <Zap className="w-5 h-5 text-white" />
          )}
        </div>
        
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex-1">
              <h3 className="font-semibold text-sm text-gray-900 flex items-center gap-2">
                Action Required
                {confidencePercent !== null && (
                  <span className={`text-xs ${confidenceData.color} ${confidenceData.bg} px-2 py-0.5 rounded-full font-medium`}>
                    {confidencePercent}% • {confidenceData.label}
                  </span>
                )}
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Review and apply changes
              </p>
            </div>
          </div>
          
          {/* Description */}
          <p className="text-sm text-gray-700 mb-2">{description}</p>
          
          {/* Metadata */}
          <div className="flex flex-wrap gap-2 mb-3">
            <span className="text-xs bg-white dark:bg-gray-800 px-2 py-1 rounded-full border border-amber-200">
              Range: {affectedRange}
            </span>
            {metadata?.estimatedCells && (
              <span className="text-xs bg-white dark:bg-gray-800 px-2 py-1 rounded-full border border-amber-200">
                {metadata.estimatedCells} cell{metadata.estimatedCells !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          
          {/* Preview Toggle (if available) */}
          {preview && (
            <div className="mb-3">
              <button
                onClick={() => setIsPreviewExpanded(!isPreviewExpanded)}
                className="flex items-center gap-2 text-xs text-gray-600 hover:text-gray-900 font-medium mb-2 transition"
              >
                {isPreviewExpanded ? (
                  <>
                    <ChevronUp className="w-4 h-4" />
                    Hide Preview
                    <EyeOff className="w-3 h-3" />
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-4 h-4" />
                    Show Preview
                    <Eye className="w-3 h-3" />
                  </>
                )}
              </button>
              
              {isPreviewExpanded && (
                <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-amber-200 space-y-3">
                  {/* Before State */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 rounded-full bg-red-500"></div>
                      <p className="text-xs font-semibold text-gray-700">Before</p>
                    </div>
                    <div className="p-2 bg-red-50 dark:bg-red-900/10 rounded border border-red-200">
                      <pre className="text-xs text-gray-700 dark:text-gray-300 font-mono overflow-x-auto whitespace-pre-wrap break-words">
                        {JSON.stringify(preview.before, null, 2)}
                      </pre>
                    </div>
                  </div>
                  
                  {/* Arrow */}
                  <div className="flex items-center justify-center">
                    <div className="text-amber-500 font-bold">↓</div>
                  </div>
                  
                  {/* After State */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 rounded-full bg-green-500"></div>
                      <p className="text-xs font-semibold text-gray-700">After</p>
                    </div>
                    <div className="p-2 bg-green-50 dark:bg-green-900/10 rounded border border-green-200">
                      <pre className="text-xs text-gray-700 dark:text-gray-300 font-mono overflow-x-auto whitespace-pre-wrap break-words">
                        {JSON.stringify(preview.after, null, 2)}
                      </pre>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleApply}
              disabled={isProcessing || isApplying}
              className="flex items-center gap-2 text-sm bg-amber-500 text-white px-4 py-2 rounded-lg hover:bg-amber-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow"
              title="Apply changes (Ctrl+Enter)"
            >
              {isProcessing || isApplying ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Applying...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Apply Changes
                </>
              )}
            </button>
            
            {onPreview && !isPreviewExpanded && (
              <button
                onClick={onPreview}
                disabled={isProcessing || isApplying}
                className="flex items-center gap-2 text-sm border border-amber-300 bg-white px-4 py-2 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                title="Open detailed preview"
              >
                <Eye className="w-4 h-4" />
                Full Preview
              </button>
            )}
            
            <button
              onClick={onCancel}
              disabled={isProcessing || isApplying}
              className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 px-4 py-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              title="Cancel action (Esc)"
            >
              <XCircle className="w-4 h-4" />
              Cancel
            </button>
          </div>
          
          {/* Keyboard shortcuts hint */}
          <div className="mt-3 pt-3 border-t border-amber-200">
            <p className="text-xs text-gray-500">
              💡 Tip: Press <kbd className="px-1.5 py-0.5 bg-gray-100 rounded border border-gray-300 font-mono text-xs">Ctrl+Enter</kbd> to apply or <kbd className="px-1.5 py-0.5 bg-gray-100 rounded border border-gray-300 font-mono text-xs">Esc</kbd> to cancel
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
