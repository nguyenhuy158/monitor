import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './client/src'),
      '@ui': path.resolve(__dirname, './client/src/ui'),
    },
  },
  css: {
    transformer: 'lightningcss',
  },
  build: {
    outDir: 'dist',
    cssMinify: 'lightningcss',
  }
})
