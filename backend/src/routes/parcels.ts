import { Router } from 'express';
import { z } from 'zod';
import { AppStore } from '../db/store.js';
import { TrackerService } from '../services/trackerService.js';

const createParcelSchema = z.object({
  awb: z.string().min(6, 'AWB / tracking number must be at least 6 characters'),
  itemTitle: z.string().min(1, 'Tell us what is inside so you never forget!').max(120),
  carrierCode: z.string().optional(),
  itemCategory: z
    .enum(['electronics', 'fashion', 'home', 'beauty', 'books', 'gift', 'food', 'health', 'hobby', 'other'])
    .optional(),
  itemEmoji: z.string().max(8).optional(),
  merchant: z.string().max(80).optional(),
  itemNotes: z.string().max(500).optional(),
  itemImageUrl: z.string().max(500).optional(),
  orderUrl: z.string().max(500).optional(),
  originCountry: z.string().max(60).optional(),
  destinationCountry: z.string().max(60).optional(),
  estimatedDelivery: z.string().nullable().optional(),
  hintText: z.string().max(2000).optional(),
});

const updateParcelSchema = z.object({
  itemTitle: z.string().min(1).max(120).optional(),
  itemCategory: z
    .enum(['electronics', 'fashion', 'home', 'beauty', 'books', 'gift', 'food', 'health', 'hobby', 'other'])
    .optional(),
  itemEmoji: z.string().max(8).optional(),
  merchant: z.string().max(80).optional(),
  itemNotes: z.string().max(500).optional(),
  itemImageUrl: z.string().max(500).optional(),
  orderUrl: z.string().max(500).optional(),
  estimatedDelivery: z.string().nullable().optional(),
  muted: z.boolean().optional(),
  archived: z.boolean().optional(),
});

export function createParcelsRouter(store: AppStore, tracker: TrackerService): Router {
  const router = Router();

  router.get('/', (req, res) => {
    const includeArchived = req.query.includeArchived === 'true';
    const parcels = store.listParcels({ includeArchived });
    res.json({ parcels, unreadAlertsCount: store.getUnreadAlertsCount() });
  });

  router.get('/:id', (req, res) => {
    const parcel = store.getParcelById(req.params.id);
    if (!parcel) {
      res.status(404).json({ error: 'Parcel not found' });
      return;
    }
    res.json({ parcel });
  });

  router.post('/', async (req, res) => {
    const parsed = createParcelSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.issues[0]?.message ?? 'Invalid parcel payload',
        issues: parsed.error.issues,
      });
      return;
    }

    try {
      const result = await tracker.createParcel(parsed.data);
      res.status(201).json(result);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to create parcel' });
    }
  });

  router.patch('/:id', (req, res) => {
    const parsed = updateParcelSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid update payload' });
      return;
    }

    const updated = store.updateParcel(req.params.id, parsed.data);
    if (!updated) {
      res.status(404).json({ error: 'Parcel not found' });
      return;
    }
    res.json({ parcel: updated });
  });

  router.post('/:id/refresh', async (req, res) => {
    try {
      const result = await tracker.refreshParcel(req.params.id);
      res.json(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to refresh parcel';
      res.status(msg === 'Parcel not found' ? 404 : 500).json({ error: msg });
    }
  });

  router.post('/refresh-all', async (_req, res) => {
    try {
      const result = await tracker.refreshAllActive();
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Refresh failed' });
    }
  });

  router.post('/:id/mark-read', (req, res) => {
    store.markParcelAlertsRead(req.params.id);
    res.json({ ok: true, unreadAlertsCount: store.getUnreadAlertsCount() });
  });

  router.delete('/:id', (req, res) => {
    const deleted = store.deleteParcel(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: 'Parcel not found' });
      return;
    }
    res.json({ deleted: true });
  });

  return router;
}
