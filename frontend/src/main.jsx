import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

/**
 * Catches render-time crashes so a single bad map or malformed response shows a
 * recoverable message instead of a white screen.
 */
class ErrorBoundary extends React.Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[SETU] render error:', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="grid h-screen place-items-center p-8 text-center">
        <div className="max-w-md space-y-4">
          <p className="text-4xl" aria-hidden>◌</p>
          <h1 className="text-lg font-bold text-white">Something broke on this screen</h1>
          <p className="text-sm text-slate-400">{this.state.error.message}</p>
          <button className="btn-primary" onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      </div>
    );
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
