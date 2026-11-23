import { Parcel, ParcelStage, ProviderTrackingResult, RawProviderEvent } from '../../types.js';
import { getCountryFlag } from '../carrierDetector.js';
import { RegisterTrackingInput, TrackingProvider } from './types.js';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parses timestamps from Japan Post's English table:
 * e.g. "11/07/2026 14:47" (MM/DD/YYYY HH:mm) or "2026/11/07 14:47" or "11/07/2026"
 */
function parseJapanPostDate(raw: string): string {
  const cleaned = raw.trim();
  const mdy = cleaned.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/);
  if (mdy) {
    const [, mm, dd, yyyy, hh = '00', min = '00'] = mdy;
    return `${yyyy}-${mm}-${dd}T${hh}:${min}:00.000Z`;
  }
  const ymd = cleaned.match(/^(\d{4})\/(\d{2})\/(\d{2})(?:\s+(\d{2}):(\d{2}))?/);
  if (ymd) {
    const [, yyyy, mm, dd, hh = '00', min = '00'] = ymd;
    return `${yyyy}-${mm}-${dd}T${hh}:${min}:00.000Z`;
  }
  const parsed = new Date(cleaned);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function titleCaseCountry(raw: string): string {
  const upper = raw.trim().toUpperCase();
  if (!upper) return '';
  if (upper === 'USA' || upper === 'U.S.A.' || upper === 'UNITED STATES OF AMERICA') return 'United States';
  if (upper === 'UK' || upper === 'GREAT BRITAIN' || upper === 'UNITED KINGDOM') return 'United Kingdom';
  if (upper === 'UAE' || upper === 'UNITED ARAB EMIRATES') return 'UAE';
  return upper
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

const JAPAN_PREFECTURES = new Set([
  'TOKYO',
  'OSAKA',
  'KANAGAWA',
  'CHIBA',
  'SAITAMA',
  'AICHI',
  'KYOTO',
  'HYOGO',
  'FUKUOKA',
  'HOKKAIDO',
  'HIROSHIMA',
  'MIYAGI',
  'SHIZUOKA',
  'IBARAKI',
  'OKINAWA',
  'NAGANO',
  'NIIGATA',
  'KUMAMOTO',
  'OKAYAMA',
  'GIFU',
  'MIE',
  'GUNMA',
  'TOCHIGI',
]);

export interface ParsedJapanPostResult {
  found: boolean;
  serviceClass: string | null;
  destinationCountry: string | null;
  events: RawProviderEvent[];
}

export function parseJapanPostHtml(html: string): ParsedJapanPostResult {
  if (/your item was not found|not registered|no record/i.test(html) && !/summary="履歴情報"/.test(html)) {
    return { found: false, serviceClass: null, destinationCountry: null, events: [] };
  }

  // Extract service class (e.g. "International Air Packet", "EMS", "Registered Mail")
  let serviceClass: string | null = null;
  const classMatch = html.match(/<td[^>]*class="w_380"[^>]*>([\s\S]*?)<\/td>/i);
  if (classMatch?.[1]) {
    const val = decodeHtmlEntities(classMatch[1]);
    if (val) serviceClass = val;
  }

  // Extract history table (<table ... summary="履歴情報"> ... </table>)
  const historyTableMatch =
    html.match(/<table[^>]*summary="履歴情報"[^>]*>([\s\S]*?)<\/table>/i) ||
    html.match(/History information[\s\S]*?<table[^>]*>([\s\S]*?)<\/table>/i);

  if (!historyTableMatch) {
    return { found: false, serviceClass, destinationCountry: null, events: [] };
  }

  const tableHtml = historyTableMatch[1];
  const rows = [...tableHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
  const events: RawProviderEvent[] = [];
  let detectedDestination: string | null = null;

  for (const row of rows) {
    const rowHtml = row[1];
    // Skip header rows and secondary ZIP-code rows (which only have 1 <td>)
    if (/<th\b/i.test(rowHtml)) continue;
    const cells = [...rowHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) =>
      decodeHtmlEntities(m[1])
    );
    if (cells.length < 4) continue;

    const [dateStr, trackRecord, details, office, regionOrCountry = ''] = cells;
    if (!dateStr || !trackRecord) continue;

    const description = details ? `${trackRecord} — ${details}` : trackRecord;
    const regionUpper = regionOrCountry.trim().toUpperCase();
    const isJapanPrefecture = !regionUpper || JAPAN_PREFECTURES.has(regionUpper) || regionUpper === 'JAPAN';

    let locationParts: string[] = [];
    if (office) locationParts.push(office);
    if (regionOrCountry) {
      locationParts.push(isJapanPrefecture && regionUpper !== 'JAPAN' ? `${regionOrCountry}, Japan` : regionOrCountry);
    }

    if (!isJapanPrefecture && regionUpper.length >= 2) {
      detectedDestination = titleCaseCountry(regionOrCountry);
    }

    events.push({
      occurredAt: parseJapanPostDate(dateStr),
      location: locationParts.join(', '),
      countryCode: isJapanPrefecture ? 'JP' : regionUpper.slice(0, 2),
      description,
    });
  }

  return {
    found: events.length > 0,
    serviceClass,
    destinationCountry: detectedDestination,
    events,
  };
}

export function parseCainiaoJson(json: any): {
  found: boolean;
  originCountry: string | null;
  destinationCountry: string | null;
  events: RawProviderEvent[];
} {
  const mod = json?.module?.[0];
  const detailList = Array.isArray(mod?.detailList) ? mod.detailList : [];
  if (detailList.length === 0) {
    return { found: false, originCountry: null, destinationCountry: null, events: [] };
  }

  const events: RawProviderEvent[] = detailList.map((item: any) => {
    const desc = String(item.standerdDesc || item.desc || 'Tracking update').trim();
    const timeVal = item.time
      ? new Date(Number(item.time)).toISOString()
      : item.timeStr
      ? new Date(String(item.timeStr).replace(' ', 'T')).toISOString()
      : new Date().toISOString();
    return {
      occurredAt: Number.isNaN(new Date(timeVal).getTime()) ? new Date().toISOString() : timeVal,
      location: String(item.location || '').trim(),
      countryCode: item.countryCode ?? null,
      description: desc,
    };
  });

  return {
    found: true,
    originCountry: mod?.originCountry ? String(mod.originCountry) : null,
    destinationCountry: mod?.destCountry ? String(mod.destCountry) : null,
    events,
  };
}

async function fetchJapanPostDirect(input: RegisterTrackingInput): Promise<ProviderTrackingResult | null> {
  const url = `https://trackings.post.japanpost.jp/services/srv/search/direct?reqCodeNo1=${encodeURIComponent(
    input.awb
  )}&locale=en`;

  const resp = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });

  if (!resp.ok) {
    throw new Error(`Japan Post returned HTTP ${resp.status}`);
  }

  const html = await resp.text();
  const parsed = parseJapanPostHtml(html);
  if (!parsed.found) {
    return {
      provider: 'free_direct',
      providerTrackingId: input.awb,
      carrierCode: 'japanpost',
      carrierName: 'Japan Post',
      originCountry: 'Japan',
      originFlag: '🇯🇵',
      destinationCountry: input.destinationCountry,
      destinationFlag: input.destinationFlag,
      events: [
        {
          occurredAt: new Date().toISOString(),
          location: 'Japan Post',
          countryCode: 'JP',
          description: 'Checked Japan Post live — no scan events posted yet (will keep checking automatically)',
          stageHint: 'info_received',
        },
      ],
      simulatorStage: -1,
    };
  }

  const destCountry = parsed.destinationCountry || input.destinationCountry;
  const carrierLabel = parsed.serviceClass ? `Japan Post (${parsed.serviceClass})` : 'Japan Post';

  return {
    provider: 'free_direct',
    providerTrackingId: input.awb,
    carrierCode: 'japanpost',
    carrierName: carrierLabel,
    originCountry: 'Japan',
    originFlag: '🇯🇵',
    destinationCountry: destCountry,
    destinationFlag: getCountryFlag(destCountry),
    events: parsed.events,
    simulatorStage: -1,
  };
}

