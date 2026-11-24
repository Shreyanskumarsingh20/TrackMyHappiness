import { Router } from 'express';
import { z } from 'zod';
import { IAppStore } from '../db/types.js';

const pushTokenSchema = z.object({
  token: z.string().min(8),
  platform: z.string().optional(),
  deviceName: z.string().optional(),
});

export function createAlertsRouter(store: IAppStore): Router {
  const router = Router();

  router.get('/', async (req, res) => {
    try {
      const importantOnly = req.query.importantOnly === 'true';
      const limit = req.query.limit ? Math.min(200, Math.max(1, Number(req.query.limit))) : 80;
      const [alerts, unreadCount] = await Promise.all([
        store.listAlerts({ importantOnly, limit }),
        store.getUnreadAlertsCount(),
      ]);
      res.json({ alerts, unreadCount });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load alerts' });
    }
  });

  router.post('/:id/read', async (req, res) => {
    try {
      await store.markAlertRead(req.params.id);
      res.json({ ok: true, unreadCount: await store.getUnreadAlertsCount() });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to update alert' });
    }
  });

  router.post('/read-all', async (_req, res) => {
    try {
      await store.markAllAlertsRead();
      res.json({ ok: true, unreadCount: 0 });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to mark alerts read' });
    }
  });

  router.post('/push-token', async (req, res) => {
    const parsed = pushTokenSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid push token payload' });
      return;
    }
    try {
      await store.savePushToken(parsed.data.token, parsed.data.platform, parsed.data.deviceName);
      res.json({ registered: true });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to register push token' });
    }
  });

  return router;
}
