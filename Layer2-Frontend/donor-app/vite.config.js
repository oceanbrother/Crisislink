import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const backendOrigin = env.VITE_BACKEND_ORIGIN || env.VITE_API_URL || 'http://127.0.0.1:8001'
  const devPort = Number(env.VITE_DEV_PORT || 3004)

  return {
    plugins: [react()],
    server: {
      port: Number.isNaN(devPort) ? 3004 : devPort,
      strictPort: false,
      proxy: {
        '/api': {
          target: backendOrigin,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
          logLevel: 'debug',
        },
        '/static': {
          target: backendOrigin,
          changeOrigin: true,
        },
      },
    },
  }
})
