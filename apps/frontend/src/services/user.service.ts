import { useAuth, useUser } from '@clerk/clerk-react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useApi } from '../lib/api'

export interface User {
  id: string
  clerkId: string
  email: string
  firstName?: string
  lastName?: string
  createdAt: string
  updatedAt?: string
}

export interface SyncUserResponse {
  success: boolean
  user: User
}

export interface GetUserResponse {
  user: User
}

/**
 * Hook to sync Clerk user with backend database
 */
export function useSyncUser() {
  const api = useApi()
  const { user: clerkUser } = useUser()

  return useMutation({
    mutationFn: async () => {
      if (!clerkUser) {
        throw new Error('No user logged in')
      }

      return api.post<SyncUserResponse>('/api/auth/sync', {
        clerkId: clerkUser.id,
        email: clerkUser.primaryEmailAddress?.emailAddress,
        firstName: clerkUser.firstName,
        lastName: clerkUser.lastName,
      })
    },
  })
}

/**
 * Hook to get current user from backend
 */
export function useGetUser() {
  const api = useApi()
  const { isSignedIn } = useAuth()

  return useQuery({
    queryKey: ['user'],
    queryFn: () => api.get<GetUserResponse>('/api/auth/me'),
    enabled: isSignedIn,
    retry: false,
  })
}
