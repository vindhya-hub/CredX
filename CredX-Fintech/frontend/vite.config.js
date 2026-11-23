import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Reads .env / .env.local / .env.[mode]. Only VITE_* variables reach the
  // browser bundle; DEV_API_PROXY_TARGET is used here (Node side) only.
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react()],
    server: {
      proxy: {
        // The app calls VITE_API_URL (default "/api"); in development this
        // forwards those calls to the local backend, so no CORS is involved.
        '/api': {
          target: env.DEV_API_PROXY_TARGET || 'http://localhost:5000',
          changeOrigin: true,
        },
      },
    },
  }
})
