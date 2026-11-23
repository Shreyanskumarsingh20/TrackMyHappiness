import { Router } from 'express';
import { z } from 'zod';
import { AppStore } from '../db/store.js';
import { BackgroundScheduler } from '../services/scheduler.js';

const updateSettingsSchema = z.object({
  activeProvider: z
    .enum(['free_direct', 'whereparcel', 'simulator', '17track', 'ship24', 'trackingmore'])
    .optional(),
  pollIntervalMinutes: z.number().int().min(5).max(720).optional(),
  defaultDestinationCountry: z.string().min(2).max(60).optional(),
  notificationRules: z
    .object({
      notifyOnShipped: z.boolean().optional(),
      notifyOnInternationalArrival: z.boolean().optional(),
      notifyOnCustoms: z.boolean().optional(),
      notifyOnOutForDelivery: z.boolean().optional(),
      notifyOnDelivered: z.boolean().optional(),
      notifyOnException: z.boolean().optional(),
      muteMinorHubScans: z.boolean().optional(),
    })
    .optional(),
  apiKeys: z
    .object({
      whereparcel: z.string().optional(),
      dhl: z.string().optional(),
      '17track': z.string().optional(),
      ship24: z.string().optional(),
      trackingmore: z.string().optional(),
    })
    .optional(),
});

export function createSettingsRouter(store: AppStore, scheduler?: BackgroundScheduler): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    res.json({ settings: store.getSettings() });
  });

  router.patch('/', (req, res) => {
    const parsed = updateSettingsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid settings update' });
      return;
    }

    const updated = store.updateSettings(parsed.data);
    if (parsed.data.pollIntervalMinutes !== undefined) {
      scheduler?.restart();
    }
    res.json({ settings: updated });
  });

  return router;
}
