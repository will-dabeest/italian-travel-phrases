import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './react.css';
import { App } from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Missing #root element for React app.');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);
