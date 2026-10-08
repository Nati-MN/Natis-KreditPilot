import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
// Schriften aus dem eigenen Projekt statt von Google Fonts
import '@fontsource-variable/bricolage-grotesque/index.css';
import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-500.css';
import '@fontsource/ibm-plex-sans/latin-600.css';
import './index.css';
import { initPwa } from './lib/pwa';

initPwa();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
