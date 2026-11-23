import { ItemCategory, SmartPasteResult } from '../types.js';
import { detectCarrier, normalizeAwb } from './carrierDetector.js';

const KNOWN_MERCHANTS: { name: string; pattern: RegExp }[] = [
  { name: 'Amazon', pattern: /\bamazon(?:\.[a-z.]+)?\b/i },
  { name: 'AliExpress', pattern: /\baliexpress\b/i },
  { name: 'Apple', pattern: /\bapple\s*store\b|\bapple\.com\b/i },
  { name: 'Flipkart', pattern: /\bflipkart\b/i },
  { name: 'Myntra', pattern: /\bmyntra\b/i },
  { name: 'Nykaa', pattern: /\bnykaa\b/i },
  { name: 'Etsy', pattern: /\betsy\b/i },
  { name: 'eBay', pattern: /\bebay\b/i },
  { name: 'Temu', pattern: /\btemu\b/i },
  { name: 'Shein', pattern: /\bshein\b/i },
  { name: 'Nike', pattern: /\bnike\b/i },
  { name: 'Adidas', pattern: /\badidas\b/i },
  { name: 'Zara', pattern: /\bzara\b/i },
  { name: 'Uniqlo', pattern: /\buniqlo\b/i },
  { name: 'IKEA', pattern: /\bikea\b/i },
  { name: 'Sephora', pattern: /\bsephora\b/i },
  { name: 'Meesho', pattern: /\bmeesho\b/i },
  { name: 'Ajio', pattern: /\bajio\b/i },
  { name: 'Croma', pattern: /\bcroma\b/i },
  { name: 'Best Buy', pattern: /\bbest\s*buy\b/i },
  { name: 'Target', pattern: /\btarget\.com\b|\bfrom\s+target\b/i },
  { name: 'Walmart', pattern: /\bwalmart\b/i },
  { name: 'StockX', pattern: /\bstockx\b/i },
  { name: 'Farfetch', pattern: /\bfarfetch\b/i },
  { name: 'Kickstarter', pattern: /\bkickstarter\b/i },
  { name: 'Drop', pattern: /\bdrop\.com\b/i },
  { name: 'Keychron', pattern: /\bkeychron\b/i },
  { name: 'Sony', pattern: /\bsony\s*store\b/i },
  { name: 'ASOS', pattern: /\basos\b/i },
  { name: 'Decathlon', pattern: /\bdecathlon\b/i },
  { name: 'Tata CLiQ', pattern: /\btata\s*cliq\b/i },
];

export const CATEGORY_EMOJI: Record<ItemCategory, string> = {
  electronics: '🎧',
  fashion: '👟',
  home: '🛋️',
  beauty: '✨',
  books: '📚',
  gift: '🎁',
  food: '☕',
  health: '💊',
  hobby: '🎮',
  other: '📦',
};

const CATEGORY_PATTERNS: { category: ItemCategory; emoji: string; pattern: RegExp }[] = [
  {
    category: 'electronics',
    emoji: '🎧',
    pattern:
      /\b(airpods|headphones|earbuds|keyboard|keycaps|mouse|laptop|macbook|iphone|pixel|phone|ipad|tablet|watch|charger|cable|ssd|camera|lens|drone|speaker|monitor|gpu|powerbank|adapter|kindle|sony\s*wh)\b/i,
  },
  {
    category: 'fashion',
    emoji: '👟',
    pattern:
      /\b(shoes|sneakers|jacket|hoodie|shirt|t-shirt|jeans|dress|coat|boots|bag|backpack|wallet|sunglasses|cap|hat|kurta|saree|sweater|watch\s*strap|nike|adidas|zara|uniqlo)\b/i,
  },
  {
    category: 'home',
    emoji: '🛋️',
    pattern:
      /\b(lamp|desk|chair|pillow|blanket|mug|bottle|flask|kettle|blender|vacuum|organizer|mirror|candle|curtain|bedsheet|rug|plant|kitchen|pan|knife|ikea)\b/i,
  },
  {
    category: 'beauty',
    emoji: '✨',
    pattern:
      /\b(serum|skincare|perfume|cologne|sunscreen|moisturizer|lipstick|shampoo|conditioner|makeup|cream|cleanser|nykaa|sephora)\b/i,
  },
  {
    category: 'books',
    emoji: '📚',
    pattern: /\b(book|novel|manga|comic|hardcover|paperback|journal|notebook|vinyl|record)\b/i,
  },
  {
    category: 'gift',
    emoji: '🎁',
    pattern: /\b(gift|birthday|anniversary|present|surprise|flowers|hamper)\b/i,
  },
  {
    category: 'food',
    emoji: '☕',
    pattern: /\b(coffee|matcha|tea|beans|chocolate|snacks|protein|spices|sauce|honey)\b/i,
  },
  {
    category: 'health',
    emoji: '💊',
    pattern: /\b(vitamins|supplement|medicine|creatine|omega|whey|mask|toothbrush|fitness|yoga)\b/i,
  },
  {
    category: 'hobby',
    emoji: '🎮',
    pattern:
      /\b(lego|game|ps5|xbox|nintendo|switch|controller|figure|figurine|collectible|art|paint|guitar|bike|cycling|camping|tent)\b/i,
  },
];

