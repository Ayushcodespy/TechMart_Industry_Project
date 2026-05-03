import cors from 'cors';
import express from 'express';
import fs from 'fs/promises';

import { adminWebHtml } from './adminWeb.js';
import { settings } from './config.js';
import { initDatabase, pool } from './db.js';
import { errorHandler, notFoundHandler } from './errors.js';
import apiRouter from './routes/index.js';

const app = express();

const loopbackHosts = new Set(['localhost', '127.0.0.1', '::1']);

const parseOrigin = (origin) => {
  try {
    return new URL(origin);
  } catch {
    return null;
  }
};

const isLoopbackOrigin = (origin) => {
  const parsed = parseOrigin(origin);
  return parsed ? loopbackHosts.has(parsed.hostname) : false;
};

const isAllowedOrigin = (origin) => {
  if (!origin || settings.corsOrigins.includes('*') || settings.corsOrigins.includes(origin)) {
    return true;
  }

  if (isLoopbackOrigin(origin) && settings.corsOrigins.some((value) => isLoopbackOrigin(value))) {
    return true;
  }

  return false;
};

const corsOptions = {
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
      return;
    }
    callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.disable('x-powered-by');
app.use(cors(corsOptions));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/storage', express.static(settings.storageRoot));
app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.get('/admin', (_req, res) => res.type('html').send(adminWebHtml(settings.storeName)));
app.use(settings.apiV1Prefix, apiRouter);
app.use(notFoundHandler);
app.use(errorHandler);

const start = async () => {
  await fs.mkdir(settings.storageRoot, { recursive: true });
  await initDatabase();
  const server = app.listen(settings.port, settings.host, () => {
    console.log(`${settings.appName} listening on http://${settings.host}:${settings.port}`);
  });

  const shutdown = async () => {
    server.close(async () => {
      await pool.end();
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
};

start().catch(async (error) => {
  console.error('Failed to start API server:', error);
  await pool.end();
  process.exit(1);
});
