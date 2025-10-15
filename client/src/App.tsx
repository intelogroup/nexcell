import { ErrorBoundary } from './components/ErrorBoundary';
import { MainLayout } from './components/layout';
import { RoundTripTestPage } from './components/test';

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

  return (
    <ErrorBoundary>
      <MainLayout />
    </ErrorBoundary>
  );
}

export default App;