export function inferCategoryAndEmoji(
  text: string,
  merchant?: string | null
): { category: ItemCategory; emoji: string } {
  const combined = `${text} ${merchant ?? ''}`;
  for (const rule of CATEGORY_PATTERNS) {
    if (rule.pattern.test(combined)) {
      // More tailored emoji for electronics sub-items
      if (rule.category === 'electronics') {
        if (/\b(keyboard|keycaps)\b/i.test(combined)) return { category: 'electronics', emoji: '⌨️' };
        if (/\b(iphone|pixel|phone|smartphone)\b/i.test(combined)) return { category: 'electronics', emoji: '📱' };
        if (/\b(laptop|macbook)\b/i.test(combined)) return { category: 'electronics', emoji: '💻' };
        if (/\b(camera|lens)\b/i.test(combined)) return { category: 'electronics', emoji: '📷' };
        if (/\b(watch|smartwatch)\b/i.test(combined)) return { category: 'electronics', emoji: '⌚' };
      }
      if (rule.category === 'fashion') {
        if (/\b(jacket|hoodie|shirt|dress|coat|sweater|kurta)\b/i.test(combined)) {
          return { category: 'fashion', emoji: '🧥' };
        }
        if (/\b(bag|backpack|wallet)\b/i.test(combined)) return { category: 'fashion', emoji: '🎒' };
      }
      return { category: rule.category, emoji: rule.emoji };
    }
  }
  return { category: 'other', emoji: '📦' };
}

function extractUrl(text: string): string | null {
  const m = text.match(/https?:\/\/[^\s<>)"']+/i);
  return m ? m[0].replace(/[.,;!?]+$/, '') : null;
}

function extractMerchant(text: string, url: string | null): string | null {
  for (const m of KNOWN_MERCHANTS) {
    if (m.pattern.test(text)) return m.name;
  }

  // Pattern: "from <Store Name>" or "at <Store Name>"
  const fromMatch = text.match(
    /\b(?:ordered\s+from|shipped\s+from|purchased\s+from|from)\s+([A-Z][A-Za-z0-9&'.-]{2,24}(?:\s+[A-Z][A-Za-z0-9&'.-]{1,20})?)/
  );
  if (fromMatch) {
    const candidate = fromMatch[1].trim();
    const stopWords = /^(DHL|FedEx|UPS|USPS|China|Japan|Germany|USA|India|UK|Blue Dart|Delhivery|Aramex|Royal Mail|Your|Our|The)$/i;
    if (!stopWords.test(candidate)) {
      return candidate;
    }
  }

  if (url) {
    try {
      const host = new URL(url).hostname.replace(/^www\./, '');
      const main = host.split('.')[0];
      if (main && !['track', 'tracking', 't', 'bit', 'tinyurl', 'dhl', 'fedex', 'ups'].includes(main.toLowerCase())) {
        return main.charAt(0).toUpperCase() + main.slice(1);
      }
    } catch {
      // ignore invalid URL
    }
  }

  return null;
}

