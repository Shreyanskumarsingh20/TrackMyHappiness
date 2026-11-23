export type ParcelStage =
  | 'pending'
  | 'info_received'
  | 'in_transit'
  | 'customs'
  | 'out_for_delivery'
  | 'delivered'
  | 'exception'
  | 'expired';

export type EventImportance = 'critical' | 'important' | 'minor';

export type TrackingProviderId =
  | 'free_direct'
  | 'whereparcel'
  | 'simulator'
  | '17track'
  | 'ship24'
  | 'trackingmore';

export type ItemCategory =
  | 'electronics'
  | 'fashion'
  | 'home'
  | 'beauty'
  | 'books'
  | 'gift'
  | 'food'
  | 'health'
  | 'hobby'
  | 'other';

export interface TrackingEvent {
  id: string;
  parcelId: string;
  occurredAt: string;
  location: string;
  countryCode: string | null;
  rawDescription: string;
  friendlyTitle: string;
  friendlySummary: string;
  stage: ParcelStage;
  importance: EventImportance;
  createdAt: string;
}

export interface Parcel {
  id: string;
  awb: string;
  carrierCode: string;
  carrierName: string;
  carrierTrackingUrl: string;
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
  simulatorStage: number;
  muted: boolean;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  events?: TrackingEvent[];
  unreadAlertsCount?: number;
}

export interface AlertItem {
  id: string;
  parcelId: string;
  parcelTitle: string;
  parcelEmoji: string;
  parcelAwb: string;
  carrierName: string;
  eventId: string | null;
  importance: EventImportance;
  stage: ParcelStage;
  title: string;
  body: string;
  isRead: boolean;
  pushSent: boolean;
  createdAt: string;
}

export interface NotificationRules {
  notifyOnShipped: boolean;
  notifyOnInternationalArrival: boolean;
  notifyOnCustoms: boolean;
  notifyOnOutForDelivery: boolean;
  notifyOnDelivered: boolean;
  notifyOnException: boolean;
  muteMinorHubScans: boolean;
}

export interface AppSettings {
  activeProvider: TrackingProviderId;
  pollIntervalMinutes: number;
  defaultDestinationCountry: string;
  notificationRules: NotificationRules;
  configuredProviders: {
    free_direct: boolean;
    whereparcel: boolean;
    dhl: boolean;
    simulator: boolean;
    '17track': boolean;
    ship24: boolean;
    trackingmore: boolean;
  };
}

export interface CarrierDetectionResult {
  carrierCode: string;
  carrierName: string;
  confidence: 'high' | 'medium' | 'low';
  originCountry?: string;
  originFlag?: string;
  isInternational: boolean;
  reason: string;
}

export interface SmartPasteResult {
  awb: string | null;
  allCandidateAwbs: string[];
  carrier: CarrierDetectionResult | null;
  itemTitle: string | null;
  merchant: string | null;
  itemCategory: ItemCategory;
  itemEmoji: string;
  orderUrl: string | null;
  estimatedDelivery: string | null;
  notes: string | null;
}

export interface CarrierOption {
  code: string;
  name: string;
}
