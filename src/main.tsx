import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { DEFAULT_SETTINGS } from './types/settings';
import { applyAccentVariables } from './utils/accent-theme';
import { applyColorSchemePreference } from './utils/color-scheme';
import './styles/variables.css';
import './styles/global.css';

applyColorSchemePreference(document.documentElement, DEFAULT_SETTINGS.color_scheme);
applyAccentVariables(document.documentElement, DEFAULT_SETTINGS.accent_color);

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
