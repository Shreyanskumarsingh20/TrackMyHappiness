import { EventImportance, ParcelStage } from '../types.js';

export interface ClassifiedEvent {
  stage: ParcelStage;
  importance: EventImportance;
  friendlyTitle: string;
  friendlySummary: string;
}

export function classifyTrackingEvent(
  rawDescription: string,
  location: string,
  stageHint?: ParcelStage
): ClassifiedEvent {
  const desc = rawDescription.trim();
  const lower = desc.toLowerCase();
  const locSuffix = location ? ` in ${location}` : '';

  // 1. Critical exceptions / holds / failed delivery / customs duty required
  if (
    stageHint === 'exception' ||
    /\b(exception|failed\s*delivery|delivery\s*attempt|attempted\s*delivery|absence|retention|undeliverable|address\s*(?:issue|incorrect|incomplete)|returned\s*to\s*sender|damaged|lost|missing|unable\s*to\s*deliver|refused|weather\s*delay|delayed)\b/i.test(
      lower
    )
  ) {
    const isCustomsHold = /\b(customs|duty|tax|clearance\s*delay|kyc|documentation)\b/i.test(lower);
    if (isCustomsHold) {
      return {
        stage: 'exception',
        importance: 'critical',
        friendlyTitle: 'Customs Action Needed',
        friendlySummary: `Customs requires attention or documents${locSuffix}: ${desc}`,
      };
    }
    if (/\b(attempt|absence|retention|not\s*home|recipient\s*unavailable)\b/i.test(lower)) {
      return {
        stage: 'exception',
        importance: 'critical',
        friendlyTitle: 'Delivery Attempted / Held for Pickup',
        friendlySummary: `Courier attempted delivery or is holding your parcel${locSuffix} — check if reschedule or pickup is needed.`,
      };
    }
    return {
      stage: 'exception',
      importance: 'critical',
      friendlyTitle: 'Delivery Exception',
      friendlySummary: `Attention needed${locSuffix}: ${desc}`,
    };
  }

  // 2. Delivered
  if (
    stageHint === 'delivered' ||
    /\b(delivered|final\s*delivery|signed\s*for\s*by|left\s*at\s*front\s*door|handed\s*to\s*resident|collected\s*by\s*recipient)\b/i.test(
      lower
    )
  ) {
    return {
      stage: 'delivered',
      importance: 'important',
      friendlyTitle: 'Delivered!',
      friendlySummary: `Your parcel has been delivered${locSuffix}.`,
    };
  }

  // 3. Out for delivery
  if (
    stageHint === 'out_for_delivery' ||
    /\b(out\s*for\s*delivery|with\s*delivery\s*courier|on\s*fedex\s*vehicle\s*for\s*delivery|loaded\s*on\s*delivery\s*vehicle|arriving\s*today|processing\s*at\s*delivery\s*post\s*office)\b/i.test(
      lower
    )
  ) {
    return {
      stage: 'out_for_delivery',
      importance: 'important',
      friendlyTitle: 'Out for Delivery',
      friendlySummary: `On the way with your local courier${locSuffix} — keep an eye out today!`,
    };
  }

  // 4. Customs clearance / customs hold / import release
  if (
    stageHint === 'customs' ||
    /\b(customs|import\s*clearance|clearance\s*event|cleared\s*import|duty|kyc|border\s*agency|isc\s|departure\s*from\s*inward\s*office\s*of\s*exchange)\b/i.test(
      lower
    )
  ) {
    if (/\b(hold|held|required|pending\s*payment|duty\s*due|kyc|awaiting\s*documents|inspection)\b/i.test(lower)) {
      return {
        stage: 'customs',
        importance: 'critical',
        friendlyTitle: 'Customs Hold / Inspection',
        friendlySummary: `Held at customs${locSuffix}. Keep an eye out for KYC or duty requests.`,
      };
    }
    if (
      /\b(cleared|released|completed|passed|returned\s*from\s*import\s*customs|departure\s*from\s*inward\s*office\s*of\s*exchange)\b/i.test(
        lower
      )
    ) {
      return {
        stage: 'customs',
        importance: 'important',
        friendlyTitle: 'Cleared Customs',
        friendlySummary: `Smooth sailing! Cleared customs${locSuffix} and moving toward local delivery.`,
      };
    }
    return {
      stage: 'customs',
      importance: 'important',
      friendlyTitle: 'In Customs Clearance',
      friendlySummary: `Presented to import customs${locSuffix}.`,
    };
  }

  // 5. Info received / label created
  if (
    stageHint === 'info_received' ||
    /\b(label\s*created|shipping\s*info\s*received|electronic\s*information|pre-shipment|manifest\s*generated|order\s*processed|awaiting\s*pickup|no\s*scan\s*events\s*posted)\b/i.test(
      lower
    )
  ) {
    return {
      stage: 'info_received',
      importance: 'minor',
      friendlyTitle: 'Shipping Label Created',
      friendlySummary: `Waiting for first carrier scan${locSuffix}.`,
    };
  }

  // 6. Important international & handoff transit milestones
  if (
    /\b(picked\s*up|shipment\s*picked|accepted\s*by\s*carrier|dropped\s*off|dispatched\s*from\s*sender|posting\/collection|posting\s*\/\s*collection|acceptance)\b/i.test(
      lower
    )
  ) {
    return {
      stage: 'in_transit',
      importance: 'important',
      friendlyTitle: 'Picked Up & Shipped',
      friendlySummary: `Courier accepted your parcel${locSuffix} — journey started!`,
    };
  }

  if (
    /\b(arrived\s*in\s*destination\s*country|arrived\s*at\s*destination\s*(?:airport|gateway|hub)|import\s*arrival|landed\s*in|arrival\s*at\s*inward\s*office\s*of\s*exchange)\b/i.test(
      lower
    )
  ) {
    return {
      stage: 'in_transit',
      importance: 'important',
      friendlyTitle: 'Arrived in Destination Country',
      friendlySummary: `Landed in your country${locSuffix}! Next up: customs & local delivery.`,
    };
  }

  if (
    /\b(departed\s*(?:origin\s*)?country|export\s*flight|left\s*origin|international\s*flight\s*departed|hand\s*over\s*to\s*airline|departed\s*export\s*gateway|dispatch\s*from\s*outward\s*office\s*of\s*exchange)\b/i.test(
      lower
    )
  ) {
    return {
      stage: 'in_transit',
      importance: 'important',
      friendlyTitle: 'Departed Origin Country',
      friendlySummary: `Dispatched internationally${locSuffix} on its way to you.`,
    };
  }

  if (/\b(arrived\s*at\s*(?:local|delivery)\s*(?:station|hub|facility|branch))\b/i.test(lower)) {
    return {
      stage: 'in_transit',
      importance: 'important',
      friendlyTitle: 'At Local Delivery Hub',
      friendlySummary: `Reached your local delivery station${locSuffix} — delivery coming up soon.`,
    };
  }

  // 7. Everything else is routine in-transit hub scan (minor!)
  return {
    stage: stageHint ?? 'in_transit',
    importance: 'minor',
    friendlyTitle: 'In Transit',
    friendlySummary: `${desc}${locSuffix ? ` (${location})` : ''}`,
  };
}

export function buildParcelStatusSummary(
  stage: ParcelStage,
  friendlyTitle: string,
  location: string,
  estimatedDelivery: string | null
): string {
  const loc = location ? ` in ${location}` : '';
  switch (stage) {
    case 'delivered':
      return `Delivered${loc}`;
    case 'out_for_delivery':
      return `Out for delivery${loc} — arriving today`;
    case 'customs':
      return `${friendlyTitle}${loc}`;
    case 'exception':
      return `${friendlyTitle}${loc}`;
    case 'info_received':
      return 'Label created — waiting for courier pickup';
    case 'pending':
      return 'Tracking registered — fetching first update';
    default: {
      const etaPart = estimatedDelivery ? ` • ETA ${estimatedDelivery}` : '';
      return `${friendlyTitle}${loc}${etaPart}`;
    }
  }
}
