import { CarrierDetectionResult } from '../types.js';

export interface CountryInfo {
  name: string;
  flag: string;
  postCode: string;
  postName: string;
}

export const COUNTRY_META: Record<string, CountryInfo> = {
  US: { name: 'United States', flag: '🇺🇸', postCode: 'usps', postName: 'USPS' },
  CN: { name: 'China', flag: '🇨🇳', postCode: 'chinapost', postName: 'China Post' },
  HK: { name: 'Hong Kong', flag: '🇭🇰', postCode: 'hkpost', postName: 'Hongkong Post' },
  JP: { name: 'Japan', flag: '🇯🇵', postCode: 'japanpost', postName: 'Japan Post' },
  GB: { name: 'United Kingdom', flag: '🇬🇧', postCode: 'royalmail', postName: 'Royal Mail' },
  DE: { name: 'Germany', flag: '🇩🇪', postCode: 'deutschepost', postName: 'Deutsche Post / DHL' },
  FR: { name: 'France', flag: '🇫🇷', postCode: 'laposte', postName: 'La Poste' },
  IN: { name: 'India', flag: '🇮🇳', postCode: 'indiapost', postName: 'India Post' },
  SG: { name: 'Singapore', flag: '🇸🇬', postCode: 'singpost', postName: 'SingPost' },
  KR: { name: 'South Korea', flag: '🇰🇷', postCode: 'koreapost', postName: 'Korea Post' },
  AU: { name: 'Australia', flag: '🇦🇺', postCode: 'auspost', postName: 'Australia Post' },
  CA: { name: 'Canada', flag: '🇨🇦', postCode: 'canadapost', postName: 'Canada Post' },
  NL: { name: 'Netherlands', flag: '🇳🇱', postCode: 'postnl', postName: 'PostNL' },
  IT: { name: 'Italy', flag: '🇮🇹', postCode: 'posteitaliane', postName: 'Poste Italiane' },
  ES: { name: 'Spain', flag: '🇪🇸', postCode: 'correos', postName: 'Correos Spain' },
  AE: { name: 'UAE', flag: '🇦🇪', postCode: 'emiratespost', postName: 'Emirates Post' },
  SE: { name: 'Sweden', flag: '🇸🇪', postCode: 'postnord', postName: 'PostNord' },
  CH: { name: 'Switzerland', flag: '🇨🇭', postCode: 'swisspost', postName: 'Swiss Post' },
  TW: { name: 'Taiwan', flag: '🇹🇼', postCode: 'chunghwapost', postName: 'Chunghwa Post' },
  TH: { name: 'Thailand', flag: '🇹🇭', postCode: 'thailandpost', postName: 'Thailand Post' },
  MY: { name: 'Malaysia', flag: '🇲🇾', postCode: 'posmalaysia', postName: 'Pos Malaysia' },
  BR: { name: 'Brazil', flag: '🇧🇷', postCode: 'correios', postName: 'Correios Brazil' },
};

export function getCountryFlag(countryName: string): string {
  const normalized = countryName.trim().toLowerCase();
  for (const info of Object.values(COUNTRY_META)) {
    if (info.name.toLowerCase() === normalized) return info.flag;
  }
  if (normalized === 'usa' || normalized === 'u.s.a.' || normalized === 'us') return '🇺🇸';
  if (normalized === 'uk' || normalized === 'britain' || normalized === 'england') return '🇬🇧';
  return '🌍';
}

interface CarrierKeywordDef {
  code: string;
  name: string;
  keywords: RegExp[];
  isInternational: boolean;
  defaultOrigin?: { country: string; flag: string };
}

