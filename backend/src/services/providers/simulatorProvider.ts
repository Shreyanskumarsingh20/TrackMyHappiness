import { Parcel, ProviderTrackingResult, RawProviderEvent, SimulatedCheckpoint } from '../../types.js';
import { getCountryFlag } from '../carrierDetector.js';
import { RegisterTrackingInput, TrackingProvider } from './types.js';

interface OriginTemplate {
  country: string;
  flag: string;
  code: string;
  originCity: string;
  exportHub: string;
  transitHub: string;
  transitCode: string;
}

const ORIGIN_TEMPLATES: Record<string, OriginTemplate> = {
  China: {
    country: 'China',
    flag: '🇨🇳',
    code: 'CN',
    originCity: 'Shenzhen, China',
    exportHub: 'Hong Kong International Air Hub',
    transitHub: 'Singapore Changi Transit Hub',
    transitCode: 'SG',
  },
  Japan: {
    country: 'Japan',
    flag: '🇯🇵',
    code: 'JP',
    originCity: 'Tokyo, Japan',
    exportHub: 'Narita International Export Gateway, Japan',
    transitHub: 'Singapore Air Freight Hub',
    transitCode: 'SG',
  },
  'United States': {
    country: 'United States',
    flag: '🇺🇸',
    code: 'US',
    originCity: 'Los Angeles, CA, USA',
    exportHub: 'JFK International Export Gateway, New York',
    transitHub: 'Frankfurt Air Cargo Hub, Germany',
    transitCode: 'DE',
  },
  Germany: {
    country: 'Germany',
    flag: '🇩🇪',
    code: 'DE',
    originCity: 'Berlin, Germany',
    exportHub: 'Leipzig DHL Global Hub, Germany',
    transitHub: 'Dubai International Cargo Gateway, UAE',
    transitCode: 'AE',
  },
  'United Kingdom': {
    country: 'United Kingdom',
    flag: '🇬🇧',
    code: 'GB',
    originCity: 'London, UK',
    exportHub: 'London Heathrow Export Hub, UK',
    transitHub: 'Dubai Cargo Transit Hub, UAE',
    transitCode: 'AE',
  },
  UAE: {
    country: 'UAE',
    flag: '🇦🇪',
    code: 'AE',
    originCity: 'Dubai, UAE',
    exportHub: 'Dubai Logistics Gateway, UAE',
    transitHub: 'Abu Dhabi Sort Facility, UAE',
    transitCode: 'AE',
  },
  Singapore: {
    country: 'Singapore',
    flag: '🇸🇬',
    code: 'SG',
    originCity: 'Singapore',
    exportHub: 'Changi Airfreight Centre, Singapore',
    transitHub: 'Kuala Lumpur Regional Hub, Malaysia',
    transitCode: 'MY',
  },
  India: {
    country: 'India',
    flag: '🇮🇳',
    code: 'IN',
    originCity: 'Mumbai, India',
    exportHub: 'Mumbai Regional Sort Hub, India',
    transitHub: 'Pune Transit Facility, India',
    transitCode: 'IN',
  },
};

function getDestinationCities(destinationCountry: string): {
  gateway: string;
  localHub: string;
  countryCode: string;
} {
  const lower = destinationCountry.trim().toLowerCase();
  if (lower === 'india') {
    return {
      gateway: 'Mumbai International Airport Gateway, India',
      localHub: 'Bengaluru Local Delivery Hub, India',
      countryCode: 'IN',
    };
  }
  if (lower === 'united states' || lower === 'usa') {
    return {
      gateway: 'ISC New York Gateway, USA',
      localHub: 'Austin Local Delivery Station, TX',
      countryCode: 'US',
    };
  }
  if (lower === 'united kingdom' || lower === 'uk') {
    return {
      gateway: 'London Heathrow Import Hub, UK',
      localHub: 'Manchester Local Delivery Depot, UK',
      countryCode: 'GB',
    };
  }
  return {
    gateway: `${destinationCountry} International Airport Gateway`,
    localHub: `${destinationCountry} Local Delivery Hub`,
    countryCode: destinationCountry.slice(0, 2).toUpperCase(),
  };
}

function hashString(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) >>> 0;
  }
  return h;
}

