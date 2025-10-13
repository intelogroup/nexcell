import { SignUp } from '@clerk/clerk-react'

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Join Nexcel
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Start building with AI-powered spreadsheets
          </p>
        </div>
        <SignUp 
          routing="path" 
          path="/sign-up" 
          fallbackRedirectUrl="/"
          signInUrl="/sign-in"
          signInFallbackRedirectUrl="/"
        />
      </div>
    </div>
  )
}