async function fetchCainiaoDirect(input: RegisterTrackingInput): Promise<ProviderTrackingResult | null> {
  const url = `https://global.cainiao.com/global/detail.json?mailNos=${encodeURIComponent(
    input.awb
  )}&lang=en-US`;

  const resp = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json',
    },
  });

  if (!resp.ok) return null;
  const json = await resp.json().catch(() => null);
  const parsed = parseCainiaoJson(json);
  if (!parsed.found) return null;

  const originCountry = parsed.originCountry || input.originCountry || 'China';
  const destCountry = parsed.destinationCountry || input.destinationCountry;

  return {
    provider: 'free_direct',
    providerTrackingId: input.awb,
    carrierCode: input.carrierCode,
    carrierName: input.carrierName,
    originCountry,
    originFlag: getCountryFlag(originCountry),
    destinationCountry: destCountry,
    destinationFlag: getCountryFlag(destCountry),
    events: parsed.events,
    simulatorStage: -1,
  };
}

async function fetchDhlFreeDeveloperApi(
  input: RegisterTrackingInput,
  dhlApiKey: string
): Promise<ProviderTrackingResult | null> {
  const url = `https://api-eu.dhl.com/track/shipments?trackingNumber=${encodeURIComponent(input.awb)}`;
  const resp = await fetch(url, {
    headers: {
      'DHL-API-Key': dhlApiKey.trim(),
      Accept: 'application/json',
    },
  });

  if (!resp.ok) {
    throw new Error(`DHL Unified API returned HTTP ${resp.status}`);
  }

  const json: any = await resp.json();
  const shipment = json?.shipments?.[0];
  const rawList = Array.isArray(shipment?.events) ? shipment.events : [];

  const mapDhlStatus = (code?: string): ParcelStage | undefined => {
    if (!code) return undefined;
    const c = code.toLowerCase();
    if (c === 'delivered') return 'delivered';
    if (c === 'failure') return 'exception';
    if (c === 'pre-transit') return 'info_received';
    if (c === 'transit') return 'in_transit';
    return undefined;
  };

  const events: RawProviderEvent[] = rawList.map((ev: any) => ({
    occurredAt: ev.timestamp || new Date().toISOString(),
    location: ev.location?.address?.addressLocality || ev.location?.address?.countryCode || '',
    countryCode: ev.location?.address?.countryCode ?? null,
    description: ev.description || ev.status || 'DHL tracking update',
    stageHint: mapDhlStatus(ev.statusCode),
  }));

  const originCountry = shipment?.origin?.address?.countryCode || input.originCountry || 'Germany';
  const destCountry = shipment?.destination?.address?.countryCode || input.destinationCountry;

  return {
    provider: 'free_direct',
    providerTrackingId: input.awb,
    carrierCode: 'dhl',
    carrierName: 'DHL Express (Official Live)',
    originCountry,
    originFlag: getCountryFlag(originCountry),
    destinationCountry: destCountry,
    destinationFlag: getCountryFlag(destCountry),
    estimatedDelivery: shipment?.estimatedTimeOfDelivery
      ? String(shipment.estimatedTimeOfDelivery).slice(0, 10)
      : null,
    events,
    simulatorStage: -1,
  };
}

