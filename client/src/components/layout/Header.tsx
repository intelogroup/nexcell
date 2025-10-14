import { useState } from 'react';
import { Download, Settings, ChevronDown } from 'lucide-react';

interface HeaderProps {
  workbookName: string;
  onWorkbookNameChange: (name: string) => void;
  onExportXLSX?: () => void;
  onExportJSON?: () => void;
  onOpenSettings?: () => void;
}

export function Header({ workbookName, onWorkbookNameChange, onExportXLSX, onExportJSON, onOpenSettings }: HeaderProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(workbookName);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const handleBlur = () => {
    setIsEditing(false);
    if (name.trim()) {
      onWorkbookNameChange(name.trim());
    } else {
      setName(workbookName);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleBlur();
    } else if (e.key === 'Escape') {
      setName(workbookName);
      setIsEditing(false);
    }
  };

  return (
    <header className="h-14 border-b border-gray-200 bg-white px-6 flex items-center justify-between">
      {/* Left section */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-md bg-gradient-to-br from-accent-500 to-accent-600 flex items-center justify-center">
            <span className="text-white font-bold text-sm">N</span>
          </div>
          <span className="font-semibold text-gray-900 hidden sm:inline">Nexcell</span>
        </div>
        
        <div className="h-6 w-px bg-gray-200" />
        
        {isEditing ? (
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className="text-sm font-medium text-gray-900 bg-transparent border-b border-accent-500 focus:outline-none px-1"
            autoFocus
          />
        ) : (
          <button
            onClick={() => setIsEditing(true)}
            className="text-sm font-medium text-gray-900 hover:text-accent-500 transition-colors px-1"
          >
            {workbookName}
          </button>
        )}
      </div>

      {/* Right section */}
      <div className="flex items-center gap-3">
        {(onExportXLSX || onExportJSON) && (
          <div className="relative">
            <button 
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="h-8 px-3 rounded-md hover:bg-gray-100 flex items-center gap-2 transition-colors text-sm font-medium text-gray-700"
              title="Export workbook"
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Export</span>
              <ChevronDown className="h-3 w-3" />
            </button>
            
            {showExportMenu && (
              <>
                <div 
                  className="fixed inset-0 z-10" 
                  onClick={() => setShowExportMenu(false)}
                />
                <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-20">
                  <div className="py-1">
                    {onExportXLSX && (
                      <button
                        onClick={() => {
                          onExportXLSX();
                          setShowExportMenu(false);
                        }}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        Export as Excel (.xlsx)
                      </button>
                    )}
                    {onExportJSON && (
                      <button
                        onClick={() => {
                          onExportJSON();
                          setShowExportMenu(false);
                        }}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        Export as JSON
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
        {onOpenSettings && (
          <button 
            onClick={onOpenSettings}
            className="h-8 w-8 rounded-md hover:bg-gray-100 flex items-center justify-center transition-colors"
            title="Settings"
          >
            <Settings className="h-4 w-4 text-gray-600" />
          </button>
        )}
      </div>
    </header>
  );
}
