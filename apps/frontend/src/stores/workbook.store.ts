import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { formulaEngine } from '../lib/formula'

/**
 * Initialize formula engine on store creation
 */
function initializeFormulaEngine() {
  formulaEngine.initialize()
}

// Initialize formula engine when store is created
initializeFormulaEngine()

/**
 * Sheet structure
 */
export interface Sheet {
  name: string
  cells: Record<string, CellValue>
  formats?: Record<string, any>
}

/**
 * Cell value structure
 */
export interface CellValue {
  value?: string | number | boolean | null
  formula?: string
  format?: {
    bold?: boolean
    italic?: boolean
    underline?: boolean
    color?: string
    backgroundColor?: string
  }
}

/**
 * Workbook data structure
 */
export interface WorkbookData {
  sheets: Sheet[]
  metadata?: {
    activeSheet: string
    theme?: string
    created?: string
    modified?: string
  }
}

/**
 * Workbook metadata (from API)
 */
export interface Workbook {
  id: string
  name: string
  description: string | null
  version: number
  createdAt: string
  updatedAt: string
}

/**
 * Cell selection state
 */
export interface CellSelection {
  sheetName: string
  cellRef: string
  row: number
  col: number
}

/**
 * Workbook store state interface
 */
interface WorkbookState {
  // Current workbook metadata
  currentWorkbook: Workbook | null
  
  // Workbook data (sheets, cells)
  workbookData: WorkbookData | null
  
  // Current selection
  selectedCell: CellSelection | null
  
  // Loading states
  isLoading: boolean
  isSaving: boolean
  hasUnsavedChanges: boolean
  
  // Active sheet
  activeSheet: string | null
  
  // Actions
  setCurrentWorkbook: (workbook: Workbook | null) => void
  setWorkbookData: (data: WorkbookData | null) => void
  setActiveSheet: (sheetName: string) => void
  setSelectedCell: (selection: CellSelection | null) => void
  
  // Cell operations
  updateCell: (sheetName: string, cellRef: string, value: Partial<CellValue>) => void
  getCellValue: (sheetName: string, cellRef: string) => CellValue | undefined
  
  // Sheet operations
  addSheet: (name: string) => void
  deleteSheet: (name: string) => void
  renameSheet: (oldName: string, newName: string) => void
  
  // State management
  setLoading: (isLoading: boolean) => void
  setSaving: (isSaving: boolean) => void
  setUnsavedChanges: (hasChanges: boolean) => void
  
  // Clear state
  clearWorkbook: () => void
}

/**
 * Workbook store using Zustand
 */
