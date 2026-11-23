import { Router } from 'express';
import { TrackerService } from '../services/trackerService.js';
import { TrackingProviderId } from '../types.js';

const WEBHOOK_PROVIDERS: TrackingProviderId[] = ['whereparcel', '17track', 'ship24', 'trackingmore'];

export function createWebhooksRouter(tracker: TrackerService): Router {
  const router = Router();

  router.post('/:provider', async (req, res) => {
    const provider = req.params.provider as TrackingProviderId;
    if (!WEBHOOK_PROVIDERS.includes(provider)) {
      res.status(400).json({ error: `Unsupported webhook provider: ${provider}` });
      return;
    }

    try {
      const result = await tracker.handleWebhook(provider, req.body);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Webhook processing error' });
    }
  });

  return router;
}
