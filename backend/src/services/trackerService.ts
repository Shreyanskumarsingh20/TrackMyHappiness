import crypto from 'node:crypto';
import { IAppStore } from '../db/types.js';
import {
  AlertItem,
  ItemCategory,
  Parcel,
  ProviderTrackingResult,
  RawProviderEvent,
  TrackingEvent,
  TrackingProviderId,
} from '../types.js';
import { detectCarrier, getCountryFlag, normalizeAwb, SUPPORTED_CARRIERS } from './carrierDetector.js';
import { buildParcelStatusSummary, classifyTrackingEvent } from './milestoneClassifier.js';
import { NotificationService } from './notificationService.js';
import { freeDirectProvider } from './providers/freeDirectProvider.js';
import { ship24Provider } from './providers/ship24Provider.js';
import { buildSimulatedRoute, simulatorProvider } from './providers/simulatorProvider.js';
import { track17Provider } from './providers/track17Provider.js';
import { trackingMoreProvider } from './providers/trackingMoreProvider.js';
import { TrackingProvider } from './providers/types.js';
import { whereParcelProvider } from './providers/whereParcelProvider.js';
import { CATEGORY_EMOJI, inferCategoryAndEmoji } from './smartPaste.js';

export interface CreateParcelInput {
  awb: string;
  itemTitle: string;
  carrierCode?: string;
  itemCategory?: ItemCategory;
  itemEmoji?: string;
  merchant?: string;
  itemNotes?: string;
  itemImageUrl?: string;
  orderUrl?: string;
  originCountry?: string;
  destinationCountry?: string;
  estimatedDelivery?: string | null;
  hintText?: string;
}

const PROVIDERS: Record<TrackingProviderId, TrackingProvider> = {
  free_direct: freeDirectProvider,
  whereparcel: whereParcelProvider,
  simulator: simulatorProvider,
  '17track': track17Provider,
  ship24: ship24Provider,
  trackingmore: trackingMoreProvider,
};

export class TrackerService {
  private notifications: NotificationService;

  constructor(private store: IAppStore) {
    this.notifications = new NotificationService(store);
  }

  private async getKeyForProvider(id: TrackingProviderId): Promise<string | undefined> {
    const keys = await this.store.getProviderApiKeys();
    if (id === 'simulator') return undefined;
    if (id === 'free_direct') return keys.dhl || undefined;
    return keys[id] || undefined;
  }

  private async resolveActiveProvider(): Promise<{ provider: TrackingProvider; apiKey?: string }> {
    const settings = await this.store.getSettings();
    const chosen = PROVIDERS[settings.activeProvider] ?? freeDirectProvider;
    const apiKey = await this.getKeyForProvider(settings.activeProvider);

    if (chosen.isConfigured(apiKey)) {
      return { provider: chosen, apiKey };
    }
    return { provider: freeDirectProvider, apiKey: await this.getKeyForProvider('free_direct') };
  }

  private async resolveProviderById(
    id: TrackingProviderId
  ): Promise<{ provider: TrackingProvider; apiKey?: string }> {
    const chosen = PROVIDERS[id] ?? freeDirectProvider;
    const apiKey = await this.getKeyForProvider(id);
    if (chosen.isConfigured(apiKey)) {
      return { provider: chosen, apiKey };
    }
    return { provider: freeDirectProvider, apiKey: await this.getKeyForProvider('free_direct') };
  }

