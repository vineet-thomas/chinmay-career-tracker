import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' keeps the build path-agnostic for GitHub Pages sub-paths
export default defineConfig({
  plugins: [react()],
  base: './',
})
