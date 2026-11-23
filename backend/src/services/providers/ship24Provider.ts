import { Parcel, ParcelStage, ProviderTrackingResult, RawProviderEvent } from '../../types.js';
import { getCountryFlag } from '../carrierDetector.js';
import { RegisterTrackingInput, TrackingProvider } from './types.js';

const BASE_URL = 'https://api.ship24.com/public/v1';

function mapShip24Milestone(milestone?: string): ParcelStage | undefined {
  if (!milestone) return undefined;
  const m = milestone.toLowerCase();
  if (m === 'delivered') return 'delivered';
  if (m === 'out_for_delivery') return 'out_for_delivery';
  if (m === 'exception' || m === 'failed_attempt') return 'exception';
  if (m === 'info_received') return 'info_received';
  if (m === 'in_transit') return 'in_transit';
  return undefined;
}

function parseShip24Events(eventsList: any[]): RawProviderEvent[] {
  return (eventsList ?? []).map((ev) => ({
    occurredAt: ev.occurrenceDatetime || new Date().toISOString(),
    location: ev.location || '',
    countryCode: ev.countryCode ?? null,
    description: ev.status || ev.statusCategory || 'Tracking update',
    stageHint: mapShip24Milestone(ev.statusMilestone),
  }));
}

export const ship24Provider: TrackingProvider = {
  id: 'ship24',
  displayName: 'Ship24 (1,500+ Global Couriers)',

  isConfigured(apiKey?: string): boolean {
    return Boolean(apiKey && apiKey.trim().length > 6);
  },

  async registerAndFetch(input: RegisterTrackingInput, apiKey?: string): Promise<ProviderTrackingResult> {
    if (!apiKey) throw new Error('Ship24 API key is not configured.');

    const resp = await fetch(`${BASE_URL}/trackers/track`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ trackingNumber: input.awb }),
    });

    if (!resp.ok) {
      throw new Error(`Ship24 track failed (${resp.status})`);
    }

    const json: any = await resp.json();
    const tracking = json?.data?.trackings?.[0];
    const events = parseShip24Events(tracking?.events ?? []);
    const originCountry = tracking?.shipment?.originCountryCode || input.originCountry || 'International';
    const destCountry = tracking?.shipment?.destinationCountryCode || input.destinationCountry;

    return {
      provider: 'ship24',
      providerTrackingId: tracking?.tracker?.trackerId ?? null,
      carrierCode: tracking?.events?.[0]?.courierCode || input.carrierCode,
      carrierName: tracking?.events?.[0]?.courierCode?.toUpperCase() || input.carrierName,
      originCountry,
      originFlag: getCountryFlag(originCountry),
      destinationCountry: destCountry,
      destinationFlag: getCountryFlag(destCountry),
      estimatedDelivery: tracking?.shipment?.delivery?.estimatedDeliveryDate
        ? String(tracking.shipment.delivery.estimatedDeliveryDate).slice(0, 10)
        : null,
      events,
      simulatorStage: -1,
    };
  },

  async fetchUpdates(parcel: Parcel, apiKey?: string): Promise<ProviderTrackingResult> {
    return this.registerAndFetch(
      {
        awb: parcel.awb,
        carrierCode: parcel.carrierCode,
        carrierName: parcel.carrierName,
        originCountry: parcel.originCountry,
        originFlag: parcel.originFlag,
        destinationCountry: parcel.destinationCountry,
        destinationFlag: parcel.destinationFlag,
      },
      apiKey
    );
  },

  parseWebhook(payload: unknown) {
    const p: any = payload;
    const tracking = p?.trackings?.[0];
    if (!tracking?.tracker?.trackingNumber) return null;
    return {
      awb: String(tracking.tracker.trackingNumber),
      events: parseShip24Events(tracking.events ?? []),
      estimatedDelivery: tracking?.shipment?.delivery?.estimatedDeliveryDate
        ? String(tracking.shipment.delivery.estimatedDeliveryDate).slice(0, 10)
        : null,
    };
  },
};
