import { Buffer } from 'buffer';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles/tokens.css';
import './styles/app.css';

// Polyfill global Buffer for amazon-cognito-identity-js / mqtt browser compatibility
if (typeof globalThis.Buffer === 'undefined') {
  globalThis.Buffer = Buffer;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
