import React from 'react';
import ReactDOM from 'react-dom/client';
import './api/http';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { ErrorBoundary } from './ErrorBoundary';
import './index.css';

function showLoadError(message: string, err?: unknown) {
  const root = document.getElementById('root');
  if (!root) return;
  root.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;background:#1a1a2e;color:#00d4ff;font-family:system-ui,sans-serif;padding:24px;text-align:center;">
      <h1 style="font-size:20px;margin-bottom:16px;">App failed to load</h1>
      <p style="margin-bottom:16px;color:#e0e0e0;">${message}</p>
      <pre style="background:rgba(0,0,0,0.4);padding:12px;border-radius:8px;font-size:12px;overflow:auto;max-width:100%;color:#ff8888;">${err instanceof Error ? err.message : String(err)}</pre>
      <button onclick="location.reload()" style="margin-top:20px;padding:12px 24px;background:#00d4ff;color:#0a0a1a;border:none;border-radius:8px;font-size:14px;cursor:pointer;font-weight:600;">Refresh</button>
    </div>
  `;
}

try {
  const rootEl = document.getElementById('root');
  if (!rootEl) {
    document.body.innerHTML = '<div style="padding:24px;background:#1a1a2e;color:#ff6666;">No #root element found.</div>';
  } else {
    ReactDOM.createRoot(rootEl).render(
      <React.StrictMode>
        <ErrorBoundary>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </ErrorBoundary>
      </React.StrictMode>
    );
  }
} catch (err) {
  showLoadError('A startup error occurred. Check the console (F12) for details.', err);
  console.error('App startup error:', err);
}