const CARRIER_KEYWORDS: CarrierKeywordDef[] = [
  {
    code: 'dhl',
    name: 'DHL Express',
    keywords: [/\bdhl\s*express\b/i, /\bdhl\s*ecommerce\b/i, /\bdhl\b/i],
    isInternational: true,
    defaultOrigin: { country: 'Germany', flag: '🇩🇪' },
  },
  {
    code: 'fedex',
    name: 'FedEx',
    keywords: [/\bfedex\b/i, /\bfederal\s*express\b/i],
    isInternational: true,
    defaultOrigin: { country: 'United States', flag: '🇺🇸' },
  },
  {
    code: 'ups',
    name: 'UPS',
    keywords: [/\bups\b/i, /\bunited\s*parcel\s*service\b/i],
    isInternational: true,
    defaultOrigin: { country: 'United States', flag: '🇺🇸' },
  },
  {
    code: 'usps',
    name: 'USPS',
    keywords: [/\busps\b/i, /\bu\.?s\.?\s*postal\b/i],
    isInternational: true,
    defaultOrigin: { country: 'United States', flag: '🇺🇸' },
  },
  {
    code: 'bluedart',
    name: 'Blue Dart',
    keywords: [/\bblue\s*dart\b/i, /\bbluedart\b/i],
    isInternational: false,
    defaultOrigin: { country: 'India', flag: '🇮🇳' },
  },
  {
    code: 'delhivery',
    name: 'Delhivery',
    keywords: [/\bdelhivery\b/i],
    isInternational: false,
    defaultOrigin: { country: 'India', flag: '🇮🇳' },
  },
  {
    code: 'indiapost',
    name: 'India Post',
    keywords: [/\bindia\s*post\b/i, /\bspeed\s*post\b/i],
    isInternational: true,
    defaultOrigin: { country: 'India', flag: '🇮🇳' },
  },
  {
    code: 'dtdc',
    name: 'DTDC',
    keywords: [/\bdtdc\b/i],
    isInternational: false,
    defaultOrigin: { country: 'India', flag: '🇮🇳' },
  },
  {
    code: 'ekart',
    name: 'Ekart Logistics',
    keywords: [/\bekart\b/i],
    isInternational: false,
    defaultOrigin: { country: 'India', flag: '🇮🇳' },
  },
  {
    code: 'xpressbees',
    name: 'Xpressbees',
    keywords: [/\bxpressbees\b/i],
    isInternational: false,
    defaultOrigin: { country: 'India', flag: '🇮🇳' },
  },
  {
    code: 'aramex',
    name: 'Aramex',
    keywords: [/\baramex\b/i],
    isInternational: true,
    defaultOrigin: { country: 'UAE', flag: '🇦🇪' },
  },
  {
    code: 'royalmail',
    name: 'Royal Mail',
    keywords: [/\broyal\s*mail\b/i],
    isInternational: true,
    defaultOrigin: { country: 'United Kingdom', flag: '🇬🇧' },
  },
  {
    code: 'cainiao',
    name: 'Cainiao Global',
    keywords: [/\bcainiao\b/i],
    isInternational: true,
    defaultOrigin: { country: 'China', flag: '🇨🇳' },
  },
  {
    code: 'yunexpress',
    name: 'YunExpress',
    keywords: [/\byun\s*express\b/i, /\byunexpress\b/i],
    isInternational: true,
    defaultOrigin: { country: 'China', flag: '🇨🇳' },
  },
  {
    code: 'yanwen',
    name: 'Yanwen Logistics',
    keywords: [/\byanwen\b/i],
    isInternational: true,
    defaultOrigin: { country: 'China', flag: '🇨🇳' },
  },
  {
    code: 'sfexpress',
    name: 'SF Express',
    keywords: [/\bsf\s*express\b/i],
    isInternational: true,
    defaultOrigin: { country: 'China', flag: '🇨🇳' },
  },
  {
    code: 'chinapost',
    name: 'China Post',
    keywords: [/\bchina\s*post\b/i],
    isInternational: true,
    defaultOrigin: { country: 'China', flag: '🇨🇳' },
  },
  {
    code: 'japanpost',
    name: 'Japan Post / EMS',
    keywords: [/\bjapan\s*post\b/i, /\bems\s*japan\b/i],
    isInternational: true,
    defaultOrigin: { country: 'Japan', flag: '🇯🇵' },
  },
  {
    code: 'dpd',
    name: 'DPD',
    keywords: [/\bdpd\b/i],
    isInternational: true,
    defaultOrigin: { country: 'Germany', flag: '🇩🇪' },
  },
  {
    code: 'amazon',
    name: 'Amazon Logistics',
    keywords: [/\bamazon\s*logistics\b/i, /\bats\s*courier\b/i],
    isInternational: false,
  },
  {
    code: 'singpost',
    name: 'SingPost',
    keywords: [/\bsingpost\b/i, /\bsingapore\s*post\b/i],
    isInternational: true,
    defaultOrigin: { country: 'Singapore', flag: '🇸🇬' },
  },
  {
    code: '4px',
    name: '4PX Express',
    keywords: [/\b4px\b/i],
    isInternational: true,
    defaultOrigin: { country: 'China', flag: '🇨🇳' },
  },
];

