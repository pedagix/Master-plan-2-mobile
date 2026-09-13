import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles.css';
import { applyTheme } from './lib/theme';

// Apply a stored theme before React mounts to avoid a dark/light flash.
let storedThemeSettings;
try {
  storedThemeSettings = JSON.parse(localStorage.getItem('master_plan_v1') || 'null')?.settings;
} catch {
  storedThemeSettings = null;
}
applyTheme(storedThemeSettings);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