export const useWorkbookStore = create<WorkbookState>()(
  devtools(
    (set, get) => ({
      // Initial state
      currentWorkbook: null,
      workbookData: null,
      selectedCell: null,
      isLoading: false,
      isSaving: false,
      hasUnsavedChanges: false,
      activeSheet: null,

      // Setters
      setCurrentWorkbook: (workbook) => {
        set({ currentWorkbook: workbook })
      },

      setWorkbookData: (data) => {
        // Load all sheets into formula engine if available
        if (data && data.sheets && data.sheets.length > 0) {
          formulaEngine.loadWorkbookData(data)
        }
        
        set({
          workbookData: data,
          activeSheet: data?.metadata?.activeSheet || data?.sheets[0]?.name || null,
        })
      },

      setActiveSheet: (sheetName) => {
        set({ activeSheet: sheetName })
      },

      setSelectedCell: (selection) => {
        set({ selectedCell: selection })
      },

      // Cell operations
      updateCell: (sheetName, cellRef, value) => {
        const { workbookData } = get()
        if (!workbookData) return

        const sheet = workbookData.sheets.find(s => s.name === sheetName)
        if (!sheet) return

        // Parse cell reference to get row/col indices
        const cellPos = formulaEngine.parseA1Notation(cellRef)
        if (!cellPos) return

        // Get the value to set (could be formula or plain value)
        const cellValue = value.formula || (value.value ?? '')

        // Update formula engine with new value (now requires sheet name)
        formulaEngine.setCellValue(sheetName, cellPos.row, cellPos.col, cellValue)

        // Get calculated value from formula engine (now requires sheet name)
        const calculatedValue = formulaEngine.getCellValue(sheetName, cellPos.row, cellPos.col)

        // Determine if it's a formula
        const isFormula = typeof cellValue === 'string' && cellValue.startsWith('=')

        // Convert HyperFormula CellValue to our format
        let normalizedValue: string | number | boolean | null = null
        if (calculatedValue !== null && calculatedValue !== undefined) {
          if (typeof calculatedValue === 'object' && 'value' in calculatedValue) {
            // It's an error object from HyperFormula
            normalizedValue = String(calculatedValue)
          } else {
            normalizedValue = calculatedValue as string | number | boolean
          }
        }

        // Create updated cell object
        const updatedCell: CellValue = {
          value: isFormula ? normalizedValue : cellValue as string | number | boolean | null,
          formula: isFormula ? cellValue as string : undefined,
          format: value.format
        }

        const updatedWorkbookData: WorkbookData = {
          ...workbookData,
          sheets: workbookData.sheets.map(s =>
            s.name === sheetName
              ? {
                  ...s,
                  cells: {
                    ...s.cells,
                    [cellRef]: updatedCell
                  }
                }
              : s
          )
        }

        set({
          workbookData: updatedWorkbookData,
          hasUnsavedChanges: true
        })
      },

      getCellValue: (sheetName, cellRef) => {
        const { workbookData } = get()
        if (!workbookData) return undefined

        const sheet = workbookData.sheets.find(s => s.name === sheetName)
        return sheet?.cells[cellRef]
      },

      // Sheet operations
      addSheet: (name) => {
        const { workbookData } = get()
        if (!workbookData) return

        const newSheet: Sheet = {
          name,
          cells: {},
          formats: {}
        }

        // Add sheet to formula engine
        formulaEngine.addSheet(name)

        set({
          workbookData: {
            ...workbookData,
            sheets: [...workbookData.sheets, newSheet]
          },
          hasUnsavedChanges: true
        })
      },

      deleteSheet: (name) => {
        const { workbookData, activeSheet } = get()
        if (!workbookData || workbookData.sheets.length === 1) {
          // Can't delete the last sheet
          return
        }

        const updatedSheets = workbookData.sheets.filter(s => s.name !== name)
        const newActiveSheet = activeSheet === name ? updatedSheets[0].name : activeSheet

        // Remove sheet from formula engine
        formulaEngine.removeSheet(name)

        set({
          workbookData: {
            ...workbookData,
            sheets: updatedSheets
          },
          activeSheet: newActiveSheet,
          hasUnsavedChanges: true
        })
      },

      renameSheet: (oldName, newName) => {
        const { workbookData, activeSheet } = get()
        if (!workbookData) return

        // Rename sheet in formula engine
        formulaEngine.renameSheet(oldName, newName)

        set({
          workbookData: {
            ...workbookData,
            sheets: workbookData.sheets.map(s =>
              s.name === oldName ? { ...s, name: newName } : s
            )
          },
          activeSheet: activeSheet === oldName ? newName : activeSheet,
          hasUnsavedChanges: true
        })
      },

      // State management
      setLoading: (isLoading) => {
        set({ isLoading })
      },

      setSaving: (isSaving) => {
        set({ isSaving })
      },

      setUnsavedChanges: (hasUnsavedChanges) => {
        set({ hasUnsavedChanges })
      },

      // Clear state
      clearWorkbook: () => {
        set({
          currentWorkbook: null,
          workbookData: null,
          selectedCell: null,
          activeSheet: null,
          isLoading: false,
          isSaving: false,
          hasUnsavedChanges: false
        })
      }
    }),
    {
      name: 'WorkbookStore',
      enabled: import.meta.env.DEV,
    }
  )
)

// Selectors for common queries
export const useCurrentWorkbook = () => useWorkbookStore((state) => state.currentWorkbook)
export const useWorkbookData = () => useWorkbookStore((state) => state.workbookData)
export const useActiveSheet = () => useWorkbookStore((state) => state.activeSheet)
export const useSelectedCell = () => useWorkbookStore((state) => state.selectedCell)
export const useHasUnsavedChanges = () => useWorkbookStore((state) => state.hasUnsavedChanges)
