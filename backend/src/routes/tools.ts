import { Router } from 'express';
import { z } from 'zod';
import { detectCarrier, SUPPORTED_CARRIERS } from '../services/carrierDetector.js';
import { parseSmartPaste } from '../services/smartPaste.js';

const smartPasteSchema = z.object({
  text: z.string().min(1),
});

const detectCarrierSchema = z.object({
  awb: z.string().min(4),
  hintText: z.string().optional(),
});

export function createToolsRouter(): Router {
  const router = Router();

  router.post('/smart-paste', (req, res) => {
    const parsed = smartPasteSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Please paste a message, order snippet, or AWB.' });
      return;
    }
    const result = parseSmartPaste(parsed.data.text);
    res.json(result);
  });

  router.post('/detect-carrier', (req, res) => {
    const parsed = detectCarrierSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Please provide an AWB number.' });
      return;
    }
    const result = detectCarrier(parsed.data.awb, parsed.data.hintText);
    res.json(result);
  });

  router.get('/carriers', (_req, res) => {
    res.json({ carriers: SUPPORTED_CARRIERS });
  });

  return router;
}
