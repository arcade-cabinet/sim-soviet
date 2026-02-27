/**
 * SimSoviet 2000 — React Entry Point
 *
 * Replaces the old imperative main.ts with React 19's createRoot.
 */
import './style.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

const root = document.getElementById('root');
if (!root) throw new Error('Root element #root not found');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Register service worker in production only
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const base = import.meta.env.BASE_URL.endsWith('/')
      ? import.meta.env.BASE_URL
      : `${import.meta.env.BASE_URL}/`;
    const swUrl = `${base}sw.js`;
    navigator.serviceWorker.register(swUrl).catch((err) => {
      console.warn('SW registration failed:', err);
    });
  });
}
