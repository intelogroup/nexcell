import { ClerkProvider as ClerkProviderBase } from '@clerk/clerk-react'
import { ReactNode } from 'react'

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

if (!publishableKey) {
  console.warn('Missing Clerk Publishable Key - Authentication will not work')
}

export function ClerkProvider({ children }: { children: ReactNode }) {
  if (!publishableKey) {
    return <div className="p-4 text-center">
      <h2 className="text-xl font-semibold mb-2">Authentication Setup Required</h2>
      <p className="text-gray-600">Please configure your Clerk publishable key in the .env file</p>
      <div className="mt-4 p-4 bg-gray-100 rounded-lg text-left">
        <p className="font-mono text-sm">VITE_CLERK_PUBLISHABLE_KEY=your_key_here</p>
      </div>
    </div>
  }

  return (
    <ClerkProviderBase 
      publishableKey={publishableKey}
      signInFallbackRedirectUrl="/"
      signUpFallbackRedirectUrl="/"
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
    >
      {children}
    </ClerkProviderBase>
  )
}