  async createParcel(input: CreateParcelInput): Promise<{ parcel: Parcel; alerts: AlertItem[] }> {
    const cleanAwb = normalizeAwb(input.awb);
    if (cleanAwb.length < 6) {
      throw new Error('Please enter a valid AWB / tracking number (at least 6 characters).');
    }

    const detected = detectCarrier(cleanAwb, `${input.hintText ?? ''} ${input.merchant ?? ''}`);
    let carrierCode = detected.carrierCode;
    let carrierName = detected.carrierName;

    if (input.carrierCode && input.carrierCode !== 'auto') {
      const match = SUPPORTED_CARRIERS.find((c) => c.code === input.carrierCode);
      carrierCode = input.carrierCode;
      carrierName = match?.name ?? input.carrierCode.toUpperCase();
    }

    const settings = await this.store.getSettings();
    const destCountry = input.destinationCountry?.trim() || settings.defaultDestinationCountry || 'India';
    const destFlag = getCountryFlag(destCountry);
    const originCountry = input.originCountry?.trim() || detected.originCountry || 'International';
    const originFlag = detected.originFlag || getCountryFlag(originCountry);

    const inferred = inferCategoryAndEmoji(input.itemTitle, input.merchant);
    const itemCategory = input.itemCategory ?? inferred.category;
    const itemEmoji =
      input.itemEmoji?.trim() || (input.itemCategory ? CATEGORY_EMOJI[input.itemCategory] : inferred.emoji);

    const { provider, apiKey } = await this.resolveActiveProvider();

    let trackingResult: ProviderTrackingResult;
    try {
      const regInput = {
        awb: cleanAwb,
        carrierCode,
        carrierName,
        originCountry: originCountry === 'International' ? undefined : originCountry,
        originFlag,
        destinationCountry: destCountry,
        destinationFlag: destFlag,
      };
      trackingResult = await provider.registerAndFetch(regInput, apiKey);

      const wpKey = await this.getKeyForProvider('whereparcel');
      if (provider.id === 'free_direct' && trackingResult.notice && wpKey) {
        try {
          trackingResult = await whereParcelProvider.registerAndFetch(regInput, wpKey);
        } catch {
          // Keep Free Live Direct result if WhereParcel fails
        }
      }
    } catch (err) {
      trackingResult = {
        provider: provider.id,
        carrierCode,
        carrierName,
        originCountry,
        originFlag,
        destinationCountry: destCountry,
        destinationFlag: destFlag,
        estimatedDelivery: input.estimatedDelivery ?? null,
        events: [
          {
            occurredAt: new Date().toISOString(),
            location: originCountry,
            description: `AWB registered (${err instanceof Error ? err.message : 'awaiting first carrier sync'})`,
            stageHint: 'pending',
          },
        ],
        simulatorStage: provider.id === 'simulator' ? 0 : -1,
      };
    }

    const now = new Date().toISOString();
    const parcelId = crypto.randomUUID();
    const created = await this.store.createParcel({
      id: parcelId,
      awb: cleanAwb,
      carrierCode: trackingResult.carrierCode || carrierCode,
      carrierName: trackingResult.carrierName || carrierName,
      itemTitle: input.itemTitle.trim() || `Parcel ${cleanAwb.slice(-6)}`,
      itemCategory,
      itemEmoji,
      merchant: input.merchant?.trim() || '',
      itemNotes: input.itemNotes?.trim() || '',
      itemImageUrl: input.itemImageUrl?.trim() || '',
      orderUrl: input.orderUrl?.trim() || '',
      originCountry: trackingResult.originCountry || originCountry,
      originFlag: trackingResult.originFlag || originFlag,
      destinationCountry: trackingResult.destinationCountry || destCountry,
      destinationFlag: trackingResult.destinationFlag || destFlag,
      status: 'pending',
      statusSummary: 'Tracking registered — fetching latest updates',
      estimatedDelivery: input.estimatedDelivery ?? trackingResult.estimatedDelivery ?? null,
      lastLocation: '',
      lastEventAt: null,
      providerUsed: trackingResult.provider,
      providerTrackingId: trackingResult.providerTrackingId ?? null,
      simulatorStage: trackingResult.simulatorStage ?? -1,
      simulatorRoute: trackingResult.simulatorRoute ?? null,
      muted: false,
      archived: false,
      createdAt: now,
      updatedAt: now,
    });

    const alerts = await this.ingestEvents(created, trackingResult, { onlyAlertLatest: true });
    return { parcel: (await this.store.getParcelById(parcelId))!, alerts };
  }

  async refreshParcel(parcelId: string): Promise<{ parcel: Parcel; newEvents: TrackingEvent[]; alerts: AlertItem[] }> {
    const parcel = await this.store.getParcelById(parcelId);
    if (!parcel) throw new Error('Parcel not found');

    const activeSettings = await this.store.getSettings();
    const shouldUpgradeToLive =
      parcel.providerUsed === 'simulator' &&
      activeSettings.activeProvider !== 'simulator' &&
      activeSettings.configuredProviders[activeSettings.activeProvider];

    const { provider, apiKey } = shouldUpgradeToLive
      ? await this.resolveActiveProvider()
      : await this.resolveProviderById(parcel.providerUsed);

    const trackingResult = shouldUpgradeToLive
      ? await provider.registerAndFetch(
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
        )
      : await provider.fetchUpdates(parcel, apiKey);

    if (shouldUpgradeToLive) {
      await this.store.updateParcel(parcel.id, {
        providerUsed: trackingResult.provider,
        providerTrackingId: trackingResult.providerTrackingId ?? null,
        simulatorStage: -1,
        simulatorRoute: null,
      });
    }

    const { newEvents, alerts } = await this.ingestEventsDetailed(parcel, trackingResult, {
      onlyAlertLatest: false,
    });

    return {
      parcel: (await this.store.getParcelById(parcelId))!,
      newEvents,
      alerts,
    };
  }

