import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// GitHub Pages serves the site under /revolte3.0/; local dev stays at /.
export default defineConfig(({ command }) => ({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  base: command === 'build' ? '/revolte3.0/' : '/',
}))
