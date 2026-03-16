import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("CRITICAL UI CRASH:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6 text-center">
          <div className="max-w-md w-full bg-white p-8 rounded-[2rem] shadow-xl border border-red-100">
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
               <span className="text-3xl">⚠️</span>
            </div>
            <h1 className="text-xl font-black text-slate-900 mb-2">Something went wrong</h1>
            <p className="text-slate-500 text-sm mb-6">
              The application encountered an unexpected error.
            </p>
            <div className="bg-slate-50 p-4 rounded-xl text-left mb-6 overflow-auto max-h-32 text-xs font-mono text-red-600 border border-slate-100 italic">
              {this.state.error?.message}
            </div>
            <button
              onClick={() => {
                  // Clear everything to ensure a fresh start
                  localStorage.clear();
                  sessionStorage.clear();
                  
                  // Unregister service workers if possible
                  if ('serviceWorker' in navigator) {
                      navigator.serviceWorker.getRegistrations().then(regs => {
                          for(let reg of regs) reg.unregister();
                      });
                  }

                  // Force reload from server, ignoring cache
                  window.location.href = '/?refresh=' + Date.now();
              }}
              className="w-full py-4 bg-slate-900 text-white font-black uppercase tracking-widest rounded-xl hover:bg-slate-800 transition-colors"
            >
              Reset & Reload App
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
