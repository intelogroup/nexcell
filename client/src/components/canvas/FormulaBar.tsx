import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface FormulaBarProps {
  value: string;
  cellReference: string;
  onCommit: (value: string) => void;
  onCancel: () => void;
  readOnly?: boolean;
}

export function FormulaBar({ value, cellReference, onCommit, onCancel, readOnly }: FormulaBarProps) {
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onCommit(localValue);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setLocalValue(value);
      onCancel();
    }
  };

  return (
    <div className="h-10 border-b border-gray-200 bg-white flex items-center px-4 gap-3">
      {/* Cell Reference */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-gray-500 min-w-[60px]">
          {cellReference || 'A1'}
        </span>
        <div className="h-4 w-px bg-gray-200" />
      </div>

      {/* Formula Input */}
      <input
        type="text"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          if (localValue !== value) {
            onCommit(localValue);
          }
        }}
        placeholder="Enter value or formula..."
        disabled={readOnly}
        className={cn(
          "flex-1 text-sm bg-transparent focus:outline-none",
          readOnly && "text-gray-400"
        )}
      />
    </div>
  );
}
