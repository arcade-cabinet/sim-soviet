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
