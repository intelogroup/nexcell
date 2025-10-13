import toast from 'react-hot-toast'

/**
 * Standardized toast notifications with consistent styling
 */

export const showToast = {
  /**
   * Show success message
   */
  success: (message: string) => {
    toast.success(message, {
      duration: 3000,
      position: 'top-right',
    })
  },

  /**
   * Show error message
   */
  error: (message: string) => {
    toast.error(message, {
      duration: 4000,
      position: 'top-right',
    })
  },

  /**
   * Show info message
   */
  info: (message: string) => {
    toast(message, {
      duration: 3000,
      position: 'top-right',
      icon: 'ℹ️',
    })
  },

  /**
   * Show loading message (returns toast ID for dismissal)
   */
  loading: (message: string) => {
    return toast.loading(message, {
      position: 'top-right',
    })
  },

  /**
   * Dismiss a specific toast
   */
  dismiss: (toastId: string) => {
    toast.dismiss(toastId)
  },

  /**
   * Show promise-based toast (loading → success/error)
   */
  promise: <T,>(
    promise: Promise<T>,
    messages: {
      loading: string
      success: string | ((data: T) => string)
      error: string | ((error: any) => string)
    }
  ) => {
    return toast.promise(promise, messages, {
      position: 'top-right',
    })
  },
}

/**
 * Extract user-friendly error message from API error
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === 'string') {
    return error
  }

  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message)
  }

  return 'An unexpected error occurred. Please try again.'
}

/**
 * Map HTTP status codes to user-friendly messages
 */
export function getStatusMessage(status: number, operation: string = 'operation'): string {
  switch (status) {
    case 400:
      return `Invalid request. Please check your input.`
    case 401:
      return `You need to sign in to perform this ${operation}.`
    case 403:
      return `You don't have permission to perform this ${operation}.`
    case 404:
      return `The requested resource was not found.`
    case 409:
      return `This ${operation} conflicts with existing data.`
    case 422:
      return `Validation failed. Please check your input.`
    case 429:
      return `Too many requests. Please wait a moment and try again.`
    case 500:
      return `Server error. Please try again later.`
    case 503:
      return `Service temporarily unavailable. Please try again later.`
    default:
      return `${operation} failed. Please try again.`
  }
}