function extractEstimatedDelivery(text: string): string | null {
  // ISO date: 2026-11-28
  const iso = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (iso) return iso[1];

  // Natural date after arriving / delivery / eta / expected
  const natural = text.match(
    /\b(?:arriving|expected|delivery\s*(?:by|on)?|eta)\s*(?:by|on|:)?\s*((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2}(?:,?\s*20\d{2})?|\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?(?:\s+20\d{2})?)/i
  );
  if (natural) {
    const rawDate = natural[1].replace(/\./g, '');
    const hasYear = /20\d{2}/.test(rawDate);
    const parsed = new Date(hasYear ? rawDate : `${rawDate}, ${new Date().getFullYear()}`);
    if (!Number.isNaN(parsed.getTime())) {
      const yyyy = parsed.getFullYear();
      const mm = String(parsed.getMonth() + 1).padStart(2, '0');
      const dd = String(parsed.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }
  }
  return null;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function cleanItemTitle(raw: string, merchant?: string | null): string | null {
  let cleaned = raw
    .replace(/^["'“”‘’]+|["'“”‘’]+$/g, '')
    .replace(/\b(?:has been|have been|is|was)\s+(?:shipped|dispatched|out for delivery|packed|sent|on the way).*$/i, '')
    .replace(/\b(?:via|with|using)\s+(?:DHL|FedEx|UPS|USPS|Blue\s*Dart|Delhivery|Aramex|India\s*Post|Royal\s*Mail|China\s*Post|Cainiao|YunExpress|Yanwen|SF\s*Express).*$/i, '')
    .replace(/\b(?:from\s+(?:Amazon|Flipkart|AliExpress|Etsy|eBay|Myntra|Nykaa|Temu|Shein|Apple|Nike|Adidas|Zara|IKEA|Keychron)[\w.]*).*$/i, '')
    .replace(/\b(?:tracking|awb|waybill|order)\s*(?:number|no\.?|id|#)?\s*[:#-]?\s*[A-Z0-9-]{6,}.*$/i, '');

  if (merchant) {
    cleaned = cleaned.replace(new RegExp(`\\s+from\\s+${escapeRegExp(merchant)}\\b.*$`, 'i'), '');
  }

  cleaned = cleaned
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.,;:\-–—]+$/, '')
    .trim();

  if (cleaned.length < 3) return null;
  if (/^(order|package|parcel|shipment|item|delivery|your order|your package|your parcel)$/i.test(cleaned)) {
    return null;
  }
  if (cleaned.length > 72) {
    cleaned = `${cleaned.slice(0, 69).trim()}...`;
  }
  return cleaned;
}

function extractItemTitle(text: string, merchant?: string | null): string | null {
  const patterns: RegExp[] = [
    /(?:item|product|contents|what(?:'s| is)\s*inside|package\s+containing|containing)\s*[:\-–]\s*([^\n.;!?]{3,90})/i,
    /\byour\s+(?:order\s+(?:for|of)\s+|package\s+(?:with|containing)\s+)?["“]?([A-Za-z0-9][A-Za-z0-9\s\-&+'()/]{2,75})["”]?\s+(?:from\s+[A-Za-z0-9.& ]+\s+)?(?:has\s+shipped|have\s+shipped|has\s+been\s+(?:shipped|dispatched)|is\s+(?:on\s+the\s+way|out\s+for\s+delivery|shipped|dispatched))/i,
    /\b(?:shipped|dispatched|ordered|bought)\s*[:\-–]?\s*["“]([^"”]{3,75})["”]/i,
    /\border\s+for\s+([^\n.,;!?]{3,75})/i,
    /"([^"]{4,65})"/,
  ];

  for (const re of patterns) {
    const match = text.match(re);
    if (match?.[1]) {
      const cleaned = cleanItemTitle(match[1], merchant);
      if (cleaned) return cleaned;
    }
  }
  return null;
}

function extractCandidateAwbs(text: string): string[] {
  const found: { value: string; score: number }[] = [];
  const seen = new Set<string>();

  const addCandidate = (raw: string, score: number) => {
    const normalized = normalizeAwb(raw);
    if (normalized.length < 8 || normalized.length > 34) return;
    // Skip pure years/dates or phone numbers starting with +91/+1/00
    if (/^(20\d{6}|19\d{6})$/.test(normalized)) return;
    if (/^\d{10}$/.test(normalized) && /^[6-9]/.test(normalized) && /\+91|\bcall\b|\bphone\b|\bmobile\b|\bhelpline\b/i.test(text)) {
      // Lower score if likely a phone number unless explicitly labeled AWB
      score -= 40;
    }
    if (!seen.has(normalized)) {
      seen.add(normalized);
      found.push({ value: normalized, score });
    } else {
      const existing = found.find((f) => f.value === normalized);
      if (existing && score > existing.score) existing.score = score;
    }
  };

  // Strip URLs before scanning tokens so URL paths don't masquerade as AWBs
  const textWithoutUrls = text.replace(/https?:\/\/[^\s<>)"']+/gi, ' ');

  // 1. Explicitly labeled AWB / Tracking / Waybill numbers (highest priority!)
  const labeledRe =
    /\b(?:awb|air\s*waybill|waybill|tracking(?:\s*(?:id|no\.?|number|#))?|consignment(?:\s*(?:no\.?|number|id))?|docket(?:\s*(?:no\.?|number))?|shipment\s*(?:id|no\.?|#))\s*[:#\-=]?\s*([A-Z0-9][A-Z0-9\-\s]{7,30}[A-Z0-9])\b/gi;
  let m: RegExpExecArray | null;
  while ((m = labeledRe.exec(textWithoutUrls)) !== null) {
    const candidate = m[1].trim().split(/\s{2,}/)[0];
    // Avoid swallowing trailing English words like "arriving" or "via"
    const cleanedToken = candidate.replace(/\s+(?:via|from|by|arriving|expected|on|for|is|was|with).*$/i, '').trim();
    if (/^[A-Z0-9\- ]{8,34}$/i.test(cleanedToken) && /\d{4,}/.test(cleanedToken)) {
      addCandidate(cleanedToken, 100);
    }
  }

  // 2. Unambiguous global carrier formats anywhere in text (including spaced AWBs like "LP 107 964 364 JP")
  const patternMatchers: { re: RegExp; score: number }[] = [
    { re: /\b1Z(?:\s*[A-Z0-9]){16}\b/gi, score: 95 }, // UPS (plain or spaced)
    { re: /\b[A-Z]{2}(?:[\s-]*\d){9}[\s-]*[A-Z]{2}\b/gi, score: 95 }, // UPU S10 international post (e.g. LP 107 964 364 JP)
    { re: /\bTB[AMC]\d{12}\b/gi, score: 92 }, // Amazon
    { re: /\bYT\d{16}\b/gi, score: 92 }, // YunExpress
    { re: /\bLP\d{14,16}\b/gi, score: 90 }, // Cainiao
    { re: /\bSF\d{13}\b/gi, score: 90 }, // SF Express
    { re: /\b(?:JD01\d{14,18}|JJD\d{12,18}|GM\d{16,20})\b/gi, score: 90 }, // DHL prefixed
    { re: /\b(?:FMPC|FMPP|MYEP)\d{8,14}\b/gi, score: 90 }, // Ekart
    { re: /\b(?:4PX|PX)\d{10,18}\b/gi, score: 88 }, // 4PX
    { re: /\b9[23456]\d{18,20}\b/g, score: 85 }, // USPS / FedEx 20-22 digits
    { re: /\b\d{10,18}\b/g, score: 55 }, // Generic numeric AWB (DHL 10, BlueDart 11, FedEx 12/15, Delhivery 13-14)
  ];

  for (const { re, score } of patternMatchers) {
    let match: RegExpExecArray | null;
    while ((match = re.exec(textWithoutUrls)) !== null) {
      const idx = match.index;
      const prefixContext = textWithoutUrls.slice(Math.max(0, idx - 20), idx);
      let adjustedScore = score;
      // Penalize tokens directly preceded by "Order #" or phone indicators
      if (/\b(?:order|invoice|ref|otp|tel|phone|call|mobile)\s*[:#\-]?\s*$/i.test(prefixContext)) {
        adjustedScore -= 45;
      }
      if (/\+\d{1,3}\s*$/.test(prefixContext)) {
        adjustedScore -= 60;
      }
      addCandidate(match[0], adjustedScore);
    }
  }

  return found
    .filter((f) => f.score > 10)
    .sort((a, b) => b.score - a.score)
    .map((f) => f.value);
}

export function parseSmartPaste(rawText: string): SmartPasteResult {
  const text = rawText.trim();
  const orderUrl = extractUrl(text);
  const allCandidateAwbs = extractCandidateAwbs(text);
  const awb = allCandidateAwbs[0] ?? null;
  const carrier = awb ? detectCarrier(awb, text) : null;
  const merchant = extractMerchant(text, orderUrl);
  const itemTitle = extractItemTitle(text, merchant);
  const estimatedDelivery = extractEstimatedDelivery(text);
  const { category, emoji } = inferCategoryAndEmoji(itemTitle ?? text, merchant);

  // If the entire pasted input is just a raw AWB, no extra notes needed
  const isJustAwb = awb !== null && normalizeAwb(text) === awb;

  return {
    awb,
    allCandidateAwbs,
    carrier,
    itemTitle,
    merchant,
    itemCategory: category,
    itemEmoji: emoji,
    orderUrl,
    estimatedDelivery,
    notes: isJustAwb ? null : text.length > 240 ? `${text.slice(0, 237)}...` : text,
  };
}
