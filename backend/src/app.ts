import cors from 'cors';
import express, { Express } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { IAppStore } from './db/types.js';
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
  store: IAppStore,
  tracker: TrackerService,
  scheduler?: BackgroundScheduler,
  options?: CreateAppOptions
): Express {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '2mb' }));

  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  app.get('/api/health', async (_req, res) => {
    try {
      const [settings, parcelsCount, unreadAlertsCount] = await Promise.all([
        store.getSettings(),
        store.countParcels(),
        store.getUnreadAlertsCount(),
      ]);
      res.json({
        ok: true,
        service: 'TrackMyHappiness Backend',
        version: '1.0.0',
        storage: store.storageKind,
        activeProvider: settings.activeProvider,
        parcelsCount,
        unreadAlertsCount,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      res.status(500).json({
        ok: false,
        error: err instanceof Error ? err.message : 'Health check failed',
      });
    }
  });

  // Serverless background poll trigger (used by Vercel Cron / GitHub Actions)
  const handleCronPoll = async (req: express.Request, res: express.Response) => {
    const cronSecret = process.env.CRON_SECRET?.trim();
    if (cronSecret) {
      const auth = req.headers.authorization;
      if (auth !== `Bearer ${cronSecret}`) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
    }
    try {
      const result = await tracker.refreshAllActive();
      res.json({ ok: true, ...result, timestamp: new Date().toISOString() });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Cron poll failed' });
    }
  };
  app.get('/api/cron/poll', handleCronPoll);
  app.post('/api/cron/poll', handleCronPoll);

  app.use('/api/parcels', createParcelsRouter(store, tracker));
  app.use('/api/alerts', createAlertsRouter(store));
  app.use('/api/tools', createToolsRouter());
  app.use('/api/webhooks', createWebhooksRouter(tracker));
  app.use('/api/settings', createSettingsRouter(store, scheduler));

  // Unified local/Docker production serving (Vercel serves mobile/dist natively via CDN)
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
