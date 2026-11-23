import { Router } from 'express';
import { z } from 'zod';
import { AppStore } from '../db/store.js';

const pushTokenSchema = z.object({
  token: z.string().min(8),
  platform: z.string().optional(),
  deviceName: z.string().optional(),
});

export function createAlertsRouter(store: AppStore): Router {
  const router = Router();

  router.get('/', (req, res) => {
    const importantOnly = req.query.importantOnly === 'true';
    const limit = req.query.limit ? Math.min(200, Math.max(1, Number(req.query.limit))) : 80;
    const alerts = store.listAlerts({ importantOnly, limit });
    res.json({
      alerts,
      unreadCount: store.getUnreadAlertsCount(),
    });
  });

  router.post('/:id/read', (req, res) => {
    store.markAlertRead(req.params.id);
    res.json({ ok: true, unreadCount: store.getUnreadAlertsCount() });
  });

  router.post('/read-all', (_req, res) => {
    store.markAllAlertsRead();
    res.json({ ok: true, unreadCount: 0 });
  });

  router.post('/push-token', (req, res) => {
    const parsed = pushTokenSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid push token payload' });
      return;
    }
    store.savePushToken(parsed.data.token, parsed.data.platform, parsed.data.deviceName);
    res.json({ registered: true });
  });

  return router;
}