export function buildSimulatedRoute(input: RegisterTrackingInput): {
  originCountry: string;
  originFlag: string;
  route: SimulatedCheckpoint[];
} {
  const templateKeys = Object.keys(ORIGIN_TEMPLATES).filter((k) => k !== input.destinationCountry);
  let origin = input.originCountry ? ORIGIN_TEMPLATES[input.originCountry] : undefined;

  if (!origin) {
    const isDomestic =
      input.originCountry?.toLowerCase() === input.destinationCountry.toLowerCase() ||
      ['bluedart', 'delhivery', 'dtdc', 'ekart', 'xpressbees'].includes(input.carrierCode);
    if (isDomestic) {
      origin = ORIGIN_TEMPLATES.India;
    } else {
      const idx = hashString(input.awb) % templateKeys.length;
      origin = ORIGIN_TEMPLATES[templateKeys[idx]];
    }
  }

  const dest = getDestinationCities(input.destinationCountry);
  const isDomesticRoute = origin.country.toLowerCase() === input.destinationCountry.toLowerCase();

  if (isDomesticRoute) {
    const route: SimulatedCheckpoint[] = [
      {
        stage: 'info_received',
        location: origin.originCity,
        countryCode: origin.code,
        rawDescription: `Shipping label created by seller (${input.carrierName})`,
        hoursOffsetFromStart: 0,
      },
      {
        stage: 'in_transit',
        location: origin.originCity,
        countryCode: origin.code,
        rawDescription: `Shipment picked up by ${input.carrierName} courier`,
        hoursOffsetFromStart: 5,
      },
      {
        stage: 'in_transit',
        location: origin.exportHub,
        countryCode: origin.code,
        rawDescription: 'Processed at regional sorting facility',
        hoursOffsetFromStart: 14,
      },
      {
        stage: 'in_transit',
        location: dest.localHub,
        countryCode: dest.countryCode,
        rawDescription: 'Arrived at local delivery hub',
        hoursOffsetFromStart: 30,
      },
      {
        stage: 'out_for_delivery',
        location: dest.localHub,
        countryCode: dest.countryCode,
        rawDescription: 'Out for delivery — loaded on delivery vehicle',
        hoursOffsetFromStart: 36,
      },
      {
        stage: 'delivered',
        location: dest.localHub,
        countryCode: dest.countryCode,
        rawDescription: 'Delivered — handed to resident',
        hoursOffsetFromStart: 42,
      },
    ];
    return {
      originCountry: origin.country,
      originFlag: origin.flag,
      route,
    };
  }

  // International route with customs milestone (and occasional customs inspection notice on 1 in 4 AWBs)
  const includeCustomsInspection = hashString(input.awb) % 4 === 0;
  const route: SimulatedCheckpoint[] = [
    {
      stage: 'info_received',
      location: origin.originCity,
      countryCode: origin.code,
      rawDescription: `Electronic shipping info received by ${input.carrierName}`,
      hoursOffsetFromStart: 0,
    },
    {
      stage: 'in_transit',
      location: origin.originCity,
      countryCode: origin.code,
      rawDescription: `Shipment picked up from sender facility in ${origin.originCity}`,
      hoursOffsetFromStart: 6,
    },
    {
      stage: 'in_transit',
      location: origin.exportHub,
      countryCode: origin.code,
      rawDescription: 'Departed origin country — handed over to international airline',
      hoursOffsetFromStart: 22,
    },
    {
      stage: 'in_transit',
      location: origin.transitHub,
      countryCode: origin.transitCode,
      rawDescription: 'Processed through international transit sorting facility',
      hoursOffsetFromStart: 44,
    },
    {
      stage: 'in_transit',
      location: dest.gateway,
      countryCode: dest.countryCode,
      rawDescription: `Arrived in destination country (${input.destinationCountry})`,
      hoursOffsetFromStart: 66,
    },
    includeCustomsInspection
      ? {
          stage: 'customs',
          location: dest.gateway,
          countryCode: dest.countryCode,
          rawDescription: 'Held for customs inspection — verify KYC or import clearance status',
          hoursOffsetFromStart: 74,
        }
      : {
          stage: 'customs',
          location: dest.gateway,
          countryCode: dest.countryCode,
          rawDescription: 'In customs clearance processing at import gateway',
          hoursOffsetFromStart: 74,
        },
    {
      stage: 'customs',
      location: dest.gateway,
      countryCode: dest.countryCode,
      rawDescription: 'Cleared import customs — released to domestic network',
      hoursOffsetFromStart: 88,
    },
    {
      stage: 'in_transit',
      location: dest.localHub,
      countryCode: dest.countryCode,
      rawDescription: 'Arrived at local delivery station',
      hoursOffsetFromStart: 104,
    },
    {
      stage: 'out_for_delivery',
      location: dest.localHub,
      countryCode: dest.countryCode,
      rawDescription: 'Out for delivery — with delivery courier',
      hoursOffsetFromStart: 112,
    },
    {
      stage: 'delivered',
      location: dest.localHub,
      countryCode: dest.countryCode,
      rawDescription: 'Delivered — signed for by recipient',
      hoursOffsetFromStart: 117,
    },
  ];

  return {
    originCountry: origin.country,
    originFlag: origin.flag,
    route,
  };
}

