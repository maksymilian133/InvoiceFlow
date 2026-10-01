import { StrictMode, Component, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-stone-50">
          <div className="max-w-lg w-full mx-4 bg-white border border-red-200 rounded-lg p-6">
            <p className="text-sm font-semibold text-red-700 mb-2">Błąd aplikacji</p>
            <pre className="text-xs text-red-600 whitespace-pre-wrap bg-red-50 rounded p-3">
              {(this.state.error as Error).message}
              {'\n'}
              {(this.state.error as Error).stack}
            </pre>
            <button
              className="mt-4 px-4 py-1.5 bg-stone-900 text-white text-sm rounded-md"
              onClick={() => this.setState({ error: null })}
            >
              Spróbuj ponownie
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
