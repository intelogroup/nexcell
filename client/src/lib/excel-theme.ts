/**
 * Excel-like Color Theme Configuration
 * Based on Microsoft Excel's Fluent Design System and brand colors
 */

export const excelTheme = {
  // Primary Excel green colors (based on #1D6F42)
  primary: {
    50: '#f0f9f4',   // Very light green tint
    100: '#dcf4e6',  // Light green background
    200: '#bae8cc',  // Subtle green
    300: '#8dd5a8',  // Medium light green
    400: '#5cb87e',  // Active green
    500: '#1d6f42',  // Excel brand green
    600: '#196238',  // Darker green
    700: '#15502e',  // Deep green
    800: '#124025',  // Very deep green
    900: '#0f331d',  // Darkest green
  },

  // Toolbar specific colors
  toolbar: {
    // Background colors
    background: '#f8fdf9',        // Very light green tint for toolbar background
    backgroundHover: '#f0f9f4',   // Slightly darker on hover
    backgroundActive: '#dcf4e6',  // Active state background
    
    // Border colors
    border: '#e5f3e8',           // Light green border
    borderActive: '#bae8cc',     // Active border color
    
    // Button states
    button: {
      default: 'transparent',
      hover: '#f0f9f4',
      active: '#dcf4e6',
      pressed: '#bae8cc',
      selected: '#5cb87e',       // Selected button background
      selectedText: '#ffffff',   // Selected button text
    },
    
    // Text colors
    text: {
      primary: '#124025',        // Dark green for primary text
      secondary: '#196238',      // Medium green for secondary text
      muted: '#5cb87e',         // Light green for muted text
      inverse: '#ffffff',       // White text for dark backgrounds
    },
    
    // Icon colors
    icon: {
      default: '#196238',       // Default icon color
      hover: '#124025',         // Darker on hover
      active: '#5cb87e',        // Active state
      disabled: '#8dd5a8',      // Disabled state
    },
  },

  // Dropdown and picker colors
  dropdown: {
    background: '#ffffff',
    border: '#e5f3e8',
    shadow: 'rgba(29, 111, 66, 0.1)',
    item: {
      hover: '#f0f9f4',
      selected: '#dcf4e6',
      selectedText: '#124025',
    },
  },

  // Canvas specific colors
  canvas: {
    background: '#ffffff',        // White canvas background
    gridLines: '#e5f3e8',        // Light green grid lines
    border: '#e5f3e8',           // Canvas border color
  },

  // Focus and selection states
  focus: {
    ring: '#5cb87e',
    ringOffset: '#ffffff',
  },

  // Status colors (keeping Excel-like but with green tint)
  status: {
    success: '#22c55e',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#3b82f6',
  },
} as const;

// CSS custom properties for easy usage
export const excelThemeCSS = `
  :root {
    --excel-primary-50: ${excelTheme.primary[50]};
    --excel-primary-100: ${excelTheme.primary[100]};
    --excel-primary-200: ${excelTheme.primary[200]};
    --excel-primary-300: ${excelTheme.primary[300]};
    --excel-primary-400: ${excelTheme.primary[400]};
    --excel-primary-500: ${excelTheme.primary[500]};
    --excel-primary-600: ${excelTheme.primary[600]};
    --excel-primary-700: ${excelTheme.primary[700]};
    --excel-primary-800: ${excelTheme.primary[800]};
    --excel-primary-900: ${excelTheme.primary[900]};
    
    --excel-toolbar-bg: ${excelTheme.toolbar.background};
    --excel-toolbar-bg-hover: ${excelTheme.toolbar.backgroundHover};
    --excel-toolbar-bg-active: ${excelTheme.toolbar.backgroundActive};
    --excel-toolbar-border: ${excelTheme.toolbar.border};
    --excel-toolbar-border-active: ${excelTheme.toolbar.borderActive};
    
    --excel-button-hover: ${excelTheme.toolbar.button.hover};
    --excel-button-active: ${excelTheme.toolbar.button.active};
    --excel-button-selected: ${excelTheme.toolbar.button.selected};
    --excel-button-selected-text: ${excelTheme.toolbar.button.selectedText};
    
    --excel-text-primary: ${excelTheme.toolbar.text.primary};
    --excel-text-secondary: ${excelTheme.toolbar.text.secondary};
    --excel-text-muted: ${excelTheme.toolbar.text.muted};
    
    --excel-icon-default: ${excelTheme.toolbar.icon.default};
    --excel-icon-hover: ${excelTheme.toolbar.icon.hover};
    --excel-icon-active: ${excelTheme.toolbar.icon.active};
    
    --excel-dropdown-bg: ${excelTheme.dropdown.background};
    --excel-dropdown-border: ${excelTheme.dropdown.border};
    --excel-dropdown-shadow: ${excelTheme.dropdown.shadow};
    --excel-dropdown-item-hover: ${excelTheme.dropdown.item.hover};
    --excel-dropdown-item-selected: ${excelTheme.dropdown.item.selected};
    
    --excel-focus-ring: ${excelTheme.focus.ring};
  }
`;

// Utility function to get theme colors
export const getExcelColor = (path: string) => {
  const keys = path.split('.');
  let value: any = excelTheme;
  
  for (const key of keys) {
    value = value[key];
    if (value === undefined) {
      console.warn(`Excel theme color not found: ${path}`);
      return '#1d6f42'; // Fallback to Excel brand color
    }
  }
  
  return value;
};

export default excelTheme;