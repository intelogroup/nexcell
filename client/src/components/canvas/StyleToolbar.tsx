/**
 * StyleToolbar Component
 * Extended formatting toolbar with alignment, font size, and additional style options
 */

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { ColorPicker } from './ColorPicker';
import type { CellStyle } from '@/lib/workbook/types';
import { excelTheme } from '../../lib/excel-theme';

interface StyleToolbarProps {
  selectedCell?: {
    address: string;
    style?: CellStyle;
  };
  onStyleChange: (style: Partial<CellStyle>) => void;
  onMergeCells?: () => void;
  onUnmergeCells?: () => void;
  onFindReplace?: () => void;
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

export function StyleToolbar({ selectedCell, onStyleChange, onMergeCells, onUnmergeCells, onFindReplace, disabled }: StyleToolbarProps) {
  const [showFontSize, setShowFontSize] = useState(false);
  const [showFontFamily, setShowFontFamily] = useState(false);

  const currentStyle = selectedCell?.style || {};

  const handleWrapTextToggle = () => {
    onStyleChange({ 
      alignment: {
        ...currentStyle.alignment,
        wrapText: !currentStyle.alignment?.wrapText
      }
    });
  };

  const handleIndentChange = (direction: 'increase' | 'decrease') => {
    const currentIndent = currentStyle.alignment?.indent || 0;
    const newIndent = direction === 'increase' 
      ? Math.min(currentIndent + 1, 10) // Max indent of 10
      : Math.max(currentIndent - 1, 0);  // Min indent of 0
    
    onStyleChange({ 
      alignment: {
        ...currentStyle.alignment,
        indent: newIndent
      }
    });
  };

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
    <div 
      className="flex items-center gap-2 px-4 py-2"
      style={{ 
        height: '40px',
        borderBottom: `1px solid ${excelTheme.toolbar.border}`,
        backgroundColor: excelTheme.toolbar.background 
      }}
    >
      {/* Font Family */}
      <div className="relative">
        <button
          onClick={() => setShowFontFamily(!showFontFamily)}
          className="flex items-center gap-1 px-3 py-1 text-sm border rounded transition-colors"
          style={{
            backgroundColor: showFontFamily ? excelTheme.toolbar.button.active : 'transparent',
            color: excelTheme.toolbar.text.primary,
            borderColor: excelTheme.toolbar.border,
          }}
          onMouseEnter={(e) => {
            if (!showFontFamily) {
              e.currentTarget.style.backgroundColor = excelTheme.toolbar.button.hover;
            }
          }}
          onMouseLeave={(e) => {
            if (!showFontFamily) {
              e.currentTarget.style.backgroundColor = 'transparent';
            }
          }}
        >
          {currentFontFamily}
        </button>

        {showFontFamily && (
            <div 
              className="absolute top-full left-0 mt-1 w-48 rounded-md shadow-lg z-10"
              style={{
                backgroundColor: excelTheme.dropdown.background,
                border: `1px solid ${excelTheme.dropdown.border}`,
                boxShadow: excelTheme.dropdown.shadow,
              }}
            >
              <div className="max-h-64 overflow-y-auto">
                {FONT_FAMILIES.map((family) => (
                  <button
                    key={family}
                    onClick={() => handleFontFamilyChange(family)}
                    className="w-full text-left px-3 py-2 text-sm transition-colors"
                    style={{
                      fontFamily: family,
                      backgroundColor: currentFontFamily === family ? excelTheme.dropdown.item.selected : 'transparent',
                      color: currentFontFamily === family ? excelTheme.dropdown.item.selectedText : excelTheme.toolbar.text.primary,
                    }}
                    onMouseEnter={(e) => {
                      if (currentFontFamily !== family) {
                        e.currentTarget.style.backgroundColor = excelTheme.dropdown.item.hover;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (currentFontFamily !== family) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }
                    }}
                  >
                    {family}
                  </button>
                ))}
              </div>
          </div>
        )}
      </div>

      {/* Font Size */}
      <div className="relative">
        <button
          onClick={() => setShowFontSize(!showFontSize)}
          className="flex items-center gap-1 px-3 py-1 text-sm border rounded transition-colors"
          style={{
            backgroundColor: showFontSize ? excelTheme.toolbar.button.active : 'transparent',
            color: excelTheme.toolbar.text.primary,
            borderColor: excelTheme.toolbar.border,
          }}
          onMouseEnter={(e) => {
            if (!showFontSize) {
              e.currentTarget.style.backgroundColor = excelTheme.toolbar.button.hover;
            }
          }}
          onMouseLeave={(e) => {
            if (!showFontSize) {
              e.currentTarget.style.backgroundColor = 'transparent';
            }
          }}
        >
          {currentFontSize}
        </button>

        {showFontSize && (
          <div 
            className="absolute top-full left-0 mt-1 w-24 rounded-md shadow-lg z-10"
            style={{
              backgroundColor: excelTheme.dropdown.background,
              border: `1px solid ${excelTheme.dropdown.border}`,
              boxShadow: excelTheme.dropdown.shadow,
            }}
          >
            <div className="max-h-64 overflow-y-auto">
              {FONT_SIZES.map((size) => (
                <button
                  key={size}
                  onClick={() => handleFontSizeChange(size)}
                  className="w-full text-left px-3 py-2 text-sm transition-colors"
                  style={{
                    backgroundColor: currentFontSize === size ? excelTheme.dropdown.item.selected : 'transparent',
                    color: currentFontSize === size ? excelTheme.dropdown.item.selectedText : excelTheme.toolbar.text.primary,
                  }}
                  onMouseEnter={(e) => {
                    if (currentFontSize !== size) {
                      e.currentTarget.style.backgroundColor = excelTheme.dropdown.item.hover;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (currentFontSize !== size) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }
                  }}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Colors */}
      <div 
        className="flex items-center gap-1 pl-2"
        style={{ borderLeft: `1px solid ${excelTheme.toolbar.border}` }}
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

      {/* Horizontal Alignment */}
      <div 
        className="flex items-center gap-1 pl-2"
        style={{ borderLeft: `1px solid ${excelTheme.toolbar.border}` }}
      >
        <button
          onClick={() => handleAlignmentChange('left', undefined)}
          disabled={disabled}
          title="Align Left"
          className="w-8 h-8 p-0 rounded transition-colors"
          style={{
            backgroundColor: currentHAlign === 'left' ? excelTheme.toolbar.button.selected : 'transparent',
            color: currentHAlign === 'left' ? excelTheme.toolbar.button.selectedText : excelTheme.toolbar.text.primary,
          }}
          onMouseEnter={(e) => {
            if (currentHAlign !== 'left') {
              e.currentTarget.style.backgroundColor = excelTheme.toolbar.button.hover;
            }
          }}
          onMouseLeave={(e) => {
            if (currentHAlign !== 'left') {
              e.currentTarget.style.backgroundColor = 'transparent';
            }
          }}
        >
          ≡
        </button>
        <button
          onClick={() => handleAlignmentChange('center', undefined)}
          disabled={disabled}
          title="Align Center"
          className="w-8 h-8 p-0 rounded transition-colors"
          style={{
            backgroundColor: currentHAlign === 'center' ? excelTheme.toolbar.button.selected : 'transparent',
            color: currentHAlign === 'center' ? excelTheme.toolbar.button.selectedText : excelTheme.toolbar.text.primary,
          }}
          onMouseEnter={(e) => {
            if (currentHAlign !== 'center') {
              e.currentTarget.style.backgroundColor = excelTheme.toolbar.button.hover;
            }
          }}
          onMouseLeave={(e) => {
            if (currentHAlign !== 'center') {
              e.currentTarget.style.backgroundColor = 'transparent';
            }
          }}
        >
          ≣
        </button>
        <button
          onClick={() => handleAlignmentChange('right', undefined)}
          disabled={disabled}
          title="Align Right"
          className="w-8 h-8 p-0 rounded transition-colors"
          style={{
            backgroundColor: currentHAlign === 'right' ? excelTheme.toolbar.button.selected : 'transparent',
            color: currentHAlign === 'right' ? excelTheme.toolbar.button.selectedText : excelTheme.toolbar.text.primary,
          }}
          onMouseEnter={(e) => {
            if (currentHAlign !== 'right') {
              e.currentTarget.style.backgroundColor = excelTheme.toolbar.button.hover;
            }
          }}
          onMouseLeave={(e) => {
            if (currentHAlign !== 'right') {
              e.currentTarget.style.backgroundColor = 'transparent';
            }
          }}
        >
          ≡
        </button>
      </div>

      {/* Vertical Alignment */}
      <div 
        className="flex items-center gap-1 pl-2"
        style={{ borderLeft: `1px solid ${excelTheme.toolbar.border}` }}
      >
        <button
          onClick={() => handleAlignmentChange(undefined, 'top')}
          disabled={disabled}
          title="Align Top"
          className="w-8 h-8 p-0 rounded transition-colors"
          style={{
            backgroundColor: currentVAlign === 'top' ? excelTheme.toolbar.button.selected : 'transparent',
            color: currentVAlign === 'top' ? excelTheme.toolbar.button.selectedText : excelTheme.toolbar.text.primary,
          }}
          onMouseEnter={(e) => {
            if (currentVAlign !== 'top') {
              e.currentTarget.style.backgroundColor = excelTheme.toolbar.button.hover;
            }
          }}
          onMouseLeave={(e) => {
            if (currentVAlign !== 'top') {
              e.currentTarget.style.backgroundColor = 'transparent';
            }
          }}
        >
          ↑
        </button>
        <button
          onClick={() => handleAlignmentChange(undefined, 'middle')}
          disabled={disabled}
          title="Align Middle"
          className="w-8 h-8 p-0 rounded transition-colors"
          style={{
            backgroundColor: currentVAlign === 'middle' ? excelTheme.toolbar.button.selected : 'transparent',
            color: currentVAlign === 'middle' ? excelTheme.toolbar.button.selectedText : excelTheme.toolbar.text.primary,
          }}
          onMouseEnter={(e) => {
            if (currentVAlign !== 'middle') {
              e.currentTarget.style.backgroundColor = excelTheme.toolbar.button.hover;
            }
          }}
          onMouseLeave={(e) => {
            if (currentVAlign !== 'middle') {
              e.currentTarget.style.backgroundColor = 'transparent';
            }
          }}
        >
          ↕
        </button>
        <button
          onClick={() => handleAlignmentChange(undefined, 'bottom')}
          disabled={disabled}
          title="Align Bottom"
          className="w-8 h-8 p-0 rounded transition-colors"
          style={{
            backgroundColor: currentVAlign === 'bottom' ? excelTheme.toolbar.button.selected : 'transparent',
            color: currentVAlign === 'bottom' ? excelTheme.toolbar.button.selectedText : excelTheme.toolbar.text.primary,
          }}
          onMouseEnter={(e) => {
            if (currentVAlign !== 'bottom') {
              e.currentTarget.style.backgroundColor = excelTheme.toolbar.button.hover;
            }
          }}
          onMouseLeave={(e) => {
            if (currentVAlign !== 'bottom') {
              e.currentTarget.style.backgroundColor = 'transparent';
            }
          }}
        >
          ↓
        </button>
      </div>

      {/* Merge Cells */}
      <div 
        className="flex items-center gap-1 pl-2 border-l"
        style={{ borderColor: excelTheme.toolbar.border }}
      >
        <Button
          size="sm"
          variant="ghost"
          onClick={onMergeCells}
          disabled={disabled || !onMergeCells}
          title="Merge Cells"
          className="px-3 h-8 text-xs transition-colors"
          style={{
            backgroundColor: 'transparent',
            color: excelTheme.toolbar.text.primary,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = excelTheme.toolbar.button.hover;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          Merge
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onUnmergeCells}
          disabled={disabled || !onUnmergeCells}
          title="Unmerge Cells"
          className="px-3 h-8 text-xs transition-colors"
          style={{
            backgroundColor: 'transparent',
            color: excelTheme.toolbar.text.primary,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = excelTheme.toolbar.button.hover;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
           Unmerge
         </Button>
       </div>

       {/* Wrap Text */}
       <div 
         className="flex items-center pl-2 border-l"
         style={{ borderColor: excelTheme.toolbar.border }}
       >
         <Button
           size="sm"
           variant="ghost"
           onClick={handleWrapTextToggle}
           disabled={disabled}
           title="Wrap Text"
           className="px-3 h-8 text-xs transition-colors"
           style={{
             backgroundColor: currentStyle.alignment?.wrapText ? excelTheme.toolbar.button.selected : 'transparent',
             color: currentStyle.alignment?.wrapText ? excelTheme.toolbar.button.selectedText : excelTheme.toolbar.text.primary,
           }}
           onMouseEnter={(e) => {
             if (!currentStyle.alignment?.wrapText) {
               e.currentTarget.style.backgroundColor = excelTheme.toolbar.button.hover;
             }
           }}
           onMouseLeave={(e) => {
             if (!currentStyle.alignment?.wrapText) {
               e.currentTarget.style.backgroundColor = 'transparent';
             }
           }}
         >
           Wrap Text
         </Button>
       </div>

       {/* Indent Tools */}
       <div 
         className="flex items-center pl-2 border-l"
         style={{ borderColor: excelTheme.toolbar.border }}
       >
         <Button
           size="sm"
           variant="ghost"
           onClick={() => handleIndentChange('decrease')}
           disabled={disabled || (currentStyle.alignment?.indent || 0) === 0}
           title="Decrease Indent"
           className="px-2 h-8 text-xs transition-colors"
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
           ⬅
         </Button>
         <Button
           size="sm"
           variant="ghost"
           onClick={() => handleIndentChange('increase')}
           disabled={disabled || (currentStyle.alignment?.indent || 0) >= 10}
           title="Increase Indent"
           className="px-2 h-8 text-xs transition-colors"
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
           ➡
         </Button>
       </div>

       {/* Find & Replace */}
       <div 
         className="flex items-center pl-2 border-l"
         style={{ borderColor: excelTheme.toolbar.border }}
       >
         <Button
           size="sm"
           variant="ghost"
           onClick={onFindReplace}
           disabled={disabled || !onFindReplace}
           title="Find & Replace"
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
           Find & Replace
         </Button>
       </div>
     </div>
  );
}
