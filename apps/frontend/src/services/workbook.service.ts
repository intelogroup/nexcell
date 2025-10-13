import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@clerk/clerk-react'
import { useApi } from '../lib/api'
import { useWorkbookStore } from '../stores/workbook.store'

/**
 * Workbook interfaces
 */
export interface Workbook {
  id: string
  name: string
  description: string | null
  version: number
  createdAt: string
  updatedAt: string
}

export interface WorkbookWithData extends Workbook {
  data: any
}

export interface CreateWorkbookInput {
  name: string
  description?: string
  data?: any
}

export interface UpdateWorkbookInput {
  name?: string
  description?: string
  data?: any
}

/**
 * Get all workbooks for the current user
 */
export function useWorkbooks() {
  const api = useApi()
  
  return useQuery({
    queryKey: ['workbooks'],
    queryFn: async () => {
      const response = await api.get<{ workbooks: Workbook[] }>('/api/workbooks')
      return response.workbooks
    }
  })
}

/**
 * Get a single workbook with data
 */
export function useWorkbook(id: string | undefined) {
  const api = useApi()
  const setCurrentWorkbook = useWorkbookStore(state => state.setCurrentWorkbook)
  const setWorkbookData = useWorkbookStore(state => state.setWorkbookData)
  
  return useQuery({
    queryKey: ['workbook', id],
    queryFn: async () => {
      const response = await api.get<{ workbook: WorkbookWithData }>(`/api/workbooks/${id}`)
      const workbook = response.workbook
      
      // Update store
      setCurrentWorkbook({
        id: workbook.id,
        name: workbook.name,
        description: workbook.description,
        version: workbook.version,
        createdAt: workbook.createdAt,
        updatedAt: workbook.updatedAt,
      })
      setWorkbookData(workbook.data)
      
      return workbook
    },
    enabled: !!id,
  })
}

/**
 * Create a new workbook
 */
export function useCreateWorkbook() {
  const api = useApi()
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (input: CreateWorkbookInput) => {
      const response = await api.post<{ workbook: Workbook }>('/api/workbooks', input)
      return response.workbook
    },
    onSuccess: () => {
      // Invalidate workbooks list to refetch
      queryClient.invalidateQueries({ queryKey: ['workbooks'] })
    }
  })
}

/**
 * Update a workbook
 */
export function useUpdateWorkbook(id: string) {
  const api = useApi()
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (input: UpdateWorkbookInput) => {
      const response = await api.put<{ workbook: Workbook }>(`/api/workbooks/${id}`, input)
      return response.workbook
    },
    onSuccess: () => {
      // Invalidate queries to refetch data
      queryClient.invalidateQueries({ queryKey: ['workbooks'] })
      queryClient.invalidateQueries({ queryKey: ['workbook', id] })
    }
  })
}

/**
 * Delete a workbook
 */
export function useDeleteWorkbook() {
  const api = useApi()
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/workbooks/${id}`)
      return id
    },
    onSuccess: () => {
      // Invalidate workbooks list
      queryClient.invalidateQueries({ queryKey: ['workbooks'] })
    }
  })
}

/**
 * Save workbook (update with current data)
 */
export function useSaveWorkbook(id: string) {
  const api = useApi()
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (input: UpdateWorkbookInput) => {
      const response = await api.put<{ workbook: Workbook }>(`/api/workbooks/${id}`, input)
      return response.workbook
    },
    onSuccess: () => {
      // Invalidate queries to refetch data
      queryClient.invalidateQueries({ queryKey: ['workbooks'] })
      queryClient.invalidateQueries({ queryKey: ['workbook', id] })
    }
  })
}

/**
 * Get all templates
 */
export function useTemplates(category?: string) {
  const api = useApi()
  
  return useQuery({
    queryKey: ['templates', category],
    queryFn: async () => {
      const params = category ? `?category=${category}` : ''
      const response = await api.get<{ templates: any[] }>(`/api/templates${params}`)
      return response.templates
    }
  })
}

/**
 * Create workbook from template
 */
export function useCreateFromTemplate() {
  const api = useApi()
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ templateId, name, description }: {
      templateId: string
      name: string
      description?: string
    }) => {
      const response = await api.post<{ workbook: Workbook }>(`/api/templates/${templateId}/create`, { name, description })
      return response.workbook
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workbooks'] })
    }
  })
}

/**
 * Export workbook as Excel file
 */
export function useExportWorkbook() {
  const { getToken } = useAuth()

  return useMutation({
    mutationFn: async ({ id, filename }: { id: string; filename: string }) => {
      const token = await getToken()
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

      const response = await fetch(`${API_URL}/api/workbooks/${id}/export/xlsx`, {
        method: 'GET',
        headers: {
          ...(token && { Authorization: `Bearer ${token}` }),
        },
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({
          message: 'Export failed',
        }))
        throw new Error(error.message || `HTTP ${response.status}`)
      }

      // Get the blob from response
      const blob = await response.blob()

      // Create a download link and trigger download
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`
      document.body.appendChild(a)
      a.click()
      
      // Cleanup
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    }
  })
}
