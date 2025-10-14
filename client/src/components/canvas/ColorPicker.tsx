/**
 * ColorPicker Component
 * Simple color picker for cell styling
 */

import { useState } from 'react';

interface ColorPickerProps {
  value?: string;
  onChange: (color: string) => void;
  label?: string;
}

// Common Excel colors
const PRESET_COLORS = [
  '#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF',
  '#800000', '#008000', '#000080', '#808000', '#800080', '#008080', '#C0C0C0', '#808080',
  '#9999FF', '#993366', '#FFFFCC', '#CCFFFF', '#660066', '#FF8080', '#0066CC', '#CCCCFF',
  '#000080', '#FF00FF', '#FFFF00', '#00FFFF', '#800080', '#800000', '#008080', '#0000FF',
];

export function ColorPicker({ value, onChange, label }: ColorPickerProps) {
  const [showPicker, setShowPicker] = useState(false);
  const [customColor, setCustomColor] = useState(value || '#000000');

  const handleColorSelect = (color: string) => {
    onChange(color);
    setShowPicker(false);
  };

  const handleCustomColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const color = e.target.value;
    setCustomColor(color);
    onChange(color);
  };

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setShowPicker(!showPicker)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50"
      >
        <div 
          className="w-5 h-5 rounded border border-gray-300" 
          style={{ backgroundColor: value || '#FFFFFF' }}
        />
        {label && <span>{label}</span>}
      </button>

      {showPicker && (
        <div className="absolute top-full left-0 mt-1 p-3 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
          {/* Preset colors grid */}
          <div className="grid grid-cols-8 gap-1 mb-3">
            {PRESET_COLORS.map((color) => (
              <button
                key={color}
                onClick={() => handleColorSelect(color)}
                className="w-6 h-6 rounded border border-gray-300 hover:scale-110 transition-transform"
                style={{ backgroundColor: color }}
                title={color}
              />
            ))}
          </div>

          {/* Custom color input */}
          <div className="border-t border-gray-200 pt-3">
            <label className="text-xs text-gray-600 block mb-1">
              Custom Color
            </label>
            <div className="flex gap-2">
              <input
                type="color"
                value={customColor}
                onChange={handleCustomColorChange}
                className="w-10 h-8 cursor-pointer"
              />
              <input
                type="text"
                value={customColor}
                onChange={(e) => setCustomColor(e.target.value)}
                onBlur={() => onChange(customColor)}
                className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded"
                placeholder="#000000"
              />
            </div>
          </div>

          {/* Close button */}
          <button
            onClick={() => setShowPicker(false)}
            className="mt-3 w-full px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded"
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}
