import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough, Readable } from 'node:stream';
import { describe, it } from 'node:test';
import type { Express } from 'express';
import { createApp } from '../app.js';
import { AppStore } from '../db/store.js';
import { detectCarrier } from '../services/carrierDetector.js';
import { buildCarrierTrackingUrl } from '../services/carrierTrackingUrls.js';
import { classifyTrackingEvent } from '../services/milestoneClassifier.js';
import { parseCainiaoJson, parseJapanPostHtml } from '../services/providers/freeDirectProvider.js';
import { parseSmartPaste } from '../services/smartPaste.js';
import { TrackerService } from '../services/trackerService.js';

/**
 * In-process Express request dispatcher (exercises full Express middleware,
 * JSON parsing, Zod validation, and routing without opening a TCP port).
 */
async function invokeApp(
  app: Express,
  method: string,
  url: string,
  body?: unknown
): Promise<{ status: number; json: any }> {
  return new Promise((resolve, reject) => {
    const payload = body !== undefined ? Buffer.from(JSON.stringify(body), 'utf8') : null;
    const reqStream = new Readable({
      read() {
        if (payload) this.push(payload);
        this.push(null);
      },
    }) as any;

    reqStream.method = method;
    reqStream.url = url;
    reqStream.headers = payload
      ? { 'content-type': 'application/json', 'content-length': String(payload.length) }
      : {};
    reqStream.socket = Object.assign(new PassThrough(), { remoteAddress: '127.0.0.1' });
    reqStream.connection = reqStream.socket;
    reqStream.httpVersion = '1.1';
    reqStream.httpVersionMajor = 1;
    reqStream.httpVersionMinor = 1;

    const chunks: Buffer[] = [];
    const headers: Record<string, string | string[]> = {};
    const res: any = new EventEmitter();
    res.statusCode = 200;
    res.locals = {};
    res.headersSent = false;
    res.setHeader = (k: string, v: string | string[]) => {
      headers[k.toLowerCase()] = v;
      return res;
    };
    res.getHeader = (k: string) => headers[k.toLowerCase()];
    res.getHeaders = () => ({ ...headers });
    res.hasHeader = (k: string) => k.toLowerCase() in headers;
    res.removeHeader = (k: string) => {
      delete headers[k.toLowerCase()];
    };
    res.writeHead = (code: number, hdrs?: Record<string, string>) => {
      res.statusCode = code;
      if (hdrs) {
        for (const [k, v] of Object.entries(hdrs)) headers[k.toLowerCase()] = v;
      }
      return res;
    };
    res.write = (chunk: any) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
      return true;
    };
    res.end = (chunk?: any) => {
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
      res.headersSent = true;
      const text = Buffer.concat(chunks).toString('utf8');
      let json: any = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = text;
      }
      res.emit('finish');
      resolve({ status: res.statusCode, json });
      return res;
    };

    try {
      (app as any).handle(reqStream, res, (err?: unknown) => {
        if (err) reject(err);
      });
    } catch (err) {
      reject(err);
    }
  });
}

describe('Carrier Detector (Worldwide AWB Auto-Detection)', () => {
  it('detects UPS 1Z format with high confidence', () => {
    const res = detectCarrier('1Z999AA10123456784');
    assert.equal(res.carrierCode, 'ups');
    assert.equal(res.confidence, 'high');
    assert.equal(res.isInternational, true);
  });

  it('decodes UPU S10 international postal country codes', () => {
    const cn = detectCarrier('EJ492817365CN');
    assert.equal(cn.carrierCode, 'chinapost');
    assert.equal(cn.originCountry, 'China');
    assert.equal(cn.originFlag, '🇨🇳');

    const jp = detectCarrier('RR123456789JP');
    assert.equal(jp.carrierCode, 'japanpost');
    assert.equal(jp.originCountry, 'Japan');
    assert.equal(jp.originFlag, '🇯🇵');

    const gb = detectCarrier('LB987654321GB');
    assert.equal(gb.carrierCode, 'royalmail');
    assert.equal(gb.originCountry, 'United Kingdom');
  });

  it('disambiguates numeric AWB using message context', () => {
    const res = detectCarrier('7829401532', 'Dispatched via Blue Dart Express');
    assert.equal(res.carrierCode, 'bluedart');
    assert.equal(res.confidence, 'high');
  });

  it('detects YunExpress and Cainiao cross-border AWBs', () => {
    assert.equal(detectCarrier('YT2314521272094812').carrierCode, 'yunexpress');
    assert.equal(detectCarrier('LP00548291048291').carrierCode, 'cainiao');
  });
});

