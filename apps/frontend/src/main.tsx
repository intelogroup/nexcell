import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider, createBrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ClerkProvider } from './providers/ClerkProvider.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import './index.css'
import { routes } from './App.tsx'

// Create a single QueryClient instance for the app lifecycle
const queryClient = new QueryClient()

// Create browser router with data router API
const router = createBrowserRouter(routes)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ClerkProvider>
          <RouterProvider router={router} />
        </ClerkProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
)
