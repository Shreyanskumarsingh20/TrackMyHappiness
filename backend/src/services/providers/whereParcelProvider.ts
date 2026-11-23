import { Parcel, ParcelStage, ProviderTrackingResult, RawProviderEvent } from '../../types.js';
import { getCountryFlag } from '../carrierDetector.js';
import { RegisterTrackingInput, TrackingProvider } from './types.js';

const BASE_URL = 'https://api.whereparcel.com/v2/track';

const CARRIER_CODE_MAP: Record<string, string> = {
  japanpost: 'jp.post',
  dhl: 'intl.dhl',
  deutschepost: 'de.dhl',
  fedex: 'us.fedex',
  ups: 'us.ups',
  usps: 'us.usps',
  royalmail: 'gb.royal-mail',
  cainiao: 'intl.cainiao',
  chinapost: 'cn.post',
  indiapost: 'in.post',
  bluedart: 'in.bluedart',
  delhivery: 'in.delhivery',
  aramex: 'intl.aramex',
  dpd: 'gb.dpd',
  canadapost: 'ca.post',
  auspost: 'au.post',
  postnl: 'nl.post',
  singpost: 'sg.post',
  koreapost: 'kr.post',
  laposte: 'fr.laposte',
  amazon: 'us.amazon',
  sfexpress: 'cn.sf',
  yunexpress: 'intl.yunexpress',
  yanwen: 'cn.yanwen',
  '4px': 'intl.4px',
};

function mapWhereParcelCarrier(code: string): string {
  const lower = code.toLowerCase();
  if (lower.includes('.')) return lower;
  return CARRIER_CODE_MAP[lower] || `intl.${lower}`;
}

function mapWhereParcelStatus(status?: string): ParcelStage | undefined {
  if (!status) return undefined;
  const s = status.toLowerCase();
  if (s === 'delivered') return 'delivered';
  if (s === 'out_for_delivery') return 'out_for_delivery';
  if (s === 'failed' || s === 'returned' || s === 'cancelled' || s === 'lost' || s === 'exception') {
    return 'exception';
  }
  if (s === 'pending' || s === 'info_received') return 'info_received';
  if (s === 'in_transit' || s === 'picked_up') return 'in_transit';
  return undefined;
}

function parseWhereParcelEvents(events: any[]): RawProviderEvent[] {
  return (events ?? []).map((ev: any) => ({
    occurredAt: ev.timestamp || ev.time || new Date().toISOString(),
    location: ev.location || '',
    countryCode: ev.countryCode ?? null,
    description: ev.description || ev.status || 'Tracking update',
    stageHint: mapWhereParcelStatus(ev.status),
  }));
}

export const whereParcelProvider: TrackingProvider = {
  id: 'whereparcel',
  displayName: 'WhereParcel (Free — 1,000/mo, No Card)',

  isConfigured(apiKey?: string): boolean {
    return Boolean(apiKey && apiKey.trim().length > 6);
  },

  async registerAndFetch(input: RegisterTrackingInput, apiKey?: string): Promise<ProviderTrackingResult> {
    if (!apiKey) throw new Error('WhereParcel API key (API_KEY:SECRET_KEY) is not configured.');

    const wpCarrier = mapWhereParcelCarrier(input.carrierCode);
    const resp = await fetch(BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey.trim()}`,
      },
      body: JSON.stringify({
        carrier: wpCarrier,
        trackingNumber: input.awb,
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      throw new Error(`WhereParcel API error (${resp.status})${errText ? `: ${errText.slice(0, 140)}` : ''}`);
    }

    const json: any = await resp.json();
    const data = json?.data ?? json;
    const events = parseWhereParcelEvents(data?.events ?? []);
    const originCountry = input.originCountry || 'International';
    const destCountry = input.destinationCountry;

    return {
      provider: 'whereparcel',
      providerTrackingId: data?.trackingNumber ?? input.awb,
      carrierCode: input.carrierCode,
      carrierName: input.carrierName,
      originCountry,
      originFlag: input.originFlag || getCountryFlag(originCountry),
      destinationCountry: destCountry,
      destinationFlag: input.destinationFlag || getCountryFlag(destCountry),
      estimatedDelivery: data?.estimatedDelivery ? String(data.estimatedDelivery).slice(0, 10) : null,
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
    const data = p?.data ?? p;
    if (!data?.trackingNumber) return null;
    return {
      awb: String(data.trackingNumber),
      events: parseWhereParcelEvents(data.events ?? []),
      estimatedDelivery: data?.estimatedDelivery ? String(data.estimatedDelivery).slice(0, 10) : null,
    };
  },
};
