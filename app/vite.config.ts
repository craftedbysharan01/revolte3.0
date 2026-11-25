import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages serves the site under /revolte3.0/; local dev stays at /.
export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'build' ? '/revolte3.0/' : '/',
}))
