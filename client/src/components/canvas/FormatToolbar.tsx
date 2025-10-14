/**
 * FormatToolbar Component
 * Provides formatting controls for cells (styles and number formats)
 */

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { ColorPicker } from './ColorPicker';
import type { CellStyle } from '@/lib/workbook/types';

interface FormatToolbarProps {
  selectedCell?: {
    address: string;
    style?: CellStyle;
    numFmt?: string;
  };
  onStyleChange: (style: Partial<CellStyle>) => void;
  onNumberFormatChange: (numFmt: string) => void;
  disabled?: boolean;
}

// Common number formats
const NUMBER_FORMATS = [
  { label: 'General', value: 'General' },
  { label: 'Number', value: '0.00' },
  { label: 'Currency', value: '$#,##0.00' },
  { label: 'Accounting', value: '_($* #,##0.00_);_($* (#,##0.00);_($* "-"??_);_(@_)' },
  { label: 'Percentage', value: '0.00%' },
  { label: 'Date', value: 'M/D/YYYY' },
  { label: 'Time', value: 'h:mm:ss AM/PM' },
  { label: 'Scientific', value: '0.00E+00' },
  { label: 'Fraction', value: '# ?/?' },
  { label: 'Text', value: '@' },
];

export function FormatToolbar({ 
  selectedCell, 
  onStyleChange, 
  onNumberFormatChange,
  disabled 
}: FormatToolbarProps) {
  const [showNumFmtPicker, setShowNumFmtPicker] = useState(false);
  const [customNumFmt, setCustomNumFmt] = useState('');

  const currentStyle = selectedCell?.style || {};
  const currentNumFmt = selectedCell?.numFmt || 'General';

  const toggleBold = () => {
    onStyleChange({ bold: !currentStyle.bold });
  };

  const toggleItalic = () => {
    onStyleChange({ italic: !currentStyle.italic });
  };

  const toggleUnderline = () => {
    onStyleChange({ underline: !currentStyle.underline });
  };

  const toggleStrikethrough = () => {
    onStyleChange({ strikethrough: !currentStyle.strikethrough });
  };

  const handleNumFmtSelect = (format: string) => {
    onNumberFormatChange(format);
    setShowNumFmtPicker(false);
  };

  const handleCustomNumFmt = () => {
    if (customNumFmt.trim()) {
      onNumberFormatChange(customNumFmt);
      setCustomNumFmt('');
      setShowNumFmtPicker(false);
    }
  };

  const handleTextColorChange = (color: string) => {
    onStyleChange({ color });
  };

  const handleBgColorChange = (color: string) => {
    onStyleChange({ bgColor: color });
  };

  return (
    <div className="h-12 border-b border-gray-200 bg-white flex items-center px-4 gap-2">
      {/* Font Styles */}
      <div className="flex items-center gap-1 pr-2 border-r border-gray-200">
        <Button
          size="sm"
          variant={currentStyle.bold ? 'primary' : 'ghost'}
          onClick={toggleBold}
          disabled={disabled}
          title="Bold (Ctrl+B)"
          className="w-8 h-8 p-0 font-bold"
        >
          B
        </Button>
        <Button
          size="sm"
          variant={currentStyle.italic ? 'primary' : 'ghost'}
          onClick={toggleItalic}
          disabled={disabled}
          title="Italic (Ctrl+I)"
          className="w-8 h-8 p-0 italic"
        >
          I
        </Button>
        <Button
          size="sm"
          variant={currentStyle.underline ? 'primary' : 'ghost'}
          onClick={toggleUnderline}
          disabled={disabled}
          title="Underline (Ctrl+U)"
          className="w-8 h-8 p-0 underline"
        >
          U
        </Button>
        <Button
          size="sm"
          variant={currentStyle.strikethrough ? 'primary' : 'ghost'}
          onClick={toggleStrikethrough}
          disabled={disabled}
          title="Strikethrough"
          className="w-8 h-8 p-0 line-through"
        >
          S
        </Button>
      </div>

      {/* Colors */}
      <div className="flex items-center gap-2 pr-2 border-r border-gray-200">
        <ColorPicker
          value={currentStyle.color}
          onChange={handleTextColorChange}
          label="A"
        />
        <ColorPicker
          value={currentStyle.bgColor}
          onChange={handleBgColorChange}
          label="▨"
        />
      </div>

      {/* Number Format Picker */}
      <div className="relative">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setShowNumFmtPicker(!showNumFmtPicker)}
          disabled={disabled}
          title="Number Format"
          className="min-w-[120px] justify-start"
        >
          <span className="text-xs truncate">
            {NUMBER_FORMATS.find(f => f.value === currentNumFmt)?.label || 'Custom'}
          </span>
        </Button>

        {showNumFmtPicker && (
          <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
            {/* Preset formats */}
            <div className="p-2">
              <div className="text-xs font-semibold text-gray-500 mb-2 px-2">
                Number Formats
              </div>
              {NUMBER_FORMATS.map((format) => (
                <button
                  key={format.value}
                  onClick={() => handleNumFmtSelect(format.value)}
                  className={`
                    w-full text-left px-3 py-2 text-sm rounded hover:bg-gray-100
                    ${currentNumFmt === format.value ? 'bg-blue-50 text-blue-700' : 'text-gray-700'}
                  `}
                >
                  <div className="font-medium">{format.label}</div>
                  <div className="text-xs text-gray-500">{format.value}</div>
                </button>
              ))}
            </div>

            {/* Custom format */}
            <div className="border-t border-gray-200 p-3">
              <div className="text-xs font-semibold text-gray-500 mb-2">
                Custom Format
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customNumFmt}
                  onChange={(e) => setCustomNumFmt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleCustomNumFmt();
                    }
                  }}
                  placeholder="e.g., 0.00%"
                  className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <Button
                  size="sm"
                  onClick={handleCustomNumFmt}
                  disabled={!customNumFmt.trim()}
                >
                  Apply
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Info about selected cell */}
      {selectedCell && (
        <div className="ml-auto text-xs text-gray-500">
          {selectedCell.address}
        </div>
      )}
    </div>
  );
}
