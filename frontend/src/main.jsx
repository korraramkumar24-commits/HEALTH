import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import LanguageProvider from './context/LanguageProvider.jsx';

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      await navigator.serviceWorker.register('/service-worker.js');
      await navigator.serviceWorker.ready;
      window.dispatchEvent(new Event('carehub:offline-shell-ready'));
    } catch {
      window.dispatchEvent(new Event('carehub:offline-shell-error'));
      console.error('Offline emergency contacts are unavailable until the app is refreshed while online.');
    }
  }, { once: true });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <LanguageProvider>
        <App />
      </LanguageProvider>
    </AuthProvider>
  </StrictMode>,
);
