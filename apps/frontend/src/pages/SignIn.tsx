import { SignIn } from '@clerk/clerk-react'

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Sign in to Nexcel
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Your AI-powered spreadsheet assistant
          </p>
        </div>
        <SignIn 
          routing="path" 
          path="/sign-in" 
          fallbackRedirectUrl="/"
          signUpUrl="/sign-up"
          signUpFallbackRedirectUrl="/"
        />
      </div>
    </div>
  )
}