export const SUPPORTED_CARRIERS = [
  { code: 'auto', name: 'Auto-Detect Worldwide' },
  { code: 'dhl', name: 'DHL Express' },
  { code: 'fedex', name: 'FedEx' },
  { code: 'ups', name: 'UPS' },
  { code: 'usps', name: 'USPS' },
  { code: 'aramex', name: 'Aramex' },
  { code: 'bluedart', name: 'Blue Dart' },
  { code: 'delhivery', name: 'Delhivery' },
  { code: 'indiapost', name: 'India Post' },
  { code: 'dtdc', name: 'DTDC' },
  { code: 'ekart', name: 'Ekart Logistics' },
  { code: 'royalmail', name: 'Royal Mail' },
  { code: 'chinapost', name: 'China Post' },
  { code: 'cainiao', name: 'Cainiao Global' },
  { code: 'yunexpress', name: 'YunExpress' },
  { code: 'yanwen', name: 'Yanwen Logistics' },
  { code: 'sfexpress', name: 'SF Express' },
  { code: 'japanpost', name: 'Japan Post / EMS' },
  { code: 'dpd', name: 'DPD' },
  { code: 'singpost', name: 'SingPost' },
  { code: '4px', name: '4PX Express' },
  { code: 'amazon', name: 'Amazon Logistics' },
];

export function normalizeAwb(raw: string): string {
  return raw.replace(/[\s\-_]+/g, '').toUpperCase().trim();
}

