import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Vite builds local webview assets. Its dev server is a sample-only UI harness,
// not an application server and never a path to credentials or project files.
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist/webview',
    emptyOutDir: true,
    cssCodeSplit: false,
    rollupOptions: {
      input: 'src/main.tsx',
      output: {
        entryFileNames: 'index.js',
        assetFileNames: 'index.[ext]',
        inlineDynamicImports: true,
      },
    },
  },
})
