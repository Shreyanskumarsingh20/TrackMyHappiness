import dotenv from 'dotenv';
import path from 'node:path';
import { TrackingProviderId } from './types.js';

dotenv.config();

const validProviders: TrackingProviderId[] = [
  'free_direct',
  'whereparcel',
  'simulator',
  '17track',
  'ship24',
  'trackingmore',
];

function parseProvider(value: string | undefined): TrackingProviderId {
  if (value && validProviders.includes(value as TrackingProviderId)) {
    return value as TrackingProviderId;
  }
  return 'free_direct';
}

export const envConfig = {
  port: Number(process.env.PORT ?? 4000),
  host: process.env.HOST ?? '0.0.0.0',
  nodeEnv: process.env.NODE_ENV ?? 'development',
  dbPath: process.env.DB_PATH
    ? path.resolve(process.env.DB_PATH)
    : path.resolve(process.cwd(), 'data', 'trackmyhappiness.db'),
  seedDemoParcels:
    process.env.SEED_DEMO_PARCELS !== undefined
      ? process.env.SEED_DEMO_PARCELS === 'true'
      : process.env.NODE_ENV !== 'production',
  webDistDir: process.env.WEB_DIST_DIR
    ? path.resolve(process.env.WEB_DIST_DIR)
    : path.resolve(process.cwd(), '..', 'mobile', 'dist'),
  defaultProvider: parseProvider(process.env.TRACKING_PROVIDER),
  pollIntervalMinutes: Math.max(5, Number(process.env.POLL_INTERVAL_MINUTES ?? 30)),
  defaultDestinationCountry: process.env.DEFAULT_DESTINATION_COUNTRY ?? 'India',
  apiKeys: {
    whereparcel: process.env.WHEREPARCEL_API_KEY?.trim() || '',
    dhl: process.env.DHL_API_KEY?.trim() || '',
    '17track': process.env.TRACK17_API_KEY?.trim() || '',
    ship24: process.env.SHIP24_API_KEY?.trim() || '',
    trackingmore: process.env.TRACKINGMORE_API_KEY?.trim() || '',
  },
};
