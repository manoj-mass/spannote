import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Analytics } from '@vercel/analytics/react';
import { App } from './app';
import './styles.css';

const container = document.getElementById('root');
if (!container) throw new Error('The demo page has no #root element.');

createRoot(container).render(
  <StrictMode>
    <App />
    <Analytics />
  </StrictMode>,
);
