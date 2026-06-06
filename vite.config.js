import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { screenResume } from './api/screen.js'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load .env (including non-VITE_ vars) so the server-side screening proxy can
  // read ANTHROPIC_API_KEY. This stays on the server — it is never exposed to
  // the browser bundle (only VITE_-prefixed vars are).
  const env = loadEnv(mode, process.cwd(), '')
  if (env.ANTHROPIC_API_KEY) process.env.ANTHROPIC_API_KEY = env.ANTHROPIC_API_KEY

  return {
    plugins: [
      react(),
      {
        // Serves POST /api/screen during `npm run dev`, mirroring the Vercel
        // serverless function in api/screen.js (the "vercel dev" equivalent).
        name: 'api-screen-dev',
        configureServer(server) {
          server.middlewares.use('/api/screen', async (req, res) => {
            if (req.method !== 'POST') {
              res.statusCode = 405
              res.setHeader('content-type', 'application/json')
              res.end(JSON.stringify({ error: 'Method not allowed' }))
              return
            }
            try {
              const chunks = []
              for await (const c of req) chunks.push(c)
              const raw = Buffer.concat(chunks).toString('utf8')
              const analysis = await screenResume(raw ? JSON.parse(raw) : {})
              res.statusCode = 200
              res.setHeader('content-type', 'application/json')
              res.end(JSON.stringify({ analysis }))
            } catch (e) {
              res.statusCode = e.statusCode || 500
              res.setHeader('content-type', 'application/json')
              res.end(JSON.stringify({ error: e.message }))
            }
          })
        },
      },
    ],
  }
})
