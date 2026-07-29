import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // Honor an externally assigned port (the Claude preview harness sets
    // PORT when 5173 is taken). Vite doesn't read PORT on its own; the
    // default stays 5173 for a normal `npm run dev`.
    port: process.env.PORT ? Number(process.env.PORT) : 5173,
    // Mirror vercel.json's PostHog reverse-proxy rewrites so analytics
    // behaves identically in local dev (analytics.js always uses the
    // same-origin '/relay' path — see the api_host note there). Order
    // matters: the more specific /relay/static entry must come first.
    // US-region hosts, matching vercel.json — keep the two files in sync.
    proxy: {
      '/relay/static': {
        target: 'https://us-assets.i.posthog.com',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/relay/, ''),
      },
      '/relay': {
        target: 'https://us.i.posthog.com',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/relay/, ''),
      },
    },
  },
})
