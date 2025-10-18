import { ErrorBoundary } from './components/ErrorBoundary';
import { MainLayout } from './components/layout';
import { RoundTripTestPage } from './components/test';
import LazyLoadingDemo from './pages/LazyLoadingDemo';

function App() {
  // Check for test mode
  const params = new URLSearchParams(window.location.search);
  const testMode = params.get('test');

  if (testMode === 'roundtrip') {
    return (
      <ErrorBoundary>
        <RoundTripTestPage />
      </ErrorBoundary>
    );
  }

  if (testMode === 'lazy') {
    return (
      <ErrorBoundary>
        <LazyLoadingDemo />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <MainLayout />
    </ErrorBoundary>
  );
}

export default App;