export function detectCarrier(rawAwb: string, hintText?: string): CarrierDetectionResult {
  const awb = normalizeAwb(rawAwb);

  // 1. Check high-specificity globally standardized AWB patterns first
  // UPS: 1Z + 16 alphanumeric
  if (/^1Z[A-Z0-9]{16}$/.test(awb)) {
    return {
      carrierCode: 'ups',
      carrierName: 'UPS',
      confidence: 'high',
      originCountry: 'United States',
      originFlag: '🇺🇸',
      isInternational: true,
      reason: 'Matched UPS 1Z 18-character format',
    };
  }

  // UPU S10 International Postal Standard: 2 letters + 9 digits + 2-letter ISO country code
  const upuMatch = awb.match(/^([A-Z]{2})\d{9}([A-Z]{2})$/);
  if (upuMatch) {
    const countryIso = upuMatch[2];
    const meta = COUNTRY_META[countryIso];
    if (meta) {
      return {
        carrierCode: meta.postCode,
        carrierName: meta.postName,
        confidence: 'high',
        originCountry: meta.name,
        originFlag: meta.flag,
        isInternational: true,
        reason: `Matched international postal UPU S10 code (${countryIso})`,
      };
    }
    return {
      carrierCode: 'globalpost',
      carrierName: `International Post (${countryIso})`,
      confidence: 'medium',
      originCountry: countryIso,
      originFlag: '🌐',
      isInternational: true,
      reason: `Matched UPU S10 international postal format (${countryIso})`,
    };
  }

  // Amazon Logistics
  if (/^TB[AMC]\d{12}$/.test(awb)) {
    return {
      carrierCode: 'amazon',
      carrierName: 'Amazon Logistics',
      confidence: 'high',
      isInternational: false,
      reason: 'Matched Amazon TBA/TBM/TBC format',
    };
  }

  // YunExpress
  if (/^YT\d{16}$/.test(awb)) {
    return {
      carrierCode: 'yunexpress',
      carrierName: 'YunExpress',
      confidence: 'high',
      originCountry: 'China',
      originFlag: '🇨🇳',
      isInternational: true,
      reason: 'Matched YunExpress YT 18-character format',
    };
  }

  // Cainiao / AliExpress Standard Shipping
  if (/^(LP\d{14,16}|CAINIAO\d+|CN[A-Z]{2}\d{10,14})$/.test(awb)) {
    return {
      carrierCode: 'cainiao',
      carrierName: 'Cainiao Global',
      confidence: 'high',
      originCountry: 'China',
      originFlag: '🇨🇳',
      isInternational: true,
      reason: 'Matched Cainiao Global prefix',
    };
  }

  // SF Express
  if (/^SF\d{13}$/.test(awb)) {
    return {
      carrierCode: 'sfexpress',
      carrierName: 'SF Express',
      confidence: 'high',
      originCountry: 'China',
      originFlag: '🇨🇳',
      isInternational: true,
      reason: 'Matched SF Express SF + 13 digits',
    };
  }

  // Yanwen
  if (/^(YW|UJ|UD|SY)\d{11,15}(YP|CN)?$/.test(awb)) {
    return {
      carrierCode: 'yanwen',
      carrierName: 'Yanwen Logistics',
      confidence: 'high',
      originCountry: 'China',
      originFlag: '🇨🇳',
      isInternational: true,
      reason: 'Matched Yanwen cross-border format',
    };
  }

  // 4PX Express
  if (/^(4PX|PX)\d{10,18}$/.test(awb)) {
    return {
      carrierCode: '4px',
      carrierName: '4PX Express',
      confidence: 'high',
      originCountry: 'China',
      originFlag: '🇨🇳',
      isInternational: true,
      reason: 'Matched 4PX Express prefix',
    };
  }

  // DHL Express / eCommerce prefixed formats
  if (/^(JD01\d{14,18}|JJD\d{12,18}|GM\d{16,20}|LX\d{9}DE)$/.test(awb)) {
    return {
      carrierCode: 'dhl',
      carrierName: 'DHL Express',
      confidence: 'high',
      originCountry: 'Germany',
      originFlag: '🇩🇪',
      isInternational: true,
      reason: 'Matched DHL prefixed format',
    };
  }

  // USPS 20-22 digit or 420-zip prefixed
  if (/^(9[2345]\d{18,20}|420\d{27,31})$/.test(awb)) {
    return {
      carrierCode: 'usps',
      carrierName: 'USPS',
      confidence: 'high',
      originCountry: 'United States',
      originFlag: '🇺🇸',
      isInternational: true,
      reason: 'Matched USPS 20-22 digit Intelligent Mail format',
    };
  }

  // FedEx 96... 20-22 digit or DT prefix
  if (/^(96\d{18,20}|DT\d{12})$/.test(awb)) {
    return {
      carrierCode: 'fedex',
      carrierName: 'FedEx',
      confidence: 'high',
      originCountry: 'United States',
      originFlag: '🇺🇸',
      isInternational: true,
      reason: 'Matched FedEx extended format',
    };
  }

  // Ekart (FMPC / FMPP / MYEP)
  if (/^(FMPC|FMPP|MYEP|EKRT)\d{8,14}$/.test(awb)) {
    return {
      carrierCode: 'ekart',
      carrierName: 'Ekart Logistics',
      confidence: 'high',
      originCountry: 'India',
      originFlag: '🇮🇳',
      isInternational: false,
      reason: 'Matched Ekart prefix',
    };
  }

  // DTDC (1 letter + 8-9 digits, e.g. D12345678, Z12345678, I12345678)
  if (/^[DIZVBC]\d{8,9}$/.test(awb)) {
    return {
      carrierCode: 'dtdc',
      carrierName: 'DTDC',
      confidence: 'medium',
      originCountry: 'India',
      originFlag: '🇮🇳',
      isInternational: false,
      reason: 'Matched DTDC alphanumeric AWB pattern',
    };
  }

  // 2. If hintText explicitly mentions a carrier, use it to disambiguate pure-numeric AWBs
  if (hintText && hintText.trim().length > 0) {
    for (const def of CARRIER_KEYWORDS) {
      if (def.keywords.some((re) => re.test(hintText))) {
        return {
          carrierCode: def.code,
          carrierName: def.name,
          confidence: 'high',
          originCountry: def.defaultOrigin?.country,
          originFlag: def.defaultOrigin?.flag,
          isInternational: def.isInternational,
          reason: `Identified ${def.name} from message context`,
        };
      }
    }
  }

  // 3. Fallback numeric heuristics for pure-digit AWBs
  if (/^\d{10}$/.test(awb)) {
    return {
      carrierCode: 'dhl',
      carrierName: 'DHL Express',
      confidence: 'medium',
      originCountry: 'Germany',
      originFlag: '🇩🇪',
      isInternational: true,
      reason: '10-digit AWB commonly used by DHL Express',
    };
  }

  if (/^\d{11}$/.test(awb)) {
    return {
      carrierCode: 'bluedart',
      carrierName: 'Blue Dart',
      confidence: 'medium',
      originCountry: 'India',
      originFlag: '🇮🇳',
      isInternational: false,
      reason: '11-digit AWB commonly used by Blue Dart / Aramex',
    };
  }

  if (/^\d{12}$/.test(awb) || /^\d{15}$/.test(awb)) {
    return {
      carrierCode: 'fedex',
      carrierName: 'FedEx',
      confidence: 'medium',
      originCountry: 'United States',
      originFlag: '🇺🇸',
      isInternational: true,
      reason: `${awb.length}-digit AWB commonly used by FedEx`,
    };
  }

  if (/^\d{13,14}$/.test(awb)) {
    return {
      carrierCode: 'delhivery',
      carrierName: 'Delhivery',
      confidence: 'medium',
      originCountry: 'India',
      originFlag: '🇮🇳',
      isInternational: false,
      reason: `${awb.length}-digit AWB commonly used by Delhivery / DPD`,
    };
  }

  return {
    carrierCode: 'global',
    carrierName: 'Global Carrier (Auto)',
    confidence: 'low',
    isInternational: true,
    reason: 'Will auto-resolve via global tracking engine',
  };
}
