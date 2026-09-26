import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
// `@/` is src. An edition that extends this app (mywant-guiex) builds it from
// its own config, resolving `@/` in its own source first — see
// src/extensions/registry.

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      }
    }
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Both names: since v7 react-router-dom is a thin re-export and the
          // code itself lives in react-router, so matching only the -dom name
          // left the whole router in the main chunk.
          if (id.includes('react-router')) return 'router';
          if (id.includes('@headlessui/react') || id.includes('@heroicons/react') || id.includes('lucide-react')) return 'ui';
          if (id.includes('codemirror') || id.includes('@codemirror/')) return 'editor';
          if (id.includes('axios') || id.includes('zustand') || id.includes('zod') || id.includes('js-yaml')) return 'utils';
        },
      },
    },
  }
})