import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Servidor de desarrollo en el puerto 5173 (origen permitido por el CORS de la API).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
});
