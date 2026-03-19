import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // loadEnv reads .env files respecting mode (development/production)
  // The empty prefix '' loads ALL env vars, not just VITE_*
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    // Selectively expose ONLY safe Supabase keys to the client bundle.
    // SUPABASE_SERVICE_ROLE_KEY is intentionally excluded to prevent leakage.
    define: {
      'import.meta.env.SUPABASE_URL': JSON.stringify(env.SUPABASE_URL || ''),
      'import.meta.env.SUPABASE_ANON_KEY': JSON.stringify(env.SUPABASE_ANON_KEY || ''),
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: './vitest.setup.js',
      include: [
        'src/tests/integration/**/*.test.jsx',
        'src/pages/**/*.test.jsx',
        'src/components/**/*.test.jsx',
        'src/features/**/*.test.jsx',
        'api/__tests__/**/*.test.js',
        'lib/__tests__/**/*.test.js',
      ],
      environmentMatchGlobs: [
        ['api/__tests__/**', 'node'],
        ['lib/__tests__/**', 'node'],
      ],
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
  };
});