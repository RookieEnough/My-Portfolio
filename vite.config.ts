import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // relative asset paths, so the built dist/ works on any host and under any sub-path
  base: './',
  plugins: [react(), tailwindcss()],
})