describe('Smart Paste Parser', () => {
  it('extracts AWB, carrier, item name, merchant, emoji, and ETA from an SMS', () => {
    const sms =
      'Hi Shrey! Your Sony WH-1000XM5 Headphones from Amazon has shipped via DHL Express. Tracking AWB: 7829401532. Arriving Nov 28. Track at https://amazon.in/track/123';
    const parsed = parseSmartPaste(sms);

    assert.equal(parsed.awb, '7829401532');
    assert.equal(parsed.carrier?.carrierCode, 'dhl');
    assert.equal(parsed.merchant, 'Amazon');
    assert.equal(parsed.itemTitle, 'Sony WH-1000XM5 Headphones');
    assert.equal(parsed.itemCategory, 'electronics');
    assert.equal(parsed.itemEmoji, '🎧');
    assert.equal(parsed.orderUrl, 'https://amazon.in/track/123');
    assert.ok(parsed.estimatedDelivery?.endsWith('-11-28'), `Got ${parsed.estimatedDelivery}`);
  });

  it('ignores order numbers and phone numbers when labeled AWB is present', () => {
    const msg =
      'Order #9876543210 confirmed! Item: Mechanical Keyboard Keycaps from Keychron. AWB: EJ492817365CN. Call +91 9876543210 for help.';
    const parsed = parseSmartPaste(msg);

    assert.equal(parsed.awb, 'EJ492817365CN');
    assert.equal(parsed.carrier?.carrierCode, 'chinapost');
    assert.equal(parsed.merchant, 'Keychron');
    assert.equal(parsed.itemTitle, 'Mechanical Keyboard Keycaps');
    assert.equal(parsed.itemEmoji, '⌨️');
  });
  it('extracts spaced UPU S10 AWBs like LP 107 964 364 JP', () => {
    const parsed = parseSmartPaste('LP 107 964 364 JP');
    assert.equal(parsed.awb, 'LP107964364JP');
    assert.equal(parsed.carrier?.carrierCode, 'japanpost');
    assert.equal(parsed.carrier?.originCountry, 'Japan');
    assert.equal(parsed.carrier?.originFlag, '🇯🇵');
  });
});

describe('Milestone Classifier', () => {
  it('marks customs holds as critical and explains them clearly', () => {
    const ev = classifyTrackingEvent('Held for customs inspection - awaiting KYC documents', 'Mumbai Airport');
    assert.equal(ev.stage, 'customs');
    assert.equal(ev.importance, 'critical');
    assert.match(ev.friendlyTitle, /Customs Hold/i);
  });

  it('marks routine sort hub scans as minor so users are not spammed', () => {
    const ev = classifyTrackingEvent('Processed at regional sorting facility', 'Leipzig Hub');
    assert.equal(ev.stage, 'in_transit');
    assert.equal(ev.importance, 'minor');
  });

  it('marks out for delivery and delivered as important', () => {
    const ofd = classifyTrackingEvent('Out for delivery - with delivery courier', 'Bengaluru');
    assert.equal(ofd.stage, 'out_for_delivery');
    assert.equal(ofd.importance, 'important');

    const del = classifyTrackingEvent('Delivered - signed for by recipient', 'Bengaluru');
    assert.equal(del.stage, 'delivered');
    assert.equal(del.importance, 'important');
  });
});

