import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';

/* global Office, Excel */

// Show loading state initially
const rootElement = document.getElementById('root');
if (rootElement) {
  rootElement.innerHTML = '<div style="padding: 20px; font-family: Segoe UI, sans-serif;">Loading Claude Memory...</div>';
}

// Wait for Office.js to be ready
Office.onReady((info) => {
  console.log('Office.onReady called:', info);

  if (info.host === Office.HostType.Excel) {
    console.log('Running in Excel');
  }

  if (rootElement) {
    const root = ReactDOM.createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  }
}).catch((error) => {
  console.error('Office.onReady failed:', error);
  if (rootElement) {
    rootElement.innerHTML = `<div style="padding: 20px; font-family: Segoe UI, sans-serif; color: red;">
      Error loading Office.js: ${error.message || error}
    </div>`;
  }
});
