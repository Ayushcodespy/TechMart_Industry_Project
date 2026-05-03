import cors from 'cors';
import express from 'express';
import fs from 'fs/promises';

import { adminWebHtml } from './adminWeb.js';
import { settings } from './config.js';
import { initDatabase } from './db.js';
import { errorHandler, notFoundHandler } from './errors.js';
import apiRouter from './routes/index.js';

const app = express();

// 🔥 IMPORTANT: CORS FIX (ALLOW ALL ORIGINS PROPERLY)
app.disable('x-powered-by');

app.use(cors({
  origin: true, // ✅ allow all origins dynamically
  credentials: true,
}));

// 🔥 handle preflight requests
app.options('*', cors());

// 🔥 body parsers
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// 🔥 static + routes
app.use('/storage', express.static(settings.storageRoot));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/admin', (_req, res) => {
  res.type('html').send(adminWebHtml(settings.storeName));
});

app.use(settings.apiV1Prefix, apiRouter);

// 🔥 error handlers
app.use(notFoundHandler);
app.use(errorHandler);

// 🔥 init setup
let setupPromise;

export const prepareApp = () => {
  setupPromise ??= (async () => {
    await fs.mkdir(settings.storageRoot, { recursive: true });
    await initDatabase();
  })();
  return setupPromise;
};

export default app;