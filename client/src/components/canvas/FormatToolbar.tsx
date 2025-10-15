/**
 * FormatToolbar Component
 * Provides formatting controls for cells (styles and number formats)
 */

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { ColorPicker } from './ColorPicker';
import { excelTheme } from '@/lib/excel-theme';
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

// Border options
const BORDER_OPTIONS = [
  { label: 'All Borders', value: 'all', icon: '⊞' },
  { label: 'Outside Borders', value: 'outside', icon: '⊡' },
  { label: 'Inside Borders', value: 'inside', icon: '⊟' },
  { label: 'Top Border', value: 'top', icon: '⊤' },
  { label: 'Bottom Border', value: 'bottom', icon: '⊥' },
  { label: 'Left Border', value: 'left', icon: '⊣' },
  { label: 'Right Border', value: 'right', icon: '⊢' },
  { label: 'No Border', value: 'none', icon: '○' },
];

const SORT_FILTER_OPTIONS = [
  { label: 'Sort A to Z', value: 'sort-asc', icon: '↑' },
  { label: 'Sort Z to A', value: 'sort-desc', icon: '↓' },
  { label: 'Custom Sort', value: 'sort-custom', icon: '⇅' },
  { label: 'Filter', value: 'filter', icon: '⚡' },
  { label: 'Clear Filter', value: 'clear-filter', icon: '✕' },
];

const CONDITIONAL_FORMAT_OPTIONS = [
  { label: 'Highlight Cells Rules', value: 'highlight-cells', icon: '🎨' },
  { label: 'Top/Bottom Rules', value: 'top-bottom', icon: '📊' },
  { label: 'Data Bars', value: 'data-bars', icon: '📈' },
  { label: 'Color Scales', value: 'color-scales', icon: '🌈' },
  { label: 'Icon Sets', value: 'icon-sets', icon: '🔢' },
  { label: 'Clear Rules', value: 'clear-rules', icon: '🗑️' },
];

