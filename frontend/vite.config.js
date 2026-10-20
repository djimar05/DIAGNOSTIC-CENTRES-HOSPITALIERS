import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// En développement, /api est redirigé vers le backend (pas de CORS nécessaire).
// Pour appeler une API sur un autre domaine, définir VITE_API_URL (voir .env.example).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/api': env.BACKEND_URL || 'http://localhost:3000',
      },
    },
    test: {
      environment: 'node',
    },
  };
});
