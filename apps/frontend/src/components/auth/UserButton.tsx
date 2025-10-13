import { UserButton as ClerkUserButton, useUser } from '@clerk/clerk-react'

export function UserButton() {
  const { isSignedIn } = useUser()

  if (!isSignedIn) {
    return null
  }

  return (
    <ClerkUserButton 
      appearance={{
        elements: {
          avatarBox: "w-8 h-8"
        }
      }}
    />
  )
}