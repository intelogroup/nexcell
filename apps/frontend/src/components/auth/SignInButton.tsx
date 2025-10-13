import { SignInButton as ClerkSignInButton, useUser } from '@clerk/clerk-react'
import { cn } from '../../lib/utils'

interface SignInButtonProps {
  className?: string
}

export function SignInButton({ className }: SignInButtonProps) {
  const { isSignedIn } = useUser()

  if (isSignedIn) {
    return null
  }

  return (
    <ClerkSignInButton mode="modal">
      <button
        className={cn(
          "bg-primary text-primary-foreground px-6 py-2 rounded-lg hover:bg-primary/90 transition-colors",
          className
        )}
      >
        Sign In
      </button>
    </ClerkSignInButton>
  )
}