function buildEventsUpToStage(
  route: SimulatedCheckpoint[],
  stageIndex: number,
  anchorStartMs: number
): RawProviderEvent[] {
  const clamped = Math.min(stageIndex, route.length - 1);
  const events: RawProviderEvent[] = [];
  for (let i = 0; i <= clamped; i++) {
    const cp = route[i];
    const ts = new Date(anchorStartMs + cp.hoursOffsetFromStart * 3600_000).toISOString();
    events.push({
      occurredAt: ts,
      location: cp.location,
      countryCode: cp.countryCode,
      description: cp.rawDescription,
      stageHint: cp.stage,
    });
  }
  return events;
}

function estimateDeliveryDate(route: SimulatedCheckpoint[], currentStage: number): string | null {
  const remaining = route.length - 1 - currentStage;
  if (remaining <= 0) return new Date().toISOString().slice(0, 10);
  const daysLeft = Math.max(1, Math.ceil(remaining * 0.7));
  const eta = new Date(Date.now() + daysLeft * 86400_000);
  return eta.toISOString().slice(0, 10);
}

export const simulatorProvider: TrackingProvider = {
  id: 'simulator',
  displayName: 'Global Simulator (Demo Mode)',

  isConfigured(): boolean {
    return true;
  },

  async registerAndFetch(input: RegisterTrackingInput): Promise<ProviderTrackingResult> {
    const { originCountry, originFlag, route } = buildSimulatedRoute(input);
    // Start freshly dropped AWBs at stage 1 ("Picked Up & Shipped") so the user immediately sees movement!
    const initialStage = 1;
    const anchorStartMs = Date.now() - route[initialStage].hoursOffsetFromStart * 3600_000;
    const events = buildEventsUpToStage(route, initialStage, anchorStartMs);

    return {
      provider: 'simulator',
      providerTrackingId: `sim_${input.awb}`,
      carrierCode: input.carrierCode,
      carrierName: input.carrierName,
      originCountry,
      originFlag: originFlag || getCountryFlag(originCountry),
      destinationCountry: input.destinationCountry,
      destinationFlag: input.destinationFlag || getCountryFlag(input.destinationCountry),
      estimatedDelivery: estimateDeliveryDate(route, initialStage),
      events,
      simulatorStage: initialStage,
      simulatorRoute: route,
    };
  },

  async fetchUpdates(parcel: Parcel): Promise<ProviderTrackingResult> {
    const route =
      parcel.simulatorRoute && parcel.simulatorRoute.length > 0
        ? parcel.simulatorRoute
        : buildSimulatedRoute({
            awb: parcel.awb,
            carrierCode: parcel.carrierCode,
            carrierName: parcel.carrierName,
            originCountry: parcel.originCountry,
            originFlag: parcel.originFlag,
            destinationCountry: parcel.destinationCountry,
            destinationFlag: parcel.destinationFlag,
          }).route;

    const currentStage = Math.max(0, parcel.simulatorStage);
    const nextStage = Math.min(currentStage + 1, route.length - 1);

    // Preserve previous timestamps where possible; anchor the newest checkpoint to "now"
    const now = Date.now();
    const anchorStartMs = now - route[nextStage].hoursOffsetFromStart * 3600_000;
    const events = buildEventsUpToStage(route, nextStage, anchorStartMs);

    return {
      provider: 'simulator',
      providerTrackingId: parcel.providerTrackingId ?? `sim_${parcel.awb}`,
      carrierCode: parcel.carrierCode,
      carrierName: parcel.carrierName,
      originCountry: parcel.originCountry,
      originFlag: parcel.originFlag,
      destinationCountry: parcel.destinationCountry,
      destinationFlag: parcel.destinationFlag,
      estimatedDelivery: estimateDeliveryDate(route, nextStage),
      events,
      simulatorStage: nextStage,
      simulatorRoute: route,
    };
  },
};
