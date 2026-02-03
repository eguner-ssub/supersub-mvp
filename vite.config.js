import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './vitest.setup.js',
    include: ['src/tests/integration/**/*.test.jsx'],
  },
  // Proxy configuration to connect frontend (5173) to backend (3000)
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000', // Vercel dev server
        changeOrigin: true,
        secure: false,
      }
    }
  }
});