const CAINIAO_SUPPORTED = new Set([
  'cainiao',
  'chinapost',
  'yanwen',
  'yunexpress',
  '4px',
  'singpost',
  'hkpost',
  'postnl',
  'global',
]);

export interface FreeDirectKeys {
  dhl?: string;
}

export async function runFreeDirectLookup(
  input: RegisterTrackingInput,
  keys?: FreeDirectKeys
): Promise<ProviderTrackingResult> {
  const code = input.carrierCode.toLowerCase();

  // 1. Japan Post open official live endpoint (zero API key needed!)
  if (code === 'japanpost' || /^[A-Z]{2}\d{9}JP$/i.test(input.awb)) {
    const jp = await fetchJapanPostDirect(input);
    if (jp) return jp;
  }

  // 2. Official Free DHL Unified Tracking API (when free DHL Developer key is set)
  if ((code === 'dhl' || code === 'deutschepost') && keys?.dhl) {
    const dhl = await fetchDhlFreeDeveloperApi(input, keys.dhl);
    if (dhl) return dhl;
  }

  // 3. Cainiao Global open JSON endpoint (AliExpress, China Post, Yanwen, YunExpress, 4PX, SingPost, etc.)
  if (CAINIAO_SUPPORTED.has(code) || /^[A-Z]{2}\d{9}[A-Z]{2}$/i.test(input.awb)) {
    const cn = await fetchCainiaoDirect(input);
    if (cn) return cn;
  }

  // 4. Honest, clean fallback when courier requires a free WhereParcel key or manual carrier page view
  return {
    provider: 'free_direct',
    providerTrackingId: input.awb,
    carrierCode: input.carrierCode,
    carrierName: input.carrierName,
    originCountry: input.originCountry || 'International',
    originFlag: input.originFlag || '🌍',
    destinationCountry: input.destinationCountry,
    destinationFlag: input.destinationFlag,
    events: [
      {
        occurredAt: new Date().toISOString(),
        location: input.carrierName,
        description: `Saved in Free Live Mode. ${input.carrierName} does not publish a keyless open API — tap "Open Live Carrier Page" below for 1-tap lookup, or add a free WhereParcel key (1,000/mo, no credit card) in Settings for automatic alerts.`,
        stageHint: 'pending',
      },
    ],
    simulatorStage: -1,
    notice: `Live keyless direct lookup isn't open for ${input.carrierName}; use 1-tap carrier page or free WhereParcel key.`,
  };
}

export const freeDirectProvider: TrackingProvider = {
  id: 'free_direct',
  displayName: 'Free Live Direct ($0 — No API Key)',

  isConfigured(): boolean {
    return true;
  },

  async registerAndFetch(input: RegisterTrackingInput, dhlKey?: string): Promise<ProviderTrackingResult> {
    return runFreeDirectLookup(input, { dhl: dhlKey });
  },

  async fetchUpdates(parcel: Parcel, dhlKey?: string): Promise<ProviderTrackingResult> {
    return runFreeDirectLookup(
      {
        awb: parcel.awb,
        carrierCode: parcel.carrierCode,
        carrierName: parcel.carrierName,
        originCountry: parcel.originCountry,
        originFlag: parcel.originFlag,
        destinationCountry: parcel.destinationCountry,
        destinationFlag: parcel.destinationFlag,
      },
      { dhl: dhlKey }
    );
  },
};
