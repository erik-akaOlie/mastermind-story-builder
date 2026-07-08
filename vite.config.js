import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // Honor an externally assigned port (the Claude preview harness sets
    // PORT when 5173 is taken). Vite doesn't read PORT on its own; the
    // default stays 5173 for a normal `npm run dev`.
    port: process.env.PORT ? Number(process.env.PORT) : 5173,
  },
})