describe('Free Direct Live Parsers & Carrier Deep-Links', () => {
  it('parses real Japan Post English HTML tables accurately', () => {
    const sampleHtml = `
      <table class="tableType01">
        <tr><td class="w_180">LP 107 964 364 JP</td><td class="w_380">International Air Packet</td><td class="w_100"></td></tr>
      </table>
      <table class="tableType01" summary="履歴情報">
        <tr><th>Date</th><th>Record</th><th>Details</th><th>Office</th><th>Country</th></tr>
        <tr><td rowspan="2">11/07/2026 14:47</td><td rowspan="2">Posting/Collection</td><td rowspan="2"></td><td>OMORI</td><td rowspan="2">TOKYO</td></tr>
        <tr><td>143-8799</td></tr>
        <tr><td rowspan="2">11/09/2026 09:20</td><td rowspan="2">Dispatch from outward office of exchange</td><td rowspan="2"></td><td>TOKYO INT</td><td rowspan="2">TOKYO</td></tr>
        <tr><td>138-8799</td></tr>
        <tr><td rowspan="2">11/17/2026 08:34</td><td rowspan="2">Arrival at inward office of exchange</td><td rowspan="2"></td><td>MUMBAI AIRPORT SORTING OFFICE</td><td rowspan="2">INDIA</td></tr>
        <tr><td>&nbsp;</td></tr>
        <tr><td rowspan="2">11/17/2026 08:39</td><td rowspan="2">Item presented to import Customs</td><td rowspan="2"></td><td>MUMBAI AIRPORT SORTING OFFICE</td><td rowspan="2">INDIA</td></tr>
        <tr><td>&nbsp;</td></tr>
      </table>
    `;
    const parsed = parseJapanPostHtml(sampleHtml);
    assert.equal(parsed.found, true);
    assert.equal(parsed.serviceClass, 'International Air Packet');
    assert.equal(parsed.destinationCountry, 'India');
    assert.equal(parsed.events.length, 4);
    assert.equal(parsed.events[0].description, 'Posting/Collection');
    assert.equal(parsed.events[3].description, 'Item presented to import Customs');

    // Verify UPU Japan Post phrases classify cleanly
    assert.equal(classifyTrackingEvent('Posting/Collection', 'OMORI, TOKYO').friendlyTitle, 'Picked Up & Shipped');
    assert.equal(
      classifyTrackingEvent('Dispatch from outward office of exchange', 'TOKYO INT').friendlyTitle,
      'Departed Origin Country'
    );
    assert.equal(
      classifyTrackingEvent('Arrival at inward office of exchange', 'MUMBAI').friendlyTitle,
      'Arrived in Destination Country'
    );
    assert.equal(
      classifyTrackingEvent('Item presented to import Customs', 'MUMBAI').stage,
      'customs'
    );
  });

  it('parses Cainiao Global JSON tracking responses', () => {
    const parsed = parseCainiaoJson({
      success: true,
      module: [
        {
          mailNo: 'LP00548291048291',
          originCountry: 'China',
          destCountry: 'India',
          detailList: [
            {
              time: 1763000000000,
              standerdDesc: 'Departed from departure country/region',
              location: 'Shenzhen',
            },
          ],
        },
      ],
    });
    assert.equal(parsed.found, true);
    assert.equal(parsed.originCountry, 'China');
    assert.equal(parsed.events.length, 1);
  });

  it('builds pre-filled 1-tap official carrier tracking URLs', () => {
    assert.equal(
      buildCarrierTrackingUrl('japanpost', 'LP 107 964 364 JP'),
      'https://trackings.post.japanpost.jp/services/srv/search/direct?reqCodeNo1=LP107964364JP&locale=en'
    );
    assert.ok(buildCarrierTrackingUrl('dhl', '7829401532').includes('7829401532'));
    assert.ok(buildCarrierTrackingUrl('unknown', 'ABC123456').includes('17track.net'));
  });

  it('orders same-minute Japan Post events deterministically so Customs beats Arrival', () => {
    const store = new AppStore(':memory:');
    try {
      const now = new Date().toISOString();
      store.createParcel({
        id: 'jp-tie-test',
        awb: 'LP107964364JP',
        carrierCode: 'japanpost',
        carrierName: 'Japan Post',
        itemTitle: 'Test JP Parcel',
        itemCategory: 'other',
        itemEmoji: '📦',
        merchant: '',
        itemNotes: '',
        itemImageUrl: '',
        orderUrl: '',
        originCountry: 'Japan',
        originFlag: '🇯🇵',
        destinationCountry: 'India',
        destinationFlag: '🇮🇳',
        status: 'pending',
        statusSummary: '',
        estimatedDelivery: null,
        lastLocation: '',
        lastEventAt: null,
        providerUsed: 'free_direct',
        providerTrackingId: null,
        simulatorStage: -1,
        simulatorRoute: null,
        muted: false,
        archived: false,
        createdAt: now,
        updatedAt: now,
      });

      store.insertEventIfNew({
        parcelId: 'jp-tie-test',
        occurredAt: '2026-11-17T08:34:00.000Z',
        location: 'MUMBAI AIRPORT SORTING OFFICE, INDIA',
        countryCode: 'IN',
        rawDescription: 'Arrival at inward office of exchange',
        friendlyTitle: 'Arrived in Destination Country',
        friendlySummary: 'Landed in India',
        stage: 'in_transit',
        importance: 'important',
      });
      store.insertEventIfNew({
        parcelId: 'jp-tie-test',
        occurredAt: '2026-11-17T08:34:00.000Z',
        location: 'MUMBAI AIRPORT SORTING OFFICE, INDIA',
        countryCode: 'IN',
        rawDescription: 'Item presented to import Customs',
        friendlyTitle: 'In Customs Clearance',
        friendlySummary: 'Presented to import customs',
        stage: 'customs',
        importance: 'important',
      });
      // Repeated customs scan 5 minutes later updates timestamp to 08:39
      store.insertEventIfNew({
        parcelId: 'jp-tie-test',
        occurredAt: '2026-11-17T08:39:00.000Z',
        location: 'MUMBAI AIRPORT SORTING OFFICE, INDIA',
        countryCode: 'IN',
        rawDescription: 'Item presented to import Customs',
        friendlyTitle: 'In Customs Clearance',
        friendlySummary: 'Presented to import customs',
        stage: 'customs',
        importance: 'important',
      });

      const events = store.getEventsForParcel('jp-tie-test');
      assert.equal(events.length, 2);
      assert.equal(events[0].stage, 'customs');
      assert.equal(events[0].occurredAt, '2026-11-17T08:39:00.000Z');
    } finally {
      store.close();
    }
  });
});

