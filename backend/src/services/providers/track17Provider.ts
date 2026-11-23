import { Parcel, ParcelStage, ProviderTrackingResult, RawProviderEvent } from '../../types.js';
import { getCountryFlag } from '../carrierDetector.js';
import { RegisterTrackingInput, TrackingProvider } from './types.js';

const BASE_URL = 'https://api.17track.net/track/v2.2';

function map17TrackStage(stage?: string): ParcelStage | undefined {
  if (!stage) return undefined;
  const s = stage.toLowerCase();
  if (s.includes('delivered')) return 'delivered';
  if (s.includes('outfordelivery')) return 'out_for_delivery';
  if (s.includes('exception') || s.includes('alert') || s.includes('undelivered')) return 'exception';
  if (s.includes('inforeceived')) return 'info_received';
  if (s.includes('intransit') || s.includes('pickup')) return 'in_transit';
  return undefined;
}

function extract17TrackEvents(trackInfo: any): RawProviderEvent[] {
  const providers = trackInfo?.tracking?.providers ?? [];
  const rawEvents: RawProviderEvent[] = [];

  for (const p of providers) {
    for (const ev of p.events ?? []) {
      rawEvents.push({
        occurredAt: ev.time_utc || ev.time_iso || ev.time_raw?.date || new Date().toISOString(),
        location: ev.location || [ev.address?.city, ev.address?.state, ev.address?.country].filter(Boolean).join(', '),
        countryCode: ev.address?.country ?? null,
        description: ev.description || ev.stage || 'Tracking update',
        stageHint: map17TrackStage(ev.stage),
      });
    }
  }
  return rawEvents;
}

export const track17Provider: TrackingProvider = {
  id: '17track',
  displayName: '17TRACK (2,500+ Global Couriers)',

  isConfigured(apiKey?: string): boolean {
    return Boolean(apiKey && apiKey.trim().length > 6);
  },

  async registerAndFetch(input: RegisterTrackingInput, apiKey?: string): Promise<ProviderTrackingResult> {
    if (!apiKey) throw new Error('17TRACK API key is not configured.');

    // Register AWB (17TRACK auto-detects carrier when carrier is omitted)
    const regResp = await fetch(`${BASE_URL}/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        '17token': apiKey,
      },
      body: JSON.stringify([{ number: input.awb, auto_detection: true }]),
    });

    if (!regResp.ok) {
      throw new Error(`17TRACK register failed (${regResp.status})`);
    }

    return this.fetchUpdates(
      {
        id: '',
        awb: input.awb,
        carrierCode: input.carrierCode,
        carrierName: input.carrierName,
        carrierTrackingUrl: '',
        itemTitle: '',
        itemCategory: 'other',
        itemEmoji: '📦',
        merchant: '',
        itemNotes: '',
        itemImageUrl: '',
        orderUrl: '',
        originCountry: input.originCountry ?? 'International',
        originFlag: input.originFlag ?? '🌍',
        destinationCountry: input.destinationCountry,
        destinationFlag: input.destinationFlag,
        status: 'pending',
        statusSummary: '',
        estimatedDelivery: null,
        lastLocation: '',
        lastEventAt: null,
        providerUsed: '17track',
        providerTrackingId: null,
        simulatorStage: -1,
        simulatorRoute: null,
        muted: false,
        archived: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      apiKey
    );
  },

  async fetchUpdates(parcel: Parcel, apiKey?: string): Promise<ProviderTrackingResult> {
    if (!apiKey) throw new Error('17TRACK API key is not configured.');

    const resp = await fetch(`${BASE_URL}/gettrackinfo`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        '17token': apiKey,
      },
      body: JSON.stringify([{ number: parcel.awb }]),
    });

    if (!resp.ok) {
      throw new Error(`17TRACK gettrackinfo failed (${resp.status})`);
    }

    const json: any = await resp.json();
    const item = json?.data?.accepted?.[0];
    const trackInfo = item?.track_info;
    const events = extract17TrackEvents(trackInfo);
    const providerMeta = trackInfo?.tracking?.providers?.[0]?.provider;
    const originCountry = trackInfo?.shipping_info?.shipper_address?.country || parcel.originCountry;
    const destinationCountry = trackInfo?.shipping_info?.recipient_address?.country || parcel.destinationCountry;
    const eta = trackInfo?.time_metrics?.estimated_delivery_date?.from ?? parcel.estimatedDelivery;

    return {
      provider: '17track',
      providerTrackingId: item?.number ?? parcel.awb,
      carrierCode: providerMeta?.key ? String(providerMeta.key) : parcel.carrierCode,
      carrierName: providerMeta?.name || parcel.carrierName,
      originCountry,
      originFlag: getCountryFlag(originCountry),
      destinationCountry,
      destinationFlag: getCountryFlag(destinationCountry),
      estimatedDelivery: eta ? String(eta).slice(0, 10) : null,
      events,
      simulatorStage: -1,
    };
  },

  parseWebhook(payload: unknown) {
    const p: any = payload;
    const data = p?.data;
    if (!data?.number || !data?.track_info) return null;
    return {
      awb: String(data.number),
      events: extract17TrackEvents(data.track_info),
      estimatedDelivery: data.track_info?.time_metrics?.estimated_delivery_date?.from
        ? String(data.track_info.time_metrics.estimated_delivery_date.from).slice(0, 10)
        : null,
    };
  },
};
