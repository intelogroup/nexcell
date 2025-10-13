import { useAuth } from '@clerk/clerk-react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

export interface ApiResponse<T> {
  success?: boolean
  data?: T
  error?: string
  message?: string
}

/**
 * Custom hook to get authenticated API client
 */
export function useApi() {
  const { getToken } = useAuth()

  const fetchWithAuth = async <T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> => {
    const token = await getToken()

    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        message: 'An error occurred',
      }))
      throw new Error(error.message || `HTTP ${response.status}`)
    }

    return response.json()
  }

  return {
    get: <T>(endpoint: string) => fetchWithAuth<T>(endpoint, { method: 'GET' }),
    
    post: <T>(endpoint: string, data?: any) =>
      fetchWithAuth<T>(endpoint, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    
    put: <T>(endpoint: string, data?: any) =>
      fetchWithAuth<T>(endpoint, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    
    delete: <T>(endpoint: string) =>
      fetchWithAuth<T>(endpoint, { method: 'DELETE' }),
  }
}
