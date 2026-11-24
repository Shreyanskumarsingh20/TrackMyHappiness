import {
  AlertItem,
  AppSettings,
  ItemCategory,
  NotificationRules,
  Parcel,
  ParcelStage,
  ProviderApiKeys,
  SimulatedCheckpoint,
  TrackingEvent,
  TrackingProviderId,
} from '../types.js';

export type CreateParcelRecord = Omit<Parcel, 'events' | 'unreadAlertsCount' | 'carrierTrackingUrl'>;

export type UpdateParcelPatch = Partial<{
  carrierCode: string;
  carrierName: string;
  itemTitle: string;
  itemCategory: ItemCategory;
  itemEmoji: string;
  merchant: string;
  itemNotes: string;
  itemImageUrl: string;
  orderUrl: string;
  originCountry: string;
  originFlag: string;
  destinationCountry: string;
  destinationFlag: string;
  status: ParcelStage;
  statusSummary: string;
  estimatedDelivery: string | null;
  lastLocation: string;
  lastEventAt: string | null;
  providerUsed: TrackingProviderId;
  providerTrackingId: string | null;
  simulatorStage: number;
  simulatorRoute: SimulatedCheckpoint[] | null;
  muted: boolean;
  archived: boolean;
}>;

export interface IAppStore {
  readonly storageKind: 'sqlite-local' | 'sqlite-ephemeral' | 'postgres-persistent';
  init(): Promise<void>;
  close(): Promise<void>;
  countParcels(): Promise<number>;
  listParcels(options?: { includeArchived?: boolean }): Promise<Parcel[]>;
  listActiveParcelsForPolling(): Promise<Parcel[]>;
  getParcelById(id: string): Promise<Parcel | null>;
  getParcelByAwb(awb: string): Promise<Parcel | null>;
  createParcel(parcel: CreateParcelRecord): Promise<Parcel>;
  updateParcel(id: string, patch: UpdateParcelPatch): Promise<Parcel | null>;
  deleteParcel(id: string): Promise<boolean>;
  getEventsForParcel(parcelId: string, limit?: number): Promise<TrackingEvent[]>;
  insertEventIfNew(event: Omit<TrackingEvent, 'id' | 'eventHash' | 'createdAt'>): Promise<{
    inserted: boolean;
    event: TrackingEvent | null;
  }>;
  createAlert(input: {
    parcelId: string;
    eventId: string | null;
    importance: TrackingEvent['importance'];
    stage: ParcelStage;
    title: string;
    body: string;
    pushSent: boolean;
  }): Promise<AlertItem>;
  getAlertById(id: string): Promise<AlertItem | null>;
  listAlerts(options?: { importantOnly?: boolean; limit?: number }): Promise<AlertItem[]>;
  getUnreadAlertsCount(): Promise<number>;
  markAlertRead(id: string): Promise<void>;
  markAllAlertsRead(): Promise<void>;
  markParcelAlertsRead(parcelId: string): Promise<void>;
  savePushToken(token: string, platform?: string, deviceName?: string): Promise<void>;
  listPushTokens(): Promise<string[]>;
  getProviderApiKeys(): Promise<ProviderApiKeys>;
  getSettings(): Promise<AppSettings>;
  updateSettings(patch: {
    activeProvider?: TrackingProviderId;
    pollIntervalMinutes?: number;
    defaultDestinationCountry?: string;
    notificationRules?: Partial<NotificationRules>;
    apiKeys?: Partial<ProviderApiKeys>;
  }): Promise<AppSettings>;
}
