import cors from 'cors';
import express, { Express } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { AppStore } from './db/store.js';
import { createAlertsRouter } from './routes/alerts.js';
import { createParcelsRouter } from './routes/parcels.js';
import { createSettingsRouter } from './routes/settings.js';
import { createToolsRouter } from './routes/tools.js';
import { createWebhooksRouter } from './routes/webhooks.js';
import { BackgroundScheduler } from './services/scheduler.js';
import { TrackerService } from './services/trackerService.js';

export interface CreateAppOptions {
  webDistDir?: string;
}

export function createApp(
  store: AppStore,
  tracker: TrackerService,
  scheduler?: BackgroundScheduler,
  options?: CreateAppOptions
): Express {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '2mb' }));

  // Lightweight security headers
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  app.get('/api/health', (_req, res) => {
    const settings = store.getSettings();
    res.json({
      ok: true,
      service: 'TrackMyHappiness Backend',
      version: '1.0.0',
      activeProvider: settings.activeProvider,
      parcelsCount: store.countParcels(),
      unreadAlertsCount: store.getUnreadAlertsCount(),
      timestamp: new Date().toISOString(),
    });
  });

  app.use('/api/parcels', createParcelsRouter(store, tracker));
  app.use('/api/alerts', createAlertsRouter(store));
  app.use('/api/tools', createToolsRouter());
  app.use('/api/webhooks', createWebhooksRouter(tracker));
  app.use('/api/settings', createSettingsRouter(store, scheduler));

  // Unified production serving: if Expo Web bundle exists (mobile/dist), serve it on /
  const webDistDir = options?.webDistDir;
  if (webDistDir && fs.existsSync(path.join(webDistDir, 'index.html'))) {
    app.use(express.static(webDistDir, { maxAge: '1h' }));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/')) {
        next();
        return;
      }
      res.sendFile(path.join(webDistDir, 'index.html'));
    });
  }

  return app;
}