describe('REST API & Full Parcel Lifecycle (SQLite in-memory)', () => {
  it('creates parcel, advances simulator milestones, filters minor alerts, syncs renamed titles, and handles webhooks', async () => {
    const store = new AppStore(':memory:');
    store.updateSettings({ activeProvider: 'simulator' });
    const tracker = new TrackerService(store);
    const app = createApp(store, tracker);

    try {
      // 1. Health check
      const health = await invokeApp(app, 'GET', '/api/health');
      assert.equal(health.status, 200);
      assert.equal(health.json.ok, true);

      // 2. Smart Paste endpoint
      const pasted = await invokeApp(app, 'POST', '/api/tools/smart-paste', {
        text: 'Your Leather Backpack from Etsy has shipped via FedEx! AWB: 123456789012',
      });
      assert.equal(pasted.status, 200);
      assert.equal(pasted.json.awb, '123456789012');
      assert.equal(pasted.json.merchant, 'Etsy');
      assert.equal(pasted.json.itemEmoji, '🎒');

      // 3. Drop an AWB + what's coming
      const created = await invokeApp(app, 'POST', '/api/parcels', {
        awb: 'RR445566778JP',
        itemTitle: 'Matcha Tea Gift Set',
        merchant: 'Kyoto Tea Co',
        itemNotes: 'For weekend brunch',
      });
      assert.equal(created.status, 201);
      assert.equal(created.json.parcel.carrierCode, 'japanpost');
      assert.equal(created.json.parcel.originCountry, 'Japan');
      assert.equal(created.json.parcel.itemTitle, 'Matcha Tea Gift Set');
      assert.equal(created.json.parcel.itemEmoji, '🎁');
      assert.ok(created.json.alerts.length >= 1);

      const parcelId = created.json.parcel.id;

      // 4. Advance simulator step by step until delivered
      let delivered = false;
      for (let i = 0; i < 12; i++) {
        const ref = await invokeApp(app, 'POST', `/api/parcels/${parcelId}/refresh`);
        assert.equal(ref.status, 200);
        if (ref.json.parcel.status === 'delivered') {
          delivered = true;
          break;
        }
      }
      assert.equal(delivered, true);

      // Verify important updates include the item name and mute minor routine scans
      const alertsRes = await invokeApp(app, 'GET', '/api/alerts');
      assert.equal(alertsRes.status, 200);
      assert.ok(alertsRes.json.alerts.length >= 3);
      assert.ok(alertsRes.json.alerts.every((a: any) => a.title.includes('Matcha Tea Gift Set')));
      assert.ok(alertsRes.json.alerts.some((a: any) => a.stage === 'delivered'));
      assert.ok(alertsRes.json.alerts.some((a: any) => a.stage === 'out_for_delivery'));
      assert.ok(alertsRes.json.alerts.every((a: any) => a.importance !== 'minor'));

      // 5. Update "what's coming" item nickname and confirm existing alert titles sync too!
      const patched = await invokeApp(app, 'PATCH', `/api/parcels/${parcelId}`, {
        itemTitle: 'Ceremonial Matcha Tin (Kyoto)',
      });
      assert.equal(patched.status, 200);
      assert.equal(patched.json.parcel.itemTitle, 'Ceremonial Matcha Tin (Kyoto)');
      assert.ok(patched.json.parcel.carrierTrackingUrl.includes('RR445566778JP'));

      const syncedAlerts = await invokeApp(app, 'GET', '/api/alerts');
      assert.ok(
        syncedAlerts.json.alerts.every((a: any) => a.title.includes('Ceremonial Matcha Tin (Kyoto)'))
      );

      // 6. Test webhook ingestion (Ship24 format)
      const webhookRes = await invokeApp(app, 'POST', '/api/webhooks/ship24', {
        trackings: [
          {
            tracker: { trackingNumber: 'RR445566778JP' },
            events: [
              {
                occurrenceDatetime: new Date().toISOString(),
                location: 'Mumbai Airport',
                status: 'Customs inspection cleared and released',
                statusMilestone: 'in_transit',
              },
            ],
          },
        ],
      });
      assert.equal(webhookRes.status, 200);
      assert.equal(webhookRes.json.processed, true);

      // 7. Verify settings update works
      const settingsRes = await invokeApp(app, 'PATCH', '/api/settings', {
        defaultDestinationCountry: 'United States',
        notificationRules: { muteMinorHubScans: false },
      });
      assert.equal(settingsRes.status, 200);
      assert.equal(settingsRes.json.settings.defaultDestinationCountry, 'United States');
      assert.equal(settingsRes.json.settings.notificationRules.muteMinorHubScans, false);
    } finally {
      store.close();
    }
  });
});
