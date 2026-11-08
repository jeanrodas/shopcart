import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/plus-jakarta-sans';
import './index.css';
import { App } from './App';

const contenedor = document.getElementById('root');
if (!contenedor) {
  throw new Error('No se encontro el elemento #root');
}

createRoot(contenedor).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