export function FormatToolbar({ 
  selectedCell, 
  onStyleChange, 
  onNumberFormatChange,
  disabled 
}: FormatToolbarProps) {
  const [showNumFmtPicker, setShowNumFmtPicker] = useState(false);
  const [showBorderPicker, setShowBorderPicker] = useState(false);
  const [showSortFilterPicker, setShowSortFilterPicker] = useState(false);
  const [showConditionalFormatPicker, setShowConditionalFormatPicker] = useState(false);
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

  const handleBorderChange = (borderType: string) => {
    const defaultBorder = { style: 'thin' as const, color: '#000000' };
    
    const borderStyles: Record<string, Partial<CellStyle>> = {
      all: { 
        border: { 
          top: defaultBorder, 
          right: defaultBorder, 
          bottom: defaultBorder, 
          left: defaultBorder 
        } 
      },
      outside: { 
        border: { 
          top: defaultBorder, 
          right: defaultBorder, 
          bottom: defaultBorder, 
          left: defaultBorder 
        } 
      },
      inside: { 
        border: { 
          top: defaultBorder, 
          right: defaultBorder, 
          bottom: defaultBorder, 
          left: defaultBorder 
        } 
      },
      top: { border: { top: defaultBorder } },
      bottom: { border: { bottom: defaultBorder } },
      left: { border: { left: defaultBorder } },
      right: { border: { right: defaultBorder } },
      none: { border: { top: undefined, right: undefined, bottom: undefined, left: undefined } },
    };
    
    onStyleChange(borderStyles[borderType] || {});
    setShowBorderPicker(false);
  };

  const handleSortFilterAction = (action: string) => {
    // Placeholder for sort/filter functionality
    console.log('Sort/Filter action:', action);
    // In a real implementation, this would trigger sorting or filtering logic
    setShowSortFilterPicker(false);
  };

  const handleConditionalFormatAction = (action: string) => {
    // Placeholder for conditional formatting functionality
    console.log('Conditional Format action:', action);
    // In a real implementation, this would apply conditional formatting rules
    setShowConditionalFormatPicker(false);
  };

  return (
    <div 
      className="h-12 flex items-center px-4 gap-2 shadow-sm"
      style={{
        backgroundColor: excelTheme.toolbar.background,
        borderBottom: `1px solid ${excelTheme.toolbar.border}`,
      }}
    >
      {/* Font Styles */}
      <div 
        className="flex items-center gap-1 pr-2 border-r"
        style={{ borderColor: excelTheme.toolbar.border }}
      >
        <Button
          size="sm"
          variant={currentStyle.bold ? 'primary' : 'ghost'}
          onClick={toggleBold}
          disabled={disabled}
          title="Bold (Ctrl+B)"
          className="w-8 h-8 p-0 font-bold transition-colors"
          style={{
            backgroundColor: currentStyle.bold ? excelTheme.toolbar.button.selected : 'transparent',
            color: currentStyle.bold ? excelTheme.toolbar.button.selectedText : excelTheme.toolbar.text.primary,
          }}
          onMouseEnter={(e) => {
            if (!currentStyle.bold) {
              e.currentTarget.style.backgroundColor = excelTheme.toolbar.button.hover;
            }
          }}
          onMouseLeave={(e) => {
            if (!currentStyle.bold) {
              e.currentTarget.style.backgroundColor = 'transparent';
            }
          }}
        >
          B
        </Button>
        <Button
          size="sm"
          variant={currentStyle.italic ? 'primary' : 'ghost'}
          onClick={toggleItalic}
          disabled={disabled}
          title="Italic (Ctrl+I)"
          className="w-8 h-8 p-0 italic transition-colors"
          style={{
            backgroundColor: currentStyle.italic ? excelTheme.toolbar.button.selected : 'transparent',
            color: currentStyle.italic ? excelTheme.toolbar.button.selectedText : excelTheme.toolbar.text.primary,
          }}
          onMouseEnter={(e) => {
            if (!currentStyle.italic) {
              e.currentTarget.style.backgroundColor = excelTheme.toolbar.button.hover;
            }
          }}
          onMouseLeave={(e) => {
            if (!currentStyle.italic) {
              e.currentTarget.style.backgroundColor = 'transparent';
            }
          }}
        >
          I
        </Button>
        <Button
          size="sm"
          variant={currentStyle.underline ? 'primary' : 'ghost'}
          onClick={toggleUnderline}
          disabled={disabled}
          title="Underline (Ctrl+U)"
          className="w-8 h-8 p-0 underline transition-colors"
          style={{
            backgroundColor: currentStyle.underline ? excelTheme.toolbar.button.selected : 'transparent',
            color: currentStyle.underline ? excelTheme.toolbar.button.selectedText : excelTheme.toolbar.text.primary,
          }}
          onMouseEnter={(e) => {
            if (!currentStyle.underline) {
              e.currentTarget.style.backgroundColor = excelTheme.toolbar.button.hover;
            }
          }}
          onMouseLeave={(e) => {
            if (!currentStyle.underline) {
              e.currentTarget.style.backgroundColor = 'transparent';
            }
          }}
        >
          U
        </Button>
        <Button
          size="sm"
          variant={currentStyle.strikethrough ? 'primary' : 'ghost'}
          onClick={toggleStrikethrough}
          disabled={disabled}
          title="Strikethrough"
          className="w-8 h-8 p-0 line-through transition-colors"
          style={{
            backgroundColor: currentStyle.strikethrough ? excelTheme.toolbar.button.selected : 'transparent',
            color: currentStyle.strikethrough ? excelTheme.toolbar.button.selectedText : excelTheme.toolbar.text.primary,
          }}
          onMouseEnter={(e) => {
            if (!currentStyle.strikethrough) {
              e.currentTarget.style.backgroundColor = excelTheme.toolbar.button.hover;
            }
          }}
          onMouseLeave={(e) => {
            if (!currentStyle.strikethrough) {
              e.currentTarget.style.backgroundColor = 'transparent';
            }
          }}
        >
          S
        </Button>
      </div>

      {/* Colors */}
      <div 
        className="flex items-center gap-2 pr-2 border-r"
        style={{ borderColor: excelTheme.toolbar.border }}
      >
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

      {/* Borders */}
      <div className="relative">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setShowBorderPicker(!showBorderPicker)}
          disabled={disabled}
          title="Borders"
          className="w-8 h-8 p-0 transition-colors"
          style={{
            backgroundColor: showBorderPicker ? excelTheme.toolbar.button.active : 'transparent',
            color: excelTheme.toolbar.text.primary,
            borderColor: excelTheme.toolbar.border,
          }}
          onMouseEnter={(e) => {
            if (!showBorderPicker) {
              e.currentTarget.style.backgroundColor = excelTheme.toolbar.button.hover;
            }
          }}
          onMouseLeave={(e) => {
            if (!showBorderPicker) {
              e.currentTarget.style.backgroundColor = 'transparent';
            }
          }}
        >
          ⊞
        </Button>

        {/* Border Picker Dropdown */}
        {showBorderPicker && (
          <div
            className="absolute top-full left-0 mt-1 w-48 rounded-md shadow-lg z-50"
            style={{
              backgroundColor: excelTheme.dropdown.background,
              border: `1px solid ${excelTheme.dropdown.border}`,
              boxShadow: excelTheme.dropdown.shadow,
            }}
          >
            <div className="py-1">
              {BORDER_OPTIONS.map((border) => (
                <button
                  key={border.value}
                  onClick={() => handleBorderChange(border.value)}
                  className="w-full text-left px-3 py-2 text-sm transition-colors flex items-center gap-2"
                  style={{
                    color: excelTheme.toolbar.text.primary,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = excelTheme.dropdown.item.hover;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <span className="w-4 text-center">{border.icon}</span>
                  {border.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Number Format Picker */}
      <div className="relative">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setShowNumFmtPicker(!showNumFmtPicker)}
          disabled={disabled}
          title="Number Format"
          className="min-w-[120px] justify-start transition-colors"
          style={{
            backgroundColor: showNumFmtPicker ? excelTheme.toolbar.button.active : 'transparent',
            color: excelTheme.toolbar.text.primary,
            borderColor: excelTheme.toolbar.border,
          }}
          onMouseEnter={(e) => {
            if (!showNumFmtPicker) {
              e.currentTarget.style.backgroundColor = excelTheme.toolbar.button.hover;
            }
          }}
          onMouseLeave={(e) => {
            if (!showNumFmtPicker) {
              e.currentTarget.style.backgroundColor = 'transparent';
            }
          }}
        >
          <span className="text-xs truncate">
            {NUMBER_FORMATS.find(f => f.value === currentNumFmt)?.label || 'Custom'}
          </span>
        </Button>

        {showNumFmtPicker && (
          <div 
            className="absolute top-full left-0 mt-1 w-64 rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto"
            style={{
              backgroundColor: excelTheme.dropdown.background,
              border: `1px solid ${excelTheme.dropdown.border}`,
              boxShadow: `0 4px 6px -1px ${excelTheme.dropdown.shadow}, 0 2px 4px -1px ${excelTheme.dropdown.shadow}`,
            }}
          >
            {/* Preset formats */}
            <div className="p-2">
              <div 
                className="text-xs font-semibold mb-2 px-2"
                style={{ color: excelTheme.toolbar.text.secondary }}
              >
                Number Formats
              </div>
              {NUMBER_FORMATS.map((format) => (
                <button
                  key={format.value}
                  onClick={() => handleNumFmtSelect(format.value)}
                  className="w-full text-left px-3 py-2 text-sm rounded transition-colors"
                  style={{
                    backgroundColor: currentNumFmt === format.value ? excelTheme.dropdown.item.selected : 'transparent',
                    color: currentNumFmt === format.value ? excelTheme.dropdown.item.selectedText : excelTheme.toolbar.text.primary,
                  }}
                  onMouseEnter={(e) => {
                    if (currentNumFmt !== format.value) {
                      e.currentTarget.style.backgroundColor = excelTheme.dropdown.item.hover;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (currentNumFmt !== format.value) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }
                  }}
                >
                  <div className="font-medium">{format.label}</div>
                  <div 
                    className="text-xs"
                    style={{ color: excelTheme.toolbar.text.muted }}
                  >
                    {format.value}
                  </div>
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

      {/* Conditional Formatting */}
      <div className="relative">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setShowConditionalFormatPicker(!showConditionalFormatPicker)}
          disabled={disabled}
          title="Conditional Formatting"
          className="px-3 h-8 text-xs transition-colors"
          style={{
            color: excelTheme.toolbar.text.primary,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = excelTheme.toolbar.button.hover;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          Conditional Formatting ▼
        </Button>
        
        {showConditionalFormatPicker && (
          <div 
            className="absolute top-full left-0 mt-1 bg-white border rounded-md shadow-lg z-50 min-w-56"
            style={{
              backgroundColor: excelTheme.dropdown.background,
              borderColor: excelTheme.dropdown.border,
            }}
          >
            {CONDITIONAL_FORMAT_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => handleConditionalFormatAction(option.value)}
                className="w-full px-3 py-2 text-left text-sm transition-colors flex items-center gap-2"
                style={{
                  color: excelTheme.toolbar.text.primary,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = excelTheme.dropdown.item.hover;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <span className="w-4 text-center">{option.icon}</span>
                {option.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Sort & Filter */}
      <div className="relative">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setShowSortFilterPicker(!showSortFilterPicker)}
          disabled={disabled}
          title="Sort & Filter"
          className="px-3 h-8 text-xs transition-colors"
          style={{
            color: excelTheme.toolbar.text.primary,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = excelTheme.toolbar.button.hover;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          Sort & Filter ▼
        </Button>
        
        {showSortFilterPicker && (
          <div 
            className="absolute top-full left-0 mt-1 bg-white border rounded-md shadow-lg z-50 min-w-48"
            style={{
              backgroundColor: excelTheme.dropdown.background,
              borderColor: excelTheme.dropdown.border,
            }}
          >
            {SORT_FILTER_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => handleSortFilterAction(option.value)}
                className="w-full px-3 py-2 text-left text-sm transition-colors flex items-center gap-2"
                style={{
                  color: excelTheme.toolbar.text.primary,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = excelTheme.dropdown.item.hover;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <span className="w-4 text-center">{option.icon}</span>
                {option.label}
              </button>
            ))}
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
