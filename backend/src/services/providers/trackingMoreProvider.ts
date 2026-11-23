import { Parcel, ParcelStage, ProviderTrackingResult, RawProviderEvent } from '../../types.js';
import { getCountryFlag } from '../carrierDetector.js';
import { RegisterTrackingInput, TrackingProvider } from './types.js';

const BASE_URL = 'https://api.trackingmore.com/v4';

function mapTmStatus(status?: string): ParcelStage | undefined {
  if (!status) return undefined;
  const s = status.toLowerCase();
  if (s === 'delivered') return 'delivered';
  if (s === 'pickup' || s === 'outfordelivery') return 'out_for_delivery';
  if (s === 'exception' || s === 'undelivered') return 'exception';
  if (s === 'inforeceived' || s === 'pending') return 'info_received';
  if (s === 'transit') return 'in_transit';
  return undefined;
}

function parseTmCheckpoints(data: any): RawProviderEvent[] {
  const originEvents = data?.origin_info?.trackinfo ?? [];
  const destEvents = data?.destination_info?.trackinfo ?? [];
  return [...originEvents, ...destEvents].map((ev: any) => ({
    occurredAt: ev.checkpoint_date || new Date().toISOString(),
    location: ev.location || [ev.city, ev.state, ev.country_iso2].filter(Boolean).join(', '),
    countryCode: ev.country_iso2 ?? null,
    description: ev.tracking_detail || ev.checkpoint_delivery_status || 'Tracking update',
    stageHint: mapTmStatus(ev.checkpoint_delivery_status),
  }));
}

export const trackingMoreProvider: TrackingProvider = {
  id: 'trackingmore',
  displayName: 'TrackingMore (1,300+ Global Couriers)',

  isConfigured(apiKey?: string): boolean {
    return Boolean(apiKey && apiKey.trim().length > 6);
  },

  async registerAndFetch(input: RegisterTrackingInput, apiKey?: string): Promise<ProviderTrackingResult> {
    if (!apiKey) throw new Error('TrackingMore API key is not configured.');

    // Auto-detect courier first via TrackingMore detect endpoint
    let courierCode = input.carrierCode;
    const detectResp = await fetch(`${BASE_URL}/couriers/detect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Tracking-Api-Key': apiKey,
      },
      body: JSON.stringify({ tracking_number: input.awb }),
    });
    if (detectResp.ok) {
      const detected: any = await detectResp.json();
      if (detected?.data?.[0]?.courier_code) {
        courierCode = detected.data[0].courier_code;
      }
    }

    const createResp = await fetch(`${BASE_URL}/trackings/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Tracking-Api-Key': apiKey,
      },
      body: JSON.stringify({
        tracking_number: input.awb,
        courier_code: courierCode,
      }),
    });

    if (!createResp.ok && createResp.status !== 409) {
      throw new Error(`TrackingMore create failed (${createResp.status})`);
    }

    const created: any = await createResp.json();
    const data = created?.data;
    const events = parseTmCheckpoints(data);

    return {
      provider: 'trackingmore',
      providerTrackingId: data?.id ?? null,
      carrierCode: data?.courier_code || courierCode,
      carrierName: input.carrierName,
      originCountry: data?.origin_country || input.originCountry || 'International',
      originFlag: getCountryFlag(data?.origin_country || input.originCountry || 'International'),
      destinationCountry: data?.destination_country || input.destinationCountry,
      destinationFlag: getCountryFlag(data?.destination_country || input.destinationCountry),
      estimatedDelivery: data?.scheduled_delivery_date ? String(data.scheduled_delivery_date).slice(0, 10) : null,
      events,
      simulatorStage: -1,
    };
  },

  async fetchUpdates(parcel: Parcel, apiKey?: string): Promise<ProviderTrackingResult> {
    if (!apiKey) throw new Error('TrackingMore API key is not configured.');

    const resp = await fetch(
      `${BASE_URL}/trackings/get?tracking_numbers=${encodeURIComponent(parcel.awb)}`,
      {
        headers: {
          'Tracking-Api-Key': apiKey,
        },
      }
    );

    if (!resp.ok) {
      throw new Error(`TrackingMore get failed (${resp.status})`);
    }

    const json: any = await resp.json();
    const data = json?.data?.[0];
    const events = parseTmCheckpoints(data);

    return {
      provider: 'trackingmore',
      providerTrackingId: data?.id ?? parcel.providerTrackingId,
      carrierCode: data?.courier_code || parcel.carrierCode,
      carrierName: parcel.carrierName,
      originCountry: data?.origin_country || parcel.originCountry,
      originFlag: getCountryFlag(data?.origin_country || parcel.originCountry),
      destinationCountry: data?.destination_country || parcel.destinationCountry,
      destinationFlag: getCountryFlag(data?.destination_country || parcel.destinationCountry),
      estimatedDelivery: data?.scheduled_delivery_date
        ? String(data.scheduled_delivery_date).slice(0, 10)
        : parcel.estimatedDelivery,
      events,
      simulatorStage: -1,
    };
  },

  parseWebhook(payload: unknown) {
    const p: any = payload;
    const data = p?.data;
    if (!data?.tracking_number) return null;
    return {
      awb: String(data.tracking_number),
      events: parseTmCheckpoints(data),
      estimatedDelivery: data?.scheduled_delivery_date ? String(data.scheduled_delivery_date).slice(0, 10) : null,
    };
  },
};
