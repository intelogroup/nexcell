import type { CircularReferenceError } from '../lib/workbook/circular-reference-guard';

interface CircularReferenceAlertProps {
  error: CircularReferenceError;
  onResolve: (action: 'break' | 'ignore' | 'undo') => void;
  onDismiss: () => void;
}

export function CircularReferenceAlert({ error, onResolve, onDismiss }: CircularReferenceAlertProps) {
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'bg-red-50 border-red-200 text-red-800';
      case 'medium':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      case 'low':
        return 'bg-blue-50 border-blue-200 text-blue-800';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-800';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'high':
        return (
          <svg className="w-5 h-5 text-red-500" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
            <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        );
      case 'medium':
        return (
          <svg className="w-5 h-5 text-yellow-500" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
            <path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5 text-blue-500" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
            <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center gap-3 mb-4">
            {getSeverityIcon(((error as any).chain?.severity || (error as any).severity || 'medium') as string)}
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Circular Reference Detected
              </h2>
              <p className="text-sm text-gray-600">
                {((error as any).chain?.severity || (error as any).severity) === 'high'
                  ? 'This could cause your browser to freeze'
                  : 'This may affect calculation performance'
                }
              </p>
            </div>
          </div>

          {/* Error Details */}
          <div className={`border rounded-lg p-4 mb-6 ${getSeverityColor(((error as any).chain?.severity || (error as any).severity || 'medium') as string)}`}>
            <div className="mb-3">
              <h3 className="font-medium mb-2">Circular Reference Chain:</h3>
              <div className="font-mono text-sm bg-white bg-opacity-50 rounded p-2">
                {(((error as any).chain && (error as any).chain.cells) || (error as any).affectedCells || []).join(' → ')}
              </div>
            </div>
            
            <div className="text-sm">
              <p><strong>Operation:</strong> {(error as any).context?.operation || 'N/A'}</p>
              <p><strong>Chain Length:</strong> {(((error as any).chain && (error as any).chain.cells) || (error as any).affectedCells || []).length} cells</p>
              <p><strong>Severity:</strong> {String(((error as any).chain?.severity) || (error as any).severity || 'medium').toUpperCase()}</p>
            </div>
          </div>

          {/* Explanation */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <h3 className="font-medium text-gray-900 mb-2">What does this mean?</h3>
            <p className="text-sm text-gray-700 mb-2">
              A circular reference occurs when a formula refers back to its own cell, either directly or through other cells. 
              This creates an infinite loop that can cause calculations to never finish.
            </p>
            <p className="text-sm text-gray-700">
              <strong>Example:</strong> Cell A1 contains "=B1", Cell B1 contains "=A1"
            </p>
          </div>

          {/* Recovery Options */}
          <div className="mb-6">
            <h3 className="font-medium text-gray-900 mb-3">Choose a recovery option:</h3>
            <div className="space-y-3">
              <button
                onClick={() => onResolve('break')}
                className="w-full text-left p-4 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
              >
                <div className="font-medium text-blue-900">Break the circular reference</div>
                <div className="text-sm text-blue-700 mt-1">
                  Clear the formula in one of the cells to break the loop (Recommended)
                </div>
              </button>
              
              <button
                onClick={() => onResolve('ignore')}
                className="w-full text-left p-4 border border-yellow-200 rounded-lg hover:bg-yellow-50 transition-colors"
              >
                <div className="font-medium text-yellow-900">Continue with timeout protection</div>
                <div className="text-sm text-yellow-700 mt-1">
                  Allow calculation to proceed with a safety timeout (May cause performance issues)
                </div>
              </button>
              
              <button
                onClick={() => onResolve('undo')}
                className="w-full text-left p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="font-medium text-gray-900">Undo last change</div>
                <div className="text-sm text-gray-700 mt-1">
                  Revert to the previous state before the circular reference was created
                </div>
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <button
              onClick={onDismiss}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CircularReferenceAlert;