  async refreshAllActive(): Promise<{ checked: number; newAlerts: number }> {
    const active = await this.store.listActiveParcelsForPolling();
    let newAlerts = 0;
    for (const parcel of active) {
      try {
        const res = await this.refreshParcel(parcel.id);
        newAlerts += res.alerts.length;
      } catch (err) {
        console.warn(`[TrackerService] Failed polling ${parcel.awb}:`, err);
      }
    }
    return { checked: active.length, newAlerts };
  }

  async handleWebhook(
    providerId: TrackingProviderId,
    payload: unknown
  ): Promise<{ processed: boolean; awb?: string; alertsCreated?: number }> {
    const provider = PROVIDERS[providerId];
    if (!provider?.parseWebhook) return { processed: false };

    const parsed = provider.parseWebhook(payload);
    if (!parsed) return { processed: false };

    const parcel = await this.store.getParcelByAwb(normalizeAwb(parsed.awb));
    if (!parcel) return { processed: false, awb: parsed.awb };

    const { alerts } = await this.ingestEventsDetailed(
      parcel,
      {
        provider: providerId,
        estimatedDelivery: parsed.estimatedDelivery,
        events: parsed.events,
      },
      { onlyAlertLatest: false }
    );

    return { processed: true, awb: parcel.awb, alertsCreated: alerts.length };
  }

  private async ingestEvents(
    parcel: Parcel,
    result: ProviderTrackingResult,
    options: { onlyAlertLatest: boolean; suppressPush?: boolean }
  ): Promise<AlertItem[]> {
    const { alerts } = await this.ingestEventsDetailed(parcel, result, options);
    return alerts;
  }

