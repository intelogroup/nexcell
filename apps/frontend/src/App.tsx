import { Outlet } from 'react-router-dom'
import { useUser } from '@clerk/clerk-react'
import { useEffect } from 'react'
import { Toaster } from 'react-hot-toast'
import './App.css'
import { SignInButton } from './components/auth/SignInButton'
import { UserButton } from './components/auth/UserButton'
import SignInPage from './pages/SignIn'
import SignUpPage from './pages/SignUp'
import WorkbookList from './pages/WorkbookList'
import WorkbookEditor from './pages/WorkbookEditor'
import { useSyncUser, useGetUser } from './services/user.service'

function HomePage() {
  const { isSignedIn, user, isLoaded } = useUser()
  const syncUser = useSyncUser()
  const { data: dbUser, isLoading: isLoadingDbUser } = useGetUser()

  // Sync user to database when they first sign in
  useEffect(() => {
    if (isSignedIn && user && !dbUser && !syncUser.isPending) {
      syncUser.mutate()
    }
  }, [isSignedIn, user, dbUser, syncUser])

  if (!isLoaded || isLoadingDbUser) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-lg">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-900">Nexcel</h1>
              <span className="ml-2 text-sm text-gray-500">AI Spreadsheet Assistant</span>
            </div>
            <div className="flex items-center space-x-4">
              {isSignedIn ? <UserButton /> : <SignInButton />}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        {isSignedIn ? (
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Welcome back, {user.firstName || user.emailAddresses[0].emailAddress}!
            </h2>
            <p className="text-lg text-gray-600 mb-8">
              Ready to create amazing spreadsheets with AI assistance?
            </p>
            <div className="bg-white rounded-lg shadow-md p-8">
              <h3 className="text-xl font-semibold mb-4">Your Workbooks</h3>
              <p className="text-gray-500">Ready to get started?</p>
              <a href="/workbooks" className="mt-4 inline-block bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors">
                View Workbooks
              </a>
            </div>
          </div>
        ) : (
          <div className="text-center">
            <h2 className="text-4xl font-bold text-gray-900 mb-6">
              Welcome to Nexcel
            </h2>
            <p className="text-xl text-gray-600 mb-8">
              The AI-powered spreadsheet that understands natural language
            </p>
            <div className="grid md:grid-cols-3 gap-8 mt-12">
              <div className="bg-white p-6 rounded-lg shadow-md">
                <h3 className="text-lg font-semibold mb-2">Natural Language Interface</h3>
                <p className="text-gray-600">Tell your spreadsheet what you want in plain English</p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow-md">
                <h3 className="text-lg font-semibold mb-2">Real-time Calculations</h3>
                <p className="text-gray-600">Powered by HyperFormula for instant results</p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow-md">
                <h3 className="text-lg font-semibold mb-2">AI-driven Actions</h3>
                <p className="text-gray-600">Smart suggestions and automated workflows</p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

function App() {
  return (
    <>
      <Toaster />
      <Outlet />
    </>
  )
}

// Export routes for data router
export const routes = [
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'sign-in/*', element: <SignInPage /> },
      { path: 'sign-up/*', element: <SignUpPage /> },
      { path: 'workbooks', element: <WorkbookList /> },
      { path: 'workbooks/:id', element: <WorkbookEditor /> },
    ]
  }
]

export default App
