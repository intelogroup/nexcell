import { useState, useEffect, useRef } from 'react'
import { Loader2, Sparkles, AlertCircle, CheckCircle2, XCircle, MessageSquare } from 'lucide-react'
import {
  useGenerateAiPlan,
  useApplyAiPlan,
  useConversationHistory,
  formatOperation,
  type AiPlan,
  type ConversationMessage,
} from '../../services/ai.service'
import { showToast, getErrorMessage } from '../../lib/toast'

export interface AiAssistantProps {
  workbookId: string
  onApplySuccess?: () => void
}

export function AiAssistant({ workbookId, onApplySuccess }: AiAssistantProps) {
  const [instructions, setInstructions] = useState('')
  const [currentPlan, setCurrentPlan] = useState<AiPlan | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const generatePlan = useGenerateAiPlan()
  const applyPlan = useApplyAiPlan()
  const { data: conversationData, isLoading: isLoadingHistory } = useConversationHistory(workbookId)

  const messages = conversationData?.messages || []

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  const handleGeneratePlan = async () => {
    if (!instructions.trim()) {
      showToast.error('Please enter instructions')
      return
    }

    try {
      const response = await generatePlan.mutateAsync({
        workbookId,
        instructions: instructions.trim(),
      })

      if (response.success) {
        setCurrentPlan(response.plan)
        showToast.success('AI plan generated successfully!')
      }
    } catch (error) {
      console.error('Failed to generate plan:', error)
      showToast.error(`Failed to generate plan: ${getErrorMessage(error)}`)
    }
  }

  const handleApplyPlan = async () => {
    if (!currentPlan) return

    try {
      const response = await applyPlan.mutateAsync({
        workbookId,
        planId: currentPlan.id,
      })

      if (response.success) {
        showToast.success(
          `Applied ${response.result.appliedOps} operation(s) successfully!`
        )
        
        // Show errors if any
        if (response.result.errors.length > 0) {
          showToast.error(
            `${response.result.errors.length} operation(s) failed. Check console for details.`
          )
          console.error('Operation errors:', response.result.errors)
        }

        // Clear the plan after successful apply
        setCurrentPlan(null)
        setInstructions('')
        
        onApplySuccess?.()
      }
    } catch (error) {
      console.error('Failed to apply plan:', error)
      showToast.error(`Failed to apply plan: ${getErrorMessage(error)}`)
    }
  }

  const handleClearPlan = () => {
    setCurrentPlan(null)
  }

  const isGenerating = generatePlan.isPending
  const isApplying = applyPlan.isPending

  return (
    <div className="flex flex-col h-full bg-white border-l border-gray-200">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-purple-600" />
          <h2 className="text-lg font-semibold text-gray-900">AI Assistant</h2>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Describe what you want to do, and I'll help you edit your spreadsheet
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Conversation History */}
        {messages.length > 0 && (
          <div className="mb-4 space-y-3">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-lg px-4 py-2 ${
                    msg.role === 'user'
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {msg.role === 'assistant' && (
                      <Sparkles className="h-4 w-4 flex-shrink-0 mt-0.5 text-purple-600" />
                    )}
                    {msg.role === 'user' && (
                      <MessageSquare className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      {msg.metadata?.operations && (
                        <div className="mt-2 text-xs opacity-75">
                          {msg.metadata.operations.length} operation(s) planned
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Loading History */}
        {isLoadingHistory && (
          <div className="flex items-center justify-center py-8 text-gray-500">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Loading conversation...
          </div>
        )}

        {/* Instructions Input */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Instructions
            <span className="text-xs text-gray-500 ml-2">(5 credits)</span>
          </label>
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="e.g., Create a sum formula in cell A10 that adds all values in A1 to A9"
            rows={4}
            disabled={isGenerating || isApplying || !!currentPlan}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none disabled:bg-gray-100 disabled:cursor-not-allowed text-sm"
            maxLength={2000}
          />
          <div className="flex justify-between items-center mt-1">
            <span className="text-xs text-gray-500">
              {instructions.length}/2000 characters
            </span>
            {!currentPlan && (
              <button
                onClick={handleGeneratePlan}
                disabled={!instructions.trim() || isGenerating}
                className="px-3 py-1.5 text-sm bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Generate Plan
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Plan Preview */}
        {currentPlan && (
          <div className="border border-purple-200 rounded-md bg-purple-50 p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">
                  Generated Plan
                </h3>
                {currentPlan.reasoning && (
                  <p className="text-xs text-gray-600 mt-1">
                    {currentPlan.reasoning}
                  </p>
                )}
              </div>
              <button
                onClick={handleClearPlan}
                disabled={isApplying}
                className="text-gray-400 hover:text-gray-600 disabled:cursor-not-allowed"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            {/* Warnings */}
            {currentPlan.warnings && currentPlan.warnings.length > 0 && (
              <div className="mb-3 p-2 bg-yellow-50 border border-yellow-200 rounded">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-yellow-800">
                    {currentPlan.warnings.map((warning, i) => (
                      <div key={i}>{warning}</div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Operations List */}
            <div className="space-y-2 mb-3">
              <div className="text-xs font-medium text-gray-700">
                Operations ({currentPlan.operations.length}):
              </div>
              <div className="bg-white rounded border border-purple-200 divide-y divide-gray-100 max-h-64 overflow-y-auto">
                {currentPlan.operations.map((op, index) => (
                  <div
                    key={index}
                    className="px-3 py-2 text-xs text-gray-700 hover:bg-purple-50"
                  >
                    <span className="font-mono text-purple-600 mr-2">
                      {index + 1}.
                    </span>
                    {formatOperation(op)}
                  </div>
                ))}
              </div>
            </div>

            {/* Estimated Changes */}
            {currentPlan.estimatedChanges && (
              <div className="mb-3 text-xs text-gray-600">
                <span className="font-medium">Estimated changes:</span>{' '}
                {currentPlan.estimatedChanges}
              </div>
            )}

            {/* Token Usage */}
            {currentPlan.usage && (
              <div className="mb-3 text-xs text-gray-500">
                <span className="font-medium">Tokens:</span>{' '}
                {currentPlan.usage.totalTokens} (
                {currentPlan.usage.promptTokens} prompt +{' '}
                {currentPlan.usage.completionTokens} completion)
              </div>
            )}

            {/* Apply Button */}
            <button
              onClick={handleApplyPlan}
              disabled={isApplying}
              className="w-full px-4 py-2 text-sm bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isApplying ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Applying...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Apply Plan (10 credits)
                </>
              )}
            </button>
          </div>
        )}

        {/* Help Text */}
        {!currentPlan && !isGenerating && (
          <div className="mt-6 text-xs text-gray-500 space-y-2">
            <p className="font-medium text-gray-700">Examples:</p>
            <ul className="space-y-1 list-disc list-inside">
              <li>Sum column A and put the result in A10</li>
              <li>Create a table with headers in row 1</li>
              <li>Add a new sheet called "Budget"</li>
              <li>Format cells A1:C1 as bold with blue background</li>
              <li>Insert 3 rows at row 5</li>
            </ul>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <AlertCircle className="h-4 w-4" />
          <span>
            Generating a plan costs <strong>5 credits</strong>. Applying it
            costs <strong>10 credits</strong>.
          </span>
        </div>
      </div>
    </div>
  )
}
