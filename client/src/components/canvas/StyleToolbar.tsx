/**
 * StyleToolbar Component
 * Extended formatting toolbar with alignment, font size, and additional style options
 */

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { ColorPicker } from './ColorPicker';
import type { CellStyle } from '@/lib/workbook/types';

interface StyleToolbarProps {
  selectedCell?: {
    address: string;
    style?: CellStyle;
  };
  onStyleChange: (style: Partial<CellStyle>) => void;
  disabled?: boolean;
}

const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 72];

const FONT_FAMILIES = [
  'Arial',
  'Calibri',
  'Courier New',
  'Georgia',
  'Times New Roman',
  'Verdana',
  'Comic Sans MS',
  'Impact',
];

export function StyleToolbar({ selectedCell, onStyleChange, disabled }: StyleToolbarProps) {
  const [showFontSize, setShowFontSize] = useState(false);
  const [showFontFamily, setShowFontFamily] = useState(false);

  const currentStyle = selectedCell?.style || {};

  const handleAlignmentChange = (
    horizontal?: 'left' | 'center' | 'right',
    vertical?: 'top' | 'middle' | 'bottom'
  ) => {
    onStyleChange({
      alignment: {
        ...currentStyle.alignment,
        horizontal: horizontal || currentStyle.alignment?.horizontal || 'left',
        vertical: vertical || currentStyle.alignment?.vertical || 'top',
      },
    });
  };

  const handleFontSizeChange = (size: number) => {
    onStyleChange({ fontSize: size });
    setShowFontSize(false);
  };

  const handleFontFamilyChange = (family: string) => {
    onStyleChange({ fontFamily: family });
    setShowFontFamily(false);
  };

  const handleTextColorChange = (color: string) => {
    onStyleChange({ color });
  };

  const handleBgColorChange = (color: string) => {
    onStyleChange({ bgColor: color });
  };

  const currentFontSize = currentStyle.fontSize || 11;
  const currentFontFamily = currentStyle.fontFamily || 'Arial';
  const currentHAlign = currentStyle.alignment?.horizontal || 'left';
  const currentVAlign = currentStyle.alignment?.vertical || 'top';

  return (
    <div className="h-10 border-b border-gray-200 bg-white flex items-center px-4 gap-2">
      {/* Font Family */}
      <div className="relative">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setShowFontFamily(!showFontFamily)}
          disabled={disabled}
          className="min-w-[100px] justify-start text-xs"
        >
          {currentFontFamily}
        </Button>

        {showFontFamily && (
          <div className="absolute top-full left-0 mt-1 w-40 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
            {FONT_FAMILIES.map((family) => (
              <button
                key={family}
                onClick={() => handleFontFamilyChange(family)}
                style={{ fontFamily: family }}
                className={`
                  w-full text-left px-3 py-2 text-sm hover:bg-gray-100
                  ${currentFontFamily === family ? 'bg-blue-50 text-blue-700' : 'text-gray-700'}
                `}
              >
                {family}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Font Size */}
      <div className="relative">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setShowFontSize(!showFontSize)}
          disabled={disabled}
          className="w-16 justify-start text-xs"
        >
          {currentFontSize}
        </Button>

        {showFontSize && (
          <div className="absolute top-full left-0 mt-1 w-20 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
            {FONT_SIZES.map((size) => (
              <button
                key={size}
                onClick={() => handleFontSizeChange(size)}
                className={`
                  w-full text-left px-3 py-2 text-sm hover:bg-gray-100
                  ${currentFontSize === size ? 'bg-blue-50 text-blue-700' : 'text-gray-700'}
                `}
              >
                {size}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Colors */}
      <div className="flex items-center gap-1 pl-2 border-l border-gray-200">
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

      {/* Horizontal Alignment */}
      <div className="flex items-center gap-1 pl-2 border-l border-gray-200">
        <Button
          size="sm"
          variant={currentHAlign === 'left' ? 'primary' : 'ghost'}
          onClick={() => handleAlignmentChange('left', undefined)}
          disabled={disabled}
          title="Align Left"
          className="w-8 h-8 p-0"
        >
          ≡
        </Button>
        <Button
          size="sm"
          variant={currentHAlign === 'center' ? 'primary' : 'ghost'}
          onClick={() => handleAlignmentChange('center', undefined)}
          disabled={disabled}
          title="Align Center"
          className="w-8 h-8 p-0"
        >
          ≣
        </Button>
        <Button
          size="sm"
          variant={currentHAlign === 'right' ? 'primary' : 'ghost'}
          onClick={() => handleAlignmentChange('right', undefined)}
          disabled={disabled}
          title="Align Right"
          className="w-8 h-8 p-0"
        >
          ≡
        </Button>
      </div>

      {/* Vertical Alignment */}
      <div className="flex items-center gap-1 pl-2 border-l border-gray-200">
        <Button
          size="sm"
          variant={currentVAlign === 'top' ? 'primary' : 'ghost'}
          onClick={() => handleAlignmentChange(undefined, 'top')}
          disabled={disabled}
          title="Align Top"
          className="w-8 h-8 p-0"
        >
          ↑
        </Button>
        <Button
          size="sm"
          variant={currentVAlign === 'middle' ? 'primary' : 'ghost'}
          onClick={() => handleAlignmentChange(undefined, 'middle')}
          disabled={disabled}
          title="Align Middle"
          className="w-8 h-8 p-0"
        >
          ↕
        </Button>
        <Button
          size="sm"
          variant={currentVAlign === 'bottom' ? 'primary' : 'ghost'}
          onClick={() => handleAlignmentChange(undefined, 'bottom')}
          disabled={disabled}
          title="Align Bottom"
          className="w-8 h-8 p-0"
        >
          ↓
        </Button>
      </div>
    </div>
  );
}
