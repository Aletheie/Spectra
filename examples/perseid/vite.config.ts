import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const localPath = (path: string) => fileURLToPath(new URL(path, import.meta.url))

export default defineConfig({
  root: localPath('./'),
  base: './',
  plugins: [react(), tailwindcss()],
  server: { host: '127.0.0.1', port: 5174 },
  build: {
    outDir: localPath('../../dist/perseid'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: localPath('index.html'),
        booking: localPath('booking.html'),
        observation: localPath('observation-list.html'),
        weather: localPath('weather-alert.html'),
      },
    },
  },
})