  private async ingestEventsDetailed(
    parcel: Parcel,
    result: ProviderTrackingResult,
    options: { onlyAlertLatest: boolean; suppressPush?: boolean }
  ): Promise<{ newEvents: TrackingEvent[]; alerts: AlertItem[] }> {
    const sortedRaw = [...result.events].sort(
      (a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime()
    );

    const newEvents: TrackingEvent[] = [];
    for (const raw of sortedRaw) {
      const classified = classifyTrackingEvent(raw.description, raw.location, raw.stageHint);
      const res = await this.store.insertEventIfNew({
        parcelId: parcel.id,
        occurredAt: raw.occurredAt,
        location: raw.location,
        countryCode: raw.countryCode ?? null,
        rawDescription: raw.description,
        friendlyTitle: classified.friendlyTitle,
        friendlySummary: classified.friendlySummary,
        stage: classified.stage,
        importance: classified.importance,
      });
      if (res.inserted && res.event) {
        newEvents.push(res.event);
      }
    }

    const allEvents = await this.store.getEventsForParcel(parcel.id);
    const latest = allEvents[0];
    const nextEta = result.estimatedDelivery !== undefined ? result.estimatedDelivery : parcel.estimatedDelivery;

    const updatedParcel = (await this.store.updateParcel(parcel.id, {
      carrierCode: result.carrierCode || parcel.carrierCode,
      carrierName: result.carrierName || parcel.carrierName,
      originCountry: result.originCountry || parcel.originCountry,
      originFlag: result.originFlag || parcel.originFlag,
      destinationCountry: result.destinationCountry || parcel.destinationCountry,
      destinationFlag: result.destinationFlag || parcel.destinationFlag,
      estimatedDelivery: nextEta,
      status: latest ? latest.stage : parcel.status,
      statusSummary: latest
        ? buildParcelStatusSummary(latest.stage, latest.friendlyTitle, latest.location, nextEta)
        : parcel.statusSummary,
      lastLocation: latest ? latest.location : parcel.lastLocation,
      lastEventAt: latest ? latest.occurredAt : parcel.lastEventAt,
      simulatorStage: result.simulatorStage !== undefined ? result.simulatorStage : parcel.simulatorStage,
      simulatorRoute: result.simulatorRoute !== undefined ? result.simulatorRoute : parcel.simulatorRoute,
    }))!;

    const eventsToNotify =
      options.onlyAlertLatest && newEvents.length > 0 ? [newEvents[newEvents.length - 1]] : newEvents;

    const alerts: AlertItem[] = [];
    for (const ev of eventsToNotify) {
      const alert = await this.notifications.emitUpdateIfImportant(updatedParcel, ev, {
        suppressPush: options.suppressPush,
      });
      if (alert) alerts.push(alert);
    }

    return { newEvents, alerts };
  }

  async seedWelcomeParcelsIfEmpty(): Promise<void> {
    if ((await this.store.countParcels()) > 0) return;

    const settings = await this.store.getSettings();
    const destCountry = settings.defaultDestinationCountry || 'India';
    const destFlag = getCountryFlag(destCountry);

    const samples: Array<{
      awb: string;
      carrierCode: string;
      carrierName: string;
      itemTitle: string;
      itemCategory: ItemCategory;
      itemEmoji: string;
      merchant: string;
      itemNotes: string;
      originCountry: string;
      originFlag: string;
      targetStage: number;
    }> = [
      {
        awb: '7829401532',
        carrierCode: 'dhl',
        carrierName: 'DHL Express',
        itemTitle: 'Sony WH-1000XM5 Headphones',
        itemCategory: 'electronics',
        itemEmoji: '🎧',
        merchant: 'Amazon Japan',
        itemNotes: 'Midnight Blue — includes hard travel case',
        originCountry: 'Japan',
        originFlag: '🇯🇵',
        targetStage: 8,
      },
      {
        awb: 'EJ492817365CN',
        carrierCode: 'chinapost',
        carrierName: 'China Post EMS',
        itemTitle: 'Keychron Q1 Mechanical Keyboard & Keycaps',
        itemCategory: 'electronics',
        itemEmoji: '⌨️',
        merchant: 'Keychron Official',
        itemNotes: 'Custom PBT keycap set + tactile switches for desk setup',
        originCountry: 'China',
        originFlag: '🇨🇳',
        targetStage: 5,
      },
      {
        awb: '1Z999AA10123456784',
        carrierCode: 'ups',
        carrierName: 'UPS',
        itemTitle: 'Nike Air Max Sneakers (Size 9)',
        itemCategory: 'fashion',
        itemEmoji: '👟',
        merchant: 'Nike US',
        itemNotes: 'Gift box included — birthday surprise',
        originCountry: 'United States',
        originFlag: '🇺🇸',
        targetStage: 2,
      },
    ];

    for (const s of samples) {
      const { route } = buildSimulatedRoute({
        awb: s.awb,
        carrierCode: s.carrierCode,
        carrierName: s.carrierName,
        originCountry: s.originCountry,
        originFlag: s.originFlag,
        destinationCountry: destCountry,
        destinationFlag: destFlag,
      });

      const clampedStage = Math.min(s.targetStage, route.length - 1);
      const anchorStartMs = Date.now() - route[clampedStage].hoursOffsetFromStart * 3600_000;
      const rawEvents: RawProviderEvent[] = route.slice(0, clampedStage + 1).map((cp) => ({
        occurredAt: new Date(anchorStartMs + cp.hoursOffsetFromStart * 3600_000).toISOString(),
        location: cp.location,
        countryCode: cp.countryCode,
        description: cp.rawDescription,
        stageHint: cp.stage,
      }));

      const daysLeft = Math.max(0, Math.ceil((route.length - 1 - clampedStage) * 0.7));
      const eta = new Date(Date.now() + daysLeft * 86400_000).toISOString().slice(0, 10);
      const now = new Date().toISOString();
      const id = crypto.randomUUID();

      const parcel = await this.store.createParcel({
        id,
        awb: s.awb,
        carrierCode: s.carrierCode,
        carrierName: s.carrierName,
        itemTitle: s.itemTitle,
        itemCategory: s.itemCategory,
        itemEmoji: s.itemEmoji,
        merchant: s.merchant,
        itemNotes: s.itemNotes,
        itemImageUrl: '',
        orderUrl: '',
        originCountry: s.originCountry,
        originFlag: s.originFlag,
        destinationCountry: destCountry,
        destinationFlag: destFlag,
        status: 'pending',
        statusSummary: '',
        estimatedDelivery: eta,
        lastLocation: '',
        lastEventAt: null,
        providerUsed: 'simulator',
        providerTrackingId: `sim_${s.awb}`,
        simulatorStage: clampedStage,
        simulatorRoute: route,
        muted: false,
        archived: false,
        createdAt: now,
        updatedAt: now,
      });

      await this.ingestEvents(
        parcel,
        {
          provider: 'simulator',
          estimatedDelivery: eta,
          events: rawEvents,
          simulatorStage: clampedStage,
          simulatorRoute: route,
        },
        { onlyAlertLatest: true, suppressPush: true }
      );
    }
  }
}
