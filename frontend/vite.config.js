import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The backend's CORS only allows http://localhost:5173, so never fall back to another port.
export default defineConfig({
  plugins: [react()],
  server: { host: 'localhost', port: 5173, strictPort: true },
  preview: { host: 'localhost', port: 5173, strictPort: true },
});
