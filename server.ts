/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { runAgentReasoning } from './server/agent';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware to parse JSON payloads
  app.use(express.json());

  // API Routes FIRST
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  app.post('/api/agent', async (req, res) => {
    try {
      const { message, tasks, goals, habits } = req.body;
      if (!message) {
        return res.status(400).json({ error: "Message parameter is required." });
      }
      const result = await runAgentReasoning(message, tasks, goals, habits);
      res.json(result);
    } catch (err: any) {
      console.error("Agent reasoning error:", err);
      res.status(500).json({ error: err.message || "Internal agent reasoning error" });
    }
  });

  // Vite integration based on environment
  if (process.env.NODE_ENV !== 'production') {
    console.log("Starting full-stack dev server with Vite middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    console.log("Serving compiled production assets...");
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // SPA fallback route for Express v4
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[TaskPilot Core] Server running on http://localhost:${PORT}`);
  });
}